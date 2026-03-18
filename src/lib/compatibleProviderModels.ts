const DEFAULT_OPENAI_MODELS_ENDPOINT = 'https://api.openai.com/v1/models'

interface CompatibleModelsEndpointOptions {
  defaultOpenAI?: boolean
}

export function buildCompatibleModelsEndpointCandidates(
  baseUrl?: string | null,
  { defaultOpenAI = false }: CompatibleModelsEndpointOptions = {}
): string[] {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  const candidates: string[] = []

  const pushUnique = (url: string) => {
    if (!candidates.includes(url)) {
      candidates.push(url)
    }
  }

  if (!trimmed) {
    if (defaultOpenAI) {
      pushUnique(DEFAULT_OPENAI_MODELS_ENDPOINT)
    }
    return candidates
  }

  if (trimmed.endsWith('/models')) {
    pushUnique(trimmed)
  } else if (/\/api\/(?:coding\/)?paas\/v4$/i.test(trimmed)) {
    pushUnique(`${trimmed}/models`)
  } else if (trimmed.endsWith('/v1')) {
    pushUnique(`${trimmed}/models`)
  } else {
    pushUnique(`${trimmed}/v1/models`)
  }

  if (trimmed.endsWith('/anthropic') || trimmed.endsWith('/anthropic/v1')) {
    try {
      const parsed = new URL(trimmed)
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

export { DEFAULT_OPENAI_MODELS_ENDPOINT }
