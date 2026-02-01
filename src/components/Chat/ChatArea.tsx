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
import { TodoPanel } from '../Todo/TodoPanel'

// Minimum display time for status messages (ms)
const MIN_STATUS_DISPLAY_MS = 600

export function ChatArea() {
  const { messages, isStreaming, streamingContent, streamingToolCalls, streamingToolResults, streamingSegments, systemNotifications, activeConversationId, regenerateLastResponse, modeSwitchReason, modeTransitioning, lastCompletedTool, statusDisplayQueue, toolInputProgress, streamingStartTime } = useChatStore()
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

  // Force periodic re-renders during streaming for smooth status updates
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (!isStreaming) return
    const interval = setInterval(() => {
      forceUpdate(n => n + 1)
    }, 100) // Update every 100ms for smooth status transitions
    return () => clearInterval(interval)
  }, [isStreaming])

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
            streamingSegments={isStreaming ? streamingSegments : undefined}
            systemNotifications={systemNotifications}
            onRegenerate={handleRegenerate}
            userName={userName || undefined}
          />

          {/* Status indicator - final row in chat view with braille animation */}
          {(isStreaming || isCompacting || isProcessing || modeTransitioning) && (
            <div className="flex items-center gap-3 mt-4 py-3">
              <BrailleLoader className="text-accent text-lg" />
              <ShimmerText className="text-sm text-text-secondary flex-1">
                {modeTransitioning && modeSwitchReason ? modeSwitchReason :
                 isCompacting ? 'Compacting conversation...' :
                 isStreaming ? (() => {
                   const now = Date.now()

                   const getShortPath = (p: string) => {
                     const parts = p.split('/')
                     return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p
                   }

                   const getToolStatus = (name: string, args: Record<string, unknown>, isComplete: boolean) => {
                     if (isComplete) {
                       switch (name) {
                         case 'read_file':
                           return args.path ? `Read ${getShortPath(String(args.path))}` : 'File read'
                         case 'write_file':
                           return args.path ? `Wrote ${getShortPath(String(args.path))}` : 'File written'
                         case 'execute_command':
                           return 'Command executed'
                         case 'create_artifact':
                           return args.title ? `Created "${String(args.title).slice(0, 20)}"` : 'Artifact created'
                         case 'spawn_agent':
                           return args.name ? `Spawned ${args.name}` : 'Agent spawned'
                         case 'wait_for_agent':
                           return 'Agent complete'
                         case 'switch_mode':
                           return `Switched to ${args.mode}`
                         case 'todo_write':
                           return 'Task list updated'
                         case 'todo_read':
                           return 'Tasks loaded'
                         case 'todo_check':
                           return args.taskId ? `Started task ${args.taskId}` : 'Task checked'
                         default:
                           return `${name} done`
                       }
                     } else {
                       switch (name) {
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
                         case 'todo_write':
                           return 'Updating task list...'
                         case 'todo_read':
                           return 'Reading tasks...'
                         case 'todo_check':
                           return args.taskId ? `Starting task ${args.taskId}...` : 'Checking task...'
                         case 'switch_mode':
                           return args.mode ? `Switching to ${args.mode} mode...` : 'Switching mode...'
                         default:
                           return `Running ${name}...`
                       }
                     }
                   }

                   const activeItems = statusDisplayQueue.filter(item => {
                     if (!item.completedAt) return true
                     return (now - item.completedAt) < MIN_STATUS_DISPLAY_MS
                   })

                   if (activeItems.length > 0) {
                     const item = activeItems[activeItems.length - 1]
                     const isComplete = !!item.completedAt
                     return getToolStatus(item.toolName, item.args, isComplete)
                   }

                   if (lastCompletedTool) {
                     const timeSinceCompletion = now - lastCompletedTool.completedAt
                     if (timeSinceCompletion < 1500) {
                       return getToolStatus(lastCompletedTool.name, lastCompletedTool.args, true)
                     }
                   }

                   // Show tool input progress (for large artifacts being generated)
                   if (toolInputProgress) {
                     const { toolName, charCount } = toolInputProgress
                     const kbSize = (charCount / 1024).toFixed(1)
                     switch (toolName) {
                       case 'create_artifact':
                         return `Generating artifact... (${kbSize}KB)`
                       case 'update_artifact':
                         return `Updating artifact... (${kbSize}KB)`
                       case 'write_file':
                         return `Writing file... (${kbSize}KB)`
                       default:
                         return `Generating ${toolName}... (${kbSize}KB)`
                     }
                   }

                   if (streamingToolCalls.length > 0) {
                     return 'Finishing up...'
                   }
                   return streamingContent ? 'Responding...' : 'Processing...'
                 })() :
                 processingMessage || 'Processing...'}
              </ShimmerText>
              {/* Elapsed time display */}
              {isStreaming && streamingStartTime && (
                <span className="text-sm text-text-muted font-mono">
                  ({((Date.now() - streamingStartTime) / 1000).toFixed(1)}s)
                </span>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-bg-surface">
        <div className="max-w-3xl mx-auto p-4">
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

          {/* Todo panel - shows AI's task progress */}
          <TodoPanel />

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
// Soulful Greeting System (800+ unique combinations)
// ============================================

// Tone type for matching greetings with follow-ups
type GreetingTone = 'warm' | 'energetic' | 'calm'

// ===========================================
// QUESTION GREETINGS (stand alone, no follow-up)
// ===========================================

const MORNING_QUESTIONS = [
  "What's the plan for today?",
  "What are we building today?",
  "What's on the agenda?",
  "What shall we tackle this morning?",
  "What's calling for attention?",
  "What matters most today?",
  "What's first on the list?",
  "What are you thinking about?",
  "What's worth focusing on?",
  "What brings you here this morning?",
  "What's on your mind?",
  "Ready to create something?",
  "What shall we work on?",
  "Where should we start?",
  "What's the priority today?",
]

const AFTERNOON_QUESTIONS = [
  "How's it going so far?",
  "How can I help this afternoon?",
  "How's the day shaping up?",
  "What are we working through?",
  "What's on your mind?",
  "What's next on the list?",
  "What needs attention?",
  "How can I help move things forward?",
  "What shall we tackle?",
  "What's worth finishing?",
  "Where were we?",
  "What's the focus now?",
]

const EVENING_QUESTIONS = [
  "What's on your mind this evening?",
  "What shall we work on?",
  "How can I help tonight?",
  "What's worth finishing today?",
  "What are you thinking about?",
  "What can we tackle?",
  "What needs wrapping up?",
  "What's calling for attention?",
  "Where should we focus?",
  "What's the plan for tonight?",
  "What brings you here?",
]

const GENERIC_QUESTIONS = [
  "What's on your mind?",
  "What are you working on?",
  "What's the challenge?",
  "What shall we create?",
  "What's worth exploring?",
  "What caught your interest?",
  "What problem are we solving?",
  "What matters to you right now?",
  "What are we figuring out?",
  "What's brewing?",
  "What's the goal?",
  "Where do we start?",
  "What needs doing?",
  "What's next?",
  "What are you curious about?",
  "What shall we build?",
  "What's the task at hand?",
  "What are we making happen?",
]

// ===========================================
// STATEMENT GREETINGS (paired with follow-ups)
// ===========================================

const STATEMENT_GREETINGS: Record<GreetingTone, string[]> = {
  warm: [
    "Good to have you here.",
    "Glad you're back.",
    "Nice to see you.",
    "Welcome back.",
    "Here for you.",
    "Good to be working together.",
    "Always happy to help.",
    "Right here with you.",
    "At your service.",
    "Happy to see you.",
    "Pleased you're here.",
  ],
  energetic: [
    "Let's make something happen.",
    "Let's build something great.",
    "Ready to dive in.",
    "Let's get to work.",
    "Time to create.",
    "Let's figure this out.",
    "Ready to tackle anything.",
    "Let's do this.",
    "Fired up and ready.",
    "Let's make progress.",
    "Ready for action.",
  ],
  calm: [
    "Here whenever you're ready.",
    "Take your time.",
    "No rush at all.",
    "Ready when you are.",
    "Standing by.",
    "Here to help.",
    "At your pace.",
    "Whenever you're ready.",
    "I'm here.",
    "Present and ready.",
    "Listening.",
  ],
}

// ===========================================
// FOLLOW-UPS (statements only, tone-matched)
// ===========================================

const FOLLOW_UPS: Record<GreetingTone, string[]> = {
  warm: [
    "I'm here to help with whatever you need.",
    "Let me know how I can assist.",
    "Happy to work through anything together.",
    "I've got your back.",
    "Whatever you need, I'm here.",
    "Looking forward to helping out.",
    "Count on me.",
    "Here to support you.",
    "Together we'll figure it out.",
  ],
  energetic: [
    "Let's tackle something together.",
    "Ready to dive in whenever you are.",
    "Let's see what we can accomplish.",
    "Time to make things happen.",
    "Let's push forward.",
    "Ready to build.",
    "Let's get moving.",
    "Onward and upward.",
    "Let's crush it.",
  ],
  calm: [
    "Take your time. I'm not going anywhere.",
    "I'm listening.",
    "No pressure at all.",
    "Whenever you're ready to begin.",
    "I'll be right here.",
    "Just let me know.",
    "At your own pace.",
    "I'm patient.",
    "Ready to listen.",
  ],
}

// ===========================================
// TIME-AWARE STATEMENT GREETINGS
// ===========================================

const MORNING_STATEMENTS: Array<{ text: string; tone: GreetingTone }> = [
  { text: "Good morning.", tone: 'warm' },
  { text: "Morning.", tone: 'calm' },
  { text: "Fresh start today.", tone: 'energetic' },
  { text: "New day ahead.", tone: 'energetic' },
  { text: "Rise and create.", tone: 'energetic' },
  { text: "A new beginning.", tone: 'calm' },
]

const AFTERNOON_STATEMENTS: Array<{ text: string; tone: GreetingTone }> = [
  { text: "Good afternoon.", tone: 'warm' },
  { text: "Afternoon.", tone: 'calm' },
  { text: "Midday energy.", tone: 'energetic' },
  { text: "Keeping momentum.", tone: 'energetic' },
  { text: "Steady progress.", tone: 'calm' },
]

const EVENING_STATEMENTS: Array<{ text: string; tone: GreetingTone }> = [
  { text: "Good evening.", tone: 'warm' },
  { text: "Evening.", tone: 'calm' },
  { text: "Winding down the day.", tone: 'calm' },
  { text: "Evening hours.", tone: 'calm' },
  { text: "Still time to create.", tone: 'energetic' },
]

// ===========================================
// GREETING SELECTION LOGIC
// ===========================================

type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night'

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night' // 9pm - 5am
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface GreetingResult {
  greeting: string
  followUp: string | null  // null for question greetings
  tone: GreetingTone | null
}

function selectGreeting(period: TimePeriod): GreetingResult {
  // 60% chance of question greeting (no follow-up), 40% statement (with follow-up)
  const useQuestion = Math.random() < 0.6

  if (useQuestion) {
    // Select a question greeting based on time period
    let questionPool: string[]
    switch (period) {
      case 'morning':
        questionPool = [...MORNING_QUESTIONS, ...GENERIC_QUESTIONS.slice(0, 8)]
        break
      case 'afternoon':
        questionPool = [...AFTERNOON_QUESTIONS, ...GENERIC_QUESTIONS.slice(0, 8)]
        break
      case 'evening':
        questionPool = [...EVENING_QUESTIONS, ...GENERIC_QUESTIONS.slice(0, 8)]
        break
      case 'night':
        questionPool = GENERIC_QUESTIONS
        break
    }
    return {
      greeting: randomFrom(questionPool),
      followUp: null,
      tone: null,
    }
  } else {
    // Select a statement greeting with matching follow-up
    // Mix time-specific and generic statements
    let statementPool: Array<{ text: string; tone: GreetingTone }>
    switch (period) {
      case 'morning':
        statementPool = [
          ...MORNING_STATEMENTS,
          ...Object.entries(STATEMENT_GREETINGS).flatMap(([t, texts]) =>
            texts.slice(0, 3).map(text => ({ text, tone: t as GreetingTone }))
          ),
        ]
        break
      case 'afternoon':
        statementPool = [
          ...AFTERNOON_STATEMENTS,
          ...Object.entries(STATEMENT_GREETINGS).flatMap(([t, texts]) =>
            texts.slice(0, 3).map(text => ({ text, tone: t as GreetingTone }))
          ),
        ]
        break
      case 'evening':
        statementPool = [
          ...EVENING_STATEMENTS,
          ...Object.entries(STATEMENT_GREETINGS).flatMap(([t, texts]) =>
            texts.slice(0, 3).map(text => ({ text, tone: t as GreetingTone }))
          ),
        ]
        break
      case 'night':
        // Late night: use calm and warm tones primarily
        statementPool = [
          ...STATEMENT_GREETINGS.calm.map(text => ({ text, tone: 'calm' as GreetingTone })),
          ...STATEMENT_GREETINGS.warm.map(text => ({ text, tone: 'warm' as GreetingTone })),
        ]
        break
    }

    const selected = randomFrom(statementPool)
    const matchingFollowUp = randomFrom(FOLLOW_UPS[selected.tone])

    return {
      greeting: selected.text,
      followUp: matchingFollowUp,
      tone: selected.tone,
    }
  }
}

// Build the greeting with optional name personalization
function buildGreeting(baseGreeting: string, userName: string | null, isQuestion: boolean): string {
  if (userName) {
    // Personalize based on greeting structure
    if (baseGreeting.startsWith("Good morning") ||
        baseGreeting.startsWith("Morning") ||
        baseGreeting.startsWith("Good afternoon") ||
        baseGreeting.startsWith("Afternoon") ||
        baseGreeting.startsWith("Good evening") ||
        baseGreeting.startsWith("Evening")) {
      // "Morning." -> "Morning, Spencer."
      return baseGreeting.replace(/^(Good morning|Morning|Good afternoon|Afternoon|Good evening|Evening)(\.)?/, `$1, ${userName}.`)
    }
    if (baseGreeting.startsWith("Good to have you") ||
        baseGreeting.startsWith("Glad you're back") ||
        baseGreeting.startsWith("Nice to see you") ||
        baseGreeting.startsWith("Welcome back") ||
        baseGreeting.startsWith("Happy to see you")) {
      // "Good to have you here." -> "Good to have you here, Spencer."
      return baseGreeting.replace(/\.$/, `, ${userName}.`)
    }
    if (isQuestion) {
      // "What's on your mind?" -> "Spencer, what's on your mind?"
      return `${userName}, ${baseGreeting.charAt(0).toLowerCase()}${baseGreeting.slice(1)}`
    }
    // Default: prepend "Hey [name]."
    return `Hey ${userName}. ${baseGreeting}`
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

  // Get random greeting (stable per component mount)
  const greetingData = useMemo(() => {
    const period = getTimePeriod()
    return selectGreeting(period)
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

  const isQuestion = greetingData.followUp === null
  const displayGreeting = buildGreeting(greetingData.greeting, userName, isQuestion)

  return (
    <div className="text-center animate-fade-in space-y-8">
      {/* Logo matching onboarding style */}
      <div className="welcome-logo mx-auto">J</div>

      {/* Dynamic greeting */}
      <div>
        <h1 className="font-display text-[32px] font-normal text-text-primary mb-3 tracking-tight">
          {displayGreeting}
        </h1>
        {greetingData.followUp && (
          <p className="text-text-secondary text-lg">
            {greetingData.followUp}
          </p>
        )}
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
