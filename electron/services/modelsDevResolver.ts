export const PROVIDER_TYPE_TO_MODELS_DEV_KEYS: Record<string, string[]> = {
  anthropic: ['anthropic'],
  openai: ['openai'],
  google: ['google'],
  openrouter: ['openrouter'],
  ollama: ['ollama'],
  local: ['lmstudio', 'ollama'],
  minimax: ['minimax', 'minimax-coding-plan', 'minimax-cn', 'minimax-cn-coding-plan'],
  zai: ['zai', 'zhipuai'],
  'zai-china': ['zai', 'zhipuai'],
  'zai-coding': ['zai-coding-plan', 'zhipuai-coding-plan', 'zai', 'zhipuai'],
  'zai-coding-china': ['zai-coding-plan', 'zhipuai-coding-plan', 'zai', 'zhipuai'],
  custom: [],
  'openai-compatible': [],
  'anthropic-compatible': [],
}

export interface ModelsDevModelMetadata {
  providerKey: string
  modelKey: string
  modelId: string
  family?: string | null
  reasoning: boolean | null
  toolCall: boolean | null
}

export interface ModelsDevLookupOptions {
  baseUrl?: string | null
  providerName?: string | null
}

interface IndexedProviderRecord {
  apiUrl: string | null
  key: string
  name: string | null
  nameSlug: string | null
  normalizedName: string | null
  preferredModelIds: string[]
}

export interface ModelsDevIndexes {
  globalModelIndex: Map<string, number>
  globalModelMetadataIndex: Map<string, ModelsDevModelMetadata>
  globalModelOutputIndex: Map<string, number>
  providerModelIndex: Map<string, Map<string, number>>
  providerModelMetadataIndex: Map<string, Map<string, ModelsDevModelMetadata>>
  providerModelOutputIndex: Map<string, Map<string, number>>
  providerRecords: Map<string, IndexedProviderRecord>
}

