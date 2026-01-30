import { create } from 'zustand'
import type { AgentMode } from '../lib/modes'
import { useArtifactStore } from './artifacts'
import { useWorkspaceStore } from './workspaces'
import { useAgentStore } from './agents'
import { useSkillStore } from './skills'
import { useContextStore } from './context'
import { useSandboxStore } from './sandbox'

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

interface ChatStore {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: ToolCall[]
  streamingToolResults: ToolResult[]
  systemNotifications: SystemNotification[]
  isLoading: boolean
  error: string | null
  mode: AgentMode
  modeTransitioning: boolean
  messageQueue: QueuedMessage[]

  // Actions
  loadConversations: () => Promise<void>
  createConversation: (providerId: string, model: string) => Promise<string>
  setActiveConversation: (id: string | null) => Promise<void>
  sendMessage: (content: string, providerId: string, model: string, attachments?: MessageAttachment[]) => Promise<void>
  queueMessage: (content: string, providerId: string, model: string, attachments?: MessageAttachment[]) => void
  processQueue: () => Promise<void>
  stopStreaming: () => void
  deleteConversation: (id: string) => Promise<void>
  setMode: (mode: AgentMode) => void
  setModeTransitioning: (transitioning: boolean) => void
  clearError: () => void
  regenerateLastResponse: (providerId: string, model: string) => Promise<void>
  addSystemNotification: (notification: Omit<SystemNotification, 'id' | 'timestamp'>) => void
  clearSystemNotifications: () => void
}

