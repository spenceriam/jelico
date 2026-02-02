import { create } from 'zustand'
import type { AgentMode } from '../lib/modes'
import { useArtifactStore } from './artifacts'
import { useWorkspaceStore } from './workspaces'
import { useAgentStore } from './agents'
import { useSkillStore } from './skills'
import { useContextStore } from './context'
import { useSandboxStore } from './sandbox'
import { useTodoStore } from './todos'

export interface MessageUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokensPerSecond?: number
  durationMs?: number
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
  status?: 'starting' | 'executing' | 'complete' | 'error'
}

export interface ToolResult {
  toolCallId: string
  result: unknown
  error?: string
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
}

// System notifications that appear inline in chat
export type SystemNotificationType =
  | 'compaction_warning'
  | 'compaction_complete'
  | 'model_changed'
  | 'artifacts_created'

export interface SystemNotification {
  id: string
  type: SystemNotificationType
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

interface ChatStore {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
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
  createConversation: (providerId: string, model: string) => Promise<string>
  setActiveConversation: (id: string | null) => Promise<void>
  sendMessage: (content: string, providerId: string, model: string, attachments?: MessageAttachment[]) => Promise<void>
  queueMessage: (content: string, providerId: string, model: string, attachments?: MessageAttachment[]) => void
  processQueue: () => Promise<void>
  stopStreaming: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  setMode: (mode: AgentMode) => void
  setModeTransitioning: (transitioning: boolean) => void
  handleModeSwitch: (fromMode: AgentMode, toMode: AgentMode, reason: string) => void
  clearError: () => void
  regenerateLastResponse: (providerId: string, model: string) => Promise<void>
  addSystemNotification: (notification: Omit<SystemNotification, 'id' | 'timestamp'>) => void
  clearSystemNotifications: () => void
}

let currentStreamChannelId: string | null = null
let modeTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
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

