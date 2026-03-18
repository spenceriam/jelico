const DEFAULT_OPENAI_MODELS_ENDPOINT = 'https://api.openai.com/v1/models'

interface CompatibleModelsEndpointOptions {
  defaultOpenAI?: boolean
}

export function buildCompatibleModelsEndpointCandidates(
  baseUrl?: string | null,
  { defaultOpenAI = false }: CompatibleModelsEndpointOptions = {}
): string[] {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  const normalizedBase = trimmed.endsWith('/chat/completions')
    ? trimmed.replace(/\/chat\/completions$/, '')
    : trimmed
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
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) return null

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }

  if (trimmed.endsWith('/models')) {
    return trimmed.replace(/\/models$/, '/chat/completions')
  }

  if (/\/api\/(?:coding\/)?paas\/v4$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`
  }

  return `${trimmed}/v1/chat/completions`
}

export { DEFAULT_OPENAI_MODELS_ENDPOINT }
