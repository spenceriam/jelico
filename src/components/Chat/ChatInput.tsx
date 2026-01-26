import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'

interface ChatInputProps {
  disabled?: boolean
  isStreaming?: boolean
}

export function ChatInput({ disabled, isStreaming }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, stopStreaming } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !activeProviderId || !activeModel || isStreaming) return

    sendMessage(input.trim(), activeProviderId, activeModel)
    setInput('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, activeProviderId, activeModel, isStreaming, sendMessage])

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

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3 bg-bg-elevated rounded-xl p-3 border border-border focus-within:border-accent/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a provider to start...' : 'Message Jelico...'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none resize-none min-h-[24px] max-h-[200px] disabled:cursor-not-allowed"
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
        <span>Enter to send · Shift+Enter for new line</span>
      </div>
    </div>
  )
}
