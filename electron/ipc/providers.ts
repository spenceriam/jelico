import { ipcMain } from 'electron'
import { providerDb } from '../services/database'
import { keychainService } from '../services/keychain'
import {
  findModelMetadataTarget,
  findOpenAIContextFallback,
  findOpenAIOutputFallback,
  getCompatibleAuthHeaderCandidates,
} from '../lib/providerModelLimits'
import {
  getModelCatalogStatus,
  initializeModelCatalog,
  lookupModelsDevContextLimit,
  lookupModelsDevOutputLimit,
  lookupStrictModelsDevModelMetadata,
  refreshModelCatalog,
} from '../services/modelCatalog'
import { resolveProviderCapabilitySummary } from '../services/providerCapabilitySummary'
import {
  buildCompatibleModelsEndpointCandidates,
  buildPrimaryCompatibleModelsEndpoint,
  DEFAULT_OPENAI_MODELS_ENDPOINT,
} from '../../src/lib/compatibleProviderModels'
import { findZaiContextFallback, findZaiOutputFallback } from '../../src/lib/zaiModelLimits'

const GOOGLE_GENERATIVE_LANGUAGE_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const USER_EDITABLE_PROVIDER_ALIAS_TYPES = new Set(['openai-compatible', 'anthropic-compatible', 'custom', 'local'])

// Build models endpoint URL from base URL
function buildModelsEndpoint(baseUrl?: string | null): string {
  return buildPrimaryCompatibleModelsEndpoint(baseUrl, { defaultOpenAI: true }) || DEFAULT_OPENAI_MODELS_ENDPOINT
}

function getProviderModelsBaseUrl(type: string, baseUrl?: string | null): string | undefined {
  const trimmedBaseUrl = String(baseUrl || '').trim()
  if (trimmedBaseUrl) {
    return trimmedBaseUrl
  }

  switch (String(type || '').trim().toLowerCase()) {
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

function normalizeGoogleModelName(modelId: string): string {
  const trimmed = String(modelId || '').trim()
  if (!trimmed) return 'models'
  return trimmed.startsWith('models/') ? trimmed : `models/${trimmed}`
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

function buildGoogleModelUrl(modelId: string, apiKey: string): string {
  const url = new URL(`${GOOGLE_GENERATIVE_LANGUAGE_API_BASE_URL}/${normalizeGoogleModelName(modelId)}`)
  url.searchParams.set('key', apiKey)
  return url.toString()
}

const MINIMAX_COMPAT_MODELS: Array<{ id: string; name: string }> = [
  { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5' },
  { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5-highspeed' },
  { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1' },
  { id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1-highspeed' },
  { id: 'MiniMax-M2', name: 'MiniMax-M2' },
]

function isMiniMaxBaseUrl(baseUrl?: string | null): boolean {
  const normalized = String(baseUrl || '').toLowerCase()
  return normalized.includes('api.minimax.io') || normalized.includes('api.minimaxi.com')
}

function normalizeAnthropicCompatibleBaseUrl(baseUrl?: string | null): string | null {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) return null
  if (trimmed.endsWith('/messages')) return trimmed.replace(/\/messages$/, '')
  if (trimmed.endsWith('/v1')) return trimmed
  return `${trimmed}/v1`
}

function buildCompatibleModelsEndpoints(baseUrl?: string | null): string[] {
  return buildCompatibleModelsEndpointCandidates(baseUrl, { defaultOpenAI: true })
}

function queueModelCatalogRefresh() {
  void refreshModelCatalog(false)
}

function buildModelsDevLookupOptions(providerType: string, providerName?: string | null, baseUrl?: string | null) {
  const options: { providerName?: string; baseUrl?: string } = {}
  const normalizedType = String(providerType || '').trim().toLowerCase()
  const trimmedBaseUrl = String(baseUrl || '').trim()
  const trimmedProviderName = String(providerName || '').trim()

  if (trimmedBaseUrl) {
    options.baseUrl = trimmedBaseUrl
  }

  if (trimmedProviderName && !USER_EDITABLE_PROVIDER_ALIAS_TYPES.has(normalizedType)) {
    options.providerName = trimmedProviderName
  }

  return options
}

// Extract context size from model metadata
function extractContextSize(model: any): number | null {
  const candidates = [
    model?.context_length,
    model?.contextLength,
    model?.max_context_length,
    model?.maxContextLength,
    model?.input_token_limit,
    model?.inputTokenLimit,
    model?.max_input_tokens,
    model?.maxInputTokens,
    model?.limits?.context_window,
    model?.limits?.contextLength,
    model?.architecture?.context_length,
    model?.metadata?.context_length,
  ]
  for (const value of candidates) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function extractOutputSize(model: any): number | null {
  const candidates = [
    model?.output_token_limit,
    model?.outputTokenLimit,
    model?.max_output_tokens,
    model?.maxOutputTokens,
    model?.limits?.output,
    model?.limits?.output_tokens,
    model?.metadata?.output_tokens,
    model?.top_provider?.max_completion_tokens,
    model?.top_provider?.max_output_tokens,
  ]
  for (const value of candidates) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

// Resolve context size from /models endpoint
async function resolveContextSizeFromModelsEndpoint(
  modelId: string,
  baseUrl?: string | null,
  apiKey?: string | null
): Promise<number | null> {
  const endpoints = buildCompatibleModelsEndpoints(baseUrl)
  for (const endpoint of endpoints) {
    for (const authHeaders of getCompatibleAuthHeaderCandidates(apiKey)) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Accept: 'application/json',
            ...authHeaders,
          },
        })
        if (!response.ok) continue

        const payload = await response.json()
        const models: any[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : []

        const target = findModelMetadataTarget(models, modelId)
        if (!target) continue

        return extractContextSize(target)
      } catch {
        // Try next auth-header or endpoint candidate.
      }
    }
  }

  return null
}

async function resolveOutputSizeFromModelsEndpoint(
  modelId: string,
  baseUrl?: string | null,
  apiKey?: string | null
): Promise<number | null> {
  const endpoints = buildCompatibleModelsEndpoints(baseUrl)
  for (const endpoint of endpoints) {
    for (const authHeaders of getCompatibleAuthHeaderCandidates(apiKey)) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Accept: 'application/json',
            ...authHeaders,
          },
        })
        if (!response.ok) continue

        const payload = await response.json()
        const models: any[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : []

        const target = findModelMetadataTarget(models, modelId)
        if (!target) continue

        return extractOutputSize(target)
      } catch {
        // Try next auth-header or endpoint candidate.
      }
    }
  }

  return null
}

