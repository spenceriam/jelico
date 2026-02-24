import { create } from 'zustand'

interface ProviderConfig {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom' | 'local' | 'zai' | 'zai-china' | 'zai-coding' | 'zai-coding-china' | 'minimax' | 'openai-compatible' | 'anthropic-compatible'
  name: string
  baseUrl?: string
  defaultModel: string
  hiddenFromSelector?: boolean
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

interface ProviderInput {
  type: ProviderConfig['type']
  name: string
  baseUrl?: string
  defaultModel: string
  hiddenFromSelector?: boolean
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
  testConnection: (id: string) => Promise<{ ok: boolean; message: string; status?: number }>
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
      const currentActive = providers.find(
        p => p.id === get().activeProviderId && !p.hiddenFromSelector && !!p.defaultModel?.trim()
      )
      const defaultProvider = providers.find(p => p.isDefault && !p.hiddenFromSelector && !!p.defaultModel?.trim())
      const firstVisibleProvider = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim())
      const selectedProvider = currentActive || defaultProvider || firstVisibleProvider || null
      set({
        providers,
        activeProviderId: selectedProvider?.id || null,
        activeModel: selectedProvider?.defaultModel || null,
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
      const currentActive = providers.find(
        p => p.id === get().activeProviderId && !p.hiddenFromSelector && !!p.defaultModel?.trim()
      )
      const defaultProvider = providers.find(p => p.isDefault && !p.hiddenFromSelector && !!p.defaultModel?.trim())
      const firstVisibleProvider = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim())
      const selectedProvider = currentActive || defaultProvider || firstVisibleProvider || null
      const activeProviderId = selectedProvider?.id || null
      const activeModel = selectedProvider?.defaultModel || null

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
      let { activeProviderId, activeModel } = get()
      const activeProvider = providers.find(p => p.id === activeProviderId)

      if (!activeProvider || activeProvider.hiddenFromSelector || !activeProvider.defaultModel?.trim()) {
        const fallback = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim()) || null
        activeProviderId = fallback?.id || null
        activeModel = fallback?.defaultModel || null
      } else if (activeModel !== activeProvider.defaultModel && updates.defaultModel !== undefined && activeProvider.id === id) {
        activeModel = activeProvider.defaultModel
      }

      set({ providers, activeProviderId, activeModel, isLoading: false })
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
        const defaultProvider = providers.find(p => p.isDefault && !p.hiddenFromSelector && !!p.defaultModel?.trim())
        const firstVisibleProvider = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim())
        const fallback = defaultProvider || firstVisibleProvider || null
        activeProviderId = fallback?.id || null
        activeModel = fallback?.defaultModel || null
      } else {
        const activeProvider = providers.find(p => p.id === activeProviderId)
        if (!activeProvider || activeProvider.hiddenFromSelector || !activeProvider.defaultModel?.trim()) {
          const defaultProvider = providers.find(p => p.isDefault && !p.hiddenFromSelector && !!p.defaultModel?.trim())
          const firstVisibleProvider = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim())
          const fallback = defaultProvider || firstVisibleProvider || null
          activeProviderId = fallback?.id || null
          activeModel = fallback?.defaultModel || null
        } else {
          activeModel = activeProvider.defaultModel
        }
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
      const result = await window.jelico.providers.test(id)

      if (typeof result === 'boolean') {
        return {
          ok: result,
          message: result ? 'Connection successful' : 'Connection failed',
        }
      }

      if (result && typeof result === 'object') {
        const maybe = result as any
        const ok = Boolean(maybe.ok ?? maybe.success)
        const message = typeof maybe.message === 'string' && maybe.message.trim()
          ? maybe.message.trim()
          : ok
            ? 'Connection successful'
            : 'Connection failed'
        const statusNumber = Number(maybe.status)
        const status = Number.isFinite(statusNumber) ? statusNumber : undefined

        return { ok, message, status }
      }

      return { ok: false, message: 'Connection failed' }
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Connection test failed' }
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
