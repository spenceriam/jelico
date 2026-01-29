import { create } from 'zustand'

interface ProviderConfig {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom' | 'local' | 'zai' | 'zai-china' | 'zai-coding' | 'zai-coding-china' | 'openai-compatible' | 'anthropic-compatible'
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
  apiKey?: string
}

interface ProviderStore {
  providers: ProviderConfig[]
  activeProviderId: string | null
  activeModel: string | null
  isLoading: boolean
  error: string | null

  // Actions
  loadProviders: () => Promise<void>
  addProvider: (input: ProviderInput) => Promise<ProviderConfig>
  updateProvider: (id: string, updates: Partial<ProviderInput>) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  setActiveProvider: (id: string) => void
  setActiveModel: (model: string) => void
  testConnection: (id: string) => Promise<boolean>
  getModels: (type: string, baseUrl?: string) => Promise<Array<{ id: string; name: string }>>
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  activeProviderId: null,
  activeModel: null,
  isLoading: false,
  error: null,

  loadProviders: async () => {
    set({ isLoading: true, error: null })
    try {
      const providers = await window.jelico.providers.list()
      const defaultProvider = providers.find(p => p.isDefault)
      set({
        providers,
        activeProviderId: defaultProvider?.id || providers[0]?.id || null,
        activeModel: defaultProvider?.defaultModel || providers[0]?.defaultModel || null,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  addProvider: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const provider = await window.jelico.providers.create(input)
      const providers = await window.jelico.providers.list()

      // If this is the first/default provider, set it as active
      const activeProviderId = provider.isDefault ? provider.id : get().activeProviderId || provider.id
      const activeModel = provider.isDefault ? provider.defaultModel : get().activeModel || provider.defaultModel

      set({
        providers,
        activeProviderId,
        activeModel,
        isLoading: false,
      })
      return provider
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  updateProvider: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      await window.jelico.providers.update(id, updates)
      const providers = await window.jelico.providers.list()
      set({ providers, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  deleteProvider: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await window.jelico.providers.delete(id)
      const providers = await window.jelico.providers.list()

      // Update active provider if needed
      let { activeProviderId, activeModel } = get()
      if (activeProviderId === id) {
        const defaultProvider = providers.find(p => p.isDefault) || providers[0]
        activeProviderId = defaultProvider?.id || null
        activeModel = defaultProvider?.defaultModel || null
      }

      set({ providers, activeProviderId, activeModel, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  setActiveProvider: (id) => {
    const provider = get().providers.find(p => p.id === id)
    if (provider) {
      set({
        activeProviderId: id,
        activeModel: provider.defaultModel,
      })
    }
  },

  setActiveModel: (model) => {
    set({ activeModel: model })
  },

  testConnection: async (id) => {
    try {
      return await window.jelico.providers.test(id)
    } catch {
      return false
    }
  },

  getModels: async (type, baseUrl) => {
    try {
      return await (window.jelico as any).providers.models?.(type, baseUrl) || []
    } catch {
      return []
    }
  },
}))
