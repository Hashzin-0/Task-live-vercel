import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface ChatMessage {
  text: string
  type: string
}

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
}

const typeColors: Record<string, string> = {
  "user": "border-l-green-500 bg-green-500/5",
  "user-transcript": "border-l-yellow-500 bg-yellow-500/5",
  "assistant": "border-l-blue-500 bg-blue-500/5",
  "system": "border-l-red-500 bg-red-500/5",
}

const typeLabels: Record<string, string> = {
  "user": "USER",
  "user-transcript": "USER SPEECH",
  "assistant": "GEMINI SPEECH",
  "system": "SYSTEM",
}

export default function Chat({ messages, onSend }: Props) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input.trim())
    setInput("")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/40 rounded-xl overflow-hidden border border-gray-700/50"
    >
      <div className="px-4 py-3 border-b border-gray-700/50">
        <h2 className="text-sm font-semibold text-gray-300">Chat</h2>
      </div>

      <div className="h-64 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center pt-8">
            Connect to Gemini to start chatting
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`text-sm px-3 py-2 rounded-lg border-l-2 ${
                typeColors[msg.type] || "border-l-gray-500 bg-gray-500/5"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-0.5">
                {typeLabels[msg.type] || msg.type}
              </span>
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-700/50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all"
        >
          Send
        </motion.button>
      </form>
    </motion.div>
  )
}
