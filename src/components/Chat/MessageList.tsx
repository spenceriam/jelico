import { useState } from 'react'
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

      {streamingContent !== undefined && (
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
