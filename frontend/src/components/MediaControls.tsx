import { motion } from "framer-motion"
import { RefObject } from "react"

interface Props {
  isAudioStreaming: boolean
  isVideoStreaming: boolean
  isScreenSharing: boolean
  volume: number
  connectionStatus: string
  isConnected: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleScreen: () => void
  onVolumeChange: (vol: number) => void
  videoPreviewRef: RefObject<HTMLVideoElement | null>
}

function Btn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-green-100 text-green-700 border border-green-200"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </motion.button>
  )
}

export default function MediaControls({
  isAudioStreaming,
  isVideoStreaming,
  isScreenSharing,
  volume,
  connectionStatus,
  isConnected,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onVolumeChange,
  videoPreviewRef,
}: Props) {
  const connColor = isConnected
    ? "bg-green-100 text-green-700 border-green-200"
    : connectionStatus.includes("fail") || connectionStatus.includes("Error")
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-slate-100 text-slate-500 border-slate-200"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-100 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Btn active={isAudioStreaming} onClick={onToggleAudio}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {isAudioStreaming ? "Mic ON" : "Mic"}
          </Btn>

          <Btn active={isVideoStreaming} onClick={onToggleVideo}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {isVideoStreaming ? "Cam ON" : "Camera"}
          </Btn>

          <Btn active={isScreenSharing} onClick={onToggleScreen}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {isScreenSharing ? "Screen ON" : "Screen"}
          </Btn>
        </div>

        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${connColor}`}>
          {connectionStatus}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(parseInt(e.target.value))}
          className="flex-1 accent-indigo-600"
        />
        <span className="text-xs text-slate-500 w-8 text-right">{volume}%</span>
      </div>

      <motion.video
        ref={videoPreviewRef}
        autoPlay
        playsInline
        muted
        hidden
        className="w-full max-w-sm rounded-xl border border-slate-200 mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: videoPreviewRef.current?.hidden ? 0 : 1 }}
      />
    </motion.div>
  )
}
