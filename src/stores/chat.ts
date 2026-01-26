import { create } from 'zustand'

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

interface Conversation {
  id: string
  title: string
  workspaceId?: string
  model: string
  providerId: string
  createdAt: number
  updatedAt: number
  messages?: Message[]
}

interface ChatStore {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  isLoading: boolean
  error: string | null

  // Actions
  loadConversations: () => Promise<void>
  createConversation: (providerId: string, model: string) => Promise<string>
  setActiveConversation: (id: string | null) => Promise<void>
  sendMessage: (content: string, providerId: string, model: string) => Promise<void>
  stopStreaming: () => void
  deleteConversation: (id: string) => Promise<void>
  clearError: () => void
}

let currentStreamChannelId: string | null = null

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  isLoading: false,
  error: null,

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
      set({ activeConversationId: null, messages: [] })
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
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  sendMessage: async (content, providerId, model) => {
    const { activeConversationId, messages } = get()
    let conversationId = activeConversationId

    // Create conversation if needed
    if (!conversationId) {
      conversationId = await get().createConversation(providerId, model)
    }

    // Add user message
    const userMessage = await window.jelico.conversations.addMessage(conversationId, {
      role: 'user',
      content,
    })

    // Update title if this is the first message
    if (messages.length === 0) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      await (window.jelico.conversations as any).updateTitle?.(conversationId, title)
      // Reload conversations to get updated title
      const conversations = await window.jelico.conversations.list()
      set({ conversations })
    }

    const updatedMessages = [...messages, userMessage]
    set({
      messages: updatedMessages,
      isStreaming: true,
      streamingContent: '',
    })

    // Start streaming
    const channelId = window.jelico.ai.stream({
      providerId,
      model,
      messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
    })
    currentStreamChannelId = channelId

    let fullContent = ''

    // Handle stream chunks
    window.jelico.ai.onStreamChunk(channelId, (chunk) => {
      fullContent += chunk
      set({ streamingContent: fullContent })
    })

    // Handle stream end
    window.jelico.ai.onStreamEnd(channelId, async () => {
      window.jelico.ai.removeListeners(channelId)
      currentStreamChannelId = null

      // Save assistant message
      const assistantMessage = await window.jelico.conversations.addMessage(conversationId!, {
        role: 'assistant',
        content: fullContent,
      })

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isStreaming: false,
        streamingContent: '',
      }))
    })

    // Handle stream error
    window.jelico.ai.onStreamError(channelId, (error) => {
      window.jelico.ai.removeListeners(channelId)
      currentStreamChannelId = null
      set({
        isStreaming: false,
        streamingContent: '',
        error: error,
      })
    })
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
      await window.jelico.conversations.delete(id)
      const conversations = await window.jelico.conversations.list()
      const { activeConversationId } = get()

      set({
        conversations,
        activeConversationId: activeConversationId === id ? null : activeConversationId,
        messages: activeConversationId === id ? [] : get().messages,
      })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  clearError: () => set({ error: null }),
}))
