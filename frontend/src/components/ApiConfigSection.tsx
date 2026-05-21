import { motion, AnimatePresence } from "framer-motion"

interface Settings {
  model: string
  systemInstructions: string
  voice: string
  temperature: number
  enableGrounding: boolean
  enableWhisper: boolean
  enableThinking: boolean
  enableAlertTool: boolean
  enableCssStyleTool: boolean
  enableInputTranscription: boolean
  enableOutputTranscription: boolean
  disableActivityDetection: boolean
  silenceDuration: number
  prefixPadding: number
  endSpeechSensitivity: string
  startSpeechSensitivity: string
  activityHandling: string
  volume: number
}

interface Props {
  settings: Settings
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  isConnected: boolean
}

const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
}

function DetailSection({
  title,
  defaultOpen = true,
  children,
  index = 0,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  index?: number
}) {
  return (
    <motion.details
      custom={index}
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      open={defaultOpen}
      className="group bg-gray-800/40 rounded-xl overflow-hidden border border-gray-700/50"
    >
      <summary className="px-4 py-3 text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none">
        {title}
      </summary>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </motion.details>
  )
}

export default function ApiConfigSection({ settings, updateSetting, isConnected }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
    >
      <DetailSection title="Connection Settings">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Model ID</label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => updateSetting("model", e.target.value)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </DetailSection>

      <DetailSection title="Gemini Behavior">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            System Instructions
          </label>
          <textarea
            value={settings.systemInstructions}
            onChange={(e) => updateSetting("systemInstructions", e.target.value)}
            rows={3}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Voice</label>
          <select
            value={settings.voice}
            onChange={(e) => updateSetting("voice", e.target.value)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {["Puck", "Charon", "Kore", "Fenrir", "Aoede"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Temperature: <span className="text-blue-400">{settings.temperature.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.1}
            value={settings.temperature}
            onChange={(e) => updateSetting("temperature", parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.1</span>
            <span>2.0</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="grounding"
            checked={settings.enableGrounding}
            onChange={(e) => updateSetting("enableGrounding", e.target.checked)}
            className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="grounding" className="text-sm text-gray-300">
            Enable Google grounding (disables custom tools)
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="whisper"
            checked={settings.enableWhisper}
            onChange={(e) => updateSetting("enableWhisper", e.target.checked)}
            className="rounded border-gray-600 text-purple-500 focus:ring-purple-500"
          />
          <label htmlFor="whisper" className="text-sm text-gray-300">
            Whisper mode <span className="text-gray-500">(AI speaks softly)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="thinking"
            checked={settings.enableThinking}
            onChange={(e) => updateSetting("enableThinking", e.target.checked)}
            className="rounded border-gray-600 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="thinking" className="text-sm text-gray-300">
            Thinking mode{" "}
            <span className="text-gray-500">(deep reasoning, ~1024 token budget)</span>
          </label>
        </div>
      </DetailSection>

      <DetailSection title="Custom Tools" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="alertTool"
            checked={settings.enableAlertTool}
            onChange={(e) => updateSetting("enableAlertTool", e.target.checked)}
            className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="alertTool" className="text-sm text-gray-300">
            Show Alert Box
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="cssTool"
            checked={settings.enableCssStyleTool}
            onChange={(e) => updateSetting("enableCssStyleTool", e.target.checked)}
            className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="cssTool" className="text-sm text-gray-300">
            Add CSS Style
          </label>
        </div>
      </DetailSection>

      <DetailSection title="Transcription Settings" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="inputTrans"
            checked={settings.enableInputTranscription}
            onChange={(e) => updateSetting("enableInputTranscription", e.target.checked)}
            className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="inputTrans" className="text-sm text-gray-300">
            Enable input transcription (your speech)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="outputTrans"
            checked={settings.enableOutputTranscription}
            onChange={(e) => updateSetting("enableOutputTranscription", e.target.checked)}
            className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="outputTrans" className="text-sm text-gray-300">
            Enable output transcription (Gemini responses)
          </label>
        </div>
      </DetailSection>

      <DetailSection title="Activity Detection Settings" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="disableAD"
            checked={settings.disableActivityDetection}
            onChange={(e) => updateSetting("disableActivityDetection", e.target.checked)}
            className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="disableAD" className="text-sm text-gray-300">
            Disable automatic activity detection
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Silence duration (ms)
          </label>
          <input
            type="number"
            value={settings.silenceDuration}
            onChange={(e) => updateSetting("silenceDuration", parseInt(e.target.value))}
            min={500}
            max={10000}
            step={100}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Prefix padding (ms)
          </label>
          <input
            type="number"
            value={settings.prefixPadding}
            onChange={(e) => updateSetting("prefixPadding", parseInt(e.target.value))}
            min={0}
            max={2000}
            step={100}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            End of speech sensitivity
          </label>
          <select
            value={settings.endSpeechSensitivity}
            onChange={(e) => updateSetting("endSpeechSensitivity", e.target.value)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="END_SENSITIVITY_UNSPECIFIED">Default</option>
            <option value="END_SENSITIVITY_HIGH">High (quicker cutoff)</option>
            <option value="END_SENSITIVITY_LOW">Low (longer wait)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Start of speech sensitivity
          </label>
          <select
            value={settings.startSpeechSensitivity}
            onChange={(e) => updateSetting("startSpeechSensitivity", e.target.value)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="START_SENSITIVITY_UNSPECIFIED">Default</option>
            <option value="START_SENSITIVITY_HIGH">High (quicker detection)</option>
            <option value="START_SENSITIVITY_LOW">Low (more filtering)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Activity Handling
          </label>
          <select
            value={settings.activityHandling}
            onChange={(e) => updateSetting("activityHandling", e.target.value)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="ACTIVITY_HANDLING_UNSPECIFIED">Default (Interrupts)</option>
            <option value="START_OF_ACTIVITY_INTERRUPTS">Interrupt (Barge-in)</option>
            <option value="NO_INTERRUPTION">No Interruption</option>
          </select>
        </div>
      </DetailSection>
    </motion.div>
  )
}
