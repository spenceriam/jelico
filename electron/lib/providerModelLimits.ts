const OPENAI_FAMILY_CONTEXT_FALLBACKS: Record<string, number> = {
  'gpt-5.2-pro': 400000,
  'gpt-5.2-chat-latest': 128000,
  'gpt-5.2': 400000,
  'gpt-5.1-codex-max': 400000,
  'gpt-5.1-codex-mini': 400000,
  'gpt-5.1-codex': 400000,
  'gpt-5.1': 400000,
  'gpt-5': 400000,
  'gpt-4.1-mini': 1047576,
  'gpt-4.1-nano': 1047576,
  'gpt-4.1': 1047576,
  'gpt-4o-mini': 128000,
  'gpt-4o': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4-32k': 32768,
  'gpt-4': 8192,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-3.5-turbo': 16385,
  'o1-pro': 200000,
  'o1-preview': 128000,
  'o1-mini': 128000,
  'o1': 200000,
  'o3-mini': 200000,
  o3: 200000,
}

const OPENAI_FAMILY_OUTPUT_FALLBACKS: Record<string, number> = {
  'gpt-5.2-pro': 128000,
  'gpt-5.2-chat-latest': 16384,
  'gpt-5.2': 128000,
  'gpt-5.1-codex-max': 128000,
  'gpt-5.1-codex-mini': 128000,
  'gpt-5.1-codex': 128000,
  'gpt-5.1': 128000,
  'gpt-5': 128000,
  'gpt-4.1-mini': 32768,
  'gpt-4.1-nano': 32768,
  'gpt-4.1': 32768,
  'gpt-4o-mini': 16384,
  'gpt-4o': 16384,
  'gpt-4-turbo-preview': 4096,
  'gpt-4-turbo': 4096,
  'gpt-4-32k': 8192,
  'gpt-4': 8192,
  'gpt-3.5-turbo-16k': 4096,
  'gpt-3.5-turbo': 4096,
  'o1-pro': 100000,
  'o1-preview': 32768,
  'o1-mini': 65536,
  'o1': 100000,
  'o3-mini': 100000,
  o3: 100000,
}

export function getCompatibleAuthHeaderCandidates(apiKey?: string | null): Array<Record<string, string>> {
  if (!apiKey) return [{}]

  return [
    { Authorization: `Bearer ${apiKey}` },
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { 'x-api-key': apiKey },
  ]
}

function normalizeModelId(modelId: string): string {
  return String(modelId || '').trim().toLowerCase()
}

function hasVersionedSuffix(candidateId: string, shortId: string): boolean {
  const directPrefix = `${shortId}-`
  if (candidateId.startsWith(directPrefix)) {
    return /^[0-9]/.test(candidateId.slice(directPrefix.length))
  }

  const pathPrefix = `/${shortId}-`
  const pathIndex = candidateId.indexOf(pathPrefix)
  if (pathIndex !== -1) {
    return /^[0-9]/.test(candidateId.slice(pathIndex + pathPrefix.length))
  }

  return false
}

function matchesModelFamily(modelId: string, family: string): boolean {
  const normalizedModel = normalizeModelId(modelId)
  const normalizedFamily = normalizeModelId(family)

  if (!normalizedModel || !normalizedFamily) return false

  return (
    normalizedModel === normalizedFamily ||
    normalizedModel.startsWith(`${normalizedFamily}-`) ||
    normalizedModel.endsWith(`/${normalizedFamily}`) ||
    normalizedModel.includes(`/${normalizedFamily}-`) ||
    normalizedModel.endsWith(`:${normalizedFamily}`) ||
    normalizedModel.includes(`:${normalizedFamily}-`)
  )
}

function findFamilyFallback(modelId: string, fallbacks: Record<string, number>): number | null {
  const entries = Object.entries(fallbacks).sort((a, b) => b[0].length - a[0].length)

  for (const [family, value] of entries) {
    if (matchesModelFamily(modelId, family)) {
      return value
    }
  }

  return null
}

export function findOpenAIContextFallback(modelId: string): number | null {
  return findFamilyFallback(modelId, OPENAI_FAMILY_CONTEXT_FALLBACKS)
}

export function findOpenAIOutputFallback(modelId: string): number | null {
  return findFamilyFallback(modelId, OPENAI_FAMILY_OUTPUT_FALLBACKS)
}

export function findModelMetadataTarget<T extends { id?: unknown; name?: unknown }>(
  models: T[],
  modelId: string
): T | null {
  const normalizedId = normalizeModelId(modelId)
  const shortId = normalizedId.split('/').pop() || normalizedId

  return (
    models.find((model) => {
      const candidateId = normalizeModelId(String(model?.id || model?.name || ''))
      return (
        candidateId === normalizedId ||
        candidateId === shortId ||
        candidateId.endsWith(`/${shortId}`) ||
        hasVersionedSuffix(candidateId, shortId)
      )
    }) || null
  )
}
