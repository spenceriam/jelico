import { useState, useRef, useCallback, KeyboardEvent, useMemo } from 'react'
import { Send, Square, Clock } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'

// Detect if user is on macOS
function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

interface ChatInputProps {
  disabled?: boolean
  isStreaming?: boolean
}

export function ChatInput({ disabled, isStreaming }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, stopStreaming, messageQueue } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()

  // OS-aware modifier key
  const modKey = useMemo(() => isMac() ? '⌘' : 'Ctrl', [])

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !activeProviderId || !activeModel) return

    sendMessage(input.trim(), activeProviderId, activeModel)
    setInput('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, activeProviderId, activeModel, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize textarea
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const handleStop = () => {
    stopStreaming()
  }

  const queuedCount = messageQueue.length

  return (
    <div className="space-y-2">
      {/* Queued messages indicator */}
      {queuedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted px-1">
          <Clock className="w-3 h-3" />
          <span>{queuedCount} message{queuedCount > 1 ? 's' : ''} queued</span>
        </div>
      )}

      <div className="flex items-end gap-3 bg-bg-elevated rounded-xl p-3 border border-border hover:border-border-subtle transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a provider to start...' : isStreaming ? 'Message will be queued...' : 'Message Jelico...'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none resize-none min-h-[24px] max-h-[200px] disabled:cursor-not-allowed focus:outline-none focus:ring-0 border-none"
        />

        {isStreaming ? (
          <button
            onClick={handleStop}
            className="p-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors"
            title="Stop generating"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="p-2 bg-accent text-black rounded-lg hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted px-1">
        <span>Enter to send · Shift+Enter for new line · Tab to cycle modes</span>
        <span>{modKey}+K for commands</span>
      </div>
    </div>
  )
}
