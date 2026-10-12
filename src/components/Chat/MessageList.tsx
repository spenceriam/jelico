import { useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
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

type Row =
  | { kind: 'message'; message: MessageData }
  | { kind: 'notification'; notification: SystemNotification }
  | { kind: 'streaming' }

interface FooterContext {
  content: React.ReactNode
  padding: string | undefined
  containerClassName: string
}

function VirtuosoFooter({ context }: { context?: FooterContext }) {
  if (!context) return null
  return (
    <div className={context.containerClassName}>
      {context.content}
      {context.padding ? <div style={{ height: context.padding }} /> : null}
    </div>
  )
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
  conversationId?: string | null
  isLoadingConversation?: boolean
  containerClassName?: string
  footer?: React.ReactNode
  footerPadding?: string
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
  conversationId,
  isLoadingConversation = false,
  containerClassName = '',
  footer,
  footerPadding,
}: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const lastMessageMetaRef = useRef<{ id: string | null; count: number }>({ id: null, count: 0 })
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null)

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

  const visibleNotifications = useMemo(
    () => systemNotifications.filter((n) => n.type !== 'artifacts_created'),
    [systemNotifications]
  )

  const showStreamingRow =
    streamingContent !== undefined &&
    (streamingContent !== '' || (streamingToolCalls && streamingToolCalls.length > 0))

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = messages.map((message) => ({ kind: 'message', message }))
    for (const notification of visibleNotifications) {
      list.push({ kind: 'notification', notification })
    }
    if (showStreamingRow) {
      list.push({ kind: 'streaming' })
    }
    return list
  }, [messages, visibleNotifications, showStreamingRow])

  // Force-scroll to the end when a NEW user message is appended, even if the
  // user had scrolled up. Streaming follow is handled by followOutput.
  useEffect(() => {
    const previous = lastMessageMetaRef.current
    const count = messages.length
    const lastMessage = count > 0 ? messages[count - 1] : null
    const lastId = lastMessage?.id ?? null

    const appendedNewMessage = count > previous.count && lastId !== previous.id
    const appendedUserMessage = appendedNewMessage && lastMessage?.role === 'user'
    lastMessageMetaRef.current = { id: lastId, count }

    if (!appendedUserMessage) return
    virtuosoRef.current?.scrollToIndex({ index: rows.length - 1, align: 'end', behavior: 'auto' })
  }, [messages, rows.length])

  // During the async conversation load, render nothing rather than mounting
  // the scroller empty and losing the restore-at-bottom anchor.
  if (isLoadingConversation && rows.length === 0) {
    return <div className="h-full" />
  }

  return (
    <Virtuoso
      key={conversationId ?? 'none'}
      ref={virtuosoRef}
      className="h-full select-text"
      data={rows}
      initialTopMostItemIndex={{ index: Math.max(rows.length - 1, 0), align: 'end' }}
      alignToBottom
      followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
      increaseViewportBy={{ top: 800, bottom: 200 }}
      computeItemKey={(_index, row) => {
        if (row.kind === 'message') return row.message.id
        if (row.kind === 'notification') return row.notification.id
        return 'streaming'
      }}
      itemContent={(index, row) => {
        if (row.kind === 'notification') {
          const notification = row.notification
          return (
            <div className={`${containerClassName} pb-7`}>
              <SystemMessage
                type={notification.type}
                message={notification.message}
                artifacts={notification.artifacts}
                modelName={notification.modelName}
              />
            </div>
          )
        }

        if (row.kind === 'streaming') {
          return (
            <div className={`${containerClassName} pb-7`}>
              <Message
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent ?? '',
                  createdAt: streamingStartedAt ?? Date.now(),
                }}
                isStreaming
                streamingToolCalls={streamingToolCalls}
                streamingToolResults={streamingToolResults}
                streamingSegments={streamingSegments}
                userName={userName}
              />
            </div>
          )
        }

        const message = row.message
        const messageIndex = index
        return (
          <div className={`${containerClassName} pb-7`}>
            <Message
              message={message}
              isLastAssistantMessage={messageIndex === lastAssistantIndex}
              onRegenerate={messageIndex === lastAssistantIndex ? handleRegenerate : undefined}
              isRegenerating={isRegenerating}
              canEdit={message.role === 'user' && message.id === editableUserMessageId}
              showRetry={message.role === 'user' && message.id === retryableUserMessageId}
              onRetry={
                message.role === 'user' && message.id === retryableUserMessageId
                  ? () => { void handleRetryUnansweredMessage(message.id) }
                  : undefined
              }
              isRetrying={retryingMessageId === message.id}
              userName={userName}
            />
          </div>
        )
      }}
      components={{ Footer: VirtuosoFooter }}
      context={{ content: footer, padding: footerPadding, containerClassName }}
    />
  )
}
