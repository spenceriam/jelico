const SAFE_LOCAL_PROVIDER_ALIASES = new Set(['lm studio', 'ollama'])
const PROVIDER_NAME_LOOKUP_TYPES = new Set(['openai-compatible', 'anthropic-compatible', 'custom'])

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
      PROVIDER_NAME_LOOKUP_TYPES.has(normalizedType)
    )

  if (allowProviderNameLookup) {
    options.providerName = trimmedProviderName
  }

  return options
}
