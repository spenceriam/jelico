import { ipcMain } from 'electron'
import { providerDb } from '../services/database'
import { keychainService } from '../services/keychain'

// OpenAI family context sizes for fallback
const OPENAI_FAMILY_CONTEXT: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-3.5-turbo': 16385,
  'o1': 200000,
  'o1-mini': 128000,
  'o3-mini': 200000,
}

// Build models endpoint URL from base URL
function buildModelsEndpoint(baseUrl?: string | null): string {
  const trimmed = (baseUrl || '').replace(/\/+$/, '')
  if (!trimmed) return 'https://api.openai.com/v1/models'
  if (trimmed.endsWith('/models')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/models`
  return `${trimmed}/v1/models`
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

// Find OpenAI family fallback by model ID
function findOpenAIFamilyFallback(modelId: string): number | null {
  const normalized = modelId.toLowerCase()
  if (OPENAI_FAMILY_CONTEXT[normalized]) return OPENAI_FAMILY_CONTEXT[normalized]
  for (const [key, size] of Object.entries(OPENAI_FAMILY_CONTEXT)) {
    if (normalized.includes(key)) return size
  }
  return null
}

// Resolve context size from /models endpoint
async function resolveContextSizeFromModelsEndpoint(
  modelId: string,
  baseUrl?: string | null,
  apiKey?: string | null
): Promise<number | null> {
  try {
    const response = await fetch(buildModelsEndpoint(baseUrl), {
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    })
    if (!response.ok) return null

    const payload = await response.json()
    const models: any[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : []

    const normalizedId = modelId.toLowerCase()
    const shortId = normalizedId.split('/').pop() || normalizedId
    const target = models.find((m) => {
      const id = String(m?.id || m?.name || '').toLowerCase()
      return id === normalizedId || id === shortId || id.endsWith(`/${shortId}`)
    })
    if (!target) return null

    return extractContextSize(target)
  } catch {
    return null
  }
}

// Fallback models only used when API fetch fails
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

// Fetch models from Google Gemini API
async function fetchGoogleModels(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)

    if (!response.ok) {
      console.error('Google API error:', response.status)
      return FALLBACK_MODELS.google
    }

    const data = await response.json()

    // Filter to generative models
    const models = (data.models || [])
      .filter((m: any) => {
        const name = m.name || ''
        // Include gemini models that support generateContent
        return name.includes('gemini') &&
               m.supportedGenerationMethods?.includes('generateContent')
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
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    baseUrl: row.base_url,
    defaultModel: row.default_model,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerProviderHandlers() {
  // List all providers
  ipcMain.handle('providers:list', async () => {
    const providers = providerDb.list()
    return providers.map(toApiFormat)
  })

  // Get a single provider
  ipcMain.handle('providers:get', async (_, id: string) => {
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
      isDefault: input.isDefault,
    })

    // Store API key if provided
    if (input.apiKey) {
      await keychainService.setApiKey(provider.id, input.apiKey)
    }

    return toApiFormat(provider)
  })

  // Update a provider
  ipcMain.handle('providers:update', async (_, id: string, updates: any) => {
    const provider = providerDb.update(id, updates)

    // Update API key if provided
    if (updates.apiKey !== undefined) {
      if (updates.apiKey) {
        await keychainService.setApiKey(id, updates.apiKey)
      } else {
        await keychainService.deleteApiKey(id)
      }
    }

    return provider ? toApiFormat(provider) : null
  })

  // Delete a provider
  ipcMain.handle('providers:delete', async (_, id: string) => {
    await keychainService.deleteApiKey(id)
    providerDb.delete(id)
  })

  // Test provider connection
  ipcMain.handle('providers:test', async (_, id: string) => {
    const provider = providerDb.get(id)
    if (!provider) return false

    const apiKey = await keychainService.getApiKey(id)
    if (!apiKey && provider.type !== 'ollama') return false

    try {
      // Simple test: try to create the provider instance
      // In a real implementation, you'd make a test API call
      switch (provider.type) {
        case 'anthropic':
        case 'openai':
        case 'google':
        case 'openrouter':
          // For now, just verify we have a key
          return !!apiKey
        case 'ollama':
          // Test Ollama connection
          const baseUrl = provider.base_url || 'http://localhost:11434'
          const response = await fetch(`${baseUrl}/api/tags`)
          return response.ok
        default:
          return !!apiKey
      }
    } catch {
      return false
    }
  })

  // Get available models for a provider type (fetches from API when possible)
  ipcMain.handle('providers:models', async (_, type: string, providerId?: string) => {
    // Get API key if providerId is given
    let apiKey: string | null = null
    let baseUrl: string | undefined

    if (providerId) {
      apiKey = await keychainService.getApiKey(providerId)
      const provider = providerDb.get(providerId)
      baseUrl = provider?.base_url
    }

    switch (type) {
      case 'anthropic':
        if (apiKey) {
          return await fetchAnthropicModels(apiKey)
        }
        return FALLBACK_MODELS.anthropic

      case 'openai':
        if (apiKey) {
          return await fetchOpenAIModels(apiKey, baseUrl)
        }
        return FALLBACK_MODELS.openai

      case 'google':
        if (apiKey) {
          return await fetchGoogleModels(apiKey)
        }
        return FALLBACK_MODELS.google

      case 'ollama':
        try {
          const url = baseUrl || 'http://localhost:11434'
          const response = await fetch(`${url}/api/tags`)
          if (response.ok) {
            const data = await response.json()
            return data.models?.map((m: any) => ({ id: m.name, name: m.name })) || []
          }
        } catch {
          return []
        }
        return []

      case 'openrouter':
        // OpenRouter still uses the dedicated handler with API key
        return []

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
      return (data.data || [])
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length,
          pricing: m.pricing,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
    } catch (err: any) {
      console.error('Failed to fetch OpenRouter models:', err)
      return []
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
          const knownSizes: Record<string, number> = {
            'gpt-4o': 128000,
            'gpt-4o-mini': 128000,
            'gpt-4-turbo': 128000,
            'gpt-4-turbo-preview': 128000,
            'gpt-4': 8192,
            'gpt-4-32k': 32768,
            'gpt-3.5-turbo': 16385,
            'gpt-3.5-turbo-16k': 16385,
            'o1': 200000,
            'o1-mini': 128000,
            'o1-preview': 128000,
            'o3-mini': 200000,
          }
          // Check exact match first
          if (knownSizes[modelId]) return knownSizes[modelId]
          // Check partial match
          for (const [key, size] of Object.entries(knownSizes)) {
            if (modelId.includes(key)) return size
          }
          return 128000 // Default for newer models
        }

        case 'google': {
          if (!apiKey) return null
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${modelId}?key=${apiKey}`
          )
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
          // Z.ai models - use known values
          return 128000
        }

        case 'openai-compatible':
        case 'custom': {
          // Critical fix: actively probe /models for OpenAI-compatible/custom backends
          const resolved = await resolveContextSizeFromModelsEndpoint(modelId, baseUrl, apiKey)
          if (resolved) return resolved
          // Fallback to OpenAI family patterns
          return findOpenAIFamilyFallback(modelId)
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
