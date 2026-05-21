import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { GeminiLiveAPI, MultimodalLiveResponseType, type ResponseMessage } from "./lib/geminilive"
import { AudioStreamer, VideoStreamer, ScreenCapture, AudioPlayer } from "./lib/mediaUtils"
import { ShowAlertTool, AddCSSStyleTool } from "./lib/tools"
import SettingsModal from "./components/SettingsModal"
import type { Settings } from "./components/SettingsModal"
import FloatingButtons from "./components/FloatingButtons"
import Chat from "./components/Chat"
import MediaControls from "./components/MediaControls"

const defaultSettings: Settings = {
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
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [connectionStatus, setConnectionStatus] = useState("Not connected")
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<{ text: string; type: string }[]>([])
  const [debugInfo, setDebugInfo] = useState("Ready to connect...")
  const [setupJson, setSetupJson] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isAudioStreaming, setIsAudioStreaming] = useState(false)
  const [isVideoStreaming, setIsVideoStreaming] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const clientRef = useRef<GeminiLiveAPI | null>(null)
  const audioStreamerRef = useRef<AudioStreamer | null>(null)
  const audioPlayerRef = useRef<AudioPlayer | null>(null)
  const videoStreamerRef = useRef<VideoStreamer | null>(null)
  const screenCaptureRef = useRef<ScreenCapture | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const preWhisperVolumeRef = useRef(80)

  // Auto-adjust volume when whisper toggles
  useEffect(() => {
    if (settings.enableWhisper) {
      preWhisperVolumeRef.current = settings.volume > 25 ? settings.volume : 80
      updateVolume(25)
    } else if (settings.volume === 25) {
      updateVolume(preWhisperVolumeRef.current)
    }
  }, [settings.enableWhisper])

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
          if (!message.data.finished) addMessage(message.data.text, "user-transcript")
          break

        case MultimodalLiveResponseType.OUTPUT_TRANSCRIPTION:
          if (!message.data.finished) addMessage(message.data.text, "assistant")
          break

        case MultimodalLiveResponseType.SETUP_COMPLETE:
          addMessage("Ready!", "system")
          if (clientRef.current?.lastSetupMessage) {
            setSetupJson(JSON.stringify(clientRef.current.lastSetupMessage, null, 2))
          }
          break

        case MultimodalLiveResponseType.TOOL_CALL: {
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
        }

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
        if (settings.enableAlertTool) client.addFunction(new ShowAlertTool())
        if (settings.enableCssStyleTool) client.addFunction(new AddCSSStyleTool())
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

  // Fixed: separate state update from side effects
  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))

      const c = clientRef.current
      if (!c?.connected) return

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
    },
    []
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-indigo-600 text-white px-6 py-4 shadow-md relative overflow-hidden"
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-xl" />
        <div className="relative z-10 flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">Gemini Live Voice</h1>
            <p className="text-sm text-indigo-200">Real-time voice AI assistant</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={connect}
              disabled={isConnected}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              Connect
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={disconnect}
              disabled={!isConnected}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              Disconnect
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Setup JSON (collapsible) */}
        <AnimatePresence>
          {setupJson && (
            <motion.details
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
            >
              <summary className="text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none">
                Setup Message JSON
              </summary>
              <pre className="mt-2 text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap">
                {setupJson}
              </pre>
            </motion.details>
          )}
        </AnimatePresence>

        {/* Chat */}
        <Chat messages={messages} onSend={sendMessage} />

        {/* Media Controls */}
        <MediaControls
          isAudioStreaming={isAudioStreaming}
          isVideoStreaming={isVideoStreaming}
          isScreenSharing={isScreenSharing}
          volume={settings.volume}
          connectionStatus={connectionStatus}
          isConnected={isConnected}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreen={toggleScreen}
          onVolumeChange={updateVolume}
          videoPreviewRef={videoPreviewRef}
        />

        {/* Debug */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Debug Info
          </h3>
          <pre className="text-xs text-slate-400 font-mono">{debugInfo}</pre>
        </motion.div>
      </main>

      {/* Floating Buttons */}
      <FloatingButtons
        isAudioStreaming={isAudioStreaming}
        isConnected={isConnected}
        onToggleAudio={toggleAudio}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <SettingsModal
            open={settingsOpen}
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onChange={updateSetting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
