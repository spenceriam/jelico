import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Settings, AlertTriangle, Loader2 } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { useContextStore } from '../../stores/context'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ModeSelector } from '../ModeSelector/ModeSelector'
import { WorkspaceSelector } from '../Workspace/WorkspaceSelector'
import { ModelSelector } from '../Model/ModelSelector'
import { ShimmerText, BrailleLoader } from '../StatusIndicators'

export function ChatArea() {
  const { messages, isStreaming, streamingContent, streamingToolCalls, streamingToolResults, systemNotifications, activeConversationId, regenerateLastResponse } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()
  const { isProcessing, processingMessage } = useUIStore()
  const { getContextUsage, isCompacting } = useContextStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showContextBar, setShowContextBar] = useState(false) // Hidden by default, click to show
  const [userName, setUserName] = useState<string | null>(null)

  // Get context usage for current conversation
  const contextUsage = activeConversationId ? getContextUsage(activeConversationId) : null

  // Load user name from soul preferences
  useEffect(() => {
    window.jelico.soul.getPreference('userName').then((result) => {
      if (result?.value) {
        setUserName(result.value as string)
      }
    }).catch(() => {})
  }, [])

  // Auto-scroll to bottom when new messages or tool calls arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, streamingToolCalls, streamingToolResults])

  // Handler for regenerating the last response
  const handleRegenerate = useCallback(async () => {
    if (!activeProviderId || !activeModel) return
    await regenerateLastResponse(activeProviderId, activeModel)
  }, [activeProviderId, activeModel, regenerateLastResponse])

  // Show new chat UI when no conversation selected OR empty conversation
  const showNewChatUI = !activeConversationId || (messages.length === 0 && !isStreaming)

  // New chat / Welcome UI - centered stack
  if (showNewChatUI) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-xl">
            <NewChatView
              disabled={!activeProviderId || !activeModel}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </div>
    )
  }

  // Active conversation UI - normal chat layout
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-4">
          <MessageList
            messages={messages}
            streamingContent={isStreaming ? streamingContent : undefined}
            streamingToolCalls={isStreaming ? streamingToolCalls : undefined}
            streamingToolResults={isStreaming ? streamingToolResults : undefined}
            systemNotifications={systemNotifications}
            onRegenerate={handleRegenerate}
            userName={userName || undefined}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-bg-surface">
        <div className="max-w-3xl mx-auto p-4">
          {/* Processing indicator - sticky status at bottom, left-justified */}
          {(isStreaming || isCompacting || isProcessing) && (
            <div className="flex items-center gap-2 mb-3">
              <BrailleLoader className="text-accent" />
              <ShimmerText className="text-sm">
                {isCompacting ? 'Compacting conversation...' :
                 isStreaming ? (() => {
                   // Find actively executing tools (have call but no result yet)
                   const executingTools = streamingToolCalls.filter(
                     tc => !streamingToolResults.find(r => r.toolCallId === tc.id)
                   )
                   if (executingTools.length > 0) {
                     const tool = executingTools[0]
                     const args = tool.args || {}

                     // Generate contextual status from tool + args
                     const getShortPath = (p: string) => {
                       const parts = p.split('/')
                       return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p
                     }

                     switch (tool.name) {
                       case 'read_file':
                         return args.path ? `Reading ${getShortPath(String(args.path))}` : 'Reading file...'
                       case 'write_file':
                         return args.path ? `Writing ${getShortPath(String(args.path))}` : 'Writing file...'
                       case 'list_directory':
                         return args.path ? `Exploring ${getShortPath(String(args.path))}` : 'Listing directory...'
                       case 'search_files':
                         return args.pattern ? `Searching for ${args.pattern}` : 'Searching files...'
                       case 'execute_command': {
                         const cmd = String(args.command || '')
                         const shortCmd = cmd.length > 30 ? cmd.slice(0, 30) + '...' : cmd
                         return shortCmd ? `Running: ${shortCmd}` : 'Running command...'
                       }
                       case 'web_search':
                         return args.query ? `Searching: "${String(args.query).slice(0, 25)}..."` : 'Searching the web...'
                       case 'web_fetch': {
                         const url = String(args.url || '')
                         try {
                           const hostname = new URL(url).hostname
                           return `Fetching from ${hostname}`
                         } catch {
                           return 'Fetching URL...'
                         }
                       }
                       case 'create_artifact':
                         return args.title ? `Creating: ${String(args.title).slice(0, 30)}` : 'Creating artifact...'
                       case 'update_artifact':
                         return args.title ? `Updating: ${String(args.title).slice(0, 30)}` : 'Updating artifact...'
                       case 'spawn_agent':
                         return args.name ? `Spawning ${args.name}` : 'Spawning sub-agent...'
                       case 'wait_for_agent':
                         return 'Waiting for sub-agent...'
                       case 'get_agent_status':
                         return 'Checking agent status...'
                       case 'continue_agent':
                         return 'Continuing agent...'
                       default:
                         return 'Working...'
                     }
                   }
                   if (streamingToolCalls.length > 0) {
                     return 'Finishing up...'
                   }
                   return streamingContent ? 'Responding...' : 'Thinking...'
                 })() :
                 processingMessage || 'Processing...'}
              </ShimmerText>
            </div>
          )}

          {/* Context usage indicator - hidden by default, click percentage to toggle bar */}
          {/* Show after first message (tokenCount > 0) or during active streaming */}
          {contextUsage && (contextUsage.tokenCount > 0 || isStreaming || messages.length > 0) && (
            <div className="mb-3">
              <button
                onClick={() => setShowContextBar(!showContextBar)}
                className="w-full flex items-center gap-3 text-xs text-text-muted hover:text-text-secondary transition-colors group"
                title={showContextBar ? 'Hide context window bar' : 'Show context window bar'}
              >
                {/* Progress bar - taller, only visible when toggled on */}
                {showContextBar && (
                  <div className="flex-1 h-3 bg-bg-deep rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        contextUsage.shouldWarn ? 'bg-warning' : 'bg-accent'
                      }`}
                      style={{ width: `${Math.max(Math.min(contextUsage.percentage * 100, 100), 1)}%` }}
                    />
                  </div>
                )}
                {!showContextBar && (
                  <div className="flex-1 flex items-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted">
                      Show context window
                    </span>
                  </div>
                )}

                {/* Right side: icons and percentage */}
                <div className="flex items-center gap-2">
                  {/* Spinner during compaction */}
                  {isCompacting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  )}
                  {/* Warning icon when approaching limit (but not compacting) */}
                  {!isCompacting && contextUsage.shouldWarn && (
                    <span className="text-warning" title="Compacting conversation soon">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span>{Math.round(contextUsage.percentage * 100)}%</span>
                </div>
              </button>
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

// ============================================
// Soulful Greeting System
// ============================================

// Time-aware greetings (gentle, non-judgmental)
const MORNING_GREETINGS = [
  "Fresh start. What's the plan?",
  "New day. What are we building?",
  "Morning. What's on the agenda?",
  "Good morning. What shall we tackle?",
  "Morning. What's calling for attention?",
  "A new day. What matters most?",
  "Morning. Ready when you are.",
  "Rise and create. What's first?",
]

const AFTERNOON_GREETINGS = [
  "How's it going so far?",
  "Afternoon. How can I help?",
  "How's the day shaping up?",
  "Afternoon. What are we working through?",
  "What's on your mind this afternoon?",
  "Midday check-in. What's next?",
  "Afternoon. What needs attention?",
  "How can I help move things forward?",
]

const EVENING_GREETINGS = [
  "Evening. What's on your mind?",
  "Evening. What shall we work on?",
  "How can I help this evening?",
  "What's worth finishing today?",
  "Evening. What are you thinking about?",
  "Settling in. What can we tackle?",
  "Evening. Ready to help.",
  "What's calling for your attention?",
]

// Generic soulful greetings (used late night 9pm-5am, or mixed in anytime)
const SOULFUL_GREETINGS = [
  // Warm/Present
  "Good to have you here.",
  "Glad you're back.",
  "Here whenever you're ready.",
  "Ready to think alongside you.",
  // Thoughtful/Reflective
  "What's on your mind?",
  "What's calling for your attention?",
  "What are you thinking about?",
  "What's worth exploring?",
  "What shall we create?",
  // Curious/Engaged
  "Curious what you're working on.",
  "What's caught your interest?",
  "What's the challenge today?",
  "What problem are we solving?",
  // Encouraging/Grounded
  "Let's make something happen.",
  "Let's see what we can build.",
  "What matters to you right now?",
  "Alright, what are we working on?",
  "Let's get into it.",
  "Let's figure this out together.",
]

// Follow-up prompts (subtitle text)
const FOLLOW_UP_PROMPTS = [
  "I'm here to help with whatever you need.",
  "Let's tackle something together.",
  "What would you like to explore?",
  "Ready to dive in whenever you are.",
  "Let's see what we can figure out.",
  "Take your time. I'm not going anywhere.",
  "What can we build together?",
  "I'm listening.",
]

// Get time period
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night'

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night' // 9pm - 5am
}

// Get greeting pool based on time
function getGreetingPool(period: TimePeriod): string[] {
  switch (period) {
    case 'morning':
      return [...MORNING_GREETINGS, ...SOULFUL_GREETINGS.slice(0, 5)]
    case 'afternoon':
      return [...AFTERNOON_GREETINGS, ...SOULFUL_GREETINGS.slice(0, 5)]
    case 'evening':
      return [...EVENING_GREETINGS, ...SOULFUL_GREETINGS.slice(0, 5)]
    case 'night':
      // Late night: only use generic soulful greetings, no time references
      return SOULFUL_GREETINGS
  }
}

// Random selection helper
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Build the greeting with optional name
function buildGreeting(baseGreeting: string, userName: string | null): string {
  // If greeting already feels complete (ends with punctuation and isn't a question to personalize)
  const endsWithPunctuation = /[.!?]$/.test(baseGreeting)

  if (userName) {
    // Personalize based on greeting structure
    if (baseGreeting.startsWith("Good morning") ||
        baseGreeting.startsWith("Morning") ||
        baseGreeting.startsWith("Afternoon") ||
        baseGreeting.startsWith("Evening")) {
      // "Morning. What's on the agenda?" -> "Morning, Spencer. What's on the agenda?"
      return baseGreeting.replace(/^(Good morning|Morning|Afternoon|Evening)(\.|\,)?/, `$1, ${userName}.`)
    }
    if (baseGreeting.startsWith("Good to have you") ||
        baseGreeting.startsWith("Glad you're back")) {
      // "Good to have you here." -> "Good to have you here, Spencer."
      return baseGreeting.replace(/\.$/, `, ${userName}.`)
    }
    if (baseGreeting === "Here whenever you're ready." ||
        baseGreeting === "Ready to think alongside you.") {
      return `Hey ${userName}. ${baseGreeting}`
    }
    // For questions or action statements, prepend name
    if (!endsWithPunctuation || baseGreeting.endsWith('?')) {
      return `${userName}, ${baseGreeting.toLowerCase()}`
    }
    return `Hey ${userName}. ${baseGreeting}`
  }

  // No name - use greeting as-is, but ensure warmth
  if (baseGreeting === "Curious what you're working on.") {
    return "I'm curious what you're working on."
  }
  return baseGreeting
}

interface NewChatViewProps {
  disabled?: boolean
  isStreaming?: boolean
}

function NewChatView({ disabled, isStreaming }: NewChatViewProps) {
  const { openSettings } = useUIStore()
  const [userName, setUserName] = useState<string | null>(null)

  // Get random greeting and prompt (stable per component mount)
  const { greeting, followUp } = useMemo(() => {
    const period = getTimePeriod()
    const pool = getGreetingPool(period)
    return {
      greeting: randomFrom(pool),
      followUp: randomFrom(FOLLOW_UP_PROMPTS),
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

  const displayGreeting = buildGreeting(greeting, userName)

  return (
    <div className="text-center animate-fade-in space-y-8">
      {/* Logo matching onboarding style */}
      <div className="welcome-logo mx-auto">J</div>

      {/* Dynamic greeting */}
      <div>
        <h1 className="font-display text-[32px] font-normal text-text-primary mb-3 tracking-tight">
          {displayGreeting}
        </h1>
        <p className="text-text-secondary text-lg">
          {followUp}
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex justify-center">
        <ModeSelector />
      </div>

      {/* Workspace, Model selector, and Settings */}
      <div className="flex justify-center items-center gap-3">
        <WorkspaceSelector />
        <ModelSelector compact />
        <button
          onClick={() => openSettings()}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-surface rounded-md transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Processing indicator - show during first message send */}
      {isStreaming && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <BrailleLoader className="text-accent" />
          <ShimmerText className="text-sm">
            Starting conversation...
          </ShimmerText>
        </div>
      )}

      {/* Chat input */}
      <div className="pt-4">
        <ChatInput
          disabled={disabled}
          isStreaming={isStreaming}
          centered
        />
      </div>
    </div>
  )
}
