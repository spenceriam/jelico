import { create } from 'zustand'

interface ProviderConfig {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom' | 'local' | 'zai' | 'zai-china' | 'zai-coding' | 'zai-coding-china' | 'minimax' | 'openai-compatible' | 'anthropic-compatible'
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
  setActiveProvider: (id: string) => Promise<void>
  setActiveModel: (model: string) => Promise<void>
  setActiveSelection: (providerId: string, model: string) => void
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

  setActiveProvider: async (id) => {
    const provider = get().providers.find(p => p.id === id)
    if (!provider) {
      console.warn(`[Providers] Provider ${id} not found`)
      return
    }

    // Update state immediately for UI responsiveness
    set({
      activeProviderId: id,
      activeModel: provider.defaultModel,
      error: null,
    })

    // Persist to database
    try {
      await window.jelico.providers.update(id, { defaultModel: provider.defaultModel })
      console.log(`[Providers] Set active provider: ${provider.name} (${id})`)
    } catch (err: any) {
      console.error('[Providers] Failed to persist active provider:', err)
      set({ error: `Failed to set active provider: ${err.message}` })
    }
  },

  setActiveModel: async (model) => {
    const { activeProviderId } = get()
    if (!activeProviderId || !model) return

    // Update state immediately
    set({ activeModel: model, error: null })

    // Persist to database
    try {
      await window.jelico.providers.update(activeProviderId, { defaultModel: model })
      console.log(`[Providers] Set active model: ${model}`)
    } catch (err: any) {
      console.error('[Providers] Failed to persist active model:', err)
      set({ error: `Failed to set active model: ${err.message}` })
    }
  },

  setActiveSelection: (providerId, model) => {
    if (!providerId || !model) return
    set({
      activeProviderId: providerId,
      activeModel: model,
      error: null,
    })
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
