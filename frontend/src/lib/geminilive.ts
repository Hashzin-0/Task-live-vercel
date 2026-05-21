export enum MultimodalLiveResponseType {
  TEXT = "TEXT",
  AUDIO = "AUDIO",
  SETUP_COMPLETE = "SETUP COMPLETE",
  INTERRUPTED = "INTERRUPTED",
  TURN_COMPLETE = "TURN COMPLETE",
  TOOL_CALL = "TOOL_CALL",
  ERROR = "ERROR",
  INPUT_TRANSCRIPTION = "INPUT_TRANSCRIPTION",
  OUTPUT_TRANSCRIPTION = "OUTPUT_TRANSCRIPTION",
}

export interface TranscriptionData {
  text: string
  finished: boolean
}

export interface ResponseMessage {
  type: MultimodalLiveResponseType
  data: any
  endOfTurn: boolean
}

export interface FunctionCallArg {
  name: string
  id?: string
  args?: Record<string, any>
}

export interface FunctionCallDefinition {
  name: string
  description: string
  parameters: Record<string, any>
  requiredParameters?: string[]
}

export interface FunctionResponse {
  id?: string
  name: string
  response: { result?: any; error?: string }
}

export interface ActivityDetectionConfig {
  disabled: boolean
  silence_duration_ms: number
  prefix_padding_ms: number
  end_of_speech_sensitivity: string
  start_of_speech_sensitivity: string
}

function parseResponseMessages(data: any): ResponseMessage[] {
  const responses: ResponseMessage[] = []
  const serverContent = data?.serverContent
  const parts = serverContent?.modelTurn?.parts

  try {
    if (data?.setupComplete) {
      responses.push({ type: MultimodalLiveResponseType.SETUP_COMPLETE, data: "", endOfTurn: false })
      return responses
    }

    if (data?.toolCall) {
      responses.push({ type: MultimodalLiveResponseType.TOOL_CALL, data: data.toolCall, endOfTurn: false })
      return responses
    }

    if (parts?.length) {
      for (const part of parts) {
        if (part.inlineData) {
          responses.push({ type: MultimodalLiveResponseType.AUDIO, data: part.inlineData.data, endOfTurn: false })
        } else if (part.text) {
          responses.push({ type: MultimodalLiveResponseType.TEXT, data: part.text, endOfTurn: false })
        }
      }
    }

    if (serverContent?.inputTranscription) {
      responses.push({
        type: MultimodalLiveResponseType.INPUT_TRANSCRIPTION,
        data: { text: serverContent.inputTranscription.text || "", finished: serverContent.inputTranscription.finished || false },
        endOfTurn: false,
      })
    }

    if (serverContent?.outputTranscription) {
      responses.push({
        type: MultimodalLiveResponseType.OUTPUT_TRANSCRIPTION,
        data: { text: serverContent.outputTranscription.text || "", finished: serverContent.outputTranscription.finished || false },
        endOfTurn: false,
      })
    }

    if (serverContent?.interrupted) {
      responses.push({ type: MultimodalLiveResponseType.INTERRUPTED, data: "", endOfTurn: false })
    }

    if (serverContent?.turnComplete) {
      responses.push({ type: MultimodalLiveResponseType.TURN_COMPLETE, data: "", endOfTurn: true })
    }
  } catch (err) {
    console.log("Error parsing response data: ", err, data)
  }

  return responses
}

export class GeminiLiveAPI {
  token: string
  model: string
  modelUri: string
  responseModalities: string[] = ["AUDIO"]
  systemInstructions = ""
  baseSystemInstructions = ""
  googleGrounding = false
  voiceName = "Puck"
  temperature = 1.0
  isWhisperMode = false
  isThinkingMode = false
  inputAudioTranscription = false
  outputAudioTranscription = false
  enableFunctionCalls = false
  functions: any[] = []
  functionsMap: Record<string, any> = {}
  previousImage: string | null = null
  totalBytesSent = 0

  automaticActivityDetection: ActivityDetectionConfig = {
    disabled: false,
    silence_duration_ms: 2000,
    prefix_padding_ms: 500,
    end_of_speech_sensitivity: "END_SENSITIVITY_UNSPECIFIED",
    start_of_speech_sensitivity: "START_SENSITIVITY_UNSPECIFIED",
  }

  activityHandling = "ACTIVITY_HANDLING_UNSPECIFIED"

  serviceUrl: string
  connected = false
  webSocket: WebSocket | null = null
  lastSetupMessage: any = null

  onReceiveResponse: (message: ResponseMessage) => void = () => {}
  onOpen: () => void = () => {}
  onClose: () => void = () => {}
  onError: (message: string) => void = () => {}

