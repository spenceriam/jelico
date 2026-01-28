import { create } from 'zustand'
import type { AgentMode } from '../lib/modes'
import { useArtifactStore } from './artifacts'
import { useWorkspaceStore } from './workspaces'
import { useAgentStore } from './agents'
import { useSkillStore } from './skills'

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

interface ChatStore {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: ToolCall[]
  streamingToolResults: ToolResult[]
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

    // If already streaming, queue the message
    if (isStreaming) {
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
    }

    // Add user message (show original content, not expanded skill)
    const userMessage = await window.jelico.conversations.addMessage(conversationId, {
      role: 'user',
      content: content, // Original content for display
    })

    // Update title if this is the first message
    if (messages.length === 0) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
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

    // Start streaming with mode and workspace context
    const channelId = window.jelico.ai.stream({
      providerId,
      model,
      mode: finalMode,
      messages: aiMessages,
      workspacePath: activeWorkspace?.path,
    })
    currentStreamChannelId = channelId

    let fullContent = ''
    const streamStartTime = Date.now()

    // Handle stream chunks
    window.jelico.ai.onStreamChunk(channelId, (chunk) => {
      fullContent += chunk
      set({ streamingContent: fullContent })
    })

    // Handle tool calls
    window.jelico.ai.onToolCalls(channelId, (toolCalls) => {
      const mapped = toolCalls.map(tc => ({
        id: tc.toolCallId,
        name: tc.toolName,
        args: tc.args,
      }))
      set((state) => ({
        streamingToolCalls: [...state.streamingToolCalls, ...mapped],
      }))
    })

    // Handle tool results
    window.jelico.ai.onToolResults(channelId, (toolResults) => {
      const mapped = toolResults.map(tr => ({
        toolCallId: tr.toolCallId,
        result: tr.result,
      }))
      set((state) => ({
        streamingToolResults: [...state.streamingToolResults, ...mapped],
      }))
    })

    // Handle artifacts
    window.jelico.ai.onArtifact(channelId, (artifact) => {
      useArtifactStore.getState().addArtifact({
        conversationId: conversationId!,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        language: artifact.language,
      })
    })

    // Handle spawn agent requests
    window.jelico.ai.onSpawnAgent(channelId, (agent) => {
      useAgentStore.getState().spawnAgent({
        name: agent.name,
        task: agent.task,
        mode: agent.mode,
      })
    })

    // Handle stream end
    window.jelico.ai.onStreamEnd(channelId, async (stats) => {
      window.jelico.ai.removeListeners(channelId)
      currentStreamChannelId = null

      const { streamingToolCalls, streamingToolResults } = get()
      const durationMs = Date.now() - streamStartTime

      // Calculate tokens per second
      let usage: Message['usage'] = undefined
      if (stats?.usage) {
        const tokensPerSecond = durationMs > 0
          ? Math.round((stats.usage.completionTokens / durationMs) * 1000)
          : 0
        usage = {
          promptTokens: stats.usage.promptTokens,
          completionTokens: stats.usage.completionTokens,
          totalTokens: stats.usage.totalTokens,
          tokensPerSecond,
          durationMs,
        }
      }

      // Save assistant message
      const assistantMessage = await window.jelico.conversations.addMessage(conversationId!, {
        role: 'assistant',
        content: fullContent,
      })

      // Attach tool calls/results and usage to the message object for display
      const messageWithTools: Message = {
        ...assistantMessage,
        toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
        toolResults: streamingToolResults.length > 0 ? streamingToolResults : undefined,
        usage,
      }

      set((state) => ({
        messages: [...state.messages, messageWithTools],
        isStreaming: false,
        streamingContent: '',
        streamingToolCalls: [],
        streamingToolResults: [],
      }))

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
    set({ isStreaming: false, streamingContent: '' })
  },

  deleteConversation: async (id) => {
    try {
      // Delete artifacts for this conversation
      await useArtifactStore.getState().clearConversationArtifacts(id)
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
}))