  createConversation: async (providerId, model) => {
    try {
      const conversation = await window.jelico.conversations.create({
        title: 'New chat',
        model,
        providerId,
      })
      const conversations = await window.jelico.conversations.list()
      set({
        conversations,
        activeConversationId: conversation.id,
        messages: [],
      })
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
      set({
        activeConversationId: null,
        messages: [],
        isStreaming: false,
        streamingStartTime: null,
        streamingContent: '',
        streamingToolCalls: [],
        streamingToolResults: [],
        streamingSegments: [],
        statusDisplayQueue: [],
        toolInputProgress: null,
        modeTransitioning: false,
        modeSwitchReason: null,
        isReasoning: false,
        reasoningContent: '',
        error: null,
      })
      // No conversation = no artifacts to show
      useArtifactStore.getState().closeCanvas()
      return
    }

    set({ isLoading: true })
    try {
      const conversation = await window.jelico.conversations.get(id)
      set({
        activeConversationId: id,
        messages: conversation?.messages || [],
        isLoading: false,
        // Clear streaming state when switching to prevent old stream data appearing
        isStreaming: false,
        streamingContent: '',
        streamingToolCalls: [],
        streamingToolResults: [],
        streamingSegments: [],
        statusDisplayQueue: [],
        toolInputProgress: null,
        modeTransitioning: false,
        modeSwitchReason: null,
        isReasoning: false,
        reasoningContent: '',
      })
      // Load artifacts for this conversation and close canvas if none exist
      await useArtifactStore.getState().loadArtifactsForConversation(id)
      const conversationArtifacts = useArtifactStore.getState().getArtifactsByConversation(id)
      if (conversationArtifacts.length === 0) {
        useArtifactStore.getState().closeCanvas()
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  // Internal flag to track if this is a regenerate (skips adding user message)
  sendMessage: async (content, providerId, model, attachments, _isRegenerate = false) => {
    const { activeConversationId, messages, mode, isStreaming } = get()
    const { isCompacting } = useContextStore.getState()

    // If already streaming or compacting, queue the message (unless regenerating)
    if ((isStreaming || isCompacting) && !_isRegenerate) {
      get().queueMessage(content, providerId, model, attachments)
      return
    }

    // Check for skill shortcuts (skip for regenerate - original message already processed)
    const skillMatch = _isRegenerate ? null : useSkillStore.getState().findSkillByShortcut(content)
    let finalContent = content
    let finalMode = mode

    if (skillMatch) {
      finalContent = skillMatch.skill.prompt.replace('{{context}}', skillMatch.context)
      if (skillMatch.skill.mode) {
        finalMode = skillMatch.skill.mode
        // Temporarily set mode for this message
        set({ mode: finalMode })
      }
    }

    let conversationId = activeConversationId

    // Create conversation if needed (never happens during regenerate)
    if (!conversationId) {
      conversationId = await get().createConversation(providerId, model)
      // Initialize context tracking for new conversation
      await useContextStore.getState().initConversationContext(conversationId, providerId, model)
    } else {
      // Ensure context is initialized for existing conversation
      const contextState = useContextStore.getState()
      if (!contextState.conversationContexts[conversationId]) {
        await contextState.initConversationContext(conversationId, providerId, model)
      }
    }

    // For regenerate, use existing messages; otherwise add user message
    let updatedMessages = messages
    if (!_isRegenerate) {
      // Add user message (show original content, not expanded skill)
      const userMessage = await window.jelico.conversations.addMessage(conversationId, {
        role: 'user',
        content: content, // Original content for display
        attachments: attachments, // Include attachments for display
      })

      // Update title if this is the first message - use truncated content or placeholder
      // AI will generate a proper title in the background
      if (messages.length === 0) {
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

      updatedMessages = [...messages, userMessage]
      set({ messages: updatedMessages })
    }

    // Set streaming state
    set({
      isStreaming: true,
      streamingStartTime: Date.now(),
      streamingContent: '',
      streamingToolCalls: [],
      streamingToolResults: [],
      streamingSegments: [],
      statusDisplayQueue: [],
      toolInputProgress: null,
      isReasoning: false,
      reasoningContent: '',
    })

    // Get workspace path for context
    const workspaceState = useWorkspaceStore.getState()
    const activeWorkspace = workspaceState.workspaces.find(
      w => w.id === workspaceState.activeWorkspaceId
    )

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
    const channelId = window.jelico.ai.stream({
      providerId,
      model,
      mode: finalMode,
      messages: aiMessages,
      workspacePath: activeWorkspace?.path,
      artifacts: artifactContext,
      conversationId,  // Pass conversation ID for state isolation
    })
    currentStreamChannelId = channelId

    let fullContent = ''
    const streamStartTime = Date.now()
    let firstChunkTime: number | null = null
    let lastChunkTime: number | null = null

    // Handle stream chunks - track text segments for interleaving
    window.jelico.ai.onStreamChunk(channelId, (chunk) => {
      // Guard against undefined chunks (can happen with some stream events)
      if (chunk !== undefined && chunk !== null) {
        const now = Date.now()
        if (firstChunkTime === null) {
          firstChunkTime = now
        }
        lastChunkTime = now
        fullContent += chunk
        set((state) => {
          // Find or create the current text segment
          const segments = [...state.streamingSegments]
          const lastSegment = segments[segments.length - 1]

          if (lastSegment?.type === 'text') {
            // Append to existing text segment
            segments[segments.length - 1] = {
              type: 'text',
              content: lastSegment.content + chunk,
            }
          } else {
            // Create new text segment (first text, or text after a tool)
            segments.push({ type: 'text', content: chunk })
          }

          return {
            streamingContent: fullContent,
            streamingSegments: segments,
          }
        })
      }
    })

    // Handle tool calls - ai.ts now sends pre-formatted { id, name, args }
    // Also track segments for interleaving in UI
    window.jelico.ai.onToolCalls(channelId, (toolCalls) => {
      console.log('[Chat Store] Received tool calls:', toolCalls)
      const now = Date.now()
      set((state) => {
        // Add tool segments for each new tool call
        const newSegments: StreamingSegment[] = toolCalls.map(tc => ({
          type: 'tool' as const,
          toolCallId: tc.id,
        }))

        return {
          streamingToolCalls: [...state.streamingToolCalls, ...toolCalls],
          streamingSegments: [...state.streamingSegments, ...newSegments],
          // Add to status display queue for graceful UX
          statusDisplayQueue: [
            ...state.statusDisplayQueue,
            ...toolCalls.map(tc => ({
              id: tc.id,
              toolName: tc.name,
              args: tc.args,
              startedAt: now,
            })),
          ],
        }
      })
    })

    // Handle tool results - ai.ts now sends pre-formatted { toolCallId, result }
    window.jelico.ai.onToolResults(channelId, (toolResults) => {
      console.log('[Chat Store] Received tool results:', toolResults)
      const now = Date.now()

      set((state) => {
        // Update tool call statuses to 'complete' when their results arrive
        const completedIds = new Set(toolResults.map(r => r.toolCallId))
        const updatedToolCalls = state.streamingToolCalls.map((tc) =>
          completedIds.has(tc.id) ? { ...tc, status: 'complete' as const } : tc
        )

        // Track the last completed tool for status line display
        const lastResult = toolResults[toolResults.length - 1]
        const completedToolCall = state.streamingToolCalls.find(tc => tc.id === lastResult?.toolCallId)

        // Update status display queue - mark items as completed but keep for minimum display time
        const updatedQueue = state.statusDisplayQueue.map(item => {
          if (completedIds.has(item.id) && !item.completedAt) {
            return { ...item, completedAt: now }
          }
          return item
        })

        return {
          streamingToolCalls: updatedToolCalls,
          streamingToolResults: [...state.streamingToolResults, ...toolResults],
          statusDisplayQueue: updatedQueue,
          lastCompletedTool: completedToolCall ? {
            name: completedToolCall.name,
            args: completedToolCall.args,
            completedAt: now,
          } : state.lastCompletedTool,
          // Clear tool input progress when tool completes - fixes status stuck on "Generating spawn_agent"
          toolInputProgress: null,
        }
      })
    })

    // Handle tool call updates - updates status and args for existing tool calls
    window.jelico.ai.onToolCallUpdate(channelId, (update) => {
      console.log('[Chat Store] Tool call update:', update)
      set((state) => ({
        streamingToolCalls: state.streamingToolCalls.map((tc) =>
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
          conversationId: conversationId!,
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
        name: agent.name,
        displayName: agent.displayName,  // Friendly name like "Maya: Creating Wordle"
        task: agent.task,
        mode: agent.mode,
        conversationId,  // Track which conversation this agent belongs to
      })
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
      useTodoStore.getState().setTodos(todos)
    })

    // Handle tool input progress (for large artifacts)
    window.jelico.ai.onToolInputProgress(channelId, (progress) => {
      set({ toolInputProgress: progress })
    })

    // Handle reasoning/thinking events for thinking models (Kimi K2.5, o1, o3, etc.)
    window.jelico.ai.onReasoningStart(channelId, () => {
      set({ isReasoning: true, reasoningContent: '' })
    })

    window.jelico.ai.onReasoning(channelId, (data) => {
      set((state) => ({
        reasoningContent: state.reasoningContent + data.content,
      }))
    })

    window.jelico.ai.onReasoningEnd(channelId, () => {
      set({ isReasoning: false })
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
      currentStreamChannelId = null

      const { streamingToolCalls, streamingToolResults } = get()
      const totalDurationMs = Date.now() - streamStartTime
      // Calculate actual generation time (first chunk to last chunk)
      // This excludes tool execution time and gives accurate tok/s
      const generationMs = (firstChunkTime && lastChunkTime)
        ? (lastChunkTime - firstChunkTime)
        : totalDurationMs

      try {
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
          }
        }

        // Save assistant message with tool calls/results - even if content is empty
        const assistantMessage = await window.jelico.conversations.addMessage(conversationId!, {
          role: 'assistant',
          content: fullContent || '(Used tools)', // Ensure non-empty for DB
          toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
          toolResults: streamingToolResults.length > 0 ? streamingToolResults : undefined,
        })

        // Attach usage to the message object for display
        // Restore original content (could be empty) for display
        const messageWithTools: Message = {
          ...assistantMessage,
          content: fullContent, // Keep original empty if it was empty
          usage,
        }

        console.log('[Chat Store] Final message:', {
          content: fullContent?.slice(0, 100),
          toolCallCount: streamingToolCalls.length,
          toolResultCount: streamingToolResults.length,
          hasUsage: !!usage,
        })

        // Update context window token count from actual usage
        if (conversationId && usage?.totalTokens) {
          useContextStore.getState().updateTokenCount(conversationId, usage.totalTokens)
        } else if (conversationId) {
          // No fallback estimation - we need actual token counts from the API
          console.warn('[Chat Store] No usage stats received from provider - context tracking requires API to report token usage')
        }

        set((state) => ({
          messages: [...state.messages, messageWithTools],
          isStreaming: false,
          streamingStartTime: null,
          streamingContent: '',
          streamingToolCalls: [],
          streamingToolResults: [],
          streamingSegments: [],
          statusDisplayQueue: [],
          toolInputProgress: null,
          isReasoning: false,
          reasoningContent: '',
          lastCompletedTool: null,
        }))

        // Title is generated ONCE when user sends first message (see sendMessage)
        // No second generation here - we don't want AI response to change the title
      } catch (error) {
        console.error('[Chat Store] Error in onStreamEnd:', error)
        // Still need to end streaming state even on error
        set({
          isStreaming: false,
          streamingStartTime: null,
          streamingContent: '',
          streamingToolCalls: [],
          streamingToolResults: [],
          streamingSegments: [],
          statusDisplayQueue: [],
          lastCompletedTool: null,
          isReasoning: false,
          reasoningContent: '',
          error: `Failed to save message: ${error}`,
        })
      }

      // Add system notification for created artifacts
      if (createdArtifacts.length > 0) {
        get().addSystemNotification({
          type: 'artifacts_created',
          artifacts: createdArtifacts,
        })
      }

      // Check context usage and trigger compaction if needed
      if (conversationId) {
        const contextStore = useContextStore.getState()
        const contextUsage = contextStore.getContextUsage(conversationId)

        if (contextUsage.shouldCompact && contextStore.autoCompact) {
          // Start compaction - set flag to block new messages
          contextStore.setIsCompacting(true)

          // Run compaction async
          window.jelico.compaction.compact({
            conversationId,
            providerId,
            model,
          }).then(async (result) => {
            if (result.success) {
              // Update context with new token count
              if (result.tokensAfter !== undefined) {
                contextStore.updateTokenCount(conversationId, result.tokensAfter)
              }

              // Show compaction complete notification
              get().addSystemNotification({
                type: 'compaction_complete',
              })

              // Reload messages to get the compacted version
              await get().setActiveConversation(conversationId)
            } else {
              console.error('[Chat] Compaction failed:', result.error)
            }

            // Clear compacting flag and process any queued messages
            contextStore.setIsCompacting(false)
            get().processQueue()
          }).catch((error) => {
            console.error('[Chat] Compaction error:', error)
            contextStore.setIsCompacting(false)
            get().processQueue()
          })
        }
      }

      // Process any queued messages
      get().processQueue()
    })

    // Handle stream error
    window.jelico.ai.onStreamError(channelId, (error) => {
      window.jelico.ai.removeListeners(channelId)
      currentStreamChannelId = null

      // Clear streaming preview to prevent stale artifact content
      useArtifactStore.getState().clearStreamingPreview()

      set({
        isStreaming: false,
        streamingStartTime: null,
        streamingContent: '',
        streamingToolCalls: [],
        streamingToolResults: [],
        streamingSegments: [],
        statusDisplayQueue: [],
        toolInputProgress: null,
        isReasoning: false,
        reasoningContent: '',
        error: error,
      })

      // Still try to process queue on error
      get().processQueue()
    })
  },

  queueMessage: (content, providerId, model, attachments) => {
    set((state) => ({
      messageQueue: [...state.messageQueue, { content, attachments, providerId, model }],
    }))
  },

  processQueue: async () => {
    const { messageQueue } = get()
    if (messageQueue.length === 0) return

    // Take the first message from the queue
    const [nextMessage, ...remaining] = messageQueue
    set({ messageQueue: remaining })

    // Send the queued message
    await get().sendMessage(nextMessage.content, nextMessage.providerId, nextMessage.model, nextMessage.attachments)
  },

  stopStreaming: async () => {
    const {
      streamingContent,
      streamingToolCalls,
      streamingToolResults,
      activeConversationId,
    } = get()

    if (currentStreamChannelId) {
      window.jelico.ai.stopStream(currentStreamChannelId)
      window.jelico.ai.removeListeners(currentStreamChannelId)
      currentStreamChannelId = null
    }

    // Clear streaming preview to prevent stale artifact content
    useArtifactStore.getState().clearStreamingPreview()

    // Save partial response if there's content or tool activity
    const hasContent = streamingContent.trim().length > 0
    const hasToolCalls = streamingToolCalls.length > 0

    if (activeConversationId && (hasContent || hasToolCalls)) {
      try {
        // Save the partial response to the database
        const partialMessage = await window.jelico.conversations.addMessage(activeConversationId, {
          role: 'assistant',
          content: hasContent ? streamingContent : '(Stopped)',
          toolCalls: hasToolCalls ? streamingToolCalls : undefined,
          toolResults: streamingToolResults.length > 0 ? streamingToolResults : undefined,
        })

        // Add to local messages array
        set((state) => ({
          messages: [...state.messages, partialMessage],
        }))
      } catch (error) {
        console.error('[Chat Store] Failed to save partial response on stop:', error)
      }
    }

    set({
      isStreaming: false,
      streamingStartTime: null,
      streamingContent: '',
      streamingToolCalls: [],
      streamingToolResults: [],
      streamingSegments: [],
      statusDisplayQueue: [],
      toolInputProgress: null,
      isReasoning: false,
      reasoningContent: '',
    })
  },

  deleteConversation: async (id) => {
    try {
      // Delete artifacts for this conversation
      await useArtifactStore.getState().clearConversationArtifacts(id)

      // Clear sandbox files for this conversation (ignore errors - sandbox may not exist)
      try {
        await useSandboxStore.getState().clearSandbox(id)
      } catch {
        // Sandbox may not exist for this conversation - that's OK
      }

      await window.jelico.conversations.delete(id)
      const conversations = await window.jelico.conversations.list()
      const { activeConversationId } = get()

      if (activeConversationId === id) {
        // Clear all state when deleting the active conversation
        set({
          conversations,
          activeConversationId: null,
          messages: [],
          isStreaming: false,
          streamingStartTime: null,
          streamingContent: '',
          streamingToolCalls: [],
          streamingToolResults: [],
          streamingSegments: [],
          statusDisplayQueue: [],
          error: null,
        })
      } else {
        set({ conversations })
      }
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  setMode: (mode) => set({ mode }),

  setModeTransitioning: (transitioning) => set({ modeTransitioning: transitioning }),

  handleModeSwitch: (_fromMode, toMode, reason) => {
    const { modes } = require('../lib/modes') as { modes: Record<AgentMode, { name: string }> }

    // Cancel any pending mode transition timeout to prevent orphaned callbacks
    if (modeTransitionTimeoutId) {
      clearTimeout(modeTransitionTimeoutId)
      modeTransitionTimeoutId = null
    }

    set({
      mode: toMode,
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

    // Find the last assistant message
    let lastAssistantIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIndex = i
        break
      }
    }

    if (lastAssistantIndex === -1) return

    // Find the user message before the assistant message
    let lastUserMessage: Message | null = null
    for (let i = lastAssistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i]
        break
      }
    }

    if (!lastUserMessage) return

    // Remove artifacts created during this turn
    // We identify them by looking at artifacts created after the user message
    const artifactStore = useArtifactStore.getState()
    const artifacts = artifactStore.artifacts.filter(
      a => a.conversationId === activeConversationId &&
           a.createdAt > lastUserMessage!.createdAt
    )
    for (const artifact of artifacts) {
      await artifactStore.removeArtifact(artifact.id)
    }

    // Remove the assistant message from state (keep user message)
    const messagesWithoutLast = messages.slice(0, lastAssistantIndex)
    set({ messages: messagesWithoutLast })

    // Note: Old assistant message stays in DB (no deleteMessage API yet)
    // This is fine - new message replaces it in UI, and conversation reload works correctly
    // because we load messages by conversation and the new response overwrites conceptually

    // Start streaming with existing messages (don't re-add user message)
    // The _isRegenerate flag tells sendMessage to skip adding user message
    await (get().sendMessage as any)(lastUserMessage.content, providerId, model, undefined, true)
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
}))
