export type ModelToolSupport = 'tools_supported' | 'chat_only' | 'unknown'

export interface ModelToolCapability {
  support: ModelToolSupport
  label: 'Tools supported' | 'Chat only' | 'Tool support unknown'
  source: 'explicit' | 'provider' | 'verified' | 'unknown'
  reason: string
}

export function getToolCapabilityLabel(support: ModelToolSupport): ModelToolCapability['label'] {
  if (support === 'tools_supported') return 'Tools supported'
  if (support === 'chat_only') return 'Chat only'
  return 'Tool support unknown'
}

export function getLocalModelToolCapability(provider: {
  type?: string
  name?: string
  baseUrl?: string | null
  defaultModel?: string | null
  modelToolCapabilities?: Record<string, ModelToolCapability> | null
}, modelId?: string | null): ModelToolCapability {
  const model = modelId?.trim() || provider.defaultModel?.trim() || ''
  const cached = model ? provider.modelToolCapabilities?.[model] : null
  if (cached) return cached

  const type = (provider.type || '').toLowerCase()
  const name = (provider.name || '').toLowerCase()
  const baseUrl = (provider.baseUrl || '').toLowerCase()

  if (type.includes('nous') || name.includes('nous') || baseUrl.includes('portal.nousresearch.com')) {
    return {
      support: 'chat_only',
      label: 'Chat only',
      source: 'explicit',
      reason: 'This compatible endpoint is known to expose chat responses without reliable structured tool calls.',
    }
  }

  if (['openai', 'anthropic', 'google'].includes(type)) {
    return {
      support: 'tools_supported',
      label: 'Tools supported',
      source: 'provider',
      reason: 'Native provider integration supports structured tool calls.',
    }
  }

  return {
    support: 'unknown',
    label: 'Tool support unknown',
    source: 'unknown',
    reason: 'Tool support has not been verified for this provider and model.',
  }
}

export function isLikelyToolTaskPrompt(text: string): boolean {
  const value = text.toLowerCase()
  return /\b(read|write|edit|modify|update|create|delete|rename|archive|run|execute|command|terminal|file|folder|directory|workspace|artifact|diagram|html|svg|mermaid|code|fix|implement|build|test|search)\b/.test(value)
}