  constructor(token: string, model: string) {
    this.token = token
    this.model = model
    this.modelUri = `models/${this.model}`
    this.serviceUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${this.token}`
  }

  setProjectId(_projectId: string) {}

  setSystemInstructions(newInstructions: string) {
    this.systemInstructions = newInstructions
  }

  setGoogleGrounding(enabled: boolean) {
    this.googleGrounding = enabled
  }

  setResponseModalities(modalities: string[]) {
    this.responseModalities = modalities
  }

  setVoice(voiceName: string) {
    this.voiceName = voiceName
    if (this.connected) {
      this.sendSessionUpdate({
        generationConfig: {
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      })
    }
  }

  sendSessionUpdate(updateConfig: Record<string, any>) {
    this.sendMessage({ session_update: updateConfig })
  }

  setWhisperMode(enabled: boolean) {
    const whisperPrompt = "\n\nIMPORTANT: You must speak in a whisper, very quietly and softly, as if trying not to be overheard. Keep your voice low and gentle at all times."
    this.systemInstructions = enabled ? this.baseSystemInstructions + whisperPrompt : this.baseSystemInstructions
    this.isWhisperMode = enabled
    if (this.connected) {
      this.sendSessionUpdate({
        systemInstruction: { parts: [{ text: this.systemInstructions }] },
      })
    }
  }

  setThinkingMode(enabled: boolean, budget = 1024) {
    this.isThinkingMode = enabled
    if (this.connected) {
      this.sendSessionUpdate({
        generationConfig: {
          thinkingConfig: { thinkingBudget: enabled ? budget : 0 },
        },
      })
    }
  }

  setInputAudioTranscription(enabled: boolean) {
    this.inputAudioTranscription = enabled
  }

  setOutputAudioTranscription(enabled: boolean) {
    this.outputAudioTranscription = enabled
  }

  setEnableFunctionCalls(enabled: boolean) {
    this.enableFunctionCalls = enabled
  }

  addFunction(newFunction: any) {
    this.functions.push(newFunction)
    this.functionsMap[newFunction.name] = newFunction
  }

  callFunction(functionName: string, parameters: any) {
    return this.functionsMap[functionName]?.runFunction(parameters)
  }

  connect() {
    this.setupWebSocketToService()
  }

  disconnect() {
    if (this.webSocket) {
      this.webSocket.close()
      this.connected = false
    }
  }

  sendMessage(message: any) {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(message))
    }
  }

  private async onReceiveMessage(messageEvent: MessageEvent) {
    let jsonData: string
    if (messageEvent.data instanceof Blob) {
      jsonData = await messageEvent.data.text()
    } else if (messageEvent.data instanceof ArrayBuffer) {
      jsonData = new TextDecoder().decode(messageEvent.data)
    } else {
      jsonData = messageEvent.data
    }

    try {
      const messageData = JSON.parse(jsonData)
      const responses = parseResponseMessages(messageData)
      for (const response of responses) {
        this.onReceiveResponse(response)
      }
    } catch (err) {
      console.error("Error parsing JSON message:", err, jsonData)
    }
  }

  private setupWebSocketToService() {
    this.webSocket = new WebSocket(this.serviceUrl)

    this.webSocket.onclose = () => {
      this.connected = false
      this.onClose()
    }

    this.webSocket.onerror = () => {
      this.connected = false
      this.onError("Connection error")
    }

    this.webSocket.onopen = () => {
      this.connected = true
      this.totalBytesSent = 0
      this.sendInitialSetupMessages()
      this.onOpen()
    }

    this.webSocket.onmessage = this.onReceiveMessage.bind(this)
  }

  private getFunctionDefinitions() {
    return this.functions.map((f: any) => f.getDefinition())
  }

  private sendInitialSetupMessages() {
    const tools = this.getFunctionDefinitions()

    const sessionSetupMessage: any = {
      setup: {
        model: this.modelUri,
        generationConfig: {
          responseModalities: this.responseModalities,
          temperature: this.temperature,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: this.voiceName },
            },
          },
        },
        systemInstruction: { parts: [{ text: this.systemInstructions }] },
        tools: [{ functionDeclarations: tools }],
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: this.automaticActivityDetection.disabled,
            silenceDurationMs: this.automaticActivityDetection.silence_duration_ms,
            prefixPaddingMs: this.automaticActivityDetection.prefix_padding_ms,
            endOfSpeechSensitivity: this.automaticActivityDetection.end_of_speech_sensitivity,
            startOfSpeechSensitivity: this.automaticActivityDetection.start_of_speech_sensitivity,
          },
          activityHandling: this.activityHandling,
          turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
        },
      },
    }

    if (this.inputAudioTranscription) {
      sessionSetupMessage.setup.inputAudioTranscription = {}
    }
    if (this.outputAudioTranscription) {
      sessionSetupMessage.setup.outputAudioTranscription = {}
    }
    if (this.googleGrounding) {
      sessionSetupMessage.setup.tools = [{ google_search: {} }]
    }

    this.lastSetupMessage = sessionSetupMessage
    this.sendMessage(sessionSetupMessage)
  }

  sendTextMessage(text: string) {
    this.sendMessage({ realtimeInput: { text } })
  }

  sendToolResponse(functionResponses: FunctionResponse[]) {
    this.sendMessage({ toolResponse: { functionResponses } })
  }

  sendRealtimeInputMessage(data: string, mimeType: string) {
    const blob = { mimeType, data }
    const message: any = { realtimeInput: {} }
    if (mimeType.startsWith("audio/")) {
      message.realtimeInput.audio = blob
    } else if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) {
      message.realtimeInput.video = blob
    }
    this.sendMessage(message)
    this.addToBytesSent(data)
  }

  private addToBytesSent(data: string) {
    this.totalBytesSent += new TextEncoder().encode(data).length
  }

  getBytesSent() {
    return this.totalBytesSent
  }

  sendAudioMessage(base64PCM: string) {
    this.sendRealtimeInputMessage(base64PCM, "audio/pcm")
  }

  sendImageMessage(base64Image: string, mimeType = "image/jpeg") {
    this.sendRealtimeInputMessage(base64Image, mimeType)
  }
}
