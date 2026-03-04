import { create } from 'zustand'
import type { AgentMode } from '../lib/modes'
import { useArtifactStore } from './artifacts'
import type { Artifact } from './artifacts'
import { useWorkspaceStore } from './workspaces'
import { useAgentStore } from './agents'
import { useSkillStore } from './skills'
import { useContextStore, estimateTokens } from './context'
import { useTodoStore } from './todos'
import { useClarificationStore } from './clarification'
import { notifyUserEvent } from '../lib/notifications'

export interface MessageUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokensPerSecond?: number
  durationMs?: number
  mode?: AgentMode
  model?: string
  finishReason?: string
}

export interface MessageAttachment {
  id: string
  type: 'image' | 'text' | 'document'
  name: string
  mimeType: string
  data: string // base64 for images, text content for text files
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  segments?: StreamingSegment[]
  attachments?: MessageAttachment[]
  createdAt: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  usage?: MessageUsage
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status?: 'starting' | 'executing' | 'complete' | 'error' | 'canceled' | 'cancelled'
}

export interface ToolResult {
  toolCallId: string
  result: unknown
  error?: string
}

const INTERNAL_WEB_GATE_RESULT_TYPES = new Set(['deferred_to_subagents', 'direct_limit_reached'])
const GIT_BRANCH_SWITCH_COMMAND_PATTERN = /\bgit(?:\s+-c\s+\S+)*\s+(?:checkout|switch)\b/i

function isInternalWebGateResultPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const obj = payload as Record<string, unknown>
  if (obj.success !== true) return false
  const results = obj.results as Record<string, unknown> | undefined
  const resultType = typeof results?.type === 'string' ? results.type : ''
  return INTERNAL_WEB_GATE_RESULT_TYPES.has(resultType)
}

function shouldRefreshWorkspaceGitAfterCommand(toolCall: ToolCall | undefined, result: unknown): boolean {
  if (!toolCall || toolCall.name !== 'execute_command') return false
  if (!result || typeof result !== 'object') return false

  const resultObj = result as Record<string, unknown>
  if (resultObj.success !== true) return false

  const command = toolCall.args?.command
  if (typeof command !== 'string') return false

  return GIT_BRANCH_SWITCH_COMMAND_PATTERN.test(command)
}

// Streaming segment - tracks content in the order it arrives
// This enables proper interleaving of text and tool calls in the UI
export type StreamingSegment =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCallId: string }

interface Conversation {
  id: string
  title: string
  workspaceId?: string
  model: string
  providerId: string
  mode?: AgentMode
  archivedAt?: number | null
  createdAt: number
  updatedAt: number
  messages?: Message[]
}

// Message queue for queuing messages while streaming
interface QueuedMessage {
  content: string
  attachments?: MessageAttachment[]
  providerId: string
  model: string
  conversationId?: string | null
}

// System notifications that appear inline in chat
export type SystemNotificationType =
  | 'compaction_warning'
  | 'compaction_complete'
  | 'model_changed'
  | 'artifacts_created'
  | 'info'

export interface SystemNotification {
  id: string
  type: SystemNotificationType
  conversationId?: string
  message?: string
  artifacts?: Array<{ id: string; title: string; type: string }>
  modelName?: string
  timestamp: number
}

// Status display item for graceful UX
interface StatusDisplayItem {
  id: string
  toolName: string
  args: Record<string, unknown>
  startedAt: number
  completedAt?: number
}

interface ConversationStreamState {
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: ToolCall[]
  streamingToolResults: ToolResult[]
  streamingSegments: StreamingSegment[]
  statusDisplayQueue: StatusDisplayItem[]
  toolInputProgress: { toolName: string; charCount: number } | null
  isReasoning: boolean
  reasoningContent: string
  streamingStartTime: number | null
  lastCompletedTool: { name: string; args: Record<string, unknown>; completedAt: number } | null
}

interface PendingStreamCheckpoint {
  providerId: string
  model: string
  startedAt: number
}

interface InterruptedConversationState extends PendingStreamCheckpoint {
  detectedAt: number
}

interface ChatStore {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  conversationStreams: Record<string, ConversationStreamState>
  interruptedConversations: Record<string, InterruptedConversationState>
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: ToolCall[]
  streamingToolResults: ToolResult[]
  // Segments track the ORDER of content arrival for proper interleaving in UI
  streamingSegments: StreamingSegment[]
  systemNotifications: SystemNotification[]
  isLoading: boolean
  error: string | null
  mode: AgentMode
  modeTransitioning: boolean
  modeSwitchReason: string | null
  messageQueue: QueuedMessage[]
  lastCompletedTool: { name: string; args: Record<string, unknown>; completedAt: number } | null
  // Status display queue for graceful UX - ensures each status shows for minimum time
  statusDisplayQueue: StatusDisplayItem[]
  // Tool input progress - shown when AI is generating large tool inputs (like artifacts)
  toolInputProgress: { toolName: string; charCount: number } | null
  // Reasoning/thinking state for thinking models (Kimi K2.5, o1, o3, etc.)
  isReasoning: boolean
  reasoningContent: string
  // Streaming start time for elapsed time display
  streamingStartTime: number | null

  // Actions
  loadConversations: () => Promise<void>
  createConversation: (providerId: string, model: string, initialMessageHint?: string) => Promise<string>
  setActiveConversation: (id: string | null) => Promise<void>
  sendMessage: (content: string, providerId: string, model: string, attachments?: MessageAttachment[]) => Promise<void>
  queueMessage: (content: string, providerId: string, model: string, attachments?: MessageAttachment[], conversationId?: string | null) => void
  processQueue: () => Promise<void>
  sendQueuedNow: (queueIndex: number) => Promise<boolean>
  stopStreaming: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  setMode: (mode: AgentMode) => void
  setModeTransitioning: (transitioning: boolean) => void
  handleModeSwitch: (fromMode: AgentMode, toMode: AgentMode, reason: string) => void
  clearError: () => void
  regenerateLastResponse: (providerId: string, model: string) => Promise<void>
  resumeInterruptedConversation: (conversationId?: string) => Promise<void>
  dismissInterruptedConversation: (conversationId?: string) => void
  addSystemNotification: (notification: Omit<SystemNotification, 'id' | 'timestamp'>) => void
  clearSystemNotifications: () => void
  setConversationWorkspaceId: (id: string, workspaceId: string | null) => void
  getRegenerateArtifactImpact: () => { artifacts: Array<{ id: string; title: string; type: string }> }
}

const streamChannelByConversation = new Map<string, string>()
let modeTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null
const PENDING_STREAMS_STORAGE_KEY = 'jelico.pending_streams.v1'
const INLINE_TOOL_CALL_BEGIN_TOKEN = '<|tool_call_begin|>'
const INLINE_TOOL_CALL_ARGUMENT_BEGIN_TOKEN = '<|tool_call_argument_begin|>'
const INLINE_TOOL_CALL_END_TOKEN = '<|tool_call_end|>'
const WORKTREE_MENTION_REGEX = /\b(work[\s-]?tree|git[\s-]?work[\s-]?tree|git tree)\b/i
const WORKTREE_MENTION_COOLDOWN_MS = 5 * 60 * 1000
const worktreeGuidanceByConversation = new Map<string, { planningShown: boolean; lastMentionAt: number }>()
const DEFAULT_MODE_PREFERENCE_KEY = 'defaultMode'
const AGENT_MODES: AgentMode[] = ['auto', 'execute', 'plan', 'explore', 'review']
const FULL_EXECUTE_CONFIRM_MESSAGE = [
  'Enable Full Execute?',
  '',
  'Full Execute runs actions without per-action permission prompts while this mode is active.',
  'Use this only in environments you trust (for example, a sandbox, VM, or disposable workspace).',
  'You are responsible for actions taken in this mode.',
].join('\n')

function isAgentMode(value: unknown): value is AgentMode {
  return typeof value === 'string' && AGENT_MODES.includes(value as AgentMode)
}

async function getPreferredDefaultMode(): Promise<AgentMode> {
  if (typeof window === 'undefined' || !window.jelico?.soul?.getPreference) {
    return 'auto'
  }

  try {
    const preference = await window.jelico.soul.getPreference(DEFAULT_MODE_PREFERENCE_KEY)
    return isAgentMode(preference?.value) ? preference.value : 'auto'
  } catch (error) {
    console.warn('[Chat Store] Failed to load default mode preference, falling back to auto:', error)
    return 'auto'
  }
}

function isModeTransitionAllowed(currentMode: AgentMode, nextMode: AgentMode): boolean {
  if (nextMode !== 'execute' || currentMode === 'execute') {
    return true
  }

  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true
  }

  return window.confirm(FULL_EXECUTE_CONFIRM_MESSAGE)
}

function inferWorktreeBranchType(text: string): 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore' {
  const value = text.toLowerCase()
  if (/\b(fix|bug|broken|error|regression|issue|repair|resolve)\b/.test(value)) return 'fix'
  if (/\b(refactor|cleanup|restructure|rewrite|optimi[sz]e|performance)\b/.test(value)) return 'refactor'
  if (/\b(doc|docs|readme|documentation|guide|changelog)\b/.test(value)) return 'docs'
  if (/\b(test|tests|testing|spec|specs|unit|integration|e2e)\b/.test(value)) return 'test'
  if (/\b(chore|deps|dependency|config|tooling|ci|build|lint)\b/.test(value)) return 'chore'
  return 'feat'
}

function toBranchSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`'"*()[\]{}<>~!@#$%^&+=:;,.?/\\|]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function getSuggestedWorktreeBranchName(initialMessageHint?: string, workspaceName?: string): string {
  const firstLine = (initialMessageHint || '').split('\n')[0]?.trim() || ''
  const branchType = inferWorktreeBranchType(firstLine)
  const slug = toBranchSlug(firstLine) || toBranchSlug(workspaceName || '') || 'new-chat'
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14)

  return `worktree/${branchType}/${slug}-${timestamp}`
}

function buildWorktreeGuidanceMessage(input: {
  workspaceName?: string
  isGitWorkspace: boolean
  isWorktreeWorkspace: boolean
  branch?: string
  relatedConversationCount: number
  fromPlanningMode: boolean
  fromMention: boolean
}): string {
  if (!input.workspaceName) {
    return 'Worktree note: this chat is in Sandbox, which is already filesystem-isolated per conversation. Git worktrees apply only to Git workspaces.'
  }

  if (!input.isGitWorkspace) {
    return `Worktree note: "${input.workspaceName}" is not a Git workspace, so worktrees are unavailable here.`
  }

  if (input.isWorktreeWorkspace) {
    const branchPart = input.branch ? ` on branch "${input.branch}"` : ''
    return `Worktree note: this chat is already in an isolated Git worktree${branchPart}. Filesystem and branch state are isolated from the main workspace.`
  }

  const relatedText =
    input.relatedConversationCount > 0
      ? `${input.relatedConversationCount} other conversation(s) share this workspace path. `
      : ''
  const contextText = input.fromPlanningMode
    ? 'Planning tip: '
    : input.fromMention
      ? 'Worktree tip: '
      : ''

  return `${contextText}you are in the main workspace "${input.workspaceName}" (not a worktree). ${relatedText}Use Worktrunk (new chat isolation) when you want full filesystem + branch isolation.`
}

function getTrailingTokenOverlap(value: string, token: string): number {
  const max = Math.min(value.length, token.length - 1)
  for (let size = max; size > 0; size -= 1) {
    if (value.endsWith(token.slice(0, size))) {
      return size
    }
  }
  return 0
}

function getMaxTrailingTokenOverlap(value: string, tokens: string[]): number {
  return tokens.reduce((max, token) => Math.max(max, getTrailingTokenOverlap(value, token)), 0)
}

function createInlineToolProtocolFilter() {
  const startTokens = [INLINE_TOOL_CALL_BEGIN_TOKEN, INLINE_TOOL_CALL_ARGUMENT_BEGIN_TOKEN]
  let carry = ''
  let inProtocol = false

  const consume = (chunk: string): string => {
    if (!chunk) return ''

    let input = carry + chunk
    carry = ''
    let output = ''
    let cursor = 0

    while (cursor < input.length) {
      if (inProtocol) {
        const endIndex = input.indexOf(INLINE_TOOL_CALL_END_TOKEN, cursor)
        if (endIndex === -1) {
          const remaining = input.slice(cursor)
          const overlap = getTrailingTokenOverlap(remaining, INLINE_TOOL_CALL_END_TOKEN)
          carry = overlap > 0 ? remaining.slice(-overlap) : ''
          return output
        }

        cursor = endIndex + INLINE_TOOL_CALL_END_TOKEN.length
        inProtocol = false
        continue
      }

      let nextStartIndex = -1
      let matchedStartToken = ''
      for (const token of startTokens) {
        const idx = input.indexOf(token, cursor)
        if (idx !== -1 && (nextStartIndex === -1 || idx < nextStartIndex)) {
          nextStartIndex = idx
          matchedStartToken = token
        }
      }

      if (nextStartIndex === -1) {
        const remaining = input.slice(cursor)
        const overlap = getMaxTrailingTokenOverlap(remaining, startTokens)
        if (overlap > 0) {
          output += remaining.slice(0, -overlap)
          carry = remaining.slice(-overlap)
        } else {
          output += remaining
        }
        return output
      }

      output += input.slice(cursor, nextStartIndex)
      cursor = nextStartIndex + matchedStartToken.length
      inProtocol = true
    }

    return output
  }

  const flush = (): string => {
    if (inProtocol) {
      inProtocol = false
      carry = ''
      return ''
    }

    const tail = carry
    carry = ''

    if (!tail) return ''
    if (tail.includes('<|tool_call')) return ''
    return tail
  }

  return { consume, flush }
}

function splitBatchedToolPreambles(
  text: string,
  toolCount: number
): { leadingText: string; preambles: string[] } | null {
  if (toolCount < 2) return null

  const normalized = text.replace(/\r\n/g, '\n').trimEnd()
  if (!normalized) return null

  const candidateGroups: string[][] = []
  const splitByBlankLines = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (splitByBlankLines.length > 1) {
    candidateGroups.push(splitByBlankLines)
  }

  const splitByLines = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (splitByLines.length > 1) {
    candidateGroups.push(splitByLines)
  }

  const splitByColonSentences = normalized
    .split(/(?<=:)\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (splitByColonSentences.length > 1) {
    candidateGroups.push(splitByColonSentences)
  }

  for (const candidates of candidateGroups) {
    if (candidates.length < toolCount) continue

    const trailingCandidates = candidates.slice(-toolCount)
    const allLookLikePreambles = trailingCandidates.every(
      (candidate) => candidate.length > 2 && /:\s*$/.test(candidate)
    )

    if (!allLookLikePreambles) continue

    const preambles = trailingCandidates
      .map((candidate) => candidate.replace(/:\s*$/, '').trim())
      .filter(Boolean)

    if (preambles.length !== toolCount) continue

    return {
      leadingText: candidates.slice(0, -toolCount).join('\n\n').trim(),
      preambles,
    }
  }

  return null
}

function readPendingStreamCheckpoints(): Record<string, PendingStreamCheckpoint> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {}
    }
    const raw = window.localStorage.getItem(PENDING_STREAMS_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const entries = Object.entries(parsed).filter(([conversationId, value]) => {
      if (!conversationId || typeof conversationId !== 'string') return false
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const checkpoint = value as Record<string, unknown>
      return (
        typeof checkpoint.providerId === 'string' &&
        typeof checkpoint.model === 'string' &&
        typeof checkpoint.startedAt === 'number'
      )
    }) as Array<[string, PendingStreamCheckpoint]>

    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

function writePendingStreamCheckpoints(checkpoints: Record<string, PendingStreamCheckpoint>) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }
    window.localStorage.setItem(PENDING_STREAMS_STORAGE_KEY, JSON.stringify(checkpoints))
  } catch {
    // Ignore localStorage write failures
  }
}

function getPendingStreamCheckpoint(conversationId: string): PendingStreamCheckpoint | null {
  return readPendingStreamCheckpoints()[conversationId] || null
}

function setPendingStreamCheckpoint(conversationId: string, checkpoint: PendingStreamCheckpoint) {
  const checkpoints = readPendingStreamCheckpoints()
  checkpoints[conversationId] = checkpoint
  writePendingStreamCheckpoints(checkpoints)
}

function clearPendingStreamCheckpoint(conversationId: string) {
  const checkpoints = readPendingStreamCheckpoints()
  if (!checkpoints[conversationId]) return
  delete checkpoints[conversationId]
  writePendingStreamCheckpoints(checkpoints)
}

function getLatestUnansweredUserMessage(messages: Message[]): Message | null {
  let lastAssistantIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }

  for (let i = messages.length - 1; i > lastAssistantIndex; i -= 1) {
    if (messages[i].role === 'user') {
      return messages[i]
    }
  }

  return null
}

function getLatestUserMessage(messages: Message[]): Message | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return messages[i]
    }
  }
  return null
}

function isResumeShortcut(content: string): boolean {
  const normalized = content.trim().toLowerCase()
  return /^(resume|restart|continue)$/.test(normalized)
}

function hasIncompleteToolEvidence(messages: Message[]): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    const toolResults = message.toolResults || []
    return toolResults.some((toolResult) => {
      if (!toolResult?.result || typeof toolResult.result !== 'object') return false
      const payload = toolResult.result as Record<string, unknown>
      if (payload.cancellationReason === 'stream_end_incomplete') return true
      const error = String(payload.error || '').toLowerCase()
      return error.includes('before returning a final result')
    })
  }
  return false
}

function getRestoredTokenCount(messages: Message[]): number {
  if (messages.length === 0) return 0

  // Provider-reported usage may undercount on some models/providers.
  // Take the larger of provider usage and local estimate to avoid silent drops.
  const latestUsage = [...messages]
    .reverse()
    .find((msg) => msg.role === 'assistant' && typeof msg.usage?.totalTokens === 'number' && msg.usage.totalTokens > 0)

  const usageTotal = latestUsage?.usage?.totalTokens || 0
  const estimatedTotal = messages.reduce((sum, msg) => sum + estimateTokens(msg.content || ''), 0)

  return Math.max(usageTotal, estimatedTotal)
}

function getLastAssistantAndUser(messages: Message[]): {
  lastAssistantIndex: number
  lastAssistant: Message | null
  lastUser: Message | null
} {
  let lastAssistantIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }

  if (lastAssistantIndex === -1) {
    return { lastAssistantIndex, lastAssistant: null, lastUser: null }
  }

  let lastUser: Message | null = null
  for (let i = lastAssistantIndex - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      lastUser = messages[i]
      break
    }
  }

  return {
    lastAssistantIndex,
    lastAssistant: messages[lastAssistantIndex] || null,
    lastUser,
  }
}

function getArtifactsCreatedByLastAssistantTurn(
  activeConversationId: string | null,
  messages: Message[],
  artifacts: Artifact[]
): Artifact[] {
  if (!activeConversationId || messages.length < 2) return []

  const { lastAssistant, lastUser } = getLastAssistantAndUser(messages)
  if (!lastAssistant || !lastUser) return []

  const createCalls = (lastAssistant.toolCalls || [])
    .filter((tc) => tc.name === 'create_artifact')
    .map((tc) => ({
      title: typeof tc.args?.title === 'string' ? tc.args.title : undefined,
      type: typeof tc.args?.type === 'string' ? tc.args.type.toLowerCase() : undefined,
    }))

  if (createCalls.length === 0) return []

  const candidates = artifacts
    .filter((artifact) =>
      artifact.conversationId === activeConversationId &&
      artifact.createdAt > lastUser.createdAt
    )
    .sort((a, b) => b.createdAt - a.createdAt)

  if (candidates.length === 0) return []

  const usedIds = new Set<string>()
  const matched: Artifact[] = []

  for (const call of createCalls) {
    const callTitle = call.title?.trim().toLowerCase()
    const callType = call.type

    const hit = candidates.find((artifact) => {
      if (usedIds.has(artifact.id)) return false
      const typeMatches = callType ? artifact.type.toLowerCase() === callType : true
      const titleMatches = callTitle ? artifact.title.trim().toLowerCase() === callTitle : true
      return typeMatches && titleMatches
    })

    if (hit) {
      usedIds.add(hit.id)
      matched.push(hit)
    }
  }

  // Fallback when model omitted/mangled title args: best-effort newest artifacts from this turn.
  if (matched.length === 0) {
    return candidates.slice(0, createCalls.length)
  }

  return matched
}

function createEmptyConversationStreamState(): ConversationStreamState {
  return {
    isStreaming: false,
    streamingContent: '',
    streamingToolCalls: [],
    streamingToolResults: [],
    streamingSegments: [],
    statusDisplayQueue: [],
    toolInputProgress: null,
    isReasoning: false,
    reasoningContent: '',
    streamingStartTime: null,
    lastCompletedTool: null,
  }
}

function projectStreamStateToActiveFields(streamState: ConversationStreamState) {
  return {
    isStreaming: streamState.isStreaming,
    streamingContent: streamState.streamingContent,
    streamingToolCalls: streamState.streamingToolCalls,
    streamingToolResults: streamState.streamingToolResults,
    streamingSegments: streamState.streamingSegments,
    statusDisplayQueue: streamState.statusDisplayQueue,
    toolInputProgress: streamState.toolInputProgress,
    isReasoning: streamState.isReasoning,
    reasoningContent: streamState.reasoningContent,
    streamingStartTime: streamState.streamingStartTime,
    lastCompletedTool: streamState.lastCompletedTool,
  }
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  conversationStreams: {},
  interruptedConversations: {},
  modeTransitioning: false,
  modeSwitchReason: null,
  lastCompletedTool: null,
  isStreaming: false,
  streamingContent: '',
  streamingToolCalls: [],
  streamingToolResults: [],
  streamingSegments: [],
  systemNotifications: [],
  isLoading: false,
  error: null,
  mode: 'auto' as AgentMode,
  messageQueue: [],
  statusDisplayQueue: [],
  toolInputProgress: null,
  isReasoning: false,
  reasoningContent: '',
  streamingStartTime: null,

  loadConversations: async () => {
    set({ isLoading: true })
    try {
      const conversations = await window.jelico.conversations.list()
      set({ conversations, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createConversation: async (providerId, model, initialMessageHint) => {
    try {
      // Save the currently selected workspace to the new conversation.
      // If requested, auto-isolate via git worktree before creating the conversation.
      const workspaceState = useWorkspaceStore.getState()
      const activeWorkspace = workspaceState.workspaces.find(
        (workspace) => workspace.id === workspaceState.activeWorkspaceId
      )
      let targetWorkspaceId = workspaceState.activeWorkspaceId

      const shouldOfferIsolation = Boolean(
        targetWorkspaceId &&
        activeWorkspace &&
        activeWorkspace.isGit &&
        !activeWorkspace.isWorktree
      )

      if (shouldOfferIsolation) {
        const existingWorkspaceConversations = get().conversations.filter(
          (conversation) => conversation.workspaceId === targetWorkspaceId
        )
        const existingChatCount = existingWorkspaceConversations.length

        if (existingChatCount > 0) {
          let shouldCreateWorktree = workspaceState.createWorktreeOnNewChat

          if (!shouldCreateWorktree) {
            const sortedExisting = [...existingWorkspaceConversations]
              .sort((a, b) => b.updatedAt - a.updatedAt)
            const previewConversations = sortedExisting
              .slice(0, 6)
              .map((conversation, index) => `${index + 1}. ${conversation.title || 'Untitled chat'}`)
            const remainingCount = sortedExisting.length - previewConversations.length

            shouldCreateWorktree = window.confirm(
              'This project already has existing chats.\n\n' +
              'Current chats in this project:\n' +
              `${previewConversations.join('\n')}` +
              (remainingCount > 0 ? `\n...and ${remainingCount} more` : '') +
              '\n\n' +
              'Select OK to use Worktrunk isolation (new worktree + branch) for this chat.\n' +
              'Select Cancel to keep working in the shared workspace.'
            )
          }

          if (shouldCreateWorktree && targetWorkspaceId) {
              const branch = getSuggestedWorktreeBranchName(initialMessageHint, activeWorkspace?.name)
              try {
                const newWorkspace = await window.jelico.workspaces.createWorktree(targetWorkspaceId, branch)
                await workspaceState.loadWorkspaces()
              workspaceState.setActiveWorkspace(newWorkspace.id, true)
              targetWorkspaceId = newWorkspace.id
            } catch (error: any) {
              const message = error?.message || 'Failed to create worktree'
              set({ error: message })
              throw error
            }
          }
        }
      }

      const conversation = await window.jelico.conversations.create({
        title: 'New chat',
        model,
        providerId,
        workspaceId: targetWorkspaceId || undefined,
      })
      const conversations = await window.jelico.conversations.list()
      set({
        conversations,
        activeConversationId: conversation.id,
        messages: [],
      })
      useTodoStore.getState().setConversationId(conversation.id)
      useClarificationStore.getState().setConversationId(conversation.id)
      // New conversation has no artifacts - close canvas and clear streaming preview
      useArtifactStore.getState().clearStreamingPreview()
      useArtifactStore.getState().closeCanvas()
      return conversation.id
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },

  setActiveConversation: async (id) => {
    // Clear streaming preview when switching conversations to prevent state bleeding
    useArtifactStore.getState().clearStreamingPreview()

    // Cancel any pending mode transition timeout to prevent stale updates
    if (modeTransitionTimeoutId) {
      clearTimeout(modeTransitionTimeoutId)
      modeTransitionTimeoutId = null
    }

    if (!id) {
      const preferredMode = await getPreferredDefaultMode()
      const currentMode = get().mode

      set({
        activeConversationId: null,
        messages: [],
        modeTransitioning: false,
        modeSwitchReason: null,
        error: null,
        ...projectStreamStateToActiveFields(createEmptyConversationStreamState()),
      })
      useTodoStore.getState().setConversationId(null)
      useClarificationStore.getState().setConversationId(null)
      // New Chat: keep current workspace selection (user can switch to Sandbox explicitly)
      // No conversation = no artifacts to show
      useArtifactStore.getState().closeCanvas()

      // Reset fresh unsent chats to the user's saved default mode (auto when unset).
      if (preferredMode === 'execute') {
        get().setMode('execute')
        if (get().mode !== 'execute' && currentMode !== 'auto') {
          set({ mode: 'auto' })
        }
      } else if (preferredMode !== currentMode) {
        set({ mode: preferredMode })
      }
      return
    }

    set({ isLoading: true })
    try {
      const conversation = await window.jelico.conversations.get(id)
      const loadedMessages = conversation?.messages || []

      set((state) => {
        const streamState = state.conversationStreams[id] || createEmptyConversationStreamState()
        return {
          activeConversationId: id,
          messages: loadedMessages,
          isLoading: false,
          modeTransitioning: false,
          modeSwitchReason: null,
          ...projectStreamStateToActiveFields(streamState),
        }
      })
      useTodoStore.getState().hydrateConversationFromMessages(id, loadedMessages)
      useTodoStore.getState().setConversationId(id)
      useClarificationStore.getState().setConversationId(id)

      const activeStreamState = get().conversationStreams[id]
      const pendingCheckpoint = getPendingStreamCheckpoint(id)
      const unansweredUser = getLatestUnansweredUserMessage(loadedMessages)
      const hasIncompleteEvidence = hasIncompleteToolEvidence(loadedMessages)
      const fallbackUser = (pendingCheckpoint && hasIncompleteEvidence) ? getLatestUserMessage(loadedMessages) : null
      const resumableUser = unansweredUser || fallbackUser

      if (pendingCheckpoint && !streamChannelByConversation.has(id) && !activeStreamState?.isStreaming && resumableUser) {
        set((state) => {
          if (state.interruptedConversations[id]) return {}
          return {
            interruptedConversations: {
              ...state.interruptedConversations,
              [id]: {
                ...pendingCheckpoint,
                detectedAt: Date.now(),
              },
            },
          }
        })
      } else {
        set((state) => {
          const { [id]: _removed, ...rest } = state.interruptedConversations
          return { interruptedConversations: rest }
        })

        // Remove stale checkpoints when there is nothing to resume.
        if (pendingCheckpoint && !resumableUser) {
          clearPendingStreamCheckpoint(id)
        }
      }

      // Ensure context usage survives conversation reloads.
      if (conversation) {
        const contextState = useContextStore.getState()
        const existing = contextState.conversationContexts[id]

        if (!existing) {
          await contextState.initConversationContext(id, conversation.providerId, conversation.model)
        }

        const shouldHydrate = !existing || existing.currentTokenCount === 0
        if (shouldHydrate) {
          const restoredTokenCount = getRestoredTokenCount(loadedMessages)
          if (restoredTokenCount > 0) {
            contextState.updateTokenCount(id, restoredTokenCount)
          }
        }
      }

      // Restore workspace associated with this conversation (or reset to Sandbox if none)
      // Pass skipDbUpdate=true since we're restoring from DB, not changing
      useWorkspaceStore.getState().setActiveWorkspace(conversation?.workspaceId || null, true)

      // Load artifacts for this conversation and manage canvas state
      const wasCanvasOpen = useArtifactStore.getState().canvasOpen
      await useArtifactStore.getState().loadArtifactsForConversation(id)
      const conversationArtifacts = useArtifactStore.getState().getArtifactsByConversation(id)

      if (conversationArtifacts.length === 0) {
        // No artifacts in this conversation - close canvas if it was open
        if (wasCanvasOpen) {
          useArtifactStore.getState().closeCanvas()
        }
      } else if (wasCanvasOpen) {
        // Canvas was open and conversation has artifacts - select the latest one
        const latestArtifact = conversationArtifacts[conversationArtifacts.length - 1]
        useArtifactStore.getState().selectArtifact(latestArtifact.id)
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  // Internal flag to track if this is a regenerate (skips adding user message)
  sendMessage: async (content, providerId, model, attachments, _isRegenerate = false, _forcedConversationId: string | null = null) => {
    const { activeConversationId, messages, mode } = get()
    const requestedConversationId = _forcedConversationId ?? activeConversationId
    const contextStore = useContextStore.getState()

    const activeStreamState = requestedConversationId
      ? get().conversationStreams[requestedConversationId]
      : undefined

    const compactingActiveConversation =
      requestedConversationId !== null &&
      contextStore.isConversationCompacting(requestedConversationId)

    // If this conversation is already streaming or compacting, queue the message (unless regenerating)
    if (((activeStreamState?.isStreaming ?? false) || compactingActiveConversation) && !_isRegenerate) {
      get().queueMessage(content, providerId, model, attachments, requestedConversationId)
      return
    }

    if (
      !_isRegenerate &&
      requestedConversationId &&
      !attachments?.length &&
      get().interruptedConversations[requestedConversationId] &&
      isResumeShortcut(content)
    ) {
      await get().resumeInterruptedConversation(requestedConversationId)
      return
    }

    // Check for skill shortcuts (skip for regenerate - original message already processed)
    const skillMatch = _isRegenerate ? null : useSkillStore.getState().findSkillByShortcut(content)
    let finalContent = content
    let finalMode = mode

    if (skillMatch) {
      finalContent = skillMatch.skill.prompt.replace('{{context}}', skillMatch.context)
      if (skillMatch.skill.mode) {
        // Route skill mode changes through the same mode guard.
        get().setMode(skillMatch.skill.mode)
        finalMode = get().mode
      }
    }

    let conversationId = requestedConversationId

    // Create conversation if needed (never happens during regenerate)
    if (!conversationId) {
      conversationId = await get().createConversation(providerId, model, content)
      // Initialize context tracking for new conversation
      await useContextStore.getState().initConversationContext(conversationId, providerId, model)
    } else {
      // Ensure context is initialized for existing conversation
      const contextState = useContextStore.getState()
      if (!contextState.conversationContexts[conversationId]) {
        await contextState.initConversationContext(conversationId, providerId, model)
      }
    }

    if (!conversationId) return

    const targetConversationId = conversationId
    // Clean up stale running rows from previous turns before starting a new stream.
    // This is especially important for legacy agents that were created before parentId linkage.
    useAgentStore.getState().cancelRunningAgentsByConversation(targetConversationId)
    const updateConversationStreamState = (updater: (current: ConversationStreamState) => ConversationStreamState) => {
      set((state) => {
        const current = state.conversationStreams[targetConversationId] || createEmptyConversationStreamState()
        const next = updater(current)
        const nextConversationStreams = {
          ...state.conversationStreams,
          [targetConversationId]: next,
        }

        if (state.activeConversationId !== targetConversationId) {
          return { conversationStreams: nextConversationStreams }
        }

        return {
          conversationStreams: nextConversationStreams,
          ...projectStreamStateToActiveFields(next),
        }
      })
    }

    const clearConversationStreamState = () => {
      set((state) => {
        const { [targetConversationId]: _removed, ...rest } = state.conversationStreams
        if (state.activeConversationId !== targetConversationId) {
          return { conversationStreams: rest }
        }
        return {
          conversationStreams: rest,
          ...projectStreamStateToActiveFields(createEmptyConversationStreamState()),
        }
      })
    }

    const workspaceState = useWorkspaceStore.getState()
    const activeWorkspace = workspaceState.workspaces.find(
      (workspace) => workspace.id === workspaceState.activeWorkspaceId
    )

    let contextMessages = messages
    if (targetConversationId !== activeConversationId) {
      const conversation = await window.jelico.conversations.get(targetConversationId)
      contextMessages = conversation?.messages || []
    }

    // For regenerate, use existing messages; otherwise add user message
    let updatedMessages = contextMessages
    if (!_isRegenerate) {
      // Add user message (show original content, not expanded skill)
      const userMessage = await window.jelico.conversations.addMessage(conversationId, {
        role: 'user',
        content: content, // Original content for display
        attachments: attachments, // Include attachments for display
      })

      // Update title if this is the first message - use truncated content or placeholder
      // AI will generate a proper title in the background
      if (contextMessages.length === 0) {
        // Truncate to 50 chars max for initial display (AI generates better title)
        let titleSource = content.trim().slice(0, 50) + (content.trim().length > 50 ? '...' : '')

        // If no typed content, use a descriptive placeholder based on attachment type
        if (!titleSource && attachments && attachments.length > 0) {
          const hasText = attachments.some(a => a.type === 'text')
          const hasImage = attachments.some(a => a.type === 'image')
          if (hasText && hasImage) {
            titleSource = 'Pasted content...'
          } else if (hasText) {
            titleSource = 'Pasted text...'
          } else if (hasImage) {
            titleSource = 'Image prompt...'
          } else {
            titleSource = 'Attachment...'
          }
        }

        // Fallback to placeholder
        if (!titleSource) {
          titleSource = 'New conversation'
        }

        // Set initial title immediately (full message, CSS handles word-wrap)
        await window.jelico.conversations.updateTitle(conversationId, titleSource)
        // Reload conversations to get updated title
        const conversations = await window.jelico.conversations.list()
        set({ conversations })

        // Generate proper short title in background immediately (don't wait for AI response)
        // This starts in parallel with the main AI response so title appears quickly
        console.log('[Chat] Starting title generation for:', conversationId)
        window.jelico.ai.generateTitle({
          providerId,
          model,
          userMessage: content.slice(0, 1000),
          assistantMessage: '', // Generate from user message only for speed
        }).then(async (result) => {
          console.log('[Chat] Title generation result:', result)
          if (result.success && result.title) {
            console.log('[Chat] Updating title to:', result.title)
            await window.jelico.conversations.updateTitle(conversationId, result.title)
            const updatedConversations = await window.jelico.conversations.list()
            set({ conversations: updatedConversations })
          } else {
            console.warn('[Chat] Title generation failed, using fallback. Error:', result.error)
            // Fallback: truncate to first 50 chars if generation fails
            const fallbackTitle = content.trim().slice(0, 50) + (content.length > 50 ? '...' : '')
            await window.jelico.conversations.updateTitle(conversationId, fallbackTitle)
            const updatedConversations = await window.jelico.conversations.list()
            set({ conversations: updatedConversations })
          }
        }).catch(async (err) => {
          console.warn('[Chat] Failed to generate early title:', err)
          // Fallback: truncate to first 50 chars on error
          const fallbackTitle = content.trim().slice(0, 50) + (content.length > 50 ? '...' : '')
          await window.jelico.conversations.updateTitle(conversationId, fallbackTitle)
          const updatedConversations = await window.jelico.conversations.list()
          set({ conversations: updatedConversations })
        })
      }

      updatedMessages = [...contextMessages, userMessage]
      set((state) => (
        state.activeConversationId === targetConversationId
          ? { messages: updatedMessages }
          : {}
      ))
    }

    if (!_isRegenerate) {
      const mentionsWorktree = WORKTREE_MENTION_REGEX.test(content)
      const inPlanningMode = finalMode === 'plan'

      if (mentionsWorktree || inPlanningMode) {
        const marker = worktreeGuidanceByConversation.get(targetConversationId) || {
          planningShown: false,
          lastMentionAt: 0,
        }
        const now = Date.now()
        let shouldNotify = false

        if (inPlanningMode && !marker.planningShown) {
          marker.planningShown = true
          shouldNotify = true
        }

        if (mentionsWorktree && (now - marker.lastMentionAt > WORKTREE_MENTION_COOLDOWN_MS)) {
          marker.lastMentionAt = now
          shouldNotify = true
        }

        worktreeGuidanceByConversation.set(targetConversationId, marker)

        if (shouldNotify) {
          const relatedConversationCount = activeWorkspace?.id
            ? get().conversations.filter(
              (conversation) =>
                conversation.workspaceId === activeWorkspace.id &&
                conversation.id !== targetConversationId
            ).length
            : 0

          get().addSystemNotification({
            type: 'info',
            conversationId: targetConversationId,
            message: buildWorktreeGuidanceMessage({
              workspaceName: activeWorkspace?.name,
              isGitWorkspace: Boolean(activeWorkspace?.isGit),
              isWorktreeWorkspace: Boolean(activeWorkspace?.isWorktree),
              branch: activeWorkspace?.gitBranch,
              relatedConversationCount,
              fromPlanningMode: inPlanningMode,
              fromMention: mentionsWorktree,
            }),
          })
        }
      }
    }

    const streamStartedAt = Date.now()

    // Set streaming state for this conversation
    updateConversationStreamState(() => ({
      ...createEmptyConversationStreamState(),
      isStreaming: true,
      streamingStartTime: streamStartedAt,
    }))

    set((state) => {
      const { [targetConversationId]: _removedInterrupted, ...restInterrupted } = state.interruptedConversations
      return { interruptedConversations: restInterrupted }
    })

    setPendingStreamCheckpoint(targetConversationId, {
      providerId,
      model,
      startedAt: streamStartedAt,
    })

    // Build messages for AI - use expanded content for last user message if skill was used
    const aiMessages = updatedMessages.map((m, i) => {
      if (i === updatedMessages.length - 1 && m.role === 'user') {
        return { role: m.role, content: finalContent, attachments }
      }
      return { role: m.role, content: m.content, attachments: m.attachments }
    })

    // Get current artifacts for context
    const artifactStore = useArtifactStore.getState()
    const conversationArtifacts = conversationId
      ? artifactStore.getArtifactsByConversation(conversationId)
      : []

    // Build artifact context for AI
    const artifactContext = conversationArtifacts.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      language: a.language,
      // Include brief content preview for context (first 200 chars)
      preview: a.content.slice(0, 200) + (a.content.length > 200 ? '...' : ''),
    }))

    // Start streaming with mode, workspace, and artifact context
    let channelId: string
    try {
      channelId = window.jelico.ai.stream({
        providerId,
        model,
        mode: finalMode,
        messages: aiMessages,
        workspacePath: activeWorkspace?.path,
        artifacts: artifactContext,
        conversationId: targetConversationId,  // Pass conversation ID for state isolation
      })
    } catch (error: any) {
      console.error('[Chat Store] Failed to start stream:', error)
      clearPendingStreamCheckpoint(targetConversationId)
      clearConversationStreamState()
      set({ error: error?.message || 'Failed to start AI stream' })
      return
    }
    streamChannelByConversation.set(targetConversationId, channelId)

    let fullContent = ''
    const streamStartTime = Date.now()
    let firstChunkTime: number | null = null
    let lastChunkTime: number | null = null
    const inlineToolProtocolFilter = createInlineToolProtocolFilter()

    const flattenTextFromSegments = (segments: StreamingSegment[]): string => {
      let output = ''
      for (const segment of segments) {
        if (segment.type !== 'text' || !segment.content) continue
        if (!output) {
          output = segment.content
          continue
        }
        const needsSeparator = !/[\s\n]$/.test(output) && !/^\s/.test(segment.content)
        output += needsSeparator ? `\n\n${segment.content}` : segment.content
      }
      return output
    }

    const appendStreamTextChunk = (chunk: string) => {
      updateConversationStreamState((current) => {
        // Find or create the current text segment
        const segments = [...current.streamingSegments]
        const lastSegment = segments[segments.length - 1]
        let nextStreamingContent = fullContent

        if (lastSegment?.type === 'text') {
          // Append to existing text segment
          segments[segments.length - 1] = {
            type: 'text',
            content: lastSegment.content + chunk,
          }
          nextStreamingContent += chunk
        } else {
          const chunkAfterToolBoundary = chunk.replace(/^\s+/, '')
          if (!chunkAfterToolBoundary) {
            return current
          }

          // Create new text segment (first text, or text after a tool)
          segments.push({ type: 'text', content: chunkAfterToolBoundary })
          nextStreamingContent += nextStreamingContent.length > 0
            ? `\n\n${chunkAfterToolBoundary}`
            : chunkAfterToolBoundary
        }
        fullContent = nextStreamingContent

        return {
          ...current,
          streamingContent: nextStreamingContent,
          streamingSegments: segments,
        }
      })
    }

    // Handle stream chunks - track text segments for interleaving
    window.jelico.ai.onStreamChunk(channelId, (chunk) => {
      // Guard against undefined chunks (can happen with some stream events)
      if (chunk !== undefined && chunk !== null) {
        const sanitizedChunk = inlineToolProtocolFilter.consume(chunk)
        if (!sanitizedChunk) {
          return
        }

        const now = Date.now()
        if (firstChunkTime === null) {
          firstChunkTime = now
        }
        lastChunkTime = now
        appendStreamTextChunk(sanitizedChunk)
      }
    })

    // Handle tool calls - ai.ts now sends pre-formatted { id, name, args }
    // Also track segments for interleaving in UI
    window.jelico.ai.onToolCalls(channelId, (toolCalls) => {
      console.log('[Chat Store] Received tool calls:', toolCalls)
      const now = Date.now()
      updateConversationStreamState((current) => {
        const segments = [...current.streamingSegments]
        const lastSegment = segments[segments.length - 1]
        const statusQueueAdditions = toolCalls.map((tc) => ({
          id: tc.id,
          toolName: tc.name,
          args: tc.args,
          startedAt: now,
        }))

        if (lastSegment?.type === 'text') {
          const trimmed = lastSegment.content.replace(/[ \t]+$/g, '')
          const splitPreambles = splitBatchedToolPreambles(trimmed, toolCalls.length)

          if (splitPreambles) {
            segments.pop()

            if (splitPreambles.leadingText) {
              segments.push({
                type: 'text',
                content: splitPreambles.leadingText,
              })
            }

            for (let i = 0; i < toolCalls.length; i += 1) {
              const preamble = splitPreambles.preambles[i]
              const toolCall = toolCalls[i]
              if (preamble) {
                segments.push({
                  type: 'text',
                  content: preamble,
                })
              }
              segments.push({
                type: 'tool',
                toolCallId: toolCall.id,
              })
            }

            const nextStreamingContent = flattenTextFromSegments(segments)
            fullContent = nextStreamingContent

            return {
              ...current,
              streamingToolCalls: [...current.streamingToolCalls, ...toolCalls],
              streamingSegments: segments,
              streamingContent: nextStreamingContent,
              statusDisplayQueue: [
                ...current.statusDisplayQueue,
                ...statusQueueAdditions,
              ],
            }
          }

          // If a text segment ends with a colon, drop it to avoid "text:" before tool calls
          if (trimmed.endsWith(':')) {
            segments[segments.length - 1] = {
              type: 'text',
              content: trimmed.slice(0, -1),
            }
          }
        }

        // Add tool segments for each new tool call
        const newSegments: StreamingSegment[] = toolCalls.map(tc => ({
          type: 'tool' as const,
          toolCallId: tc.id,
        }))

        const nextStreamingContent = flattenTextFromSegments(segments)
        fullContent = nextStreamingContent

        return {
          ...current,
          streamingToolCalls: [...current.streamingToolCalls, ...toolCalls],
          streamingSegments: [...segments, ...newSegments],
          streamingContent: nextStreamingContent,
          // Add to status display queue for graceful UX
          statusDisplayQueue: [
            ...current.statusDisplayQueue,
            ...statusQueueAdditions,
          ],
        }
      })
    })

    // Handle tool results - ai.ts now sends pre-formatted { toolCallId, result }
    window.jelico.ai.onToolResults(channelId, (toolResults) => {
      console.log('[Chat Store] Received tool results:', toolResults)
      const now = Date.now()
      let shouldRefreshWorkspaceGit = false

      updateConversationStreamState((current) => {
        const hiddenToolCallIds = new Set<string>()
        for (const result of toolResults) {
          const matchingToolCall = current.streamingToolCalls.find(tc => tc.id === result.toolCallId)
          if (!matchingToolCall) continue

          if (shouldRefreshWorkspaceGitAfterCommand(matchingToolCall, result.result)) {
            shouldRefreshWorkspaceGit = true
          }

          const isInternalWebGateCall =
            (matchingToolCall.name === 'web_search' || matchingToolCall.name === 'web_fetch') &&
            isInternalWebGateResultPayload(result.result)
          if (isInternalWebGateCall) {
            hiddenToolCallIds.add(result.toolCallId)
          }
        }

        const visibleToolResults = toolResults.filter(result => !hiddenToolCallIds.has(result.toolCallId))

        // Update tool call statuses to 'complete' when their results arrive
        const completedIds = new Set(visibleToolResults.map(r => r.toolCallId))
        const updatedToolCalls = current.streamingToolCalls
          .filter(tc => !hiddenToolCallIds.has(tc.id))
          .map((tc) =>
            completedIds.has(tc.id) ? { ...tc, status: 'complete' as const } : tc
          )

        // Track the last completed tool for status line display
        const lastResult = visibleToolResults[visibleToolResults.length - 1]
        const completedToolCall = updatedToolCalls.find(tc => tc.id === lastResult?.toolCallId)

        // Update status display queue - mark items as completed but keep for minimum display time
        const updatedQueue = current.statusDisplayQueue
          .filter(item => !hiddenToolCallIds.has(item.id))
          .map(item => {
          if (completedIds.has(item.id) && !item.completedAt) {
            return { ...item, completedAt: now }
          }
          return item
          })

        const updatedSegments = current.streamingSegments.filter((segment) =>
          segment.type !== 'tool' || !hiddenToolCallIds.has(segment.toolCallId)
        )

        return {
          ...current,
          streamingToolCalls: updatedToolCalls,
          streamingToolResults: [...current.streamingToolResults, ...visibleToolResults],
          streamingSegments: updatedSegments,
          statusDisplayQueue: updatedQueue,
          lastCompletedTool: completedToolCall ? {
            name: completedToolCall.name,
            args: completedToolCall.args,
            completedAt: now,
          } : current.lastCompletedTool,
          // Clear tool input progress when tool completes - fixes status stuck on "Generating spawn_agent"
          toolInputProgress: null,
        }
      })

      if (shouldRefreshWorkspaceGit) {
        const conversationWorkspaceId = get().conversations.find((conversation) => conversation.id === targetConversationId)?.workspaceId
        const fallbackWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId
        const workspaceIdToRefresh = conversationWorkspaceId || fallbackWorkspaceId
        if (workspaceIdToRefresh) {
          void useWorkspaceStore.getState().refreshGit(workspaceIdToRefresh).catch((error) => {
            console.error('Failed to refresh workspace git state after branch switch command:', error)
          })
        }
      }
    })

    // Handle tool call updates - updates status and args for existing tool calls
    window.jelico.ai.onToolCallUpdate(channelId, (update) => {
      console.log('[Chat Store] Tool call update:', update)
      updateConversationStreamState((current) => ({
        ...current,
        streamingToolCalls: current.streamingToolCalls.map((tc) =>
          tc.id === update.id
            ? { ...tc, args: update.args, status: update.status }
            : tc
        ),
      }))
    })

    // Track artifacts created during this stream
    const createdArtifacts: Array<{ id: string; title: string; type: string }> = []

    // Handle artifacts
    window.jelico.ai.onArtifact(channelId, async (artifact) => {
      try {
        // Clear streaming preview since actual artifact is now ready
        useArtifactStore.getState().clearStreamingPreview()

        const newArtifact = await useArtifactStore.getState().addArtifact({
          conversationId: targetConversationId,
          type: artifact.type,
          title: artifact.title,
          content: artifact.content,
          language: artifact.language,
        })
        createdArtifacts.push({
          id: newArtifact.id,
          title: newArtifact.title,
          type: newArtifact.type,
        })
      } catch (error) {
        console.error('Failed to create artifact:', error)
      }
    })

    // Handle artifact updates
    window.jelico.ai.onUpdateArtifact(channelId, async (update) => {
      try {
        await useArtifactStore.getState().updateArtifact(update.id, {
          conversationId: targetConversationId,
          title: update.updates.title,
          content: update.updates.content,
          language: update.updates.language,
        })
        console.log('[Chat Store] Artifact updated:', update.id)
      } catch (error) {
        console.error('Failed to update artifact:', error)
      }
    })

    // Handle spawn agent events (agents run in main process, frontend just tracks for display)
    window.jelico.ai.onSpawnAgent(channelId, (agent) => {
      useAgentStore.getState().addAgent({
        id: agent.id,
        parentId: channelId,  // Link agent to stream for deterministic cleanup
        name: agent.name,
        displayName: agent.displayName,  // Friendly name like "Maya: Creating Wordle"
        task: agent.task,
        mode: agent.mode,
        conversationId: targetConversationId,  // Track which conversation this agent belongs to
      })
    })

    // Handle orphaned agents notification (agents spawned but never awaited by the model)
    window.jelico.ai.onOrphanedAgents(channelId, (data) => {
      console.warn(`[Chat Store] ${data.count} orphaned agent(s) detected - results auto-collected:`, data.agentIds)
      // Mark orphaned agents in the agent store so UI can indicate auto-collection
      const agentStore = useAgentStore.getState()
      for (const agentId of data.agentIds) {
        agentStore.updateAgent(agentId, {
          status: 'completed',
        })
      }
    })

    // Handle mode switch events (Auto mode transitions)
    window.jelico.ai.onModeSwitch(channelId, (data) => {
      get().handleModeSwitch(data.fromMode as AgentMode, data.toMode as AgentMode, data.reason)
    })

    // Handle agent progress updates
    window.jelico.ai.onAgentProgress(channelId, (update) => {
      // Map backend toolCalls (input/output) to frontend format (args/result)
      const mappedToolCalls = update.toolCalls?.map(tc => ({
        id: tc.id,
        name: tc.name,
        args: tc.input,
        result: tc.output,
      }))

      useAgentStore.getState().updateAgent(update.agentId, {
        status: update.status as any,
        displayName: update.displayName,  // Update display name if provided
        progress: update.progress,
        result: update.result,
        error: update.error,
        toolCalls: mappedToolCalls,
        completedAt: update.status === 'completed' || update.status === 'failed' ? Date.now() : undefined,
        latestUpdate: update.latestUpdate,  // Self-reported status from agent
      })

      // Clear streaming preview when sub-agent completes or fails
      // This handles cases where the sub-agent finishes without creating an artifact
      if (update.status === 'completed' || update.status === 'failed') {
        useArtifactStore.getState().clearStreamingPreview()
      }
    })

    // Handle todo updates from AI
    window.jelico.ai.onTodos(channelId, (todos) => {
      useTodoStore.getState().setTodos(targetConversationId, todos)
    })

    // Handle tool input progress (for large artifacts)
    window.jelico.ai.onToolInputProgress(channelId, (progress) => {
      updateConversationStreamState((current) => ({
        ...current,
        toolInputProgress: progress,
      }))
    })

    // Handle reasoning/thinking events for thinking models (Kimi K2.5, o1, o3, etc.)
    window.jelico.ai.onReasoningStart(channelId, () => {
      updateConversationStreamState((current) => ({
        ...current,
        isReasoning: true,
        reasoningContent: '',
      }))
    })

    window.jelico.ai.onReasoning(channelId, (data) => {
      updateConversationStreamState((current) => ({
        ...current,
        reasoningContent: current.reasoningContent + data.content,
      }))
    })

    window.jelico.ai.onReasoningEnd(channelId, () => {
      updateConversationStreamState((current) => ({
        ...current,
        isReasoning: false,
      }))
      // Note: reasoningContent is preserved until stream ends so UI can display it
    })

    // Handle artifact preview streaming - show content in Canvas as it's being generated
    window.jelico.ai.onArtifactPreview(channelId, (preview) => {
      // Send directly to artifact store - Canvas will show the streaming content
      useArtifactStore.getState().setStreamingPreview(preview)
    })

    // Handle stream end
    window.jelico.ai.onStreamEnd(channelId, async (stats) => {
      window.jelico.ai.removeListeners(channelId)
      useAgentStore.getState().cancelRunningAgentsByParent(channelId)
      const trailingSanitizedText = inlineToolProtocolFilter.flush()
      if (trailingSanitizedText) {
        appendStreamTextChunk(trailingSanitizedText)
      }
      const activeChannel = streamChannelByConversation.get(targetConversationId)
      if (activeChannel === channelId) {
        streamChannelByConversation.delete(targetConversationId)
      }
      const pendingCheckpoint = getPendingStreamCheckpoint(targetConversationId)
      useClarificationStore.getState().clearForConversation(targetConversationId)

      const streamSnapshot = get().conversationStreams[targetConversationId] || createEmptyConversationStreamState()
      const streamingToolCalls = streamSnapshot.streamingToolCalls
      const streamingToolResults = streamSnapshot.streamingToolResults
      const totalDurationMs = Date.now() - streamStartTime
      const completedResultIds = new Set(streamingToolResults.map((result) => result.toolCallId))
      const normalizedToolCalls = streamingToolCalls.map((toolCall) => {
        if (completedResultIds.has(toolCall.id)) {
          return toolCall.status === 'complete' ? toolCall : { ...toolCall, status: 'complete' as const }
        }
        if (toolCall.status === 'error' || toolCall.status === 'canceled' || toolCall.status === 'cancelled') {
          return toolCall
        }
        return { ...toolCall, status: 'canceled' as const }
      })

      const inferredToolResults: ToolResult[] = normalizedToolCalls
        .filter((toolCall) => !completedResultIds.has(toolCall.id))
        .map((toolCall) => ({
          toolCallId: toolCall.id,
          result: {
            success: false,
            canceled: true,
            cancellationReason: 'stream_end_incomplete',
            error: 'Tool ended before returning a final result.',
          },
          error: 'Tool ended before returning a final result.',
        }))

      const normalizedToolResults = [...streamingToolResults, ...inferredToolResults]
      const hasIncompleteToolCalls = inferredToolResults.length > 0
      const interruptedCheckpoint = pendingCheckpoint || {
        providerId,
        model,
        startedAt: streamSnapshot.streamingStartTime ?? streamStartedAt,
      }
      if (hasIncompleteToolCalls) {
        setPendingStreamCheckpoint(targetConversationId, interruptedCheckpoint)
      } else {
        clearPendingStreamCheckpoint(targetConversationId)
      }
      // Calculate actual generation time (first chunk to last chunk)
      // This excludes tool execution time and gives accurate tok/s
      const generationMs = (firstChunkTime && lastChunkTime)
        ? (lastChunkTime - firstChunkTime)
        : totalDurationMs

      try {
        const completedMode = get().mode
        // Calculate tokens per second using actual generation time
        let usage: Message['usage'] = undefined
        if (stats?.usage) {
          // Use generation time for tok/s (accurate), but store total duration for reference
          const tokensPerSecond = generationMs > 0
            ? Math.round((stats.usage.completionTokens / generationMs) * 1000)
            : 0
          usage = {
            promptTokens: stats.usage.promptTokens,
            completionTokens: stats.usage.completionTokens,
            totalTokens: stats.usage.totalTokens,
            tokensPerSecond,
            durationMs: totalDurationMs,
            mode: completedMode,
            model,
            finishReason: stats.finishReason,
          }
        }

        const hasToolActivity = normalizedToolCalls.length > 0 || normalizedToolResults.length > 0
        const baseAssistantContent = fullContent && fullContent.trim().length > 0
          ? fullContent
          : (hasToolActivity ? 'Completed requested tool actions.' : 'No response text was returned.')
        const interruptionNote = hasIncompleteToolCalls
          ? '\n\n[Some tool actions did not finish before the response ended. Use Restart to continue from the last request.]'
          : ''
        const assistantContent = interruptionNote && !baseAssistantContent.includes('did not finish before the response ended')
          ? `${baseAssistantContent}${interruptionNote}`
          : baseAssistantContent
        const assistantCreatedAt = streamSnapshot.streamingStartTime ?? streamStartedAt

        // Save assistant message with tool calls/results
        const assistantMessage = await window.jelico.conversations.addMessage(targetConversationId, {
          role: 'assistant',
          content: assistantContent,
          createdAt: assistantCreatedAt,
          segments: streamSnapshot.streamingSegments.length > 0 ? streamSnapshot.streamingSegments : undefined,
          toolCalls: normalizedToolCalls.length > 0 ? normalizedToolCalls : undefined,
          toolResults: normalizedToolResults.length > 0 ? normalizedToolResults : undefined,
          usage,
        })

        // Attach usage to the message object for display
        const messageWithTools: Message = {
          ...assistantMessage,
          content: assistantContent,
          usage,
        }

        console.log('[Chat Store] Final message:', {
          content: fullContent?.slice(0, 100),
          toolCallCount: normalizedToolCalls.length,
          toolResultCount: normalizedToolResults.length,
          hasUsage: !!usage,
        })

        // Update context window token count from actual usage
        if (usage?.totalTokens) {
          useContextStore.getState().updateTokenCount(targetConversationId, usage.totalTokens)
        } else {
          // No fallback estimation - we need actual token counts from the API
          console.warn('[Chat Store] No usage stats received from provider - context tracking requires API to report token usage')
        }

        set((state) => {
          const nextMessages = state.activeConversationId === targetConversationId
            ? [...state.messages, messageWithTools]
            : state.messages

          const { [targetConversationId]: _removed, ...restStreams } = state.conversationStreams
          const nextInterruptedConversations = hasIncompleteToolCalls
            ? {
              ...state.interruptedConversations,
              [targetConversationId]: {
                ...interruptedCheckpoint,
                detectedAt: Date.now(),
              },
            }
            : (() => {
              const { [targetConversationId]: _removedInterrupted, ...restInterrupted } = state.interruptedConversations
              return restInterrupted
            })()
          const updates: Partial<ChatStore> = {
            messages: nextMessages,
            conversationStreams: restStreams,
            interruptedConversations: nextInterruptedConversations,
          }

          if (state.activeConversationId === targetConversationId) {
            Object.assign(updates, projectStreamStateToActiveFields(createEmptyConversationStreamState()))
          }

          return updates as Partial<ChatStore>
        })

        // Title is generated ONCE when user sends first message (see sendMessage)
        // No second generation here - we don't want AI response to change the title
      } catch (error) {
        console.error('[Chat Store] Error in onStreamEnd:', error)
        // Still need to end streaming state even on error
        clearConversationStreamState()
        if (hasIncompleteToolCalls) {
          set((state) => ({
            interruptedConversations: {
              ...state.interruptedConversations,
              [targetConversationId]: {
                ...interruptedCheckpoint,
                detectedAt: Date.now(),
              },
            },
          }))
        }
        set({ error: `Failed to save message: ${error}` })
      }

      // Add system notification for created artifacts
      if (createdArtifacts.length > 0) {
        get().addSystemNotification({
          type: 'artifacts_created',
          conversationId: targetConversationId,
          artifacts: createdArtifacts,
        })
      }

      // Check context usage and trigger compaction if needed
      const contextStore = useContextStore.getState()
      const contextUsage = contextStore.getContextUsage(targetConversationId)

      if (contextUsage.shouldCompact && contextStore.autoCompact) {
        const usagePercent = Math.round(contextUsage.percentage * 100)
        get().addSystemNotification({
          type: 'compaction_warning',
          conversationId: targetConversationId,
          message: `Auto-compacting context at ${usagePercent}% usage...`,
        })

        // Start compaction for this conversation only.
        contextStore.setConversationCompacting(targetConversationId, true)

        // Run compaction async
        window.jelico.compaction.compact({
          conversationId: targetConversationId,
          providerId,
          model,
        }).then(async (result) => {
          if (result.success) {
            const maxTokens = contextUsage.maxTokens
            const beforeTokens = Math.max(
              0,
              Math.round(result.tokensBefore ?? contextUsage.tokenCount)
            )
            const afterTokens = Math.max(
              0,
              Math.round(result.tokensAfter ?? beforeTokens)
            )
            const beforePercent = maxTokens > 0
              ? Math.round((beforeTokens / maxTokens) * 100)
              : 0
            const afterPercent = maxTokens > 0
              ? Math.round((afterTokens / maxTokens) * 100)
              : 0
            const reductionPercent = beforeTokens > 0
              ? Math.max(0, Math.round(((beforeTokens - afterTokens) / beforeTokens) * 100))
              : 0

            const compactionSummary = `Auto-compacted context ${beforePercent}% → ${afterPercent}% (${beforeTokens.toLocaleString()} → ${afterTokens.toLocaleString()} tokens${reductionPercent > 0 ? `, -${reductionPercent}%` : ''}).`

            contextStore.setCompactionSummary(
              targetConversationId,
              compactionSummary,
              afterTokens,
              beforeTokens
            )

            // Show compaction complete notification
            get().addSystemNotification({
              type: 'compaction_complete',
              conversationId: targetConversationId,
              message: compactionSummary,
            })

            // Reload messages only if this conversation is currently visible.
            if (get().activeConversationId === targetConversationId) {
              await get().setActiveConversation(targetConversationId)
            }
          } else {
            console.error('[Chat] Compaction failed:', result.error)
          }

          // Clear compacting flag for this conversation and process queued messages.
          contextStore.setConversationCompacting(targetConversationId, false)
          get().processQueue()
        }).catch((error) => {
          console.error('[Chat] Compaction error:', error)
          contextStore.setConversationCompacting(targetConversationId, false)
          get().processQueue()
        })
      }

      // Process any queued messages
      get().processQueue()

      // Optional desktop/sound notification for completed AI turn
      notifyUserEvent('turn_complete', {
        title: 'Jelico response complete',
        body: 'Jelico has finished responding.',
      }).catch((err) => {
        console.warn('[Chat] Turn completion notification failed:', err)
      })
    })

    // Handle stream error
    window.jelico.ai.onStreamError(channelId, (error) => {
      window.jelico.ai.removeListeners(channelId)
      useAgentStore.getState().cancelRunningAgentsByParent(channelId)
      const activeChannel = streamChannelByConversation.get(targetConversationId)
      if (activeChannel === channelId) {
        streamChannelByConversation.delete(targetConversationId)
      }
      clearPendingStreamCheckpoint(targetConversationId)
      useClarificationStore.getState().clearForConversation(targetConversationId)

      // Clear streaming preview to prevent stale artifact content
      useArtifactStore.getState().clearStreamingPreview()

      clearConversationStreamState()
      set((state) => {
        const { [targetConversationId]: _removedInterrupted, ...restInterrupted } = state.interruptedConversations
        return {
          interruptedConversations: restInterrupted,
          error,
        }
      })

      // Still try to process queue on error
      get().processQueue()
    })
  },

  queueMessage: (content, providerId, model, attachments, conversationId) => {
    set((state) => ({
      messageQueue: [...state.messageQueue, { content, attachments, providerId, model, conversationId }],
    }))
  },

  processQueue: async () => {
    const { messageQueue } = get()
    if (messageQueue.length === 0) return

    // Take the first message from the queue
    const [nextMessage, ...remaining] = messageQueue
    set({ messageQueue: remaining })

    // Send the queued message
    await (get().sendMessage as any)(
      nextMessage.content,
      nextMessage.providerId,
      nextMessage.model,
      nextMessage.attachments,
      false,
      nextMessage.conversationId ?? null
    )
  },

  sendQueuedNow: async (queueIndex) => {
    const { messageQueue, activeConversationId } = get()
    const queuedMessage = messageQueue[queueIndex]
    if (!queuedMessage) return false

    // Remove selected message from queue first to avoid duplicate processing races.
    set((state) => {
      const nextQueue = [...state.messageQueue]
      nextQueue.splice(queueIndex, 1)
      return { messageQueue: nextQueue }
    })

    const refreshedState = get()
    const targetConversationId = queuedMessage.conversationId ?? refreshedState.activeConversationId ?? activeConversationId ?? null
    const targetStreamState = targetConversationId ? refreshedState.conversationStreams[targetConversationId] : undefined

    // "Send now" means send this queued item immediately.
    // If the target conversation is currently streaming, stop first so this message can run now.
    if (targetConversationId && targetConversationId === refreshedState.activeConversationId && targetStreamState?.isStreaming) {
      await refreshedState.stopStreaming()
    }

    await (get().sendMessage as any)(
      queuedMessage.content,
      queuedMessage.providerId,
      queuedMessage.model,
      queuedMessage.attachments,
      false,
      targetConversationId
    )

    return true
  },

  stopStreaming: async () => {
    const { activeConversationId, conversationStreams } = get()
    if (!activeConversationId) return

    const streamState = conversationStreams[activeConversationId] || createEmptyConversationStreamState()
    const {
      streamingContent,
      streamingToolCalls,
      streamingToolResults,
      streamingSegments,
      streamingStartTime,
    } = streamState

    // Debug: Log what we have when stop is called
    console.log('[Chat Store] stopStreaming called:', {
      hasContent: streamingContent.length > 0,
      contentLength: streamingContent.length,
      contentPreview: streamingContent.slice(0, 100),
      toolCallCount: streamingToolCalls.length,
      toolCallNames: streamingToolCalls.map(tc => tc.name),
      toolResultCount: streamingToolResults.length,
      segmentCount: streamingSegments.length,
      conversationId: activeConversationId,
    })

    const streamChannelId = streamChannelByConversation.get(activeConversationId)
    if (streamChannelId) {
      // Stop stale "running" rows immediately for this stream.
      useAgentStore.getState().cancelRunningAgentsByParent(streamChannelId)
      window.jelico.ai.stopStream(streamChannelId)
      window.jelico.ai.removeListeners(streamChannelId)
      streamChannelByConversation.delete(activeConversationId)
    } else {
      // Fallback cleanup if channel mapping was already lost.
      useAgentStore.getState().cancelRunningAgentsByConversation(activeConversationId)
    }
    clearPendingStreamCheckpoint(activeConversationId)
    useClarificationStore.getState().clearForConversation(activeConversationId)

    // Clear streaming preview to prevent stale artifact content
    useArtifactStore.getState().clearStreamingPreview()

    // Save partial response if there's content or tool activity
    const hasContent = streamingContent.trim().length > 0
    const hasToolCalls = streamingToolCalls.length > 0

    console.log('[Chat Store] Saving partial response:', { hasContent, hasToolCalls })

    // Normalize tool call state on manual stop so UI never shows stale "running" actions.
    const completedResultIds = new Set(streamingToolResults.map((result) => result.toolCallId))
    const normalizedToolCalls = streamingToolCalls.map((toolCall) => {
      if (completedResultIds.has(toolCall.id)) {
        return toolCall.status === 'complete' ? toolCall : { ...toolCall, status: 'complete' as const }
      }
      if (toolCall.status === 'error' || toolCall.status === 'canceled' || toolCall.status === 'cancelled') {
        return toolCall
      }
      return { ...toolCall, status: 'canceled' as const }
    })

    const interruptedToolResults: ToolResult[] = normalizedToolCalls
      .filter((toolCall) => !completedResultIds.has(toolCall.id))
      .map((toolCall) => ({
        toolCallId: toolCall.id,
        result: {
          success: false,
          canceled: true,
          cancellationReason: 'user_stop',
          error: 'Canceled: stream stopped by user',
        },
        error: 'Canceled: stream stopped by user',
      }))

    const normalizedToolResults = [...streamingToolResults, ...interruptedToolResults]

    // Build context about active agents so the next turn knows what was happening
    const conversationAgents = useAgentStore.getState().getAgentsByConversation(activeConversationId)
    const activeAgentSummaries = conversationAgents
      .filter(a => a.status === 'running' || a.status === 'pending' || a.status === 'completed')
      .map(a => {
        const statusLabel = a.status === 'completed' ? 'finished' : 'was in progress'
        const errorNote = a.error ? ` (error: ${a.error})` : ''
        return `- ${a.displayName || a.name}: ${a.task.slice(0, 120)}${a.task.length > 120 ? '...' : ''} [${statusLabel}${errorNote}]`
      })

    // Build the content to save, appending agent context if any agents were active
    let savedContent = hasContent ? streamingContent : '(Stopped)'
    if (activeAgentSummaries.length > 0) {
      savedContent += `\n\n[Context from interrupted turn — ${activeAgentSummaries.length} sub-agent(s) were active when the user stopped this response:\n${activeAgentSummaries.join('\n')}\nThe user interrupted to send a new message. Continue from where things left off.]`
    }

    if (activeConversationId && (hasContent || hasToolCalls)) {
      try {
        const partialCreatedAt = streamingStartTime ?? Date.now()
        // Save the partial response to the database
        const partialMessage = await window.jelico.conversations.addMessage(activeConversationId, {
          role: 'assistant',
          content: savedContent,
          createdAt: partialCreatedAt,
          segments: streamingSegments.length > 0 ? streamingSegments : undefined,
          toolCalls: hasToolCalls ? normalizedToolCalls : undefined,
          toolResults: normalizedToolResults.length > 0 ? normalizedToolResults : undefined,
        })

        console.log('[Chat Store] Partial message saved:', {
          id: partialMessage.id,
          contentLength: partialMessage.content?.length,
          toolCallCount: partialMessage.toolCalls?.length,
        })

        // Add to local messages array
        set((state) => ({
          messages: [...state.messages, partialMessage],
        }))
      } catch (error) {
        console.error('[Chat Store] Failed to save partial response on stop:', error)
      }
    } else {
      console.log('[Chat Store] Nothing to save on stop - no content or tool calls')
    }

    set((state) => {
      const { [activeConversationId]: _removed, ...restStreams } = state.conversationStreams
      const { [activeConversationId]: _removedInterrupted, ...restInterrupted } = state.interruptedConversations
      return {
        conversationStreams: restStreams,
        interruptedConversations: restInterrupted,
        ...projectStreamStateToActiveFields(createEmptyConversationStreamState()),
      }
    })
  },

  deleteConversation: async (id) => {
    const wasActiveConversation = get().activeConversationId === id

    // Optimistically clear active conversation state before archive work so
    // the composer immediately returns to a clean, editable new-chat state.
    if (wasActiveConversation) {
      set((state) => {
        const { [id]: _removedStream, ...restStreams } = state.conversationStreams
        const { [id]: _removedInterrupted, ...restInterrupted } = state.interruptedConversations
        return {
          activeConversationId: null,
          messages: [],
          conversationStreams: restStreams,
          interruptedConversations: restInterrupted,
          ...projectStreamStateToActiveFields(createEmptyConversationStreamState()),
          error: null,
        }
      })
      useTodoStore.getState().setConversationId(null)
      useClarificationStore.getState().setConversationId(null)
      useArtifactStore.getState().clearStreamingPreview()
      useArtifactStore.getState().closeCanvas()
    }

    try {
      const streamChannelId = streamChannelByConversation.get(id)
      if (streamChannelId) {
        window.jelico.ai.stopStream(streamChannelId)
        window.jelico.ai.removeListeners(streamChannelId)
        streamChannelByConversation.delete(id)
      }
      clearPendingStreamCheckpoint(id)
      worktreeGuidanceByConversation.delete(id)
      useClarificationStore.getState().clearForConversation(id)

      // Archive instead of permanent delete so users can restore later.
      await window.jelico.conversations.archive(id)
      const conversations = await window.jelico.conversations.list()

      if (wasActiveConversation) {
        set({ conversations })
      } else {
        set((state) => {
          const { [id]: _removedStream, ...restStreams } = state.conversationStreams
          const { [id]: _removedInterrupted, ...restInterrupted } = state.interruptedConversations
          return {
            conversations,
            conversationStreams: restStreams,
            interruptedConversations: restInterrupted,
          }
        })
      }
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  setMode: (mode) => {
    const currentMode = get().mode
    if (mode === currentMode) return
    if (!isModeTransitionAllowed(currentMode, mode)) return
    set({ mode })

    const activeConversationId = get().activeConversationId
    if (!activeConversationId) return

    const streamChannelId = streamChannelByConversation.get(activeConversationId)
    const streamState = get().conversationStreams[activeConversationId]
    if (!streamChannelId || !streamState?.isStreaming) return

    try {
      window.jelico.ai.updateStreamMode(streamChannelId, mode)
    } catch (error) {
      console.warn('[Chat Store] Failed to update active stream mode:', error)
    }
  },

  setModeTransitioning: (transitioning) => set({ modeTransitioning: transitioning }),

  handleModeSwitch: (_fromMode, toMode, reason) => {
    const { modes } = require('../lib/modes') as { modes: Record<AgentMode, { name: string }> }
    const modeBefore = get().mode

    // Cancel any pending mode transition timeout to prevent orphaned callbacks
    if (modeTransitionTimeoutId) {
      clearTimeout(modeTransitionTimeoutId)
      modeTransitionTimeoutId = null
    }

    get().setMode(toMode)
    const modeAfter = get().mode
    if (modeAfter !== toMode || modeAfter === modeBefore) {
      return
    }

    set({
      modeTransitioning: true,
      modeSwitchReason: `Switching to ${modes[toMode].name}: ${reason}`,
    })

    // Clear the transitioning state after animation
    modeTransitionTimeoutId = setTimeout(() => {
      modeTransitionTimeoutId = null
      set({ modeTransitioning: false, modeSwitchReason: null })
    }, 2000)
  },

  clearError: () => set({ error: null }),

  regenerateLastResponse: async (providerId, model) => {
    const { messages, activeConversationId, isStreaming } = get()

    if (isStreaming || !activeConversationId || messages.length < 2) return

    const { lastAssistantIndex, lastUser } = getLastAssistantAndUser(messages)
    if (lastAssistantIndex === -1 || !lastUser) return

    // Regenerate starts a fresh assistant turn for this conversation.
    // Clear prior-turn todos so the panel reflects only the new attempt.
    useTodoStore.getState().clearTodos(activeConversationId)

    // Remove artifacts created during this turn (create_artifact calls only)
    const artifactStore = useArtifactStore.getState()
    const artifactsToDelete = getArtifactsCreatedByLastAssistantTurn(
      activeConversationId,
      messages,
      artifactStore.artifacts
    )

    for (const artifact of artifactsToDelete) {
      await artifactStore.removeArtifact(artifact.id)
    }

    // Remove the assistant message from state (keep user message)
    const messagesWithoutLast = messages.slice(0, lastAssistantIndex)
    set({ messages: messagesWithoutLast })

    // Keep DB aligned with the UI so reloads don't resurrect regenerated responses.
    try {
      await window.jelico.conversations.deleteMessage(messages[lastAssistantIndex].id)
    } catch (error) {
      console.error('[Chat Store] Failed to delete regenerated assistant message from DB:', error)
    }

    // Start streaming with existing messages (don't re-add user message)
    // The _isRegenerate flag tells sendMessage to skip adding user message
    await (get().sendMessage as any)(lastUser.content, providerId, model, undefined, true)
  },

  getRegenerateArtifactImpact: () => {
    const { messages, activeConversationId } = get()
    if (!activeConversationId || messages.length < 2) {
      return { artifacts: [] }
    }

    const artifacts = getArtifactsCreatedByLastAssistantTurn(
      activeConversationId,
      messages,
      useArtifactStore.getState().artifacts
    )

    return {
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        type: artifact.type,
      })),
    }
  },

  resumeInterruptedConversation: async (conversationId) => {
    const targetConversationId = conversationId || get().activeConversationId
    if (!targetConversationId) return

    const streamState = get().conversationStreams[targetConversationId]
    if (streamState?.isStreaming) return

    try {
      const conversation = await window.jelico.conversations.get(targetConversationId)
      if (!conversation) return

      const pendingCheckpoint = getPendingStreamCheckpoint(targetConversationId)
      const interruptedState = get().interruptedConversations[targetConversationId]
      const conversationMessages = conversation.messages || []
      const unansweredUser = getLatestUnansweredUserMessage(conversationMessages)
      const hasIncompleteEvidence = hasIncompleteToolEvidence(conversationMessages)
      const fallbackUser = ((pendingCheckpoint || interruptedState) && hasIncompleteEvidence)
        ? getLatestUserMessage(conversationMessages)
        : null
      const resumeUser = unansweredUser || fallbackUser

      if (!resumeUser) {
        clearPendingStreamCheckpoint(targetConversationId)
        set((state) => {
          const { [targetConversationId]: _removed, ...rest } = state.interruptedConversations
          return { interruptedConversations: rest }
        })
        return
      }

      const providerId = pendingCheckpoint?.providerId || interruptedState?.providerId || conversation.providerId
      const model = pendingCheckpoint?.model || interruptedState?.model || conversation.model

      if (!unansweredUser && interruptedState) {
        const trailingMessage = conversationMessages[conversationMessages.length - 1]
        if (trailingMessage?.role === 'assistant') {
          try {
            await window.jelico.conversations.deleteMessage(trailingMessage.id)
          } catch (error) {
            console.error('[Chat Store] Failed to delete interrupted assistant message from DB:', error)
          }

          set((state) => {
            if (state.activeConversationId !== targetConversationId) return {}
            const filteredMessages = state.messages.filter((message) => message.id !== trailingMessage.id)
            return { messages: filteredMessages }
          })
        }
      }

      set((state) => {
        const { [targetConversationId]: _removed, ...rest } = state.interruptedConversations
        return { interruptedConversations: rest }
      })

      await (get().sendMessage as any)(
        resumeUser.content,
        providerId,
        model,
        resumeUser.attachments,
        true,
        targetConversationId
      )
    } catch (error: any) {
      set({ error: error.message || String(error) })
    }
  },

  dismissInterruptedConversation: (conversationId) => {
    const targetConversationId = conversationId || get().activeConversationId
    if (!targetConversationId) return

    clearPendingStreamCheckpoint(targetConversationId)
    set((state) => {
      const { [targetConversationId]: _removed, ...rest } = state.interruptedConversations
      return { interruptedConversations: rest }
    })
  },

  addSystemNotification: (notification) => {
    const newNotification: SystemNotification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }
    set((state) => ({
      systemNotifications: [...state.systemNotifications, newNotification],
    }))
  },

  clearSystemNotifications: () => {
    set({ systemNotifications: [] })
  },
  setConversationWorkspaceId: (id, workspaceId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === id ? { ...conv, workspaceId: workspaceId || undefined } : conv
      ),
    }))
  },
}))