// Fallback models only used when API fetch fails
const FALLBACK_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  anthropic: [],
  openai: [],
  google: [],
  openrouter: [],
  ollama: [],
  custom: [],
}

// Fetch models from Anthropic API
async function fetchAnthropicModels(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })

    if (!response.ok) {
      console.error('Anthropic API error:', response.status)
      return FALLBACK_MODELS.anthropic
    }

    const data = await response.json()

    // Filter to only chat models and format nicely
    const models = (data.data || [])
      .filter((m: any) => m.type === 'model')
      .map((m: any) => {
        // Create friendly name from model ID
        let name = m.display_name || m.id
        return { id: m.id, name }
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    return models.length > 0 ? models : FALLBACK_MODELS.anthropic
  } catch (err) {
    console.error('Failed to fetch Anthropic models:', err)
    return FALLBACK_MODELS.anthropic
  }
}

// Fetch models from OpenAI API
async function fetchOpenAIModels(apiKey: string, baseUrl?: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const url = baseUrl ? `${baseUrl}/models` : 'https://api.openai.com/v1/models'
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      console.error('OpenAI API error:', response.status)
      return FALLBACK_MODELS.openai
    }

    const data = await response.json()

    // Filter to GPT models and format
    const models = (data.data || [])
      .filter((m: any) => {
        const id = m.id.toLowerCase()
        // Include GPT models, O1/O3 models, and exclude embeddings/whisper/etc
        return (id.includes('gpt') || id.startsWith('o1') || id.startsWith('o3')) &&
               !id.includes('instruct') && !id.includes('realtime')
      })
      .map((m: any) => ({
        id: m.id,
        name: m.id, // OpenAI uses readable IDs
      }))
      .sort((a: any, b: any) => {
        // Sort GPT-4 models first, then GPT-3.5
        if (a.id.includes('gpt-4') && !b.id.includes('gpt-4')) return -1
        if (!a.id.includes('gpt-4') && b.id.includes('gpt-4')) return 1
        return a.id.localeCompare(b.id)
      })

    return models.length > 0 ? models : FALLBACK_MODELS.openai
  } catch (err) {
    console.error('Failed to fetch OpenAI models:', err)
    return FALLBACK_MODELS.openai
  }
}