let currentStreamChannelId: string | null = null

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  modeTransitioning: false,
  isStreaming: false,
  streamingContent: '',
  streamingToolCalls: [],
  streamingToolResults: [],
  systemNotifications: [],
  isLoading: false,
  error: null,
  mode: 'auto' as AgentMode,
  messageQueue: [],

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
      return conversation.id
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },

  setActiveConversation: async (id) => {
    if (!id) {
      set({
        activeConversationId: null,
        messages: [],
        isStreaming: false,
        streamingContent: '',
        streamingToolCalls: [],
        streamingToolResults: [],
        error: null,
      })
      return
    }

    set({ isLoading: true })
    try {
      const conversation = await window.jelico.conversations.get(id)
      set({
        activeConversationId: id,
        messages: conversation?.messages || [],
        isLoading: false,
      })
      // Load artifacts for this conversation
      useArtifactStore.getState().loadArtifactsForConversation(id)
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  sendMessage: async (content, providerId, model, attachments) => {
    const { activeConversationId, messages, mode, isStreaming } = get()
    const { isCompacting } = useContextStore.getState()

    // If already streaming or compacting, queue the message
    if (isStreaming || isCompacting) {
      get().queueMessage(content, providerId, model, attachments)
      return
    }

    // Check for skill shortcuts
    const skillMatch = useSkillStore.getState().findSkillByShortcut(content)
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

    // Create conversation if needed
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

    // Add user message (show original content, not expanded skill)
    const userMessage = await window.jelico.conversations.addMessage(conversationId, {
      role: 'user',
      content: content, // Original content for display
      attachments: attachments, // Include attachments for display
    })

    // Update title if this is the first message - use content or placeholder
    // AI will generate a proper title after the first response
    if (messages.length === 0) {
      let titleSource = content.trim()

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

      const title = titleSource.slice(0, 50) + (titleSource.length > 50 ? '...' : '')
      await window.jelico.conversations.updateTitle(conversationId, title)
      // Reload conversations to get updated title
      const conversations = await window.jelico.conversations.list()
      set({ conversations })
    }

    const updatedMessages = [...messages, userMessage]
    set({
      messages: updatedMessages,
      isStreaming: true,
      streamingContent: '',
      streamingToolCalls: [],
      streamingToolResults: [],
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
    })
    currentStreamChannelId = channelId

    let fullContent = ''
    const streamStartTime = Date.now()
    let firstChunkTime: number | null = null
    let lastChunkTime: number | null = null

    // Handle stream chunks
    window.jelico.ai.onStreamChunk(channelId, (chunk) => {
      // Guard against undefined chunks (can happen with some stream events)
      if (chunk !== undefined && chunk !== null) {
        const now = Date.now()
        if (firstChunkTime === null) {
          firstChunkTime = now
        }
        lastChunkTime = now
        fullContent += chunk
        set({ streamingContent: fullContent })
      }
    })

    // Handle tool calls - ai.ts now sends pre-formatted { id, name, args }
    window.jelico.ai.onToolCalls(channelId, (toolCalls) => {
      console.log('[Chat Store] Received tool calls:', toolCalls)
      set((state) => ({
        streamingToolCalls: [...state.streamingToolCalls, ...toolCalls],
      }))
    })

    // Handle tool results - ai.ts now sends pre-formatted { toolCallId, result }
    window.jelico.ai.onToolResults(channelId, (toolResults) => {
      console.log('[Chat Store] Received tool results:', toolResults)
      set((state) => {
        // Update tool call statuses to 'complete' when their results arrive
        const completedIds = new Set(toolResults.map(r => r.toolCallId))
        const updatedToolCalls = state.streamingToolCalls.map((tc) =>
          completedIds.has(tc.id) ? { ...tc, status: 'complete' as const } : tc
        )
        return {
          streamingToolCalls: updatedToolCalls,
          streamingToolResults: [...state.streamingToolResults, ...toolResults],
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
        task: agent.task,
        mode: agent.mode,
      })
    })

    // Handle agent progress updates
    window.jelico.ai.onAgentProgress(channelId, (update) => {
      useAgentStore.getState().updateAgent(update.agentId, {
        status: update.status as any,
        progress: update.progress,
        result: update.result,
        error: update.error,
        completedAt: update.status === 'completed' || update.status === 'failed' ? Date.now() : undefined,
      })
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
          // Log when no usage stats received - need to investigate provider
          console.warn('[Chat Store] No usage stats received from provider - context tracking disabled for this message')
        }

        set((state) => ({
          messages: [...state.messages, messageWithTools],
          isStreaming: false,
          streamingContent: '',
          streamingToolCalls: [],
          streamingToolResults: [],
        }))

        // Generate AI title after first exchange (2 messages: user + assistant)
        const currentMessages = get().messages
        if (currentMessages.length === 2 && conversationId) {
          const userMsg = currentMessages.find(m => m.role === 'user')
          const assistantMsg = currentMessages.find(m => m.role === 'assistant')

          if (userMsg && assistantMsg) {
            // Get the full user content including attachments
            let userContent = userMsg.content || ''
            if (userMsg.attachments?.length) {
              const attachmentText = userMsg.attachments
                .filter(a => a.type === 'text' && a.data)
                .map(a => a.data)
                .join('\n')
              if (attachmentText) {
                userContent = userContent ? `${userContent}\n\n${attachmentText}` : attachmentText
              }
            }

            // Generate title in background (don't await)
            window.jelico.ai.generateTitle({
              providerId,
              model,
              userMessage: userContent.slice(0, 1000),
              assistantMessage: assistantMsg.content.slice(0, 1000),
            }).then(async (result) => {
              if (result.success && result.title) {
                await window.jelico.conversations.updateTitle(conversationId, result.title)
                const conversations = await window.jelico.conversations.list()
                set({ conversations })
              }
            }).catch((err) => {
              console.warn('[Chat] Failed to generate AI title:', err)
            })
          }
        }
      } catch (error) {
        console.error('[Chat Store] Error in onStreamEnd:', error)
        // Still need to end streaming state even on error
        set({
          isStreaming: false,
          streamingContent: '',
          streamingToolCalls: [],
          streamingToolResults: [],
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
      set({
        isStreaming: false,
        streamingContent: '',
        streamingToolCalls: [],
        streamingToolResults: [],
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

  stopStreaming: () => {
    if (currentStreamChannelId) {
      window.jelico.ai.stopStream(currentStreamChannelId)
      window.jelico.ai.removeListeners(currentStreamChannelId)
      currentStreamChannelId = null
    }
    set({
      isStreaming: false,
      streamingContent: '',
      streamingToolCalls: [],
      streamingToolResults: [],
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
          streamingContent: '',
          streamingToolCalls: [],
          streamingToolResults: [],
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

    // Remove the assistant message from state
    const messagesWithoutLast = messages.slice(0, lastAssistantIndex)
    set({ messages: messagesWithoutLast })

    // Re-send the user's message to regenerate
    await get().sendMessage(lastUserMessage.content, providerId, model)
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
