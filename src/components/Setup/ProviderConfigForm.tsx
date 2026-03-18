import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Eye, EyeOff, Search, Loader2, RefreshCw } from 'lucide-react'
import { buildCompatibleModelsEndpointCandidates } from '../../lib/compatibleProviderModels'
import { sortGoogleModels } from '../../lib/googleModels'
import { getSupportedReasoningEfforts, REASONING_EFFORT_LABELS, type ReasoningEffort } from '../../lib/reasoning'
import { ToolSupportBadge } from '../Providers/ToolSupportBadge'

const GOOGLE_GENERATIVE_LANGUAGE_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

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
  anthropic: [],
  openai: [],
  google: [],
  openrouter: [],
  ollama: [],
  custom: [],
  // Z.ai models - curated fallback from current public docs.
  zai: [
    { id: 'glm-5', name: 'GLM-5' },
    { id: 'glm-4.7', name: 'GLM-4.7' },
    { id: 'glm-4.7-flashx', name: 'GLM-4.7 FlashX' },
    { id: 'glm-4.5', name: 'GLM-4.5' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.5-airx', name: 'GLM-4.5 AirX' },
    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash' },
    { id: 'glm-z1-air', name: 'GLM-Z1 Air' },
    { id: 'glm-z1-airx', name: 'GLM-Z1 AirX' },
  ],
  'zai-china': [
    { id: 'glm-5', name: 'GLM-5' },
    { id: 'glm-4.7', name: 'GLM-4.7' },
    { id: 'glm-4.7-flashx', name: 'GLM-4.7 FlashX' },
    { id: 'glm-4.5', name: 'GLM-4.5' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.5-airx', name: 'GLM-4.5 AirX' },
    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash' },
    { id: 'glm-z1-air', name: 'GLM-Z1 Air' },
    { id: 'glm-z1-airx', name: 'GLM-Z1 AirX' },
  ],
  'zai-coding': [
    { id: 'glm-4.7', name: 'GLM-4.7' },
    { id: 'glm-5', name: 'GLM-5' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.6', name: 'GLM-4.6' },
    { id: 'glm-4.5', name: 'GLM-4.5' },
    { id: 'glm-4.5v', name: 'GLM-4.5V' },
    { id: 'glm-4.6v', name: 'GLM-4.6V' },
  ],
  'zai-coding-china': [
    { id: 'glm-4.7', name: 'GLM-4.7' },
    { id: 'glm-5', name: 'GLM-5' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.6', name: 'GLM-4.6' },
    { id: 'glm-4.5', name: 'GLM-4.5' },
    { id: 'glm-4.5v', name: 'GLM-4.5V' },
    { id: 'glm-4.6v', name: 'GLM-4.6V' },
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
  'zai',
  'zai-china',
  'zai-coding',
  'zai-coding-china',
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
  capabilitySummary?: ProviderCapabilitySummary | null
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
    defaultReasoningEffort?: ReasoningEffort | null
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
  const hasCustomModelOverrideRef = useRef(false)
  const latestModelRequestKeyRef = useRef('')
  const catalogRefreshRequestKeyRef = useRef<string | null>(null)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | ''>('')

  const needsApiKey = type !== 'ollama' && type !== 'local'
  const needsBaseUrl = ['ollama', 'custom', 'openai-compatible', 'anthropic-compatible', 'local'].includes(type)
  const modelIsOptional = ['openai-compatible', 'anthropic-compatible', 'custom', 'local', 'minimax'].includes(type)
  const isDynamic = DYNAMIC_MODEL_PROVIDERS.includes(type)
  const apiKeyUrl = apiKeyUrlOverride || API_KEY_URLS[type]

  const resolveFetchedModelSelection = useCallback((currentModel: string, fetchedModels: ProviderModel[]) => {
    if (hasCustomModelOverrideRef.current && currentModel.trim()) {
      return currentModel
    }

    return currentModel && fetchedModels.some((candidate) => candidate.id === currentModel)
      ? currentModel
      : fetchedModels[0].id
  }, [])

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
      const providerName = name || initialName || getDefaultName(type)
      const requestKey = JSON.stringify({
        type,
        apiKey,
        baseUrl,
        providerName,
      })
      latestModelRequestKeyRef.current = requestKey
      let fetchedModels: ProviderModel[] = []

      fetchedModels = await window.jelico.providers.previewModels(
        type,
        apiKey,
        baseUrl,
        providerName
      )
      if (fetchedModels.length === 0) {
        fetchedModels = await fetchModelsWithKey(type, apiKey, baseUrl)
      }

      if (latestModelRequestKeyRef.current !== requestKey) {
        return
      }

      if (fetchedModels.length > 0) {
        setModels(fetchedModels)
        setModelsFetched(true)
        setModel((currentModel) => resolveFetchedModelSelection(currentModel, fetchedModels))
      } else {
        setModels(FALLBACK_MODELS[type] || [])
        setModelsFetched(false)
      }

      const catalogStatus = await window.jelico.providers.getModelCatalogStatus()
      if (
        fetchedModels.length > 0 &&
        (!catalogStatus.hasSnapshot || catalogStatus.isStale) &&
        catalogRefreshRequestKeyRef.current !== requestKey
      ) {
        catalogRefreshRequestKeyRef.current = requestKey
        void (async () => {
          try {
            await window.jelico.providers.refreshModelCatalog()
            const refreshedModels = await window.jelico.providers.previewModels(
              type,
              apiKey,
              baseUrl,
              providerName
            )
            if (
              latestModelRequestKeyRef.current !== requestKey ||
              refreshedModels.length === 0
            ) {
              return
            }

            setModels(refreshedModels)
            setModelsFetched(true)
            setModel((currentModel) => resolveFetchedModelSelection(currentModel, refreshedModels))
          } catch (error) {
            console.error(`Failed to refresh ${type} model capability labels:`, error)
          }
        })()
      }
    } catch (err) {
      console.error(`Failed to fetch ${type} models:`, err)
      setModels(FALLBACK_MODELS[type] || [])
      setModelsFetched(false)
    } finally {
      setIsLoadingModels(false)
    }
  }, [type, apiKey, baseUrl, isDynamic, needsApiKey, name, initialName, resolveFetchedModelSelection])

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

  const supportedReasoningEfforts = useMemo(
    () => getSupportedReasoningEfforts(type, model),
    [type, model]
  )

  useEffect(() => {
    if (!reasoningEffort) return
    if (!supportedReasoningEfforts.includes(reasoningEffort)) {
      setReasoningEffort('')
    }
  }, [reasoningEffort, supportedReasoningEfforts])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name || initialName || getDefaultName(type),
      apiKey,
      defaultModel: model,
      defaultReasoningEffort: reasoningEffort || null,
      baseUrl: needsBaseUrl ? baseUrl : undefined,
    })
  }

  // Show searchable list for providers with many models
  const showSearchableList = type === 'openrouter' || (modelsFetched && models.length > 10)
  const modelIsListed = models.some((entry) => entry.id === model)

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
          <>
            <div className="text-sm text-text-muted mb-2">
              {needsApiKey && !apiKey
                ? 'Enter API key to load available models'
                : 'No models were returned from the API. Enter a model ID manually.'}
            </div>
            <input
              type="text"
              value={model}
              onChange={(e) => {
                hasCustomModelOverrideRef.current = true
                setModel(e.target.value)
              }}
              className="input input-mono"
              placeholder="Enter model ID..."
            />
          </>
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
                    onClick={() => {
                      hasCustomModelOverrideRef.current = false
                      setModel(m.id)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-surface transition-colors border-b border-border-subtle last:border-b-0 ${
                      model === m.id ? 'bg-accent-glow text-accent' : 'text-text-primary'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{m.name}</div>
                      <ToolSupportBadge summary={m.capabilitySummary} compact />
                    </div>
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
            value={modelIsListed ? model : ''}
            onChange={(e) => {
              hasCustomModelOverrideRef.current = false
              setModel(e.target.value)
            }}
            className="input"
          >
            <option value="">
              {model && !modelIsListed ? `Custom: ${model}` : 'Select a model...'}
            </option>
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
        {models.length > 0 && (
          <div className="mt-3">
            <label className="label">
              Custom Model ID <span className="text-text-muted font-normal">(optional override)</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => {
                hasCustomModelOverrideRef.current = true
                setModel(e.target.value)
              }}
              className="input input-mono"
              placeholder="Use this for testing or early-access models"
            />
            <p className="form-hint">
              Live model discovery can vary by API key. You can always enter a model ID manually.
            </p>
          </div>
        )}
      </div>

      {supportedReasoningEfforts.length > 0 && (
        <div>
          <label className="label">Default Reasoning</label>
          <select
            value={reasoningEffort}
            onChange={(e) => setReasoningEffort((e.target.value as ReasoningEffort | '') || '')}
            className="input"
          >
            <option value="">API default</option>
            {supportedReasoningEfforts.map((effort) => (
              <option key={effort} value={effort}>
                {REASONING_EFFORT_LABELS[effort]}
              </option>
            ))}
          </select>
          <p className="form-hint">
            Set a default reasoning level for supported models on this provider.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading || (needsApiKey && !apiKey) || (!modelIsOptional && !model.trim())}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

function buildGoogleModelsListUrl(apiKey: string, pageToken?: string | null): string {
  const url = new URL(`${GOOGLE_GENERATIVE_LANGUAGE_API_BASE_URL}/models`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('pageSize', '1000')
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken)
  }
  return url.toString()
}

async function fetchAllGoogleModelsWithKey(apiKey: string): Promise<any[]> {
  const allModels: any[] = []
  const seenNames = new Set<string>()
  const seenPageTokens = new Set<string>()
  let nextPageToken: string | null = null

  do {
    const response: Response = await fetch(buildGoogleModelsListUrl(apiKey, nextPageToken))
    if (!response.ok) return []

    const data: { models?: any[]; nextPageToken?: string } = await response.json()
    const pageModels = Array.isArray(data?.models) ? data.models : []
    for (const model of pageModels) {
      const key = String(model?.name || '')
      if (!key || seenNames.has(key)) continue
      seenNames.add(key)
      allModels.push(model)
    }

    const candidateToken: string = typeof data?.nextPageToken === 'string' ? data.nextPageToken : ''
    if (!candidateToken || seenPageTokens.has(candidateToken)) {
      nextPageToken = null
    } else {
      seenPageTokens.add(candidateToken)
      nextPageToken = candidateToken
    }
  } while (nextPageToken)

  return allModels
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
      case 'zai':
      case 'zai-china':
      case 'zai-coding':
      case 'zai-coding-china':
      case 'openai-compatible':
      case 'anthropic-compatible':
      case 'custom':
      case 'local': {
        return await fetchOpenAICompatibleModels(apiKey, getCompatibleProviderBaseUrl(type, baseUrl))
      }

      case 'google': {
        return sortGoogleModels((await fetchAllGoogleModelsWithKey(apiKey))
          .filter((m: any) => {
            const name = m.name || ''
            const supportedGenerationMethods = Array.isArray(m.supportedGenerationMethods)
              ? m.supportedGenerationMethods
              : Array.isArray(m.supportedActions)
                ? m.supportedActions
                : []
            return name.includes('gemini') &&
                   (
                     supportedGenerationMethods.length === 0 ||
                     supportedGenerationMethods.includes('generateContent')
                   )
          })
          .map((m: any) => {
            const id = m.name.replace('models/', '')
            return { id, name: m.displayName || id }
          }))
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

function getCompatibleProviderBaseUrl(type: string, baseUrl?: string): string | undefined {
  const trimmedBaseUrl = String(baseUrl || '').trim()
  if (trimmedBaseUrl) {
    return trimmedBaseUrl
  }

  switch (type) {
    case 'zai':
      return 'https://api.z.ai/api/paas/v4'
    case 'zai-china':
      return 'https://open.bigmodel.cn/api/paas/v4'
    case 'zai-coding':
      return 'https://api.z.ai/api/coding/paas/v4'
    case 'zai-coding-china':
      return 'https://open.bigmodel.cn/api/coding/paas/v4'
    default:
      return trimmedBaseUrl || undefined
  }
}

async function fetchOpenAICompatibleModels(
  apiKey: string,
  baseUrl?: string
): Promise<ProviderModel[]> {
  const endpoints = buildCompatibleModelsEndpointCandidates(baseUrl)
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
