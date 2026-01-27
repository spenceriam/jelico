import { useRef, useEffect, useState, useMemo } from 'react'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { useContextStore } from '../../stores/context'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ModeSelector } from '../ModeSelector/ModeSelector'
import { ShimmerText } from '../StatusIndicators/ShimmerText'

export function ChatArea() {
  const { messages, isStreaming, streamingContent, streamingToolCalls, streamingToolResults, activeConversationId } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()
  const { isCompacting, isProcessing, processingMessage } = useUIStore()
  const { getContextUsage } = useContextStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get context usage for current conversation
  const contextUsage = activeConversationId ? getContextUsage(activeConversationId) : null

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
          {/* Processing indicator */}
          {(isCompacting || isProcessing) && processingMessage && (
            <div className="flex justify-center mb-3">
              <ShimmerText className="text-sm">
                {processingMessage}
              </ShimmerText>
            </div>
          )}

          {/* Context usage indicator */}
          {contextUsage && contextUsage.percentage > 0.5 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                <span>Context usage</span>
                <span>{Math.round(contextUsage.percentage * 100)}%</span>
              </div>
              <div className="h-1 bg-bg-deep rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    contextUsage.percentage >= 0.75
                      ? 'bg-error'
                      : contextUsage.percentage >= 0.5
                      ? 'bg-accent'
                      : 'bg-success'
                  }`}
                  style={{ width: `${Math.min(contextUsage.percentage * 100, 100)}%` }}
                />
              </div>
              {contextUsage.shouldCompact && (
                <p className="text-xs text-text-muted mt-1">
                  Context is filling up. Auto-compaction will occur soon.
                </p>
              )}
            </div>
          )}

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

// Greetings based on time of day
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Working late?'
}

// Variety of casual greetings/prompts
const CASUAL_GREETINGS = [
  "What's on your mind?",
  "What are we working on?",
  "Ready when you are",
  "How can I help today?",
  "Let's get something done",
]

const FOLLOW_UP_PROMPTS = [
  "Ask me anything or start a task.",
  "I'm here to help with whatever you need.",
  "Let's tackle something together.",
  "What would you like to explore?",
  "Ready to dive in whenever you are.",
]

function EmptyState() {
  const [userName, setUserName] = useState<string | null>(null)

  // Get random greeting and prompt (stable per session)
  const { greeting, prompt } = useMemo(() => {
    const greetingIndex = Math.floor(Math.random() * CASUAL_GREETINGS.length)
    const promptIndex = Math.floor(Math.random() * FOLLOW_UP_PROMPTS.length)
    return {
      greeting: CASUAL_GREETINGS[greetingIndex],
      prompt: FOLLOW_UP_PROMPTS[promptIndex],
    }
  }, [])

  // Load user name from soul preferences
  useEffect(() => {
    window.jelico.soul.getPreference('userName').then((result) => {
      if (result?.value) {
        setUserName(result.value as string)
      }
    }).catch(() => {
      // Ignore errors, just don't show name
    })
  }, [])

  const timeGreeting = getTimeBasedGreeting()

  // Decide which greeting style to use (time-based vs casual)
  const useTimeGreeting = Math.random() > 0.5

  return (
    <div className="h-full flex items-center justify-center p-10">
      <div className="text-center max-w-lg animate-fade-in">
        {/* Logo matching onboarding style */}
        <div className="welcome-logo mb-6">J</div>

        {/* Dynamic greeting */}
        <h1 className="font-display text-[32px] font-normal text-text-primary mb-3 tracking-tight">
          {useTimeGreeting ? (
            userName ? `${timeGreeting}, ${userName}` : timeGreeting
          ) : (
            userName ? `Hey ${userName}, ${greeting.toLowerCase()}` : greeting
          )}
        </h1>

        {/* Follow-up prompt */}
        <p className="text-text-secondary text-lg">
          {prompt}
        </p>
      </div>
    </div>
  )
}