async function fetchAllGoogleModels(apiKey: string): Promise<any[]> {
  const allModels: any[] = []
  const seenNames = new Set<string>()
  const seenPageTokens = new Set<string>()
  let nextPageToken: string | null = null

  do {
    const url = buildGoogleModelsListUrl(apiKey, nextPageToken)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`)
    }

    const data = await response.json()
    const pageModels = Array.isArray(data?.models) ? data.models : []
    for (const model of pageModels) {
      const key = String(model?.name || '')
      if (!key || seenNames.has(key)) continue
      seenNames.add(key)
      allModels.push(model)
    }

    const candidateToken = typeof data?.nextPageToken === 'string' ? data.nextPageToken : ''
    if (!candidateToken || seenPageTokens.has(candidateToken)) {
      nextPageToken = null
    } else {
      seenPageTokens.add(candidateToken)
      nextPageToken = candidateToken
    }
  } while (nextPageToken)

  return allModels
}

// Fetch models from Google Gemini API
async function fetchGoogleModels(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const models = (await fetchAllGoogleModels(apiKey))
      .filter((m: any) => {
        const name = m.name || ''
        // Include gemini models that support generateContent
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
        // Extract model ID from name (e.g., "models/gemini-1.5-pro" -> "gemini-1.5-pro")
        const id = m.name.replace('models/', '')
        return {
          id,
          name: m.displayName || id,
        }
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    return models.length > 0 ? models : FALLBACK_MODELS.google
  } catch (err) {
    console.error('Failed to fetch Google models:', err)
    return FALLBACK_MODELS.google
  }
}

// Convert database row to API format
function toApiFormat(row: any) {
  const lookupOptions = buildModelsDevLookupOptions(row.type, row.name, row.base_url)

  return {
    id: row.id,
    type: row.type,
    name: row.name,
    baseUrl: row.base_url,
    defaultModel: row.default_model,
    hiddenFromSelector: row.hidden_from_selector === 1,
    capabilityProfiles: row.capability_profiles || null,
    defaultReasoningEffort: row.default_reasoning_effort || null,
    capabilitySummary: resolveProviderCapabilitySummary({
      providerType: row.type,
      modelId: row.default_model,
      providerName: row.name,
      baseUrl: row.base_url,
      modelsDevMetadata: lookupStrictModelsDevModelMetadata(row.type, row.default_model, lookupOptions) || undefined,
    }),
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function attachCapabilitySummaries(
  providerType: string,
  models: Array<{ id: string; name: string; contextLength?: number; pricing?: { prompt: string; completion: string } }>,
  providerName?: string,
  baseUrl?: string
) {
  if (!models.length) return models

  await refreshModelCatalog(false)
  const lookupOptions = buildModelsDevLookupOptions(providerType, providerName, baseUrl)

  return models.map((model) => ({
    ...model,
    capabilitySummary: resolveProviderCapabilitySummary({
      providerType,
      modelId: model.id,
      providerName,
      baseUrl,
      modelsDevMetadata: lookupStrictModelsDevModelMetadata(providerType, model.id, lookupOptions) || undefined,
    }),
  }))
}

async function fetchCompatibleModels(apiKey: string | null, baseUrl?: string): Promise<Array<{ id: string; name: string }>> {
  const endpoints = buildCompatibleModelsEndpoints(baseUrl)
  const authHeaderCandidates = getCompatibleAuthHeaderCandidates(apiKey)

  for (const endpoint of endpoints) {
    for (const authHeaders of authHeaderCandidates) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Accept: 'application/json',
            ...authHeaders,
          },
        })

        if (!response.ok) {
          continue
        }

        const payload = await response.json()
        const models: any[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : []

        const normalized = models
          .map((model: any) => {
            const id = String(model?.id || model?.name || '').trim()
            if (!id) return null
            const name = String(model?.name || model?.display_name || id).trim() || id
            return { id, name }
          })
          .filter(Boolean) as Array<{ id: string; name: string }>

        if (normalized.length > 0) {
          return normalized.sort((a, b) => a.name.localeCompare(b.name))
        }
      } catch {
        // Try next header combination or endpoint candidate.
      }
    }
  }

  if (isMiniMaxBaseUrl(baseUrl)) {
    return MINIMAX_COMPAT_MODELS
  }

  return []
}

interface ProviderTestResult {
  ok: boolean
  message: string
  status?: number
}

function extractProviderErrorMessage(status: number, payload: unknown): string {
  const statusSummary = (() => {
    if (status === 401 || status === 403) return 'Authentication failed. Check your API key.'
    if (status === 404) return 'Endpoint not found. Check provider endpoint URL.'
    if (status >= 500) return 'Provider service error. Please try again.'
    return `Request failed (${status})`
  })()

  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (trimmed) {
      const lowered = trimmed.toLowerCase()
      const looksHtml =
        lowered.includes('<!doctype html') ||
        lowered.includes('<html') ||
        lowered.includes('<body')

      if (looksHtml) return statusSummary

      const singleLine = trimmed.replace(/\s+/g, ' ')
      if (singleLine.length > 180) return `${singleLine.slice(0, 177)}...`
      return singleLine
    }
  }

  if (payload && typeof payload === 'object') {
    const asAny = payload as any
    const fromErrorObject = asAny?.error?.message
    const fromMessage = asAny?.message
    const fromDetail = asAny?.detail

    const pickMessage = (value: unknown): string | null => {
      if (typeof value !== 'string') return null
      const trimmed = value.trim()
      if (!trimmed) return null

      const lowered = trimmed.toLowerCase()
      const looksHtml =
        lowered.includes('<!doctype html') ||
        lowered.includes('<html') ||
        lowered.includes('<body')

      if (looksHtml) return statusSummary

      const singleLine = trimmed.replace(/\s+/g, ' ')
      if (singleLine.length > 180) return `${singleLine.slice(0, 177)}...`
      return singleLine
    }

    const errorMessage = pickMessage(fromErrorObject)
    if (errorMessage) return errorMessage
    const message = pickMessage(fromMessage)
    if (message) return message
    const detail = pickMessage(fromDetail)
    if (detail) return detail
  }

  return statusSummary
}

async function probeProviderEndpoint(url: string, init?: RequestInit): Promise<ProviderTestResult> {
  try {
    const response = await fetch(url, init)
    if (response.ok) {
      return { ok: true, message: 'Connection successful' }
    }

    let errorPayload: unknown = null
    try {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        errorPayload = await response.json()
      } else {
        errorPayload = await response.text()
      }
    } catch {
      errorPayload = null
    }

    return {
      ok: false,
      status: response.status,
      message: extractProviderErrorMessage(response.status, errorPayload),
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Network error',
    }
  }
}

async function probeCompatibleModelsEndpoint(
  baseUrl: string | null,
  apiKey: string | null
): Promise<ProviderTestResult> {
  const endpoints = buildCompatibleModelsEndpoints(baseUrl)
  const authHeaderCandidates: Array<Record<string, string>> = apiKey
    ? [
        { Authorization: `Bearer ${apiKey}` },
        { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        { 'x-api-key': apiKey },
      ]
    : [{}]
  let lastFailure: ProviderTestResult | null = null

  for (const endpoint of endpoints) {
    for (const authHeaders of authHeaderCandidates) {
      const result = await probeProviderEndpoint(endpoint, {
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
      })

      if (result.ok) {
        return result
      }

      lastFailure = result
    }
  }

  return lastFailure || { ok: false, message: 'Connection test failed' }
}

async function probeMiniMaxAnthropicMessageEndpoint(
  baseUrl: string | null,
  apiKey: string,
  modelId: string
): Promise<ProviderTestResult> {
  const normalizedBase = normalizeAnthropicCompatibleBaseUrl(baseUrl)
  if (!normalizedBase) {
    return { ok: false, message: 'Missing provider endpoint URL' }
  }
  const endpoint = `${normalizedBase}/messages`

  const authHeaderVariants: Array<Record<string, string>> = [
    { Authorization: `Bearer ${apiKey}` },
    { Authorization: apiKey },
    { 'x-api-key': apiKey },
  ]

  let lastFailure: ProviderTestResult | null = null
  for (const authHeaders of authHeaderVariants) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...authHeaders,
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 8,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'ping' }],
            },
          ],
        }),
      })

      if (response.ok) {
        return { ok: true, message: 'Connection successful' }
      }

      let payload: unknown = null
      try {
        const contentType = response.headers.get('content-type') || ''
        payload = contentType.includes('application/json') ? await response.json() : await response.text()
      } catch {
        payload = null
      }

      lastFailure = {
        ok: false,
        status: response.status,
        message: extractProviderErrorMessage(response.status, payload),
      }
    } catch (error: any) {
      lastFailure = {
        ok: false,
        message: error?.message || 'Network error',
      }
    }
  }

  return lastFailure || { ok: false, message: 'Connection test failed' }
}

export function registerProviderHandlers() {
  initializeModelCatalog()

  // List all providers
  ipcMain.handle('providers:list', async () => {
    void refreshModelCatalog(false)
    const providers = providerDb.list()
    return providers.map(toApiFormat)
  })

  // Get a single provider
  ipcMain.handle('providers:get', async (_, id: string) => {
    void refreshModelCatalog(false)
    const provider = providerDb.get(id)
    return provider ? toApiFormat(provider) : null
  })

  // Create a new provider
  ipcMain.handle('providers:create', async (_, input: any) => {
    const provider = providerDb.create({
      type: input.type,
      name: input.name,
      baseUrl: input.baseUrl,
      defaultModel: input.defaultModel,
      capabilityProfiles: input.capabilityProfiles,
      defaultReasoningEffort: input.defaultReasoningEffort,
      isDefault: input.isDefault,
    })

    // Store API key if provided
    if (input.apiKey) {
      await keychainService.setApiKey(provider.id, input.apiKey)
    }

    queueModelCatalogRefresh()
    return toApiFormat(provider)
  })

  // Update a provider
  ipcMain.handle('providers:update', async (_, id: string, updates: any) => {
    const provider = providerDb.update(id, {
      ...updates,
      capabilityProfiles: updates.capabilityProfiles,
      defaultReasoningEffort: updates.defaultReasoningEffort,
    })

    // Update API key if provided
    if (updates.apiKey !== undefined) {
      if (updates.apiKey) {
        await keychainService.setApiKey(id, updates.apiKey)
      } else {
        await keychainService.deleteApiKey(id)
      }
    }

    queueModelCatalogRefresh()
    return provider ? toApiFormat(provider) : null
  })

  // Delete a provider
  ipcMain.handle('providers:delete', async (_, id: string) => {
    await keychainService.deleteApiKey(id)
    providerDb.delete(id)
  })

  ipcMain.handle('providers:reorder', async (_, ids: string[]) => {
    const providers = providerDb.reorder(ids)
    return providers.map(toApiFormat)
  })

  // Test provider connection
  ipcMain.handle('providers:test', async (_, id: string) => {
    const provider = providerDb.get(id)
    if (!provider) {
      return { ok: false, message: 'Provider not found' } satisfies ProviderTestResult
    }

    const normalizedModel = String(provider.default_model || '').toLowerCase()
    if (
      provider.type === 'openai-compatible' &&
      normalizedModel.includes('highspeed')
    ) {
      return {
        ok: false,
        message: 'Highspeed models require Anthropic-compatible provider type.',
      } satisfies ProviderTestResult
    }

    const apiKey = await keychainService.getApiKey(id)
    if (!apiKey && provider.type !== 'ollama' && provider.type !== 'local') {
      return { ok: false, message: 'Missing API key' } satisfies ProviderTestResult
    }

    try {
      switch (provider.type) {
        case 'anthropic': {
          return await probeProviderEndpoint('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': apiKey!,
              'anthropic-version': '2023-06-01',
            },
          })
        }
        case 'openai': {
          return await probeProviderEndpoint(buildModelsEndpoint(provider.base_url), {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${apiKey!}`,
            },
          })
        }
        case 'google': {
          return await probeProviderEndpoint(buildGoogleModelsListUrl(apiKey!))
        }
        case 'openrouter': {
          return await probeProviderEndpoint('https://openrouter.ai/api/v1/models', {
            headers: {
              Authorization: `Bearer ${apiKey!}`,
            },
          })
        }
        case 'ollama': {
          const baseUrl = provider.base_url || 'http://localhost:11434'
          return await probeProviderEndpoint(`${baseUrl}/api/tags`)
        }
        case 'openai-compatible':
        case 'custom':
        case 'local': {
          if (!provider.default_model?.trim()) {
            return { ok: false, message: 'Missing model name/id' } satisfies ProviderTestResult
          }
          return await probeCompatibleModelsEndpoint(provider.base_url, apiKey || null)
        }
        case 'anthropic-compatible':
        case 'minimax': {
          if (!provider.default_model?.trim()) {
            return { ok: false, message: 'Missing model name/id' } satisfies ProviderTestResult
          }

          if (provider.type === 'anthropic-compatible' && isMiniMaxBaseUrl(provider.base_url)) {
            return await probeMiniMaxAnthropicMessageEndpoint(
              provider.base_url,
              apiKey!,
              provider.default_model
            )
          }

          // Anthropic-compatible providers may use /anthropic in base URL.
          // Probe standard and fallback model-list endpoints.
          return await probeCompatibleModelsEndpoint(provider.base_url, apiKey || null)
        }
        case 'zai':
        case 'zai-china':
        case 'zai-coding':
        case 'zai-coding-china':
          return await probeCompatibleModelsEndpoint(
            getProviderModelsBaseUrl(provider.type, provider.base_url) || null,
            apiKey || null
          )
        default:
          return {
            ok: !!apiKey,
            message: apiKey ? 'API key configured' : 'Missing API key',
          } satisfies ProviderTestResult
      }
    } catch (error: any) {
      return {
        ok: false,
        message: error?.message || 'Connection test failed',
      } satisfies ProviderTestResult
    }
  })

  // Get available models for a provider type (fetches from API when possible)
  ipcMain.handle('providers:models', async (_, type: string, providerId?: string) => {
    // Get API key if providerId is given
    let apiKey: string | null = null
    let baseUrl: string | undefined
    let providerName: string | undefined

    if (providerId) {
      apiKey = await keychainService.getApiKey(providerId)
      const provider = providerDb.get(providerId)
      baseUrl = provider?.base_url
      providerName = provider?.name
    }

    switch (type) {
      case 'anthropic':
        if (apiKey) {
          return await attachCapabilitySummaries(type, await fetchAnthropicModels(apiKey), providerName, baseUrl)
        }
        return []

      case 'openai':
        if (apiKey) {
          return await attachCapabilitySummaries(type, await fetchOpenAIModels(apiKey, baseUrl), providerName, baseUrl)
        }
        return []

      case 'google':
        if (apiKey) {
          return await attachCapabilitySummaries(type, await fetchGoogleModels(apiKey), providerName, baseUrl)
        }
        return []

      case 'ollama':
        try {
          const url = baseUrl || 'http://localhost:11434'
          const response = await fetch(`${url}/api/tags`)
          if (response.ok) {
            const data = await response.json()
            return await attachCapabilitySummaries(
              type,
              data.models?.map((m: any) => ({ id: m.name, name: m.name })) || [],
              providerName,
              baseUrl
            )
          }
        } catch {
          return []
        }
        return []

      case 'zai':
      case 'zai-china':
      case 'zai-coding':
      case 'zai-coding-china':
        return await attachCapabilitySummaries(
          type,
          await fetchCompatibleModels(apiKey, getProviderModelsBaseUrl(type, baseUrl)),
          providerName,
          getProviderModelsBaseUrl(type, baseUrl)
        )

      case 'openrouter':
        // OpenRouter still uses the dedicated handler with API key
        return []

      case 'openai-compatible':
      case 'anthropic-compatible':
      case 'custom':
      case 'local':
      case 'minimax':
        return await attachCapabilitySummaries(
          type,
          await fetchCompatibleModels(apiKey, baseUrl),
          providerName,
          baseUrl
        )

      default:
        return FALLBACK_MODELS[type] || []
    }
  })

  // Fetch OpenRouter models using API key
  ipcMain.handle('providers:fetchOpenRouterModels', async (_, apiKey: string) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`)
      }

      const data = await response.json()

      // Sort by name and return formatted list
      return await attachCapabilitySummaries('openrouter', (data.data || [])
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length,
          pricing: m.pricing,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name)))
    } catch (err: any) {
      console.error('Failed to fetch OpenRouter models:', err)
      return []
    }
  })

  // Preview models before provider is saved (setup flow)
  ipcMain.handle('providers:previewModels', async (_, type: string, apiKey?: string, baseUrl?: string, providerName?: string) => {
    switch (type) {
      case 'anthropic':
        if (apiKey) return await attachCapabilitySummaries(type, await fetchAnthropicModels(apiKey), providerName, baseUrl)
        return []

      case 'openai':
        if (apiKey) return await attachCapabilitySummaries(type, await fetchOpenAIModels(apiKey, baseUrl), providerName, baseUrl)
        return []

      case 'google':
        if (apiKey) return await attachCapabilitySummaries(type, await fetchGoogleModels(apiKey), providerName, baseUrl)
        return []

      case 'zai':
      case 'zai-china':
      case 'zai-coding':
      case 'zai-coding-china':
        return await attachCapabilitySummaries(
          type,
          await fetchCompatibleModels(apiKey || null, getProviderModelsBaseUrl(type, baseUrl)),
          providerName,
          getProviderModelsBaseUrl(type, baseUrl)
        )

      case 'openrouter':
        if (apiKey) {
          try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!response.ok) return []
            const data = await response.json()
            return await attachCapabilitySummaries(
              type,
              (data.data || [])
                .map((m: any) => ({ id: m.id, name: m.name || m.id }))
                .sort((a: any, b: any) => a.name.localeCompare(b.name)),
              providerName,
              baseUrl
            )
          } catch {
            return []
          }
        }
        return []

      case 'ollama': {
        try {
          const url = baseUrl || 'http://localhost:11434'
          const response = await fetch(`${url}/api/tags`)
          if (!response.ok) return []
          const data = await response.json()
          return await attachCapabilitySummaries(
            type,
            data.models?.map((m: any) => ({ id: m.name, name: m.name })) || [],
            providerName,
            baseUrl
          )
        } catch {
          return []
        }
      }

      case 'openai-compatible':
      case 'anthropic-compatible':
      case 'custom':
      case 'local':
      case 'minimax':
        return await attachCapabilitySummaries(
          type,
          await fetchCompatibleModels(apiKey || null, baseUrl),
          providerName,
          baseUrl
        )

      default:
        return FALLBACK_MODELS[type] || []
    }
  })

  ipcMain.handle('providers:refreshModelCatalog', async () => {
    await refreshModelCatalog(true)
    return getModelCatalogStatus()
  })

  ipcMain.handle('providers:getModelCatalogStatus', () => {
    return getModelCatalogStatus()
  })

  ipcMain.handle('providers:getModelLimits', async (_, providerId: string, modelId: string) => {
    try {
      const provider = providerDb.get(providerId)
      if (!provider || !modelId) {
        return { contextWindow: null, maxOutputTokens: null }
      }

      const apiKey = await keychainService.getApiKey(providerId)
      const baseUrl = provider.base_url
      const lookupOptions = buildModelsDevLookupOptions(provider.type, provider.name, baseUrl)

      await refreshModelCatalog(false)

      let contextWindow = lookupModelsDevContextLimit(provider.type, modelId, lookupOptions)

      let maxOutputTokens = lookupModelsDevOutputLimit(provider.type, modelId, lookupOptions)

      switch (provider.type) {
        case 'openai':
        case 'openai-compatible':
        case 'custom':
        case 'local':
        case 'anthropic-compatible':
        case 'minimax': {
          if (!contextWindow) {
            contextWindow = await resolveContextSizeFromModelsEndpoint(modelId, baseUrl, apiKey)
          }
          if (!maxOutputTokens) {
            maxOutputTokens = await resolveOutputSizeFromModelsEndpoint(modelId, baseUrl, apiKey)
          }
          if (!contextWindow && provider.type === 'openai') {
            contextWindow = findOpenAIContextFallback(modelId)
          }
          if (!maxOutputTokens && provider.type === 'openai') {
            maxOutputTokens = findOpenAIOutputFallback(modelId)
          }
          break
        }

        case 'google': {
          if ((!contextWindow || !maxOutputTokens) && apiKey) {
            const response = await fetch(buildGoogleModelUrl(modelId, apiKey))
            if (response.ok) {
              const data = await response.json()
              contextWindow = contextWindow || Number(data.inputTokenLimit) || null
              maxOutputTokens = maxOutputTokens || Number(data.outputTokenLimit) || null
            }
          }
          break
        }

        case 'openrouter': {
          if ((!contextWindow || !maxOutputTokens) && apiKey) {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (response.ok) {
              const data = await response.json()
              const model = (data.data || []).find((entry: any) => entry.id === modelId)
              contextWindow = contextWindow || Number(model?.context_length) || null
              maxOutputTokens =
                maxOutputTokens ||
                Number(model?.top_provider?.max_completion_tokens) ||
                Number(model?.top_provider?.max_output_tokens) ||
                null
            }
          }
          break
        }

        case 'zai':
        case 'zai-china':
        case 'zai-coding':
        case 'zai-coding-china': {
          if (!contextWindow) {
            contextWindow = findZaiContextFallback(modelId)
          }
          if (!maxOutputTokens) {
            maxOutputTokens = findZaiOutputFallback(modelId)
          }
          break
        }

        case 'ollama': {
          if (!contextWindow) {
            const url = baseUrl || 'http://localhost:11434'
            const response = await fetch(`${url}/api/show`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: modelId }),
            })
            if (response.ok) {
              const data = await response.json()
              const params = data.parameters || ''
              const match = params.match(/num_ctx\s+(\d+)/)
              contextWindow = match ? parseInt(match[1], 10) : Number(data.model_info?.context_length) || null
            }
          }
          break
        }

        default:
          break
      }

      return {
        contextWindow: contextWindow && Number.isFinite(contextWindow) ? Math.round(contextWindow) : null,
        maxOutputTokens: maxOutputTokens && Number.isFinite(maxOutputTokens) ? Math.round(maxOutputTokens) : null,
      }
    } catch (error) {
      console.error('[Providers] Failed to get model limits:', error)
      return { contextWindow: null, maxOutputTokens: null }
    }
  })

  // Get context window size for a specific model from the provider's API
  ipcMain.handle('providers:getModelContextSize', async (_, providerId: string, modelId: string) => {
    try {
      const provider = providerDb.get(providerId)
      if (!provider) {
        console.error('[Providers] Provider not found:', providerId)
        return null
      }

      const apiKey = await keychainService.getApiKey(providerId)
      const baseUrl = provider.base_url
      const lookupOptions = buildModelsDevLookupOptions(provider.type, provider.name, baseUrl)

      // Keep catalog fresh and prefer models.dev when available.
      await refreshModelCatalog(false)
      const fromModelsDev = lookupModelsDevContextLimit(provider.type, modelId, lookupOptions)
      if (fromModelsDev) {
        return fromModelsDev
      }

      switch (provider.type) {
        case 'anthropic': {
          if (!apiKey) return null
          const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          })
          if (!response.ok) return null
          const data = await response.json()
          const model = (data.data || []).find((m: any) => m.id === modelId)
          // Anthropic returns max_tokens or we can infer from model name
          if (model?.context_window) return model.context_window
          // Fallback: Claude 3.x models have 200k context
          if (modelId.includes('claude-3') || modelId.includes('claude-sonnet') || modelId.includes('claude-opus')) {
            return 200000
          }
          return null
        }

        case 'openai': {
          if (!apiKey) return null
          // OpenAI doesn't expose context length in their API directly
          // We need to use known values or query a different endpoint
          // For now, use known values for common models
          return findOpenAIContextFallback(modelId) || 128000
        }

        case 'google': {
          if (!apiKey) return null
          const response = await fetch(buildGoogleModelUrl(modelId, apiKey))
          if (!response.ok) return null
          const data = await response.json()
          // Google returns inputTokenLimit
          return data.inputTokenLimit || null
        }

        case 'openrouter': {
          if (!apiKey) return null
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          })
          if (!response.ok) return null
          const data = await response.json()
          const model = (data.data || []).find((m: any) => m.id === modelId)
          return model?.context_length || null
        }

        case 'ollama': {
          const url = baseUrl || 'http://localhost:11434'
          const response = await fetch(`${url}/api/show`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelId }),
          })
          if (!response.ok) return null
          const data = await response.json()
          // Ollama returns model info with context length in parameters
          // Look for num_ctx in modelfile or parameters
          const params = data.parameters || ''
          const match = params.match(/num_ctx\s+(\d+)/)
          if (match) return parseInt(match[1], 10)
          // Default Ollama context is often 2048 or 4096
          return data.model_info?.context_length || 4096
        }

        case 'zai':
        case 'zai-china':
        case 'zai-coding':
        case 'zai-coding-china': {
          return findZaiContextFallback(modelId) || 128000
        }

        case 'openai-compatible':
        case 'custom': {
          // Critical fix: actively probe /models for OpenAI-compatible/custom backends
          const resolved = await resolveContextSizeFromModelsEndpoint(modelId, baseUrl, apiKey)
          if (resolved) return resolved
          // Fallback to OpenAI family patterns
          return findOpenAIContextFallback(modelId)
        }

        default:
          // For unknown providers, try generic /models endpoint
          return await resolveContextSizeFromModelsEndpoint(modelId, baseUrl, apiKey)
      }
    } catch (err) {
      console.error('[Providers] Failed to get model context size:', err)
      return null
    }
  })

  // Keychain handlers
  ipcMain.handle('keychain:set', async (_, providerId: string, key: string) => {
    await keychainService.setApiKey(providerId, key)
  })

  ipcMain.handle('keychain:get', async (_, providerId: string) => {
    return await keychainService.getApiKey(providerId)
  })

  ipcMain.handle('keychain:delete', async (_, providerId: string) => {
    return await keychainService.deleteApiKey(providerId)
  })
}
