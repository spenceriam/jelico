import { ipcMain } from 'electron'
import { providerDb } from '../services/database'
import { keychainService } from '../services/keychain'

// Model lists for each provider type
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
  openrouter: [], // Fetched dynamically from OpenRouter API
  ollama: [], // Will be fetched dynamically
  custom: [],
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

  // Get available models for a provider type
  ipcMain.handle('providers:models', async (_, type: string, baseUrl?: string) => {
    if (type === 'ollama') {
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
    }
    return PROVIDER_MODELS[type] || []
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
