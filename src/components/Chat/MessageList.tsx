import { Message } from './Message'

interface MessageData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

interface MessageListProps {
  messages: MessageData[]
  streamingContent?: string
}

export function MessageList({ messages, streamingContent }: MessageListProps) {
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
        />
      )}
    </div>
  )
}
