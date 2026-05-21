import { motion } from "framer-motion"

export interface Settings {
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
  open: boolean
  settings: Settings
  onClose: () => void
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

const voices = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"]

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 rounded-full bg-slate-200 peer-checked:bg-indigo-600 transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-5 transition-transform" />
      </div>
      <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
        {label}
      </span>
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function SettingsModal({ open, settings, onClose, onChange }: Props) {
  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-semibold text-slate-800">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Voice & Behavior */}
            <div className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Voice & Behavior
              </h3>
              <Select
                label="Voice"
                value={settings.voice}
                onChange={(v) => onChange("voice", v)}
                options={voices.map((v) => ({ value: v, label: v }))}
              />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Temperature:{" "}
                  <span className="text-indigo-600">{settings.temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  value={settings.temperature}
                  onChange={(e) => onChange("temperature", parseFloat(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>0.1</span>
                  <span>2.0</span>
                </div>
              </div>
              <Toggle
                id="whisper"
                checked={settings.enableWhisper}
                onChange={(v) => onChange("enableWhisper", v)}
                label="Whisper mode"
              />
              <Toggle
                id="thinking"
                checked={settings.enableThinking}
                onChange={(v) => onChange("enableThinking", v)}
                label="Thinking mode (~1024 tokens)"
              />
            </div>

            {/* API Configuration */}
            <div className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                API Configuration
              </h3>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Model
                </label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => onChange("model", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  System Instructions
                </label>
                <textarea
                  value={settings.systemInstructions}
                  onChange={(e) => onChange("systemInstructions", e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                />
              </div>
              <Toggle
                id="grounding"
                checked={settings.enableGrounding}
                onChange={(v) => onChange("enableGrounding", v)}
                label="Google grounding (disables custom tools)"
              />
            </div>

            {/* Transcription */}
            <div className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Transcription
              </h3>
              <Toggle
                id="inputTrans"
                checked={settings.enableInputTranscription}
                onChange={(v) => onChange("enableInputTranscription", v)}
                label="Input transcription (your speech)"
              />
              <Toggle
                id="outputTrans"
                checked={settings.enableOutputTranscription}
                onChange={(v) => onChange("enableOutputTranscription", v)}
                label="Output transcription (Gemini responses)"
              />
            </div>

            {/* Activity Detection */}
            <div className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Activity Detection
              </h3>
              <Toggle
                id="disableAD"
                checked={settings.disableActivityDetection}
                onChange={(v) => onChange("disableActivityDetection", v)}
                label="Disable activity detection"
              />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Silence duration (ms)
                </label>
                <input
                  type="number"
                  value={settings.silenceDuration}
                  onChange={(e) => onChange("silenceDuration", parseInt(e.target.value))}
                  min={500}
                  max={10000}
                  step={100}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Prefix padding (ms)
                </label>
                <input
                  type="number"
                  value={settings.prefixPadding}
                  onChange={(e) => onChange("prefixPadding", parseInt(e.target.value))}
                  min={0}
                  max={2000}
                  step={100}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <Select
                label="End of speech sensitivity"
                value={settings.endSpeechSensitivity}
                onChange={(v) => onChange("endSpeechSensitivity", v)}
                options={[
                  { value: "END_SENSITIVITY_UNSPECIFIED", label: "Default" },
                  { value: "END_SENSITIVITY_HIGH", label: "High (quicker cutoff)" },
                  { value: "END_SENSITIVITY_LOW", label: "Low (longer wait)" },
                ]}
              />
              <Select
                label="Start of speech sensitivity"
                value={settings.startSpeechSensitivity}
                onChange={(v) => onChange("startSpeechSensitivity", v)}
                options={[
                  { value: "START_SENSITIVITY_UNSPECIFIED", label: "Default" },
                  { value: "START_SENSITIVITY_HIGH", label: "High (quicker detection)" },
                  { value: "START_SENSITIVITY_LOW", label: "Low (more filtering)" },
                ]}
              />
              <Select
                label="Activity handling"
                value={settings.activityHandling}
                onChange={(v) => onChange("activityHandling", v)}
                options={[
                  { value: "ACTIVITY_HANDLING_UNSPECIFIED", label: "Default (Interrupts)" },
                  { value: "START_OF_ACTIVITY_INTERRUPTS", label: "Interrupt (Barge-in)" },
                  { value: "NO_INTERRUPTION", label: "No Interruption" },
                ]}
              />
            </div>

            {/* Custom Tools */}
            <div className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Custom Tools
              </h3>
              <Toggle
                id="alertTool"
                checked={settings.enableAlertTool}
                onChange={(v) => onChange("enableAlertTool", v)}
                label="Show Alert Box"
              />
              <Toggle
                id="cssTool"
                checked={settings.enableCssStyleTool}
                onChange={(v) => onChange("enableCssStyleTool", v)}
                label="Add CSS Style"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex justify-end flex-shrink-0">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium shadow-sm transition-colors hover:bg-slate-800"
          >
            Done
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
