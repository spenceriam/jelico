export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

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

export function getSupportedReasoningEfforts(providerType: string, modelId?: string | null): ReasoningEffort[] {
  const normalizedProvider = String(providerType || '').trim().toLowerCase()
  const normalizedModel = String(modelId || '').trim().toLowerCase()

  if (!normalizedModel) return []
  if (normalizedProvider !== 'openai') return []

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
