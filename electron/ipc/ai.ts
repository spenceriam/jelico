import { ipcMain, BrowserWindow } from 'electron'
import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { providerDb } from '../services/database'
import { keychainService } from '../services/keychain'

// Store active streams for cancellation
const activeStreams = new Map<string, AbortController>()

function getProviderInstance(providerConfig: any, apiKey: string) {
  switch (providerConfig.type) {
    case 'anthropic':
      return createAnthropic({ apiKey })
    case 'openai':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url || undefined,
      })
    case 'google':
      return createGoogleGenerativeAI({ apiKey })
    case 'openrouter':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url || 'https://openrouter.ai/api/v1',
      })
    case 'ollama':
      return createOpenAI({
        apiKey: 'ollama', // Ollama doesn't need a real key
        baseURL: providerConfig.base_url || 'http://localhost:11434/v1',
      })
    case 'custom':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url,
      })
    default:
      throw new Error(`Unknown provider type: ${providerConfig.type}`)
  }
}

export function registerAIHandlers() {
  // Stream AI response
  ipcMain.on('ai:stream', async (event, channelId: string, params: any) => {
    const abortController = new AbortController()
    activeStreams.set(channelId, abortController)

    try {
      // Get provider config
      const providerConfig = providerDb.get(params.providerId)
      if (!providerConfig) {
        event.sender.send(`ai:error:${channelId}`, 'Provider not found')
        return
      }

      // Get API key
      const apiKey = await keychainService.getApiKey(params.providerId)
      if (!apiKey && providerConfig.type !== 'ollama') {
        event.sender.send(`ai:error:${channelId}`, 'API key not found')
        return
      }

      // Create provider instance
      const provider = getProviderInstance(providerConfig, apiKey || '')
      const modelId = params.model || providerConfig.default_model

      // Stream the response
      const result = await streamText({
        model: provider(modelId),
        messages: params.messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        abortSignal: abortController.signal,
      })

      // Send chunks as they arrive
      for await (const chunk of result.textStream) {
        if (abortController.signal.aborted) break
        event.sender.send(`ai:chunk:${channelId}`, chunk)
      }

      // Signal completion
      if (!abortController.signal.aborted) {
        event.sender.send(`ai:end:${channelId}`)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('AI streaming error:', error)
        event.sender.send(`ai:error:${channelId}`, error.message || 'Unknown error')
      }
    } finally {
      activeStreams.delete(channelId)
    }
  })

  // Stop streaming
  ipcMain.on('ai:stop', (_, channelId: string) => {
    const controller = activeStreams.get(channelId)
    if (controller) {
      controller.abort()
      activeStreams.delete(channelId)
    }
  })
}
