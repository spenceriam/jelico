import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Settings, AlertTriangle, Loader2 } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { useContextStore } from '../../stores/context'
import { useClarificationStore, type ClarificationRequest } from '../../stores/clarification'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ModeSelector } from '../ModeSelector/ModeSelector'
import { WorkspaceSelector } from '../Workspace/WorkspaceSelector'
import { ModelSelector } from '../Model/ModelSelector'
import { ShimmerText, BrailleLoader } from '../StatusIndicators'
import { TodoPanel } from '../Todo/TodoPanel'
import { ClarificationPanel } from '../Clarification/ClarificationPanel'
import { formatElapsedTime } from '../../utils/format'

// Minimum display time for status messages (ms)
const MIN_STATUS_DISPLAY_MS = 600

export function ChatArea() {
  const { messages, isStreaming, streamingContent, streamingToolCalls, streamingToolResults, streamingSegments, systemNotifications, activeConversationId, regenerateLastResponse, modeSwitchReason, modeTransitioning, lastCompletedTool, statusDisplayQueue, toolInputProgress, streamingStartTime } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()
  const { isProcessing, processingMessage } = useUIStore()
  const { getContextUsage, isCompacting } = useContextStore()
  const { setActiveRequest } = useClarificationStore()
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

  // Listen for clarification requests from the AI
  useEffect(() => {
    if (!window.jelico?.clarification?.onRequest) return

    const unsubscribe = window.jelico.clarification.onRequest(
      (request: ClarificationRequest) => {
        // Only show if it's for the active conversation
        if (request.conversationId === activeConversationId) {
          setActiveRequest(request)
        }
      }
    )

    return unsubscribe
  }, [activeConversationId, setActiveRequest])

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
            <div className="flex items-center gap-2 mt-4 py-3">
              <BrailleLoader className="text-accent text-lg" />
              <div className="flex items-center gap-1.5">
                <ShimmerText className="text-sm text-text-secondary">
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
                         // Completed status - brief flash after tool finishes
                         switch (name) {
                           case 'read_file':
                             return args.path ? `Read ${getShortPath(String(args.path))}` : 'File read'
                           case 'write_file':
                             return args.path ? `Wrote ${getShortPath(String(args.path))}` : 'File written'
                           case 'list_directory':
                             return args.path ? `Explored ${getShortPath(String(args.path))}` : 'Directory explored'
                           case 'search_files':
                             return 'Search complete'
                           case 'execute_command':
                             return 'Command complete'
                           case 'web_search':
                             return 'Search complete'
                           case 'web_fetch': {
                             const url = String(args.url || '')
                             try {
                               const hostname = new URL(url).hostname
                               return `Fetched ${hostname}`
                             } catch {
                               return 'Page fetched'
                             }
                           }
                           case 'create_artifact':
                             return args.title ? `Created: ${String(args.title).slice(0, 25)}` : 'Artifact created'
                           case 'update_artifact':
                             return args.title ? `Updated: ${String(args.title).slice(0, 25)}` : 'Artifact updated'
                           case 'spawn_agent':
                             return args.name ? `Started: ${args.name}` : 'Sub-agent started'
                           case 'wait_for_agent':
                             return 'Sub-agent complete'
                           case 'get_agent_status':
                             return 'Status checked'
                           case 'continue_agent':
                             return 'Sub-agent resumed'
                           case 'cancel_agent':
                             return 'Sub-agent cancelled'
                           case 'dismiss_agent':
                             return 'Sub-agent dismissed'
                           case 'get_agents_summary':
                             return 'Agents reviewed'
                           case 'switch_mode':
                             return args.mode ? `Switched to ${args.mode}` : 'Mode switched'
                           case 'todo_write':
                             return 'Tasks updated'
                           case 'todo_read':
                             return 'Tasks loaded'
                           case 'todo_check':
                             return 'Task checked'
                           case 'ask_user_question':
                             return 'Question sent'
                           default:
                             return 'Done'
                         }
                       } else {
                         // In-progress status - while tool is running
                         switch (name) {
                           case 'read_file':
                             return args.path ? `Reading ${getShortPath(String(args.path))}` : 'Reading file...'
                           case 'write_file':
                             return args.path ? `Writing ${getShortPath(String(args.path))}` : 'Writing file...'
                           case 'list_directory':
                             return args.path ? `Exploring ${getShortPath(String(args.path))}` : 'Exploring directory...'
                           case 'search_files':
                             return args.pattern ? `Searching for "${args.pattern}"` : 'Searching files...'
                           case 'execute_command': {
                             const cmd = String(args.command || '')
                             const shortCmd = cmd.length > 30 ? cmd.slice(0, 30) + '...' : cmd
                             return shortCmd ? `Running: ${shortCmd}` : 'Running command...'
                           }
                           case 'web_search':
                             return args.query ? `Searching: "${String(args.query).slice(0, 25)}"` : 'Searching the web...'
                           case 'web_fetch': {
                             const url = String(args.url || '')
                             try {
                               const hostname = new URL(url).hostname
                               return `Fetching ${hostname}`
                             } catch {
                               return 'Fetching page...'
                             }
                           }
                           case 'create_artifact':
                             return args.title ? `Creating: ${String(args.title).slice(0, 30)}` : 'Creating artifact...'
                           case 'update_artifact':
                             return args.title ? `Updating: ${String(args.title).slice(0, 30)}` : 'Updating artifact...'
                           case 'spawn_agent':
                             return args.name ? `Starting sub-agent: ${args.name}` : 'Starting sub-agent...'
                           case 'wait_for_agent':
                             return 'Waiting for sub-agent...'
                           case 'get_agent_status':
                             return 'Checking sub-agent...'
                           case 'continue_agent':
                             return 'Resuming sub-agent...'
                           case 'cancel_agent':
                             return 'Cancelling sub-agent...'
                           case 'dismiss_agent':
                             return 'Dismissing sub-agent...'
                           case 'get_agents_summary':
                             return 'Reviewing sub-agents...'
                           case 'switch_mode':
                             return args.mode ? `Switching to ${args.mode} mode...` : 'Switching mode...'
                           case 'todo_write':
                             return 'Updating tasks...'
                           case 'todo_read':
                             return 'Loading tasks...'
                           case 'todo_check':
                             return 'Checking task...'
                           case 'ask_user_question':
                             return 'Asking for input...'
                           default:
                             return 'Working...'
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

                     // Show tool input progress (for large content being generated)
                     if (toolInputProgress) {
                       const { toolName } = toolInputProgress
                       switch (toolName) {
                         case 'create_artifact':
                           return 'Generating artifact...'
                         case 'update_artifact':
                           return 'Updating artifact...'
                         case 'write_file':
                           return 'Writing file...'
                         case 'execute_command':
                           return 'Running command...'
                         default:
                           return 'Generating...'
                       }
                     }

                     if (streamingToolCalls.length > 0) {
                       // Check what tool is pending - show specific status instead of generic "Finishing up"
                       const pendingTool = streamingToolCalls.find(tc =>
                         !streamingToolResults.some(tr => tr.toolCallId === tc.id)
                       )
                       if (pendingTool) {
                         const name = pendingTool.name || 'tool'
                         switch (name) {
                           case 'spawn_agent': return 'Starting sub-agent...'
                           case 'wait_for_agent': return 'Waiting for sub-agent...'
                           case 'create_artifact': return 'Creating artifact...'
                           case 'update_artifact': return 'Updating artifact...'
                           case 'read_file': return 'Reading file...'
                           case 'write_file': return 'Writing file...'
                           case 'execute_command': return 'Running command...'
                           case 'search_files': return 'Searching files...'
                           case 'list_directory': return 'Exploring directory...'
                           case 'web_search': return 'Searching the web...'
                           case 'web_fetch': return 'Fetching page...'
                           case 'ask_user_question': return 'Preparing question...'
                           default: return `Running ${name.replace(/_/g, ' ')}...`
                         }
                       }
                       return 'Processing response...'
                     }
                     return streamingContent ? 'Responding...' : 'Processing...'
                   })() :
                   processingMessage || 'Processing...'}
                </ShimmerText>
                {/* Elapsed time display - right next to status text */}
                {isStreaming && streamingStartTime && (
                  <span className="text-sm text-text-muted">
                    ({formatElapsedTime(Date.now() - streamingStartTime)})
                  </span>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Panels sticky to bottom of scroll area */}
        <div className="sticky bottom-0 max-w-3xl mx-auto px-4 space-y-2">
          {/* Clarification panel - AI asking for user input */}
          <ClarificationPanel />
          {/* Todo panel - task tracking */}
          <TodoPanel />
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
// Soulful Greeting System (1500+ unique combinations)
// ============================================

// Tone type for matching greetings with follow-ups
type GreetingTone = 'warm' | 'energetic' | 'calm' | 'curious' | 'playful'

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
  "Coffee's ready—what's the mission?",
  "New day, new code?",
  "What's cooking in that brain of yours?",
  "Morning! What problem shall we crack?",
  "What's the first thing we're fixing?",
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
  "Making progress? What's next?",
  "What's the current puzzle?",
  "Midday momentum—where to?",
  "What's been bugging you?",
  "Found any interesting problems?",
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
  "One more feature before calling it?",
  "What's keeping you up?",
  "Late night debugging session?",
  "What's the evening project?",
]

