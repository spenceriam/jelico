import { ChevronDown, Settings, PanelRight } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { useArtifactStore } from '../../stores/artifacts'
import { ModeSelector } from '../ModeSelector/ModeSelector'
import { WorkspaceSelector } from '../Workspace/WorkspaceSelector'

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
  const { artifacts, canvasOpen, toggleCanvas } = useArtifactStore()
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
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg-deep">
      {/* Left - Workspace selector */}
      <div className="flex-1 min-w-0">
        <WorkspaceSelector />
      </div>

      {/* Center - Mode selector */}
      <ModeSelector />

      {/* Right - Model & Settings */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {/* Model selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface border border-border-subtle rounded-md transition-colors"
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
            <div className="absolute top-full right-0 mt-1 w-72 bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden z-50">
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

        {/* Canvas toggle button */}
        <button
          onClick={toggleCanvas}
          className={`
            p-2 rounded-md transition-colors relative
            ${canvasOpen
              ? 'text-accent bg-bg-surface'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-surface'}
          `}
          title={canvasOpen ? 'Hide Canvas' : 'Show Canvas'}
        >
          <PanelRight className="w-5 h-5" />
          {artifacts.length > 0 && !canvasOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={() => openSettings()}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-surface rounded-md transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
