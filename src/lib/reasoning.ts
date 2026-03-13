export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
type ReasoningProviderKind = 'openai' | 'anthropic' | 'google'
type AnthropicReasoningEffort = Extract<ReasoningEffort, 'low' | 'medium' | 'high'>
type GoogleThinkingLevel = Extract<ReasoningEffort, 'minimal' | 'low' | 'medium' | 'high'>

export type ReasoningProviderOptions =
  | { openai: { reasoningEffort: ReasoningEffort } }
  | { anthropic: { effort: AnthropicReasoningEffort } }
  | { google: { thinkingConfig: { thinkingLevel: GoogleThinkingLevel } } }

export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
}

function matchesModelFamily(normalizedModel: string, family: string): boolean {
  return (
    normalizedModel === family ||
    normalizedModel.startsWith(`${family}-`) ||
    normalizedModel.endsWith(`/${family}`) ||
    normalizedModel.includes(`/${family}-`) ||
    normalizedModel.endsWith(`:${family}`) ||
    normalizedModel.includes(`:${family}-`)
  )
}

const OPENAI_STYLE_PROVIDER_TYPES = new Set([
  'openai',
  'openrouter',
  'ollama',
  'custom',
  'local',
  'zai',
  'zai-china',
  'zai-coding',
  'zai-coding-china',
  'minimax',
  'openai-compatible',
])

const ANTHROPIC_STYLE_PROVIDER_TYPES = new Set(['anthropic', 'anthropic-compatible'])
const GOOGLE_STYLE_PROVIDER_TYPES = new Set(['google'])

function getReasoningProviderKind(providerType: string): ReasoningProviderKind | null {
  const normalizedProvider = String(providerType || '').trim().toLowerCase()

  if (OPENAI_STYLE_PROVIDER_TYPES.has(normalizedProvider)) return 'openai'
  if (ANTHROPIC_STYLE_PROVIDER_TYPES.has(normalizedProvider)) return 'anthropic'
  if (GOOGLE_STYLE_PROVIDER_TYPES.has(normalizedProvider)) return 'google'
  return null
}

export function getSupportedReasoningEfforts(providerType: string, modelId?: string | null): ReasoningEffort[] {
  const normalizedModel = String(modelId || '').trim().toLowerCase()
  const providerKind = getReasoningProviderKind(providerType)

  if (!normalizedModel) return []
  switch (providerKind) {
    case 'openai': {
      const isReasoningModel =
        normalizedModel.startsWith('gpt-5') ||
        normalizedModel.startsWith('o1') ||
        normalizedModel.startsWith('o3') ||
        normalizedModel.includes('codex')

      if (!isReasoningModel) return []

      if (matchesModelFamily(normalizedModel, 'gpt-5.1-codex-max')) {
        return ['none', 'medium', 'high', 'xhigh']
      }

      if (normalizedModel.includes('gpt-5.1')) {
        return ['none', 'low', 'medium', 'high']
      }

      return ['minimal', 'low', 'medium', 'high']
    }
    case 'anthropic':
      if (
        matchesModelFamily(normalizedModel, 'claude-opus-4-5') ||
        matchesModelFamily(normalizedModel, 'claude-opus-4-20250514')
      ) {
        return ['low', 'medium', 'high']
      }
      return []
    case 'google':
      if (matchesModelFamily(normalizedModel, 'gemini-3-pro')) {
        return ['low', 'high']
      }

      if (matchesModelFamily(normalizedModel, 'gemini-3-flash')) {
        return ['minimal', 'low', 'medium', 'high']
      }

      return []
    default:
      return []
  }
}

export function sanitizeReasoningEffort(
  providerType: string,
  modelId?: string | null,
  effort?: ReasoningEffort | null
): ReasoningEffort | null {
  if (!effort) return null
  return getSupportedReasoningEfforts(providerType, modelId).includes(effort) ? effort : null
}

export function supportsReasoningEffort(providerType: string, modelId?: string | null): boolean {
  return getSupportedReasoningEfforts(providerType, modelId).length > 0
}

export function buildReasoningProviderOptions(
  providerType: string,
  modelId?: string | null,
  effort?: ReasoningEffort | null
): ReasoningProviderOptions | undefined {
  const validatedEffort = sanitizeReasoningEffort(providerType, modelId, effort)
  const providerKind = getReasoningProviderKind(providerType)

  if (!validatedEffort || !providerKind) return undefined

  switch (providerKind) {
    case 'openai':
      return {
        openai: {
          reasoningEffort: validatedEffort,
        },
      }
    case 'anthropic':
      return {
        anthropic: {
          effort: validatedEffort as AnthropicReasoningEffort,
        },
      }
    case 'google':
      return {
        google: {
          thinkingConfig: {
            thinkingLevel: validatedEffort as GoogleThinkingLevel,
          },
        },
      }
    default:
      return undefined
  }
}