const NIGHT_QUESTIONS = [
  "Burning the midnight oil?",
  "Night owl coding session?",
  "What's keeping you awake?",
  "Late night inspiration struck?",
  "Can't sleep without solving this one?",
  "What's on your mind at this hour?",
  "Quiet hours, focused work?",
  "The best code is written at night, right?",
  "What's the late-night project?",
  "Working through something tricky?",
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
  "Got something interesting?",
  "What's the idea?",
  "Debugging or building?",
  "What needs thinking through?",
  "Got a tricky one for me?",
  "What's the adventure today?",
]

// Creative/coding-specific questions
const CRAFT_QUESTIONS = [
  "What shall we architect?",
  "Got a feature in mind?",
  "What needs refactoring?",
  "Debugging something tricky?",
  "What's the technical challenge?",
  "Building something new?",
  "What's the design problem?",
  "Working on something creative?",
  "What's the next iteration?",
  "Prototype or production?",
  "What's the use case?",
  "Starting fresh or continuing?",
  "What broke this time?",
  "Adding features or fixing bugs?",
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
    "Glad we're doing this again.",
    "Your favorite coding buddy, reporting in.",
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
    "Let's ship something.",
    "Game time.",
    "Let's write some code.",
    "Keyboards ready.",
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
    "Waiting patiently.",
    "All ears.",
    "Unhurried and ready.",
  ],
  curious: [
    "I wonder what we'll build.",
    "Curious what you're thinking about.",
    "Eager to hear your ideas.",
    "Interested in what's next.",
    "Always curious about your projects.",
    "Wonder what challenge awaits.",
    "Intrigued by what's coming.",
    "Looking forward to hearing more.",
    "Keen to understand the problem.",
    "Fascinated by what you're working on.",
  ],
  playful: [
    "Another day, another bug to squash.",
    "Ready to wrangle some code.",
    "The compiler awaits.",
    "Let's make computers do our bidding.",
    "Time to make the pixels dance.",
    "Ready to turn coffee into code.",
    "Your ideas, my circuits.",
    "The keyboard is mightier than the mouse.",
    "Bits and bytes at your command.",
    "Semicolons loaded and ready.",
    "Let's debug reality.",
    "Code mode: activated.",
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
    "Your problems are my problems.",
    "Let's make this happen together.",
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
    "No challenge too big.",
    "Bring on the complexity.",
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
    "The floor is yours.",
    "Speak when ready.",
  ],
  curious: [
    "Tell me what you're thinking.",
    "I want to understand your vision.",
    "Walk me through it.",
    "I'd love to hear more.",
    "What's the backstory?",
    "Help me see the full picture.",
    "I'm all ears for the details.",
    "Explain it to me.",
    "Share your thinking.",
  ],
  playful: [
    "Let's see what trouble we can get into.",
    "The code won't write itself... or will it?",
    "Warning: productivity ahead.",
    "Caution: may cause working software.",
    "Side effects may include shipped features.",
    "No bugs were harmed in the making of this code.",
    "Let's make something that doesn't 500.",
    "Time to turn ideas into reality.",
    "Adventure awaits in the codebase.",
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
  { text: "Morning coffee and code.", tone: 'playful' },
  { text: "Dawn of a new feature.", tone: 'playful' },
  { text: "Early bird gets the clean build.", tone: 'playful' },
  { text: "The morning is full of possibility.", tone: 'curious' },
]

