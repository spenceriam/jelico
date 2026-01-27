import { useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ModeSelector } from '../ModeSelector/ModeSelector'
import { Sparkles } from 'lucide-react'

export function ChatArea() {
  const { messages, isStreaming, streamingContent, streamingToolCalls, streamingToolResults, activeConversationId } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="max-w-3xl mx-auto py-6 px-4">
            <MessageList
              messages={messages}
              streamingContent={isStreaming ? streamingContent : undefined}
              streamingToolCalls={isStreaming ? streamingToolCalls : undefined}
              streamingToolResults={isStreaming ? streamingToolResults : undefined}
            />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-bg-surface">
        <div className="max-w-3xl mx-auto p-4">
          {/* Mode selector above input */}
          <div className="flex justify-center mb-3">
            <ModeSelector />
          </div>
          <ChatInput
            disabled={!activeProviderId || !activeModel}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-accent" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Welcome to Jelico
        </h2>
        <p className="text-text-secondary">
          Your AI productivity partner. Ask me anything or start a task.
        </p>
      </div>
    </div>
  )
}
