import { useState } from 'react'
import { Message } from './Message'
import { SystemMessage } from './SystemMessage'
import type { ToolCall, ToolResult, MessageUsage, SystemNotification, MessageAttachment, StreamingSegment } from '../../stores/chat'

interface MessageData {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  createdAt: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  usage?: MessageUsage
  attachments?: MessageAttachment[]
}

interface MessageListProps {
  messages: MessageData[]
  streamingContent?: string
  streamingStartedAt?: number | null
  streamingToolCalls?: ToolCall[]
  streamingToolResults?: ToolResult[]
  streamingSegments?: StreamingSegment[]
  systemNotifications?: SystemNotification[]
  onRegenerate?: () => Promise<void>
  userName?: string  // User's name for avatar
}

export function MessageList({
  messages,
  streamingContent,
  streamingStartedAt,
  streamingToolCalls,
  streamingToolResults,
  streamingSegments,
  systemNotifications = [],
  onRegenerate,
  userName,
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
          userName={userName}
        />
      ))}

      {/* System notifications - show after last message (filter out artifact notifications - now inline with tool calls) */}
      {systemNotifications
        .filter((n) => n.type !== 'artifacts_created')
        .map((notification) => (
          <SystemMessage
            key={notification.id}
            type={notification.type}
            message={notification.message}
            artifacts={notification.artifacts}
            modelName={notification.modelName}
          />
        ))}

      {/* Streaming message - show when we have content OR tool calls */}
      {streamingContent !== undefined && (streamingContent !== '' || (streamingToolCalls && streamingToolCalls.length > 0)) && (
        <Message
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            createdAt: streamingStartedAt ?? Date.now(),
          }}
          isStreaming
          streamingToolCalls={streamingToolCalls}
          streamingToolResults={streamingToolResults}
          streamingSegments={streamingSegments}
          userName={userName}
        />
      )}
    </div>
  )
}
