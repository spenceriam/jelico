const SAFE_LOCAL_PROVIDER_ALIASES = new Set(['lm studio', 'ollama'])
const PROVIDER_NAME_LOOKUP_TYPES = new Set(['openai-compatible', 'anthropic-compatible', 'custom'])

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true
  }

  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.includes('.internal.')) {
    return true
  }

  if (/^10\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true

  const match = hostname.match(/^172\.(\d{1,2})\./)
  if (match) {
    const secondOctet = Number.parseInt(match[1], 10)
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true
    }
  }

  return false
}

function isProxyLikeBaseUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl)
    return isPrivateHost(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function buildModelsDevLookupOptions(providerType: string, providerName?: string | null, baseUrl?: string | null) {
  const options: { providerName?: string; baseUrl?: string } = {}
  const normalizedType = String(providerType || '').trim().toLowerCase()
  const trimmedBaseUrl = String(baseUrl || '').trim()
  const trimmedProviderName = String(providerName || '').trim()

  if (trimmedBaseUrl) {
    options.baseUrl = trimmedBaseUrl
  }

  const allowProviderNameLookup =
    !!trimmedProviderName &&
    (
      (normalizedType === 'local' && SAFE_LOCAL_PROVIDER_ALIASES.has(trimmedProviderName.toLowerCase())) ||
      (PROVIDER_NAME_LOOKUP_TYPES.has(normalizedType) && isProxyLikeBaseUrl(trimmedBaseUrl))
    )

  if (allowProviderNameLookup) {
    options.providerName = trimmedProviderName
  }

  return options
}