export function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function shortModelId(modelId: string): string {
  const normalized = normalize(modelId)
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeApiUrl(value?: string | null): string | null {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null

  const stripTailSegments = (input: string) =>
    input
      .replace(/\/+(models|messages)$/i, '')
      .replace(/\/+$/, '')

  try {
    const parsed = new URL(trimmed)
    const pathname = stripTailSegments(parsed.pathname || '')
    const normalizedPath = pathname ? pathname : ''
    return `${parsed.origin.toLowerCase()}${normalizedPath}`
  } catch {
    return stripTailSegments(trimmed.toLowerCase())
  }
}

function toPositiveNumber(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.round(numeric)
}

function extractContextLimit(model: Record<string, unknown>): number | null {
  const candidates = [
    model.limit && typeof model.limit === 'object' ? (model.limit as Record<string, unknown>).context : null,
    model.limit && typeof model.limit === 'object' ? (model.limit as Record<string, unknown>).input : null,
    model.context_length,
    model.contextLength,
    model.max_context_length,
    model.maxContextLength,
    model.input_token_limit,
    model.inputTokenLimit,
    model.max_input_tokens,
    model.maxInputTokens,
    model.limits && typeof model.limits === 'object' ? (model.limits as Record<string, unknown>).context_window : null,
    model.limits && typeof model.limits === 'object' ? (model.limits as Record<string, unknown>).contextLength : null,
    model.architecture && typeof model.architecture === 'object' ? (model.architecture as Record<string, unknown>).context_length : null,
    model.metadata && typeof model.metadata === 'object' ? (model.metadata as Record<string, unknown>).context_length : null,
  ]

  for (const candidate of candidates) {
    const size = toPositiveNumber(candidate)
    if (size) return size
  }

  return null
}

function extractOutputLimit(model: Record<string, unknown>): number | null {
  const candidates = [
    model.limit && typeof model.limit === 'object' ? (model.limit as Record<string, unknown>).output : null,
    model.output_token_limit,
    model.outputTokenLimit,
    model.max_output_tokens,
    model.maxOutputTokens,
    model.limits && typeof model.limits === 'object' ? (model.limits as Record<string, unknown>).output : null,
    model.limits && typeof model.limits === 'object' ? (model.limits as Record<string, unknown>).output_tokens : null,
    model.metadata && typeof model.metadata === 'object' ? (model.metadata as Record<string, unknown>).output_tokens : null,
  ]

  for (const candidate of candidates) {
    const size = toPositiveNumber(candidate)
    if (size) return size
  }

  return null
}

function parseCatalogDate(value: unknown): number {
  if (typeof value !== 'string') return 0
  const trimmed = value.trim()
  if (!trimmed) return 0

  let normalizedValue = trimmed
  if (/^\d{4}$/.test(trimmed)) {
    normalizedValue = `${trimmed}-01-01`
  } else if (/^\d{4}-\d{2}$/.test(trimmed)) {
    normalizedValue = `${trimmed}-01`
  }

  const parsed = Date.parse(normalizedValue)
  return Number.isFinite(parsed) ? parsed : 0
}

function compareProviderModels(
  a: { contextLimit: number; id: string; lastUpdated: number; outputLimit: number; releaseDate: number; toolCall: boolean },
  b: { contextLimit: number; id: string; lastUpdated: number; outputLimit: number; releaseDate: number; toolCall: boolean }
): number {
  if (a.releaseDate !== b.releaseDate) return b.releaseDate - a.releaseDate
  if (a.lastUpdated !== b.lastUpdated) return b.lastUpdated - a.lastUpdated
  if (a.outputLimit !== b.outputLimit) return b.outputLimit - a.outputLimit
  if (a.contextLimit !== b.contextLimit) return b.contextLimit - a.contextLimit
  if (a.toolCall !== b.toolCall) return Number(b.toolCall) - Number(a.toolCall)
  return a.id.localeCompare(b.id)
}

function indexModelId(target: Map<string, number>, id: string, limit: number) {
  const normalizedId = normalize(id)
  if (!normalizedId) return

  const previous = target.get(normalizedId)
  if (!previous || limit > previous) {
    target.set(normalizedId, limit)
  }
}

function indexModelMetadata(
  target: Map<string, ModelsDevModelMetadata>,
  id: string,
  metadata: ModelsDevModelMetadata
) {
  const normalizedId = normalize(id)
  if (!normalizedId) return
  if (!target.has(normalizedId)) {
    target.set(normalizedId, metadata)
  }
}

export function buildModelsDevIndexes(providers: Record<string, unknown>): ModelsDevIndexes {
  const providerModelIndex = new Map<string, Map<string, number>>()
  const globalModelIndex = new Map<string, number>()
  const providerModelOutputIndex = new Map<string, Map<string, number>>()
  const globalModelOutputIndex = new Map<string, number>()
  const providerModelMetadataIndex = new Map<string, Map<string, ModelsDevModelMetadata>>()
  const globalModelMetadataIndex = new Map<string, ModelsDevModelMetadata>()
  const providerRecords = new Map<string, IndexedProviderRecord>()

  for (const [providerKey, providerValue] of Object.entries(providers)) {
    if (!providerValue || typeof providerValue !== 'object') continue

    const normalizedProviderKey = normalize(providerKey)
    const providerRecord = providerValue as Record<string, unknown>
    const models = providerRecord.models
    if (!models || typeof models !== 'object') continue

    const providerMap = new Map<string, number>()
    const providerOutputMap = new Map<string, number>()
    const providerMetadataMap = new Map<string, ModelsDevModelMetadata>()
    const preferredModels: Array<{
      contextLimit: number
      id: string
      lastUpdated: number
      outputLimit: number
      releaseDate: number
      toolCall: boolean
    }> = []

    for (const [modelKey, modelValue] of Object.entries(models as Record<string, unknown>)) {
      if (!modelValue || typeof modelValue !== 'object') continue

      const modelRecord = modelValue as Record<string, unknown>
      const contextLimit = extractContextLimit(modelRecord)
      const outputLimit = extractOutputLimit(modelRecord)
      const modelId = typeof modelRecord.id === 'string' ? modelRecord.id : modelKey

      preferredModels.push({
        contextLimit: contextLimit || 0,
        id: modelId,
        lastUpdated: parseCatalogDate(modelRecord.last_updated),
        outputLimit: outputLimit || 0,
        releaseDate: parseCatalogDate(modelRecord.release_date),
        toolCall: modelRecord.tool_call === true,
      })

      const ids = new Set<string>([modelKey])
      if (typeof modelRecord.id === 'string') ids.add(modelRecord.id)

      const metadata: ModelsDevModelMetadata = {
        providerKey: normalizedProviderKey,
        modelKey,
        modelId,
        family: typeof modelRecord.family === 'string' ? modelRecord.family : null,
        reasoning: typeof modelRecord.reasoning === 'boolean' ? modelRecord.reasoning : null,
        toolCall: typeof modelRecord.tool_call === 'boolean' ? modelRecord.tool_call : null,
      }

      for (const id of ids) {
        if (contextLimit) {
          indexModelId(providerMap, id, contextLimit)
          indexModelId(globalModelIndex, id, contextLimit)
        }

        if (outputLimit) {
          indexModelId(providerOutputMap, id, outputLimit)
          indexModelId(globalModelOutputIndex, id, outputLimit)
        }

        indexModelMetadata(providerMetadataMap, id, metadata)
        indexModelMetadata(globalModelMetadataIndex, id, metadata)

        const shortId = shortModelId(id)
        if (shortId && shortId !== normalize(id)) {
          if (contextLimit) {
            indexModelId(providerMap, shortId, contextLimit)
            indexModelId(globalModelIndex, shortId, contextLimit)
          }

          if (outputLimit) {
            indexModelId(providerOutputMap, shortId, outputLimit)
            indexModelId(globalModelOutputIndex, shortId, outputLimit)
          }

          indexModelMetadata(providerMetadataMap, shortId, metadata)
          indexModelMetadata(globalModelMetadataIndex, shortId, metadata)
        }
      }
    }

    preferredModels.sort(compareProviderModels)

    providerRecords.set(normalizedProviderKey, {
      apiUrl: normalizeApiUrl(typeof providerRecord.api === 'string' ? providerRecord.api : null),
      key: normalizedProviderKey,
      name: typeof providerRecord.name === 'string' ? providerRecord.name : null,
      nameSlug: typeof providerRecord.name === 'string' ? slugify(providerRecord.name) : null,
      normalizedName: typeof providerRecord.name === 'string' ? normalize(providerRecord.name) : null,
      preferredModelIds: preferredModels.map((model) => model.id),
    })

    providerModelIndex.set(normalizedProviderKey, providerMap)
    providerModelOutputIndex.set(normalizedProviderKey, providerOutputMap)
    providerModelMetadataIndex.set(normalizedProviderKey, providerMetadataMap)
  }

  return {
    globalModelIndex,
    globalModelMetadataIndex,
    globalModelOutputIndex,
    providerModelIndex,
    providerModelMetadataIndex,
    providerModelOutputIndex,
    providerRecords,
  }
}

function getProviderCandidates(
  indexes: ModelsDevIndexes,
  providerType: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): string[] {
  const normalizedType = normalize(providerType)
  const candidates = new Set<string>([normalizedType, ...(PROVIDER_TYPE_TO_MODELS_DEV_KEYS[normalizedType] || [])])

  const normalizedModelId = normalize(modelId)
  const shortId = shortModelId(modelId)

  if (indexes.providerRecords.has(normalizedModelId)) {
    candidates.add(normalizedModelId)
  }

  if (indexes.providerRecords.has(shortId)) {
    candidates.add(shortId)
  }

  const providerName = String(options?.providerName || '').trim()
  if (providerName) {
    const normalizedName = normalize(providerName)
    const sluggedName = slugify(providerName)

    for (const providerRecord of indexes.providerRecords.values()) {
      if (
        providerRecord.normalizedName === normalizedName ||
        (sluggedName && providerRecord.nameSlug === sluggedName)
      ) {
        candidates.add(providerRecord.key)
      }
    }
  }

  const normalizedBaseUrl = normalizeApiUrl(options?.baseUrl)
  if (normalizedBaseUrl) {
    for (const providerRecord of indexes.providerRecords.values()) {
      if (!providerRecord.apiUrl) continue

      if (
        normalizedBaseUrl === providerRecord.apiUrl ||
        normalizedBaseUrl.startsWith(providerRecord.apiUrl) ||
        providerRecord.apiUrl.startsWith(normalizedBaseUrl)
      ) {
        candidates.add(providerRecord.key)
      }
    }
  }

  return [...candidates]
}

function lookupInProviderIndex(
  providerIndex: Map<string, Map<string, number>>,
  providerKey: string,
  modelId: string
): number | null {
  const providerMap = providerIndex.get(normalize(providerKey))
  if (!providerMap) return null

  const normalizedModelId = normalize(modelId)
  const shortId = shortModelId(modelId)
  return providerMap.get(normalizedModelId) ?? providerMap.get(shortId) ?? null
}

function lookupInProviderMetadataIndex(
  providerIndex: Map<string, Map<string, ModelsDevModelMetadata>>,
  providerKey: string,
  modelId: string
): ModelsDevModelMetadata | null {
  const providerMap = providerIndex.get(normalize(providerKey))
  if (!providerMap) return null

  const normalizedModelId = normalize(modelId)
  const shortId = shortModelId(modelId)
  return providerMap.get(normalizedModelId) ?? providerMap.get(shortId) ?? null
}

function resolveProviderAliasModelId(
  indexes: ModelsDevIndexes,
  providerKey: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): string | null {
  const providerRecord = indexes.providerRecords.get(normalize(providerKey))
  if (!providerRecord || providerRecord.preferredModelIds.length === 0) return null

  const normalizedModelId = normalize(modelId)
  const shortId = shortModelId(modelId)
  const sluggedModelId = slugify(modelId)
  const providerName = String(options?.providerName || '').trim()
  const normalizedProviderName = providerName ? normalize(providerName) : ''
  const sluggedProviderName = providerName ? slugify(providerName) : ''

  const matchesProviderAlias = [
    providerRecord.key,
    providerRecord.normalizedName || '',
    providerRecord.nameSlug || '',
    normalizedProviderName,
    sluggedProviderName,
  ].some((candidate) => candidate && (
    candidate === normalizedModelId ||
    candidate === shortId ||
    candidate === sluggedModelId
  ))

  if (!matchesProviderAlias) return null
  return providerRecord.preferredModelIds[0] || null
}

function lookupGlobalIndex<T>(target: Map<string, T>, modelId: string): T | null {
  const normalizedModelId = normalize(modelId)
  const shortId = shortModelId(modelId)
  return target.get(normalizedModelId) ?? target.get(shortId) ?? null
}

function shouldAllowGlobalOutputLimitFallback(
  providerType: string,
): boolean {
  const normalizedType = normalize(providerType)
  switch (normalizedType) {
    case 'openai-compatible':
    case 'anthropic-compatible':
    case 'custom':
    case 'local':
      return false
    default:
      return true
  }
}

export function lookupModelsDevContextLimitInIndexes(
  indexes: ModelsDevIndexes,
  providerType: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): number | null {
  const candidates = getProviderCandidates(indexes, providerType, modelId, options)

  for (const providerKey of candidates) {
    const directMatch = lookupInProviderIndex(indexes.providerModelIndex, providerKey, modelId)
    if (directMatch) return directMatch
  }

  for (const providerKey of candidates) {
    const aliasModelId = resolveProviderAliasModelId(indexes, providerKey, modelId, options)
    if (!aliasModelId) continue

    const aliasMatch = lookupInProviderIndex(indexes.providerModelIndex, providerKey, aliasModelId)
    if (aliasMatch) return aliasMatch
  }

  return lookupGlobalIndex(indexes.globalModelIndex, modelId)
}

export function lookupModelsDevOutputLimitInIndexes(
  indexes: ModelsDevIndexes,
  providerType: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): number | null {
  const candidates = getProviderCandidates(indexes, providerType, modelId, options)

  for (const providerKey of candidates) {
    const directMatch = lookupInProviderIndex(indexes.providerModelOutputIndex, providerKey, modelId)
    if (directMatch) return directMatch
  }

  for (const providerKey of candidates) {
    const aliasModelId = resolveProviderAliasModelId(indexes, providerKey, modelId, options)
    if (!aliasModelId) continue

    const aliasMatch = lookupInProviderIndex(indexes.providerModelOutputIndex, providerKey, aliasModelId)
    if (aliasMatch) return aliasMatch
  }

  if (!shouldAllowGlobalOutputLimitFallback(providerType)) {
    return null
  }

  return lookupGlobalIndex(indexes.globalModelOutputIndex, modelId)
}

export function lookupModelsDevModelMetadataInIndexes(
  indexes: ModelsDevIndexes,
  providerType: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): ModelsDevModelMetadata | null {
  const candidates = getProviderCandidates(indexes, providerType, modelId, options)

  for (const providerKey of candidates) {
    const directMatch = lookupInProviderMetadataIndex(indexes.providerModelMetadataIndex, providerKey, modelId)
    if (directMatch) return directMatch
  }

  for (const providerKey of candidates) {
    const aliasModelId = resolveProviderAliasModelId(indexes, providerKey, modelId, options)
    if (!aliasModelId) continue

    const aliasMatch = lookupInProviderMetadataIndex(indexes.providerModelMetadataIndex, providerKey, aliasModelId)
    if (aliasMatch) return aliasMatch
  }

  return lookupGlobalIndex(indexes.globalModelMetadataIndex, modelId)
}
