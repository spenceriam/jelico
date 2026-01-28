import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Message } from './Message'
import type { ToolCall, ToolResult, MessageUsage } from '../../stores/chat'

interface MessageData {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  createdAt: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  usage?: MessageUsage
}

interface MessageListProps {
  messages: MessageData[]
  streamingContent?: string
  streamingToolCalls?: ToolCall[]
  streamingToolResults?: ToolResult[]
  onRegenerate?: () => Promise<void>
}

export function MessageList({
  messages,
  streamingContent,
  streamingToolCalls,
  streamingToolResults,
  onRegenerate,
}: MessageListProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Find the index of the last assistant message
  let lastAssistantIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }

  const handleRegenerate = async () => {
    if (!onRegenerate || isRegenerating) return
    setIsRegenerating(true)
    try {
      await onRegenerate()
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {messages.map((message, index) => (
        <Message
          key={message.id}
          message={message}
          isLastAssistantMessage={index === lastAssistantIndex}
          onRegenerate={index === lastAssistantIndex ? handleRegenerate : undefined}
          isRegenerating={isRegenerating}
        />
      ))}

      {/* Thinking indicator - show when streaming starts but no content/tools yet */}
      {streamingContent !== undefined && streamingContent === '' && (!streamingToolCalls || streamingToolCalls.length === 0) && (
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
          </div>
          <div className="flex items-center gap-2 text-text-muted">
            <span className="text-sm">Thinking...</span>
          </div>
        </div>
      )}

      {/* Streaming message - show when we have content OR tool calls */}
      {streamingContent !== undefined && (streamingContent !== '' || (streamingToolCalls && streamingToolCalls.length > 0)) && (
        <Message
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            createdAt: Date.now(),
          }}
          isStreaming
          streamingToolCalls={streamingToolCalls}
          streamingToolResults={streamingToolResults}
        />
      )}
    </div>
  )
}