const AFTERNOON_STATEMENTS: Array<{ text: string; tone: GreetingTone }> = [
  { text: "Good afternoon.", tone: 'warm' },
  { text: "Afternoon.", tone: 'calm' },
  { text: "Midday energy.", tone: 'energetic' },
  { text: "Keeping momentum.", tone: 'energetic' },
  { text: "Steady progress.", tone: 'calm' },
  { text: "Post-lunch productivity.", tone: 'playful' },
  { text: "The day continues.", tone: 'calm' },
  { text: "Afternoon stretch, then code.", tone: 'playful' },
]

const EVENING_STATEMENTS: Array<{ text: string; tone: GreetingTone }> = [
  { text: "Good evening.", tone: 'warm' },
  { text: "Evening.", tone: 'calm' },
  { text: "Winding down the day.", tone: 'calm' },
  { text: "Evening hours.", tone: 'calm' },
  { text: "Still time to create.", tone: 'energetic' },
  { text: "The quiet hours.", tone: 'calm' },
  { text: "Evening productivity unlocked.", tone: 'playful' },
  { text: "Day's not over yet.", tone: 'energetic' },
]

const NIGHT_STATEMENTS: Array<{ text: string; tone: GreetingTone }> = [
  { text: "The night is young.", tone: 'playful' },
  { text: "Peak coding hours.", tone: 'playful' },
  { text: "Night mode activated.", tone: 'playful' },
  { text: "Quiet time to focus.", tone: 'calm' },
  { text: "The world sleeps, we code.", tone: 'playful' },
  { text: "Late night inspiration.", tone: 'curious' },
  { text: "The best work happens after midnight.", tone: 'playful' },
  { text: "Night owl mode.", tone: 'calm' },
]

