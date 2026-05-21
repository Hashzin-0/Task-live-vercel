import { motion } from "framer-motion"
import { RefObject } from "react"

interface Props {
  isAudioStreaming: boolean
  isVideoStreaming: boolean
  isScreenSharing: boolean
  volume: number
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleScreen: () => void
  onVolumeChange: (vol: number) => void
  videoPreviewRef: RefObject<HTMLVideoElement | null>
}

const btnClass =
  "px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"

const MicIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
)

const CameraIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const ScreenIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

export default function MediaControls({
  isAudioStreaming,
  isVideoStreaming,
  isScreenSharing,
  volume,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onVolumeChange,
  videoPreviewRef,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gray-800/40 rounded-xl p-4 space-y-4"
    >
      <h2 className="text-sm font-semibold text-gray-300">Media Streaming</h2>

      <div className="flex gap-2 flex-wrap">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onToggleAudio}
          className={`${btnClass} flex items-center gap-2 ${
            isAudioStreaming
              ? "bg-green-600 hover:bg-green-500 shadow-green-500/30"
              : "bg-gray-700 hover:bg-gray-600 shadow-gray-500/20"
          }`}
        >
          <MicIcon />
          {isAudioStreaming ? "Stop Audio" : "Start Audio"}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onToggleVideo}
          className={`${btnClass} flex items-center gap-2 ${
            isVideoStreaming
              ? "bg-green-600 hover:bg-green-500 shadow-green-500/30"
              : "bg-gray-700 hover:bg-gray-600 shadow-gray-500/20"
          }`}
        >
          <CameraIcon />
          {isVideoStreaming ? "Stop Video" : "Start Video"}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onToggleScreen}
          className={`${btnClass} flex items-center gap-2 ${
            isScreenSharing
              ? "bg-green-600 hover:bg-green-500 shadow-green-500/30"
              : "bg-gray-700 hover:bg-gray-600 shadow-gray-500/20"
          }`}
        >
          <ScreenIcon />
          {isScreenSharing ? "Stop Sharing" : "Share Screen"}
        </motion.button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Output volume: <span className="text-blue-400">{volume}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(parseInt(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      <motion.video
        ref={videoPreviewRef}
        autoPlay
        playsInline
        muted
        hidden
        className="w-full max-w-md rounded-lg border border-gray-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: videoPreviewRef.current?.hidden ? 0 : 1 }}
      />
    </motion.div>
  )
}
