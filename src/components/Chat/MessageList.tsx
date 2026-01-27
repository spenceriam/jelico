import { Message } from './Message'
import type { ToolCall, ToolResult } from '../../stores/chat'

interface MessageData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

interface MessageListProps {
  messages: MessageData[]
  streamingContent?: string
  streamingToolCalls?: ToolCall[]
  streamingToolResults?: ToolResult[]
}

export function MessageList({ messages, streamingContent, streamingToolCalls, streamingToolResults }: MessageListProps) {
  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
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
