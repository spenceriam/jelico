import { ChevronDown, Settings } from 'lucide-react'
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
  // Dynamic providers - show provider's default model
  openrouter: [],
  ollama: [],
  custom: [],
}

export function Header() {
  const { providers, activeProviderId, activeModel, setActiveProvider, setActiveModel } = useProviderStore()
  const { openSettings } = useUIStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeProvider = providers.find(p => p.id === activeProviderId)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getModelName = (modelId: string, providerType: string) => {
    const models = PROVIDER_MODELS[providerType] || []
    return models.find(m => m.id === modelId)?.name || modelId
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg-surface">
      {/* Left - placeholder for workspace selector */}
      <div className="flex-1" />

      {/* Center - Model selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
        >
          <span>
            {activeModel && activeProvider
              ? getModelName(activeModel, activeProvider.type)
              : 'Select model'}
          </span>
          {activeProvider && (
            <span className="text-text-muted">· {activeProvider.name}</span>
          )}
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-72 bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden z-50">
            {providers.map((provider) => {
              const models = PROVIDER_MODELS[provider.type] || [
                { id: provider.defaultModel, name: provider.defaultModel }
              ]

              return (
                <div key={provider.id}>
                  <div className="px-3 py-2 text-xs text-text-muted uppercase tracking-wider bg-bg-surface">
                    {provider.name}
                  </div>
                  {models.map((model) => (
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
                  ))}
                </div>
              )
            })}

            <div className="border-t border-border">
              <button
                onClick={() => {
                  setDropdownOpen(false)
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

      {/* Right - Settings */}
      <div className="flex-1 flex justify-end">
        <button
          onClick={() => openSettings()}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
