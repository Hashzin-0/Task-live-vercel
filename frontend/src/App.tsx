import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { GeminiLiveAPI, MultimodalLiveResponseType, type ResponseMessage } from "./lib/geminilive"
import { AudioStreamer, VideoStreamer, ScreenCapture, AudioPlayer } from "./lib/mediaUtils"
import { ShowAlertTool, AddCSSStyleTool } from "./lib/tools"
import ApiConfigSection from "./components/ApiConfigSection"
import MediaControls from "./components/MediaControls"
import Chat from "./components/Chat"

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState("Not connected")
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<{ text: string; type: string }[]>([])
  const [debugInfo, setDebugInfo] = useState("Ready to connect...")
  const [setupJson, setSetupJson] = useState<string | null>(null)
  const [isAudioStreaming, setIsAudioStreaming] = useState(false)
  const [isVideoStreaming, setIsVideoStreaming] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const clientRef = useRef<GeminiLiveAPI | null>(null)
  const audioStreamerRef = useRef<AudioStreamer | null>(null)
  const audioPlayerRef = useRef<AudioPlayer | null>(null)
  const videoStreamerRef = useRef<VideoStreamer | null>(null)
  const screenCaptureRef = useRef<ScreenCapture | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)

  const [settings, setSettings] = useState({
    model: "gemini-2.5-flash-native-audio-latest",
    systemInstructions: "You are a helpful assistant. Be concise and friendly.",
    voice: "Puck",
    temperature: 1.0,
    enableGrounding: false,
    enableWhisper: false,
    enableThinking: false,
    enableAlertTool: true,
    enableCssStyleTool: true,
    enableInputTranscription: true,
    enableOutputTranscription: true,
    disableActivityDetection: false,
    silenceDuration: 500,
    prefixPadding: 500,
    endSpeechSensitivity: "END_SENSITIVITY_UNSPECIFIED",
    startSpeechSensitivity: "START_SENSITIVITY_UNSPECIFIED",
    activityHandling: "ACTIVITY_HANDLING_UNSPECIFIED",
    volume: 80,
  })

  const addMessage = useCallback((text: string, type: string) => {
    setMessages((prev) => [...prev, { text, type }])
  }, [])

  const updateDebug = useCallback((text: string) => {
    setDebugInfo(text)
  }, [])

  const detectVoiceCommands = useCallback(
    (text: string) => {
      if (!clientRef.current?.connected) return
      const t = text.toLowerCase()
      const c = clientRef.current

      if (/\b(whisper|sussurr|fala baixo|speak quiet|quiet mode|soft voice|fala baixinho)\b/i.test(t) && !c.isWhisperMode) {
        c.setWhisperMode(true)
        setSettings((s) => ({ ...s, enableWhisper: true }))
        addMessage("[Whisper mode activated by voice]", "system")
      } else if (/\b(stop whispering|normal voice|fala normal|para de sussurr|normal mode|no whisper)\b/i.test(t) && c.isWhisperMode) {
        c.setWhisperMode(false)
        setSettings((s) => ({ ...s, enableWhisper: false }))
        addMessage("[Normal voice restored by voice]", "system")
      }

      if (/\b(think|pensar|deep thought|raciocínio|complex question|hard question|modo pensar)\b/i.test(t) && !c.isThinkingMode) {
        c.setThinkingMode(true)
        setSettings((s) => ({ ...s, enableThinking: true }))
        addMessage("[Thinking mode activated by voice]", "system")
      } else if (/\b(stop thinking|normal mode|para de pensar|no thinking|quick answer|resposta rápida)\b/i.test(t) && c.isThinkingMode) {
        c.setThinkingMode(false)
        setSettings((s) => ({ ...s, enableThinking: false }))
        addMessage("[Thinking mode deactivated by voice]", "system")
      }
    },
    [addMessage]
  )

  const handleMessage = useCallback(
    (message: ResponseMessage) => {
      updateDebug(`Message: ${message.type}`)

      switch (message.type) {
        case MultimodalLiveResponseType.TEXT:
          addMessage(message.data, "assistant")
          break

        case MultimodalLiveResponseType.AUDIO:
          audioPlayerRef.current?.play(message.data)
          break

        case MultimodalLiveResponseType.INPUT_TRANSCRIPTION:
          if (message.data.text) detectVoiceCommands(message.data.text)
          if (!message.data.finished) {
            addMessage(message.data.text, "user-transcript")
          }
          break

        case MultimodalLiveResponseType.OUTPUT_TRANSCRIPTION:
          if (!message.data.finished) {
            addMessage(message.data.text, "assistant")
          }
          break

        case MultimodalLiveResponseType.SETUP_COMPLETE:
          addMessage("Ready!", "system")
          if (clientRef.current?.lastSetupMessage) {
            setSetupJson(JSON.stringify(clientRef.current.lastSetupMessage, null, 2))
          }
          break

        case MultimodalLiveResponseType.TOOL_CALL:
          const functionCalls = message.data.functionCalls
          const responses: { id?: string; name: string; response: Record<string, any> }[] = []
          for (const fc of functionCalls) {
            try {
              const result = clientRef.current?.callFunction(fc.name, fc.args)
              responses.push({ id: fc.id, name: fc.name, response: { result: result ?? "ok" } })
            } catch (err: any) {
              responses.push({ id: fc.id, name: fc.name, response: { error: err.message } })
            }
          }
          clientRef.current?.sendToolResponse(responses)
          break

        case MultimodalLiveResponseType.TURN_COMPLETE:
          updateDebug("Turn complete")
          break

        case MultimodalLiveResponseType.INTERRUPTED:
          addMessage("[Interrupted]", "system")
          audioPlayerRef.current?.interrupt()
          break
      }
    },
    [addMessage, updateDebug, detectVoiceCommands]
  )

  const connect = useCallback(async () => {
    try {
      setConnectionStatus("Fetching ephemeral token...")
      const response = await fetch("/api/token", { method: "POST" })
      if (!response.ok) throw new Error(`Failed to fetch token: ${response.statusText}`)
      const { token } = await response.json()

      setConnectionStatus("Connecting...")
      const client = new GeminiLiveAPI(token, settings.model)

      client.baseSystemInstructions = settings.systemInstructions
      client.systemInstructions = settings.systemInstructions
      client.inputAudioTranscription = settings.enableInputTranscription
      client.outputAudioTranscription = settings.enableOutputTranscription
      client.googleGrounding = settings.enableGrounding
      client.responseModalities = ["AUDIO"]
      client.voiceName = settings.voice
      client.temperature = settings.temperature

      client.automaticActivityDetection = {
        disabled: settings.disableActivityDetection,
        silence_duration_ms: settings.silenceDuration,
        prefix_padding_ms: settings.prefixPadding,
        end_of_speech_sensitivity: settings.endSpeechSensitivity,
        start_of_speech_sensitivity: settings.startSpeechSensitivity,
      }

      client.activityHandling = settings.activityHandling

      if (!settings.enableGrounding) {
        if (settings.enableAlertTool) {
          client.addFunction(new ShowAlertTool())
        }
        if (settings.enableCssStyleTool) {
          client.addFunction(new AddCSSStyleTool())
        }
      }

      client.onReceiveResponse = handleMessage
      client.onError = (err) => {
        setConnectionStatus("Error: " + err)
        updateDebug("Error: " + err)
      }
      client.onClose = () => {
        setConnectionStatus("Disconnected")
        setIsConnected(false)
        disconnect()
      }

      client.onOpen = () => {
        setConnectionStatus("Connected")
        setIsConnected(true)
        if (settings.enableWhisper) client.setWhisperMode(true)
        if (settings.enableThinking) client.setThinkingMode(true)
      }

      clientRef.current = client
      client.connect()

      audioStreamerRef.current = new AudioStreamer(client)
      videoStreamerRef.current = new VideoStreamer(client)
      screenCaptureRef.current = new ScreenCapture(client)
      audioPlayerRef.current = new AudioPlayer()
      await audioPlayerRef.current.init()

      updateDebug("Connected successfully")
    } catch (error: any) {
      setConnectionStatus("Connection failed: " + error.message)
      updateDebug("Error: " + error.message)
    }
  }, [settings, handleMessage, updateDebug])

  const disconnect = useCallback(() => {
    clientRef.current?.webSocket?.close()
    clientRef.current = null
    audioStreamerRef.current?.stop()
    videoStreamerRef.current?.stop()
    screenCaptureRef.current?.stop()
    audioPlayerRef.current?.destroy()
    setIsAudioStreaming(false)
    setIsVideoStreaming(false)
    setIsScreenSharing(false)
    setConnectionStatus("Disconnected")
    setIsConnected(false)
  }, [])

  const toggleAudio = useCallback(async () => {
    if (!isAudioStreaming) {
      try {
        if (audioStreamerRef.current) {
          await audioStreamerRef.current.start()
          setIsAudioStreaming(true)
          addMessage("[Microphone on]", "system")
        }
      } catch (err: any) {
        addMessage("[Audio error: " + err.message + "]", "system")
      }
    } else {
      audioStreamerRef.current?.stop()
      setIsAudioStreaming(false)
      addMessage("[Microphone off]", "system")
    }
  }, [isAudioStreaming, addMessage])

  const toggleVideo = useCallback(async () => {
    if (!isVideoStreaming) {
      try {
        if (videoStreamerRef.current) {
          const video = await videoStreamerRef.current.start()
          if (videoPreviewRef.current && video) {
            videoPreviewRef.current.srcObject = video.srcObject
            videoPreviewRef.current.hidden = false
          }
          setIsVideoStreaming(true)
          addMessage("[Camera on]", "system")
        }
      } catch (err: any) {
        addMessage("[Video error: " + err.message + "]", "system")
      }
    } else {
      videoStreamerRef.current?.stop()
      setIsVideoStreaming(false)
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null
        videoPreviewRef.current.hidden = true
      }
      addMessage("[Camera off]", "system")
    }
  }, [isVideoStreaming, addMessage])

  const toggleScreen = useCallback(async () => {
    if (!isScreenSharing) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        addMessage("[Screen share not available: requires HTTPS or localhost]", "system")
        return
      }
      try {
        if (screenCaptureRef.current) {
          const video = await screenCaptureRef.current.start()
          if (videoPreviewRef.current && video) {
            videoPreviewRef.current.srcObject = video.srcObject
            videoPreviewRef.current.hidden = false
          }
          setIsScreenSharing(true)
          addMessage("[Screen sharing on]", "system")
        }
      } catch (err: any) {
        addMessage("[Screen share error: " + err.message + "]", "system")
      }
    } else {
      screenCaptureRef.current?.stop()
      setIsScreenSharing(false)
      if (!isVideoStreaming && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null
        videoPreviewRef.current.hidden = true
      }
      addMessage("[Screen sharing off]", "system")
    }
  }, [isScreenSharing, isVideoStreaming, addMessage])

  const updateVolume = useCallback((vol: number) => {
    audioPlayerRef.current?.setVolume(vol / 100)
    setSettings((s) => ({ ...s, volume: vol }))
  }, [])

  const sendMessage = useCallback(
    (text: string) => {
      if (!clientRef.current) {
        addMessage("[Connect to Gemini first]", "system")
        return
      }
      detectVoiceCommands(text)
      addMessage(text, "user")
      clientRef.current.sendTextMessage(text)
    },
    [addMessage, detectVoiceCommands]
  )

  const updateSetting = useCallback(
    <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
      setSettings((prev) => {
        const updated = { ...prev, [key]: value }
        const c = clientRef.current
        if (!c?.connected) return updated

        switch (key) {
          case "enableWhisper":
            c.setWhisperMode(value as boolean)
            break
          case "enableThinking":
            c.setThinkingMode(value as boolean)
            break
          case "voice":
            c.setVoice(value as string)
            break
        }
        return updated
      })
    },
    []
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 p-6">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Gemini Live API
        </h1>
        <p className="text-sm text-gray-400">Vanilla TypeScript + React + Audio/Video Streaming</p>
      </motion.header>

      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 space-y-4">
          <ApiConfigSection
            settings={settings}
            updateSetting={updateSetting}
            isConnected={isConnected}
          />

          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={connect}
              disabled={isConnected}
              className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all"
            >
              Connect
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={disconnect}
              disabled={!isConnected}
              className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-500/20 transition-all"
            >
              Disconnect
            </motion.button>

            <AnimatePresence mode="wait">
              <motion.span
                key={connectionStatus}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-sm px-3 py-1 rounded-full ${
                  isConnected
                    ? "bg-green-500/20 text-green-400"
                    : connectionStatus.includes("failed") || connectionStatus.includes("Error")
                    ? "bg-red-500/20 text-red-400"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                {connectionStatus}
              </motion.span>
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {setupJson && (
              <motion.details
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-800/50 rounded-xl p-4"
              >
                <summary className="text-sm font-medium text-gray-300 cursor-pointer">
                  Setup Message JSON
                </summary>
                <pre className="mt-2 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                  {setupJson}
                </pre>
              </motion.details>
            )}
          </AnimatePresence>
        </div>

        <div className="w-full lg:w-1/2 space-y-4">
          <MediaControls
            isAudioStreaming={isAudioStreaming}
            isVideoStreaming={isVideoStreaming}
            isScreenSharing={isScreenSharing}
            volume={settings.volume}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreen={toggleScreen}
            onVolumeChange={updateVolume}
            videoPreviewRef={videoPreviewRef}
          />

          <Chat messages={messages} onSend={sendMessage} />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/40 rounded-xl p-4"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Debug Info
            </h3>
            <pre className="text-xs text-gray-400 font-mono">{debugInfo}</pre>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
