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
  isStreaming?: boolean
  streamingContent?: string
  streamingStartedAt?: number | null
  streamingToolCalls?: ToolCall[]
  streamingToolResults?: ToolResult[]
  streamingSegments?: StreamingSegment[]
  systemNotifications?: SystemNotification[]
  onRegenerate?: () => Promise<void>
  onRetryUnansweredMessage?: () => Promise<void>
  userName?: string  // User's name for avatar
}

export function MessageList({
  messages,
  isStreaming = false,
  streamingContent,
  streamingStartedAt,
  streamingToolCalls,
  streamingToolResults,
  streamingSegments,
  systemNotifications = [],
  onRegenerate,
  onRetryUnansweredMessage,
  userName,
}: MessageListProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null)

  // Find the index of the last assistant message
  let lastAssistantIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }

  let retryableUserMessageId: string | null = null
  if (onRetryUnansweredMessage && !isStreaming) {
    for (let i = messages.length - 1; i > lastAssistantIndex; i--) {
      if (messages[i].role === 'user') {
        retryableUserMessageId = messages[i].id
        break
      }
    }
  }

  let editableUserMessageId: string | null = null
  if (!isStreaming && lastAssistantIndex !== -1) {
    for (let i = lastAssistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') {
        editableUserMessageId = messages[i].id
        break
      }
    }
  }

  const handleRegenerate = async () => {
    if (!onRegenerate || isRegenerating || retryingMessageId) return
    setIsRegenerating(true)
    try {
      await onRegenerate()
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleRetryUnansweredMessage = async (messageId: string) => {
    if (!onRetryUnansweredMessage || isRegenerating || retryingMessageId) return
    setRetryingMessageId(messageId)
    try {
      await onRetryUnansweredMessage()
    } finally {
      setRetryingMessageId(null)
    }
  }

  return (
    <div className="space-y-7">
      {messages.map((message, index) => (
        <Message
          key={message.id}
          message={message}
          isLastAssistantMessage={index === lastAssistantIndex}
          onRegenerate={index === lastAssistantIndex ? handleRegenerate : undefined}
          isRegenerating={isRegenerating}
          canEdit={message.role === 'user' && message.id === editableUserMessageId}
          showRetry={message.role === 'user' && message.id === retryableUserMessageId}
          onRetry={message.role === 'user' && message.id === retryableUserMessageId
            ? () => { void handleRetryUnansweredMessage(message.id) }
            : undefined}
          isRetrying={retryingMessageId === message.id}
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
