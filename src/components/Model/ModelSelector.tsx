import { ChevronDown, Edit2, Check, X, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'

// Model lists for display (static providers only)
// OpenRouter, Ollama, and Custom use dynamic model selection
const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ],
  // Dynamic providers - these support editable model input
  openrouter: [],
  ollama: [],
  custom: [],
}

// Providers that support editable model input
const DYNAMIC_PROVIDERS = ['openrouter', 'ollama', 'custom']

interface ModelSelectorProps {
  compact?: boolean
}

export function ModelSelector({ compact = false }: ModelSelectorProps) {
  const { providers, activeProviderId, activeModel, setActiveProvider, setActiveModel } = useProviderStore()
  const { openSettings } = useUIStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [editModelValue, setEditModelValue] = useState('')
  const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; name: string }>>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const activeProvider = providers.find(p => p.id === activeProviderId)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
        setEditingModel(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingModel && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingModel])

  // Fetch OpenRouter models when dropdown opens for an OpenRouter provider
  const fetchOpenRouterModels = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (provider?.type !== 'openrouter' || openRouterModels.length > 0) return

    setLoadingModels(true)
    try {
      const apiKey = await window.jelico.keychain.getApiKey(providerId)
      if (apiKey) {
        const models = await window.jelico.providers.fetchOpenRouterModels(apiKey)
        setOpenRouterModels(models.map(m => ({ id: m.id, name: m.name })))
      }
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  const startEditingModel = (providerId: string, currentModel: string) => {
    setEditingModel(providerId)
    setEditModelValue(currentModel)
    setModelSearch('')
    // Fetch models if OpenRouter
    const provider = providers.find(p => p.id === providerId)
    if (provider?.type === 'openrouter') {
      fetchOpenRouterModels(providerId)
    }
  }

  const saveModelEdit = (providerId: string) => {
    if (editModelValue.trim()) {
      setActiveProvider(providerId)
      setActiveModel(editModelValue.trim())
    }
    setEditingModel(null)
    setDropdownOpen(false)
  }

  const cancelModelEdit = () => {
    setEditingModel(null)
    setEditModelValue('')
  }

  const getModelName = (modelId: string, providerType: string) => {
    const models = PROVIDER_MODELS[providerType] || []
    return models.find(m => m.id === modelId)?.name || modelId
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface border border-border-subtle rounded-md transition-colors ${
          compact ? '' : ''
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-accent" />
        <span>
          {activeModel && activeProvider
            ? getModelName(activeModel, activeProvider.type)
            : 'Select model'}
        </span>
        <ChevronDown className="w-3 h-3 text-text-muted" />
      </button>

      {dropdownOpen && (
        <div className={`absolute top-full mt-1 w-80 bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden z-50 max-h-[70vh] overflow-y-auto ${
          compact ? 'left-1/2 -translate-x-1/2' : 'right-0'
        }`}>
          {providers.map((provider) => {
            const isDynamic = DYNAMIC_PROVIDERS.includes(provider.type)
            const isEditing = editingModel === provider.id
            const staticModels = PROVIDER_MODELS[provider.type] || []
            const currentModel = activeProviderId === provider.id ? activeModel : provider.defaultModel

            return (
              <div key={provider.id}>
                <div className="px-3 py-2 text-xs text-text-muted uppercase tracking-wider bg-bg-surface flex items-center justify-between">
                  <span>{provider.name}</span>
                  {isDynamic && !isEditing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditingModel(provider.id, currentModel || '')
                      }}
                      className="p-1 hover:text-text-primary rounded"
                      title="Change model"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Dynamic provider - editable model */}
                {isDynamic && isEditing ? (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editModelValue}
                        onChange={(e) => setEditModelValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveModelEdit(provider.id)
                          if (e.key === 'Escape') cancelModelEdit()
                        }}
                        placeholder="Enter model ID..."
                        className="flex-1 px-2 py-1.5 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary"
                      />
                      <button
                        onClick={() => saveModelEdit(provider.id)}
                        className="p-1.5 text-green-500 hover:bg-bg-hover rounded"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelModelEdit}
                        className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* OpenRouter model suggestions */}
                    {provider.type === 'openrouter' && (
                      <div className="space-y-1">
                        {loadingModels ? (
                          <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading models...
                          </div>
                        ) : openRouterModels.length > 0 ? (
                          <>
                            <input
                              type="text"
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                              placeholder="Search models..."
                              className="w-full px-2 py-1 text-xs bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary"
                            />
                            <div className="max-h-40 overflow-y-auto">
                              {openRouterModels
                                .filter(m =>
                                  m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
                                  m.name.toLowerCase().includes(modelSearch.toLowerCase())
                                )
                                .slice(0, 20)
                                .map((model) => (
                                  <button
                                    key={model.id}
                                    onClick={() => {
                                      setEditModelValue(model.id)
                                    }}
                                    className="w-full px-2 py-1.5 text-xs text-left hover:bg-bg-hover rounded text-text-secondary hover:text-text-primary truncate"
                                  >
                                    {model.name}
                                    <span className="text-text-faint ml-1">({model.id})</span>
                                  </button>
                                ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-text-muted">
                            Type a model ID like: anthropic/claude-3.5-sonnet
                          </p>
                        )}
                      </div>
                    )}

                    {provider.type === 'ollama' && (
                      <p className="text-xs text-text-muted">
                        Use models from: ollama list
                      </p>
                    )}
                  </div>
                ) : isDynamic ? (
                  /* Dynamic provider - current model display */
                  <button
                    onClick={() => {
                      setActiveProvider(provider.id)
                      setActiveModel(currentModel || provider.defaultModel)
                      setDropdownOpen(false)
                    }}
                    className={`
                      w-full px-3 py-2 text-sm text-left hover:bg-bg-hover transition-colors flex items-center justify-between
                      ${activeProviderId === provider.id ? 'text-accent' : 'text-text-primary'}
                    `}
                  >
                    <span className="truncate">{currentModel || provider.defaultModel}</span>
                    {activeProviderId === provider.id && <span>✓</span>}
                  </button>
                ) : (
                  /* Static provider - model list */
                  staticModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setActiveProvider(provider.id)
                        setActiveModel(model.id)
                        setDropdownOpen(false)
                      }}
                      className={`
                        w-full px-3 py-2 text-sm text-left hover:bg-bg-hover transition-colors
                        ${activeProviderId === provider.id && activeModel === model.id
                          ? 'text-accent'
                          : 'text-text-primary'}
                      `}
                    >
                      {model.name}
                      {activeProviderId === provider.id && activeModel === model.id && (
                        <span className="ml-2">✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )
          })}

          <div className="border-t border-border">
            <button
              onClick={() => {
                setDropdownOpen(false)
                setEditingModel(null)
                openSettings('providers')
              }}
              className="w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors"
            >
              Manage providers...
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
