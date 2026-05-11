export const DASHSCOPE_COMPATIBLE_BASE_URLS = {
  international: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  us: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
  china: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
} as const

type DashScopeRegion = keyof typeof DASHSCOPE_COMPATIBLE_BASE_URLS

function normalizeBaseUrl(baseUrl?: string | null): string {
  return String(baseUrl || '').trim().replace(/\/+$/, '')
}

function getDashScopeRegion(baseUrl?: string | null): DashScopeRegion | null {
  const normalized = normalizeBaseUrl(baseUrl).toLowerCase()
  if (!normalized) return null

  try {
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase()
    if (host === 'dashscope-intl.aliyuncs.com') return 'international'
    if (host === 'dashscope-us.aliyuncs.com') return 'us'
    if (host === 'dashscope.aliyuncs.com') return 'china'
  } catch {
    return null
  }

  return null
}

function isDashScopeUrl(baseUrl?: string | null): boolean {
  return getDashScopeRegion(baseUrl) !== null
}

function isQwenModel(modelId?: string | null): boolean {
  return String(modelId || '').trim().toLowerCase().startsWith('qwen')
}

function isQwenUsModel(modelId?: string | null): boolean {
  return String(modelId || '').trim().toLowerCase().endsWith('-us')
}

function looksLikeCommercialQwenModel(modelId?: string | null): boolean {
  const normalized = String(modelId || '').trim().toLowerCase()
  return (
    normalized === 'qwen-plus' ||
    normalized === 'qwen-flash' ||
    normalized === 'qwen-max' ||
    normalized.startsWith('qwen3.5-plus') ||
    normalized.startsWith('qwen3.5-flash') ||
    normalized.startsWith('qwen-plus-') ||
    normalized.startsWith('qwen-flash-') ||
    normalized.startsWith('qwen-max-')
  )
}

export function validateDashScopeProviderConfig(params: {
  providerType?: string | null
  baseUrl?: string | null
  modelId?: string | null
}): string | null {
  const providerType = String(params.providerType || '').trim().toLowerCase()
  const baseUrl = normalizeBaseUrl(params.baseUrl)
  const normalizedBaseUrl = baseUrl.toLowerCase()
  const region = getDashScopeRegion(baseUrl)
  const modelId = String(params.modelId || '').trim()

  if (!region && !normalizedBaseUrl.includes('dashscope')) {
    return null
  }

  if (providerType && !['openai-compatible', 'custom'].includes(providerType)) {
    return null
  }

  if (normalizedBaseUrl.includes('/api/v1')) {
    return 'DashScope OpenAI-compatible providers must use /compatible-mode/v1 as the base URL, not the DashScope SDK /api/v1 endpoint.'
  }

  if (normalizedBaseUrl.endsWith('/chat/completions')) {
    return 'Use the DashScope compatible base URL ending in /compatible-mode/v1, not the full /chat/completions URL.'
  }

  if (region && !normalizedBaseUrl.endsWith('/compatible-mode/v1')) {
    return `Use ${DASHSCOPE_COMPATIBLE_BASE_URLS[region]} for DashScope OpenAI-compatible chat.`
  }

  if (!isQwenModel(modelId)) {
    return null
  }

  if (region === 'us' && looksLikeCommercialQwenModel(modelId) && !isQwenUsModel(modelId)) {
    return 'DashScope US deployment model IDs should use the -us suffix, such as qwen-plus-us or qwen-flash-us.'
  }

  if (region && region !== 'us' && isQwenUsModel(modelId)) {
    return 'DashScope -us model IDs must be used with the US /compatible-mode/v1 endpoint.'
  }

  return null
}

export function isDashScopeCompatibleProvider(baseUrl?: string | null): boolean {
  return isDashScopeUrl(baseUrl)
}