// ===========================================
// SPECIAL GREETINGS (rare, memorable)
// ===========================================

const SPECIAL_GREETINGS: Array<{ text: string; followUp: string }> = [
  { text: "Plot twist: you showed up.", followUp: "The protagonist always returns." },
  { text: "Well, well, well.", followUp: "Look who's ready to build something." },
  { text: "Ah, there you are.", followUp: "I was wondering when you'd be back." },
  { text: "The hero returns.", followUp: "What quest awaits?" },
  { text: "You again.", followUp: "I was hoping you'd show up." },
  { text: "We meet again.", followUp: "What shall we create this time?" },
  { text: "I had a feeling you'd be here.", followUp: "Call it machine intuition." },
  { text: "Right on cue.", followUp: "There's work to be done." },
  { text: "Look who it is.", followUp: "Ready to make something great?" },
  { text: "Back for more?", followUp: "I like your persistence." },
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
  // 5% chance of special greeting (rare but memorable)
  if (Math.random() < 0.05) {
    const special = randomFrom(SPECIAL_GREETINGS)
    return {
      greeting: special.text,
      followUp: special.followUp,
      tone: 'playful',
    }
  }

  // 55% chance of question greeting (no follow-up), 45% statement (with follow-up)
  const useQuestion = Math.random() < 0.55

  if (useQuestion) {
    // Select a question greeting based on time period
    // Mix time-specific, generic, and craft questions
    let questionPool: string[]
    switch (period) {
      case 'morning':
        questionPool = [...MORNING_QUESTIONS, ...GENERIC_QUESTIONS.slice(0, 10), ...CRAFT_QUESTIONS.slice(0, 5)]
        break
      case 'afternoon':
        questionPool = [...AFTERNOON_QUESTIONS, ...GENERIC_QUESTIONS.slice(0, 10), ...CRAFT_QUESTIONS.slice(0, 5)]
        break
      case 'evening':
        questionPool = [...EVENING_QUESTIONS, ...GENERIC_QUESTIONS.slice(0, 10), ...CRAFT_QUESTIONS.slice(0, 5)]
        break
      case 'night':
        questionPool = [...NIGHT_QUESTIONS, ...GENERIC_QUESTIONS, ...CRAFT_QUESTIONS]
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
            texts.slice(0, 4).map(text => ({ text, tone: t as GreetingTone }))
          ),
        ]
        break
      case 'afternoon':
        statementPool = [
          ...AFTERNOON_STATEMENTS,
          ...Object.entries(STATEMENT_GREETINGS).flatMap(([t, texts]) =>
            texts.slice(0, 4).map(text => ({ text, tone: t as GreetingTone }))
          ),
        ]
        break
      case 'evening':
        statementPool = [
          ...EVENING_STATEMENTS,
          ...Object.entries(STATEMENT_GREETINGS).flatMap(([t, texts]) =>
            texts.slice(0, 4).map(text => ({ text, tone: t as GreetingTone }))
          ),
        ]
        break
      case 'night':
        // Late night: use night-specific, calm, and playful tones
        statementPool = [
          ...NIGHT_STATEMENTS,
          ...STATEMENT_GREETINGS.calm.map(text => ({ text, tone: 'calm' as GreetingTone })),
          ...STATEMENT_GREETINGS.playful.map(text => ({ text, tone: 'playful' as GreetingTone })),
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
        baseGreeting.startsWith("Happy to see you") ||
        baseGreeting.startsWith("Pleased you're here")) {
      // "Good to have you here." -> "Good to have you here, Spencer."
      return baseGreeting.replace(/\.$/, `, ${userName}.`)
    }
    // Special greetings with personality
    if (baseGreeting.startsWith("Ah, there you are") ||
        baseGreeting.startsWith("Look who it is") ||
        baseGreeting.startsWith("You again") ||
        baseGreeting.startsWith("Well, well")) {
      return baseGreeting.replace(/\.$/, `, ${userName}.`)
    }
    if (isQuestion) {
      // 50% chance: "Spencer, what's on your mind?" vs "What's on your mind, Spencer?"
      if (Math.random() < 0.5) {
        return `${userName}, ${baseGreeting.charAt(0).toLowerCase()}${baseGreeting.slice(1)}`
      } else {
        return baseGreeting.replace(/\?$/, `, ${userName}?`)
      }
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
