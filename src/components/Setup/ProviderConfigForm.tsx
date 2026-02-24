import { useState, useEffect, useMemo, useCallback } from 'react'
import { Eye, EyeOff, Search, Loader2, RefreshCw } from 'lucide-react'

const API_KEY_URLS: Record<string, string> = {
  anthropic: 'console.anthropic.com',
  openai: 'platform.openai.com',
  google: 'aistudio.google.com',
  openrouter: 'openrouter.ai',
  zai: 'open.bigmodel.cn',
  'zai-china': 'open.bigmodel.cn',
  'zai-coding': 'open.bigmodel.cn',
  'zai-coding-china': 'open.bigmodel.cn',
  minimax: 'platform.minimax.io',
  'openai-compatible': '',
  'anthropic-compatible': '',
  custom: '',
  local: '',
}

// Fallback models shown before API key is entered or when fetch fails
const FALLBACK_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
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
  openrouter: [],
  ollama: [],
  custom: [],
  // Z.ai models - verified from z.ai/mastra.ai docs
  zai: [
    { id: 'glm-4.7', name: 'GLM-4.7 (Flagship)' },
    { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash' },
    { id: 'glm-4.6', name: 'GLM-4.6 (205K)' },
    { id: 'glm-4.6v', name: 'GLM-4.6v (Vision)' },
    { id: 'glm-4.5', name: 'GLM-4.5 (131K)' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash (Free)' },
  ],
  'zai-china': [
    { id: 'glm-4.7', name: 'GLM-4.7 (Flagship)' },
    { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash' },
    { id: 'glm-4.6', name: 'GLM-4.6 (205K)' },
    { id: 'glm-4.6v', name: 'GLM-4.6v (Vision)' },
    { id: 'glm-4.5', name: 'GLM-4.5 (131K)' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash (Free)' },
  ],
  'zai-coding': [
    { id: 'glm-4.7', name: 'GLM-4.7 (Flagship)' },
    { id: 'glm-4.6', name: 'GLM-4.6 (205K)' },
    { id: 'glm-4.5', name: 'GLM-4.5 (131K)' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash' },
  ],
  'zai-coding-china': [
    { id: 'glm-4.7', name: 'GLM-4.7 (Flagship)' },
    { id: 'glm-4.6', name: 'GLM-4.6 (205K)' },
    { id: 'glm-4.5', name: 'GLM-4.5 (131K)' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash' },
  ],
  minimax: [],
  // Generic providers - user enters model manually
  'openai-compatible': [],
  'anthropic-compatible': [],
  local: [],
}

// Provider types that support dynamic model fetching
const DYNAMIC_MODEL_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'ollama',
  'minimax',
  'openai-compatible',
  'anthropic-compatible',
  'custom',
  'local',
]

interface ProviderModel {
  id: string
  name: string
  contextLength?: number
  pricing?: { prompt: string; completion: string }
}

interface ProviderConfigFormProps {
  type: string
  defaultModel: string
  initialName?: string
  initialBaseUrl?: string
  apiKeyUrl?: string
  onSave: (config: {
    name: string
    apiKey: string
    defaultModel: string
    baseUrl?: string
  }) => void
  isLoading?: boolean
}

export function ProviderConfigForm({
  type,
  defaultModel,
  initialName,
  initialBaseUrl,
  apiKeyUrl: apiKeyUrlOverride,
  onSave,
  isLoading,
}: ProviderConfigFormProps) {
  const [name, setName] = useState(initialName || '')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(defaultModel)
  const [baseUrl, setBaseUrl] = useState(
    initialBaseUrl ||
    (type === 'ollama' ? 'http://localhost:11434' :
    type === 'local' ? 'http://localhost:8080/v1' : '')
  )
  const [showKey, setShowKey] = useState(false)

  // Dynamic model fetching state
  const [models, setModels] = useState<ProviderModel[]>(FALLBACK_MODELS[type] || [])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelsFetched, setModelsFetched] = useState(false)
  const [modelSearch, setModelSearch] = useState('')

  const needsApiKey = type !== 'ollama' && type !== 'local'
  const needsBaseUrl = ['ollama', 'custom', 'openai-compatible', 'anthropic-compatible', 'local'].includes(type)
  const modelIsOptional = ['openai-compatible', 'anthropic-compatible', 'custom', 'local', 'minimax'].includes(type)
  const isDynamic = DYNAMIC_MODEL_PROVIDERS.includes(type)
  const apiKeyUrl = apiKeyUrlOverride || API_KEY_URLS[type]

  // Function to fetch models from API
  const fetchModels = useCallback(async () => {
    if (!isDynamic) return

    // For providers needing API key, check if we have one
    if (needsApiKey && (!apiKey || apiKey.length < 10)) {
      setModels(FALLBACK_MODELS[type] || [])
      setModelsFetched(false)
      return
    }

    setIsLoadingModels(true)
    try {
      let fetchedModels: ProviderModel[] = []

      fetchedModels = await window.jelico.providers.previewModels(type, apiKey, baseUrl)

      if (fetchedModels.length > 0) {
        setModels(fetchedModels)
        setModelsFetched(true)
        // Auto-select first model if none selected or current not in list
        if (!model || !fetchedModels.find(m => m.id === model)) {
          setModel(fetchedModels[0].id)
        }
      } else {
        setModels(FALLBACK_MODELS[type] || [])
        setModelsFetched(false)
      }
    } catch (err) {
      console.error(`Failed to fetch ${type} models:`, err)
      setModels(FALLBACK_MODELS[type] || [])
      setModelsFetched(false)
    } finally {
      setIsLoadingModels(false)
    }
  }, [type, apiKey, baseUrl, isDynamic, needsApiKey, model])

  // Fetch models when API key changes (debounced)
  useEffect(() => {
    if (!isDynamic) return

    const timeout = setTimeout(() => {
      fetchModels()
    }, 500)

    return () => clearTimeout(timeout)
  }, [apiKey, baseUrl, isDynamic, fetchModels])

  // Filter models by search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return models
    const search = modelSearch.toLowerCase()
    return models.filter(
      m => m.id.toLowerCase().includes(search) || m.name.toLowerCase().includes(search)
    )
  }, [models, modelSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name || initialName || getDefaultName(type),
      apiKey,
      defaultModel: model,
      baseUrl: needsBaseUrl ? baseUrl : undefined,
    })
  }

  // Show searchable list for providers with many models
  const showSearchableList = type === 'openrouter' || (modelsFetched && models.length > 10)

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

      {/* Model selector */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">
            Default Model{modelIsOptional ? ' (optional)' : ''}
          </label>
          {isDynamic && modelsFetched && (
            <button
              type="button"
              onClick={fetchModels}
              disabled={isLoadingModels}
              className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {isLoadingModels ? (
          <div className="flex items-center gap-2 text-text-muted py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading models from API...</span>
          </div>
        ) : models.length === 0 ? (
          <div className="text-sm text-text-muted">
            {needsApiKey && !apiKey
              ? 'Enter API key to load available models'
              : 'No models found. Check your connection.'}
          </div>
        ) : showSearchableList ? (
          <>
            {/* Search input for large model lists */}
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

            {/* Scrollable model list */}
            <div className="max-h-48 overflow-y-auto border border-border-subtle rounded-md bg-bg-deep">
              {filteredModels.length === 0 ? (
                <div className="p-3 text-sm text-text-muted">No models match "{modelSearch}"</div>
              ) : (
                filteredModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-surface transition-colors border-b border-border-subtle last:border-b-0 ${
                      model === m.id ? 'bg-accent-glow text-accent' : 'text-text-primary'
                    }`}
                  >
                    <div className="font-medium">{m.name}</div>
                    {m.id !== m.name && (
                      <div className="text-xs text-text-muted font-mono">{m.id}</div>
                    )}
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
        ) : (
          /* Simple dropdown for smaller model lists */
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.id !== m.name ? ` (${m.id})` : ''}
              </option>
            ))}
          </select>
        )}

        {modelsFetched && (
          <p className="text-xs text-text-muted mt-1">
            {models.length} models loaded from API
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading || (needsApiKey && !apiKey) || (!modelIsOptional && !model)}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

// Fetch models with temporary API key (before provider is saved)
async function fetchModelsWithKey(
  type: string,
  apiKey: string,
  baseUrl?: string
): Promise<ProviderModel[]> {
  try {
    switch (type) {
      case 'anthropic': {
        const response = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        })
        if (!response.ok) return []
        const data = await response.json()
        return (data.data || [])
          .filter((m: any) => m.type === 'model')
          .map((m: any) => ({
            id: m.id,
            name: m.display_name || m.id,
          }))
          .sort((a: ProviderModel, b: ProviderModel) => a.name.localeCompare(b.name))
      }

      case 'openai': {
        const url = baseUrl ? `${baseUrl}/models` : 'https://api.openai.com/v1/models'
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        })
        if (!response.ok) return []
        const data = await response.json()
        return (data.data || [])
          .filter((m: any) => {
            const id = m.id.toLowerCase()
            return (id.includes('gpt') || id.startsWith('o1') || id.startsWith('o3')) &&
                   !id.includes('instruct') && !id.includes('realtime')
          })
          .map((m: any) => ({ id: m.id, name: m.id }))
          .sort((a: ProviderModel, b: ProviderModel) => {
            if (a.id.includes('gpt-4') && !b.id.includes('gpt-4')) return -1
            if (!a.id.includes('gpt-4') && b.id.includes('gpt-4')) return 1
            return a.id.localeCompare(b.id)
          })
      }

      case 'minimax':
      case 'openai-compatible':
      case 'anthropic-compatible':
      case 'custom':
      case 'local': {
        return await fetchOpenAICompatibleModels(apiKey, baseUrl, type)
      }

      case 'google': {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
        )
        if (!response.ok) return []
        const data = await response.json()
        return (data.models || [])
          .filter((m: any) => {
            const name = m.name || ''
            return name.includes('gemini') &&
                   m.supportedGenerationMethods?.includes('generateContent')
          })
          .map((m: any) => {
            const id = m.name.replace('models/', '')
            return { id, name: m.displayName || id }
          })
          .sort((a: ProviderModel, b: ProviderModel) => a.name.localeCompare(b.name))
      }

      default:
        return []
    }
  } catch (err) {
    console.error(`Error fetching ${type} models:`, err)
    return []
  }
}

function getDefaultName(type: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    ollama: 'Ollama',
    openrouter: 'OpenRouter',
    custom: 'Custom',
    zai: 'Z.ai',
    'zai-china': 'Z.ai China',
    'zai-coding': 'Z.ai Coding',
    'zai-coding-china': 'Z.ai Coding CN',
    minimax: 'MiniMax',
    'openai-compatible': 'OpenAI Compatible',
    'anthropic-compatible': 'Anthropic Compatible',
    local: 'Local Server',
  }
  return names[type] || 'Provider'
}

function buildModelsEndpointCandidates(type: string, baseUrl?: string): string[] {
  if (!baseUrl) {
    if (type === 'openai') return ['https://api.openai.com/v1/models']
    return []
  }

  const trimmed = baseUrl.replace(/\/+$/, '')
  const candidates: string[] = []

  const pushUnique = (url: string) => {
    if (!candidates.includes(url)) {
      candidates.push(url)
    }
  }

  if (trimmed.endsWith('/models')) {
    pushUnique(trimmed)
  } else if (trimmed.endsWith('/v1')) {
    pushUnique(`${trimmed}/models`)
  } else {
    pushUnique(`${trimmed}/v1/models`)
  }

  if (trimmed.endsWith('/anthropic')) {
    try {
      const parsed = new URL(trimmed)
      pushUnique(`${parsed.origin}/v1/models`)
    } catch {
      // Ignore invalid URL and use existing candidates only.
    }
  }

  return candidates
}

async function fetchOpenAICompatibleModels(
  apiKey: string,
  baseUrl?: string,
  type: string = 'openai-compatible'
): Promise<ProviderModel[]> {
  const endpoints = buildModelsEndpointCandidates(type, baseUrl)
  if (endpoints.length === 0) {
    return []
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      })
      if (!response.ok) {
        continue
      }

      const payload = await response.json()
      const models = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.models)
          ? payload.models
          : []

      const normalized = models
        .map((model: any) => {
          const id = String(model?.id || model?.name || '').trim()
          if (!id) return null
          const displayName = String(model?.name || model?.display_name || id).trim() || id
          return { id, name: displayName }
        })
        .filter(Boolean) as ProviderModel[]

      if (normalized.length > 0) {
        return normalized.sort((a, b) => a.name.localeCompare(b.name))
      }
    } catch {
      // Try next candidate endpoint
    }
  }

  return []
}
