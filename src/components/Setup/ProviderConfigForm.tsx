import { useState, useEffect, useMemo } from 'react'
import { Eye, EyeOff, Search, Loader2 } from 'lucide-react'

const API_KEY_URLS: Record<string, string> = {
  anthropic: 'console.anthropic.com',
  openai: 'platform.openai.com',
  google: 'makersuite.google.com',
  openrouter: 'openrouter.ai',
}

const MODEL_OPTIONS: Record<string, Array<{ id: string; name: string }>> = {
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
  openrouter: [], // Fetched dynamically
  ollama: [],
  custom: [],
}

interface OpenRouterModel {
  id: string
  name: string
  contextLength?: number
  pricing?: { prompt: string; completion: string }
}

interface ProviderConfigFormProps {
  type: string
  defaultModel: string
  onSave: (config: {
    name: string
    apiKey: string
    defaultModel: string
    baseUrl?: string
  }) => void
  isLoading?: boolean
}

export function ProviderConfigForm({ type, defaultModel, onSave, isLoading }: ProviderConfigFormProps) {
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(defaultModel)
  const [baseUrl, setBaseUrl] = useState(type === 'ollama' ? 'http://localhost:11434' : '')
  const [showKey, setShowKey] = useState(false)

  // OpenRouter specific state
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')

  const needsApiKey = type !== 'ollama'
  const needsBaseUrl = type === 'ollama' || type === 'custom'
  const isOpenRouter = type === 'openrouter'
  const staticModels = MODEL_OPTIONS[type] || []
  const apiKeyUrl = API_KEY_URLS[type]

  // Fetch OpenRouter models when API key changes
  useEffect(() => {
    if (!isOpenRouter || !apiKey || apiKey.length < 10) {
      setOpenRouterModels([])
      return
    }

    const fetchModels = async () => {
      setIsLoadingModels(true)
      try {
        const models = await window.jelico.providers.fetchOpenRouterModels(apiKey)
        setOpenRouterModels(models)
        // Auto-select first model if none selected
        if (models.length > 0 && !model) {
          setModel(models[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch OpenRouter models:', err)
        setOpenRouterModels([])
      } finally {
        setIsLoadingModels(false)
      }
    }

    // Debounce the fetch
    const timeout = setTimeout(fetchModels, 500)
    return () => clearTimeout(timeout)
  }, [isOpenRouter, apiKey])

  // Filter OpenRouter models by search
  const filteredOpenRouterModels = useMemo(() => {
    if (!modelSearch.trim()) return openRouterModels
    const search = modelSearch.toLowerCase()
    return openRouterModels.filter(
      m => m.id.toLowerCase().includes(search) || m.name.toLowerCase().includes(search)
    )
  }, [openRouterModels, modelSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name || getDefaultName(type),
      apiKey,
      defaultModel: model,
      baseUrl: needsBaseUrl ? baseUrl : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {needsApiKey && (
        <div>
          <label className="label">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input input-mono pr-10"
              placeholder={`${type === 'anthropic' ? 'sk-ant-' : 'sk-'}...`}
              required
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {apiKeyUrl && (
            <p className="form-hint">
              Get your key at{' '}
              <a
                href={`https://${apiKeyUrl}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {apiKeyUrl} &rarr;
              </a>
            </p>
          )}
        </div>
      )}

      <div>
        <label className="label">
          Display Name <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder={getDefaultName(type)}
        />
      </div>

      {needsBaseUrl && (
        <div>
          <label className="label">
            {type === 'ollama' ? 'Server URL' : 'Base URL'}
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="input input-mono"
            placeholder={type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
            required={type === 'custom'}
          />
        </div>
      )}

      {/* OpenRouter model selector with search */}
      {isOpenRouter && (
        <div>
          <label className="label">Default Model</label>

          {!apiKey ? (
            <p className="text-sm text-text-muted">Enter API key to load available models</p>
          ) : isLoadingModels ? (
            <div className="flex items-center gap-2 text-text-muted py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading models...</span>
            </div>
          ) : openRouterModels.length === 0 ? (
            <p className="text-sm text-text-muted">No models found. Check your API key.</p>
          ) : (
            <>
              {/* Search input */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="input pl-9"
                  placeholder="Search models..."
                />
              </div>

              {/* Model list */}
              <div className="max-h-48 overflow-y-auto border border-border-subtle rounded-md bg-bg-deep">
                {filteredOpenRouterModels.length === 0 ? (
                  <div className="p-3 text-sm text-text-muted">No models match "{modelSearch}"</div>
                ) : (
                  filteredOpenRouterModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-surface transition-colors border-b border-border-subtle last:border-b-0 ${
                        model === m.id ? 'bg-accent-glow text-accent' : 'text-text-primary'
                      }`}
                    >
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-text-muted font-mono">{m.id}</div>
                    </button>
                  ))
                )}
              </div>

              {model && (
                <p className="mt-2 text-xs text-text-secondary">
                  Selected: <span className="font-mono">{model}</span>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Static model dropdown for other providers */}
      {!isOpenRouter && staticModels.length > 0 && (
        <div>
          <label className="label">Default Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input"
          >
            {staticModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Manual model input for ollama/custom */}
      {!isOpenRouter && staticModels.length === 0 && (
        <div>
          <label className="label">Model ID</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input input-mono"
            placeholder="llama3.1"
            required
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading || (needsApiKey && !apiKey) || (isOpenRouter && !model)}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

function getDefaultName(type: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    ollama: 'Ollama',
    openrouter: 'OpenRouter',
    custom: 'Custom',
  }
  return names[type] || 'Provider'
}
