import { create } from 'zustand'
import { sanitizeReasoningEffort, type ReasoningEffort } from '../lib/reasoning'

const LAST_PROVIDER_SELECTION_STORAGE_KEY = 'jelico:last-provider-selection'

interface ProviderSelectionSnapshot {
  providerId: string
  model: string
  reasoningEffort: ReasoningEffort | null
}

interface ProviderConfig {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom' | 'local' | 'zai' | 'zai-china' | 'zai-coding' | 'zai-coding-china' | 'minimax' | 'openai-compatible' | 'anthropic-compatible'
  name: string
  baseUrl?: string
  defaultModel: string
  hiddenFromSelector?: boolean
  capabilityProfiles?: Record<string, unknown> | null
  defaultReasoningEffort?: ReasoningEffort | null
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
  capabilityProfiles?: Record<string, unknown> | null
  defaultReasoningEffort?: ReasoningEffort | null
  isDefault?: boolean
  apiKey?: string
}

interface ProviderStore {
  providers: ProviderConfig[]
  activeProviderId: string | null
  activeModel: string | null
  activeReasoningEffort: ReasoningEffort | null
  isLoading: boolean
  error: string | null

  // Actions
  loadProviders: () => Promise<void>
  addProvider: (input: ProviderInput) => Promise<ProviderConfig>
  updateProvider: (id: string, updates: Partial<ProviderInput>) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  reorderProviders: (ids: string[]) => Promise<void>
  setActiveProvider: (id: string) => Promise<void>
  setActiveModel: (model: string) => Promise<void>
  setActiveReasoningEffort: (effort: ReasoningEffort | null) => void
  setActiveSelection: (providerId: string, model: string, reasoningEffort?: ReasoningEffort | null) => void
  testConnection: (id: string) => Promise<{ ok: boolean; message: string; status?: number }>
  getModels: (type: string, baseUrl?: string) => Promise<Array<{ id: string; name: string }>>
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function loadPersistedProviderSelection(): ProviderSelectionSnapshot | null {
  if (!canUseLocalStorage()) return null

  try {
    const raw = window.localStorage.getItem(LAST_PROVIDER_SELECTION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProviderSelectionSnapshot>
    if (typeof parsed.providerId !== 'string' || typeof parsed.model !== 'string') return null
    return {
      providerId: parsed.providerId,
      model: parsed.model,
      reasoningEffort: parsed.reasoningEffort ?? null,
    }
  } catch {
    return null
  }
}

function persistProviderSelection(selection: ProviderSelectionSnapshot | null): void {
  if (!canUseLocalStorage()) return

  try {
    if (!selection) {
      window.localStorage.removeItem(LAST_PROVIDER_SELECTION_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(LAST_PROVIDER_SELECTION_STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // Ignore localStorage persistence failures.
  }
}

function normalizeSelectionSnapshot(
  providers: ProviderConfig[],
  selection?: ProviderSelectionSnapshot | null
): ProviderSelectionSnapshot | null {
  if (!selection?.providerId || !selection.model?.trim()) return null

  const provider = providers.find(
    (entry) => entry.id === selection.providerId && !entry.hiddenFromSelector && !!entry.defaultModel?.trim()
  )

  if (!provider) return null

  return {
    providerId: provider.id,
    model: selection.model.trim(),
    reasoningEffort: sanitizeReasoningEffort(
      provider.type,
      selection.model.trim(),
      selection.reasoningEffort ?? provider.defaultReasoningEffort ?? null
    ),
  }
}

function resolveActiveSelection(
  providers: ProviderConfig[],
  ...preferredSelections: Array<ProviderSelectionSnapshot | null | undefined>
): ProviderSelectionSnapshot | null {
  for (const selection of preferredSelections) {
    const normalized = normalizeSelectionSnapshot(providers, selection)
    if (normalized) return normalized
  }

  const defaultProvider = providers.find((provider) => provider.isDefault && !provider.hiddenFromSelector && !!provider.defaultModel?.trim())
  const firstVisibleProvider = providers.find((provider) => !provider.hiddenFromSelector && !!provider.defaultModel?.trim())
  const fallbackProvider = defaultProvider || firstVisibleProvider || null

  if (!fallbackProvider) return null

  return {
    providerId: fallbackProvider.id,
    model: fallbackProvider.defaultModel,
    reasoningEffort: fallbackProvider.defaultReasoningEffort || null,
  }
}

function getCurrentSelectionSnapshot(state: ProviderStore): ProviderSelectionSnapshot | null {
  if (!state.activeProviderId || !state.activeModel) return null

  return {
    providerId: state.activeProviderId,
    model: state.activeModel,
    reasoningEffort: state.activeReasoningEffort,
  }
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  activeProviderId: null,
  activeModel: null,
  activeReasoningEffort: null,
  isLoading: false,
  error: null,

  loadProviders: async () => {
    set({ isLoading: true, error: null })
    try {
      const providers = await window.jelico.providers.list()
      const selectedSelection = resolveActiveSelection(
        providers,
        getCurrentSelectionSnapshot(get()),
        loadPersistedProviderSelection()
      )

      set({
        providers,
        activeProviderId: selectedSelection?.providerId || null,
        activeModel: selectedSelection?.model || null,
        activeReasoningEffort: selectedSelection?.reasoningEffort || null,
        isLoading: false,
      })
      persistProviderSelection(selectedSelection)
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  addProvider: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const provider = await window.jelico.providers.create(input)
      const providers = await window.jelico.providers.list()
      const activeSelection = resolveActiveSelection(
        providers,
        getCurrentSelectionSnapshot(get()),
        loadPersistedProviderSelection()
      )

      set({
        providers,
        activeProviderId: activeSelection?.providerId || null,
        activeModel: activeSelection?.model || null,
        activeReasoningEffort: activeSelection?.reasoningEffort || null,
        isLoading: false,
      })
      persistProviderSelection(activeSelection)
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
      let { activeProviderId, activeModel, activeReasoningEffort } = get()
      const activeProvider = providers.find(p => p.id === activeProviderId)

      if (!activeProvider || activeProvider.hiddenFromSelector || !activeProvider.defaultModel?.trim()) {
        const fallback = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim()) || null
        activeProviderId = fallback?.id || null
        activeModel = fallback?.defaultModel || null
        activeReasoningEffort = fallback?.defaultReasoningEffort || null
      } else if (activeModel !== activeProvider.defaultModel && updates.defaultModel !== undefined && activeProvider.id === id) {
        activeModel = activeProvider.defaultModel
        activeReasoningEffort = activeProvider.defaultReasoningEffort || null
      } else if (updates.defaultReasoningEffort !== undefined && activeProvider.id === id) {
        activeReasoningEffort = activeProvider.defaultReasoningEffort || null
      }

      set({ providers, activeProviderId, activeModel, activeReasoningEffort, isLoading: false })
      persistProviderSelection(resolveActiveSelection(
        providers,
        activeProviderId && activeModel
          ? { providerId: activeProviderId, model: activeModel, reasoningEffort: activeReasoningEffort }
          : null
      ))
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
      let { activeProviderId, activeModel, activeReasoningEffort } = get()
      if (activeProviderId === id) {
        const defaultProvider = providers.find(p => p.isDefault && !p.hiddenFromSelector && !!p.defaultModel?.trim())
        const firstVisibleProvider = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim())
        const fallback = defaultProvider || firstVisibleProvider || null
        activeProviderId = fallback?.id || null
        activeModel = fallback?.defaultModel || null
        activeReasoningEffort = fallback?.defaultReasoningEffort || null
      } else {
        const activeProvider = providers.find(p => p.id === activeProviderId)
        if (!activeProvider || activeProvider.hiddenFromSelector || !activeProvider.defaultModel?.trim()) {
          const defaultProvider = providers.find(p => p.isDefault && !p.hiddenFromSelector && !!p.defaultModel?.trim())
          const firstVisibleProvider = providers.find(p => !p.hiddenFromSelector && !!p.defaultModel?.trim())
          const fallback = defaultProvider || firstVisibleProvider || null
          activeProviderId = fallback?.id || null
          activeModel = fallback?.defaultModel || null
          activeReasoningEffort = fallback?.defaultReasoningEffort || null
        } else {
          activeModel = activeProvider.defaultModel
          activeReasoningEffort = activeProvider.defaultReasoningEffort || null
        }
      }

      set({ providers, activeProviderId, activeModel, activeReasoningEffort, isLoading: false })
      persistProviderSelection(resolveActiveSelection(
        providers,
        activeProviderId && activeModel
          ? { providerId: activeProviderId, model: activeModel, reasoningEffort: activeReasoningEffort }
          : null
      ))
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  reorderProviders: async (ids) => {
    set({ isLoading: true, error: null })
    try {
      const providers = await window.jelico.providers.reorder(ids)
      const activeSelection = resolveActiveSelection(
        providers,
        getCurrentSelectionSnapshot(get())
      )
      set({
        providers,
        activeProviderId: activeSelection?.providerId || null,
        activeModel: activeSelection?.model || null,
        activeReasoningEffort: activeSelection?.reasoningEffort || null,
        isLoading: false,
      })
      persistProviderSelection(activeSelection)
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
      activeReasoningEffort: provider.defaultReasoningEffort || null,
      error: null,
    })
    persistProviderSelection({
      providerId: id,
      model: provider.defaultModel,
      reasoningEffort: provider.defaultReasoningEffort || null,
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
    const { activeProviderId, providers, activeReasoningEffort } = get()
    if (!activeProviderId || !model) return
    const activeProvider = providers.find((provider) => provider.id === activeProviderId) || null

    // Update state immediately
    set({
      activeModel: model,
      activeReasoningEffort: sanitizeReasoningEffort(activeProvider?.type || '', model, activeReasoningEffort),
      error: null,
    })
    persistProviderSelection(
      activeProvider
        ? {
            providerId: activeProviderId,
            model,
            reasoningEffort: sanitizeReasoningEffort(activeProvider.type, model, activeReasoningEffort),
          }
        : null
    )

    // Persist to database
    try {
      await window.jelico.providers.update(activeProviderId, { defaultModel: model })
      console.log(`[Providers] Set active model: ${model}`)
    } catch (err: any) {
      console.error('[Providers] Failed to persist active model:', err)
      set({ error: `Failed to set active model: ${err.message}` })
    }
  },

  setActiveReasoningEffort: (effort) => {
    const { activeProviderId, activeModel, providers } = get()
    const activeProvider = providers.find((provider) => provider.id === activeProviderId) || null
    const nextReasoningEffort = sanitizeReasoningEffort(activeProvider?.type || '', activeModel, effort)
    set({
      activeReasoningEffort: nextReasoningEffort,
      error: null,
    })
    persistProviderSelection(
      activeProvider && activeProviderId && activeModel
        ? {
            providerId: activeProviderId,
            model: activeModel,
            reasoningEffort: nextReasoningEffort,
          }
        : null
    )
  },

  setActiveSelection: (providerId, model, reasoningEffort) => {
    if (!providerId || !model) return
    const provider = get().providers.find((entry) => entry.id === providerId) || null
    const nextReasoningEffort = sanitizeReasoningEffort(
      provider?.type || '',
      model,
      reasoningEffort !== undefined ? reasoningEffort : provider?.defaultReasoningEffort || null
    )
    set({
      activeProviderId: providerId,
      activeModel: model,
      activeReasoningEffort: nextReasoningEffort,
      error: null,
    })
    persistProviderSelection(
      provider
        ? {
            providerId,
            model,
            reasoningEffort: nextReasoningEffort,
          }
        : null
    )
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
