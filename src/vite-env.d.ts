/// <reference types="vite/client" />

interface Window {
  jelico: {
    providers: {
      list: () => Promise<ProviderConfig[]>
      get: (id: string) => Promise<ProviderConfig | null>
      create: (provider: ProviderInput) => Promise<ProviderConfig>
      update: (id: string, updates: Partial<ProviderInput>) => Promise<ProviderConfig>
      delete: (id: string) => Promise<void>
      test: (id: string) => Promise<boolean>
      fetchOpenRouterModels: (apiKey: string) => Promise<OpenRouterModel[]>
    }
    keychain: {
      setApiKey: (providerId: string, key: string) => Promise<void>
      getApiKey: (providerId: string) => Promise<string | null>
      deleteApiKey: (providerId: string) => Promise<void>
    }
    conversations: {
      list: () => Promise<Conversation[]>
      get: (id: string) => Promise<Conversation | null>
      create: (conversation: ConversationInput) => Promise<Conversation>
      addMessage: (convId: string, message: MessageInput) => Promise<Message>
      delete: (id: string) => Promise<void>
    }
    ai: {
      stream: (params: StreamParams) => string
      onStreamChunk: (channelId: string, callback: (chunk: string) => void) => void
      onStreamEnd: (channelId: string, callback: () => void) => void
      onStreamError: (channelId: string, callback: (error: string) => void) => void
      stopStream: (channelId: string) => void
      removeListeners: (channelId: string) => void
    }
  }
}

interface ProviderConfig {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom'
  name: string
  baseUrl?: string
  defaultModel: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

interface ProviderInput {
  type: ProviderConfig['type']
  name: string
  baseUrl?: string
  defaultModel: string
  isDefault?: boolean
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

interface ConversationInput {
  title: string
  model: string
  providerId: string
  workspaceId?: string
}

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

interface MessageInput {
  role: Message['role']
  content: string
}

interface StreamParams {
  providerId: string
  model?: string
  messages: Array<{ role: string; content: string }>
}

interface OpenRouterModel {
  id: string
  name: string
  contextLength?: number
  pricing?: { prompt: string; completion: string }
}
