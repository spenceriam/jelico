const DEFAULT_OPENAI_MODELS_ENDPOINT = 'https://api.openai.com/v1/models'

interface CompatibleModelsEndpointOptions {
  defaultOpenAI?: boolean
}

interface NormalizeCompatibleBaseUrlOptions {
  stripModelsPath?: boolean
}

export function normalizeCompatibleBaseUrl(
  baseUrl?: string | null,
  { stripModelsPath = false }: NormalizeCompatibleBaseUrlOptions = {}
): string {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed.replace(/\/chat\/completions$/, '')
  }
  if (stripModelsPath && trimmed.endsWith('/models')) {
    return trimmed.replace(/\/models$/, '')
  }
  return trimmed
}

export function buildCompatibleModelsEndpointCandidates(
  baseUrl?: string | null,
  { defaultOpenAI = false }: CompatibleModelsEndpointOptions = {}
): string[] {
  const normalizedBase = normalizeCompatibleBaseUrl(baseUrl)
  const candidates: string[] = []

  const pushUnique = (url: string) => {
    if (!candidates.includes(url)) {
      candidates.push(url)
    }
  }

  if (!normalizedBase) {
    if (defaultOpenAI) {
      pushUnique(DEFAULT_OPENAI_MODELS_ENDPOINT)
    }
    return candidates
  }

  if (normalizedBase.endsWith('/models')) {
    pushUnique(normalizedBase)
  } else if (/\/api\/(?:coding\/)?paas\/v4$/i.test(normalizedBase)) {
    pushUnique(`${normalizedBase}/models`)
  } else if (normalizedBase.endsWith('/v1')) {
    pushUnique(`${normalizedBase}/models`)
  } else {
    pushUnique(`${normalizedBase}/v1/models`)
  }

  if (normalizedBase.endsWith('/anthropic') || normalizedBase.endsWith('/anthropic/v1')) {
    try {
      const parsed = new URL(normalizedBase)
      pushUnique(`${parsed.origin}/v1/models`)
    } catch {
      // Ignore malformed base URL and keep the primary endpoint only.
    }
  }

  return candidates
}

export function buildPrimaryCompatibleModelsEndpoint(
  baseUrl?: string | null,
  options?: CompatibleModelsEndpointOptions
): string | null {
  return buildCompatibleModelsEndpointCandidates(baseUrl, options)[0] ?? null
}

export function buildCompatibleChatCompletionsEndpoint(baseUrl?: string | null): string | null {
  const normalizedBase = normalizeCompatibleBaseUrl(baseUrl, { stripModelsPath: true })
  if (!normalizedBase) return null

  if (/\/api\/(?:coding\/)?paas\/v4$/i.test(normalizedBase)) {
    return `${normalizedBase}/chat/completions`
  }

  if (normalizedBase.endsWith('/v1')) {
    return `${normalizedBase}/chat/completions`
  }

  return `${normalizedBase}/v1/chat/completions`
}

export { DEFAULT_OPENAI_MODELS_ENDPOINT }
