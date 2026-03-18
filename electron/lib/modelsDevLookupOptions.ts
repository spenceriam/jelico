const USER_EDITABLE_PROVIDER_ALIAS_TYPES = new Set(['openai-compatible', 'anthropic-compatible', 'custom', 'local'])

export function buildModelsDevLookupOptions(providerType: string, providerName?: string | null, baseUrl?: string | null) {
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
