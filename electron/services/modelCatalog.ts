import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const MODELS_DEV_URL = 'https://models.dev/api.json'
const CATALOG_REFRESH_TTL_MS = 6 * 60 * 60 * 1000 // 6h

const PROVIDER_TYPE_TO_MODELS_DEV_KEYS: Record<string, string[]> = {
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

interface ModelCatalogSnapshot {
  etag?: string | null
  lastCheckedAt?: number
  lastUpdatedAt?: number
  providers: Record<string, unknown>
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function shortModelId(modelId: string): string {
  const normalized = normalize(modelId)
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

function getCatalogCachePath(): string {
  return path.join(app.getPath('userData'), 'models-dev-catalog.json')
}

function toPositiveNumber(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.round(numeric)
}

function extractContextLimit(model: any): number | null {
  const candidates = [
    model?.limit?.context,
    model?.limit?.input,
    model?.context_length,
    model?.contextLength,
    model?.max_context_length,
    model?.maxContextLength,
    model?.input_token_limit,
    model?.inputTokenLimit,
    model?.max_input_tokens,
    model?.maxInputTokens,
    model?.limits?.context_window,
    model?.limits?.contextLength,
    model?.architecture?.context_length,
    model?.metadata?.context_length,
  ]

  for (const candidate of candidates) {
    const size = toPositiveNumber(candidate)
    if (size) return size
  }

  return null
}

let initialized = false
let inMemoryProviders: Record<string, unknown> | null = null
let providerModelIndex = new Map<string, Map<string, number>>()
let globalModelIndex = new Map<string, number>()
let etag: string | null = null
let lastCheckedAt = 0
let lastUpdatedAt = 0
let refreshInFlight: Promise<void> | null = null
let refreshTimer: NodeJS.Timeout | null = null

function indexModelId(target: Map<string, number>, id: string, contextLimit: number) {
  const normalized = normalize(id)
  if (!normalized) return

  const previous = target.get(normalized)
  if (!previous || contextLimit > previous) {
    target.set(normalized, contextLimit)
  }
}

function rebuildIndexes(providers: Record<string, unknown>) {
  providerModelIndex = new Map()
  globalModelIndex = new Map()

  for (const [providerKey, providerValue] of Object.entries(providers)) {
    if (!providerValue || typeof providerValue !== 'object') continue

    const providerRecord = providerValue as Record<string, unknown>
    const models = providerRecord.models
    if (!models || typeof models !== 'object') continue

    const providerMap = new Map<string, number>()

    for (const [modelKey, modelValue] of Object.entries(models as Record<string, unknown>)) {
      if (!modelValue || typeof modelValue !== 'object') continue

      const modelRecord = modelValue as Record<string, unknown>
      const contextLimit = extractContextLimit(modelRecord)
      if (!contextLimit) continue

      const ids = new Set<string>()
      ids.add(modelKey)
      if (typeof modelRecord.id === 'string') ids.add(modelRecord.id)

      for (const id of ids) {
        indexModelId(providerMap, id, contextLimit)
        indexModelId(globalModelIndex, id, contextLimit)

        const shortId = shortModelId(id)
        if (shortId && shortId !== normalize(id)) {
          indexModelId(providerMap, shortId, contextLimit)
          indexModelId(globalModelIndex, shortId, contextLimit)
        }
      }
    }

    providerModelIndex.set(normalize(providerKey), providerMap)
  }
}

function persistSnapshot() {
  if (!inMemoryProviders) return

  try {
    const snapshot: ModelCatalogSnapshot = {
      etag,
      lastCheckedAt,
      lastUpdatedAt,
      providers: inMemoryProviders,
    }
    fs.writeFileSync(getCatalogCachePath(), JSON.stringify(snapshot))
  } catch (error) {
    console.warn('[ModelCatalog] Failed to persist models.dev snapshot:', error)
  }
}

function loadSnapshotFromDisk() {
  try {
    const cachePath = getCatalogCachePath()
    if (!fs.existsSync(cachePath)) return

    const raw = fs.readFileSync(cachePath, 'utf-8')
    if (!raw) return

    const parsed = JSON.parse(raw) as ModelCatalogSnapshot
    if (!parsed || typeof parsed !== 'object' || !parsed.providers || typeof parsed.providers !== 'object') {
      return
    }

    etag = parsed.etag ?? null
    lastCheckedAt = typeof parsed.lastCheckedAt === 'number' ? parsed.lastCheckedAt : 0
    lastUpdatedAt = typeof parsed.lastUpdatedAt === 'number' ? parsed.lastUpdatedAt : 0
    inMemoryProviders = parsed.providers
    rebuildIndexes(parsed.providers)
  } catch (error) {
    console.warn('[ModelCatalog] Failed to load models.dev cache:', error)
  }
}

export async function refreshModelCatalog(force = false): Promise<void> {
  if (refreshInFlight) return refreshInFlight

  const now = Date.now()
  if (!force && now - lastCheckedAt < CATALOG_REFRESH_TTL_MS) {
    return
  }

  refreshInFlight = (async () => {
    lastCheckedAt = now

    try {
      const response = await fetch(MODELS_DEV_URL, {
        headers: {
          Accept: 'application/json',
          ...(etag ? { 'If-None-Match': etag } : {}),
        },
      })

      if (response.status === 304) {
        persistSnapshot()
        return
      }

      if (!response.ok) {
        throw new Error(`models.dev responded with ${response.status}`)
      }

      const payload = await response.json()
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid models.dev payload')
      }

      inMemoryProviders = payload as Record<string, unknown>
      rebuildIndexes(inMemoryProviders)
      etag = response.headers.get('etag')
      lastUpdatedAt = Date.now()
      persistSnapshot()
    } catch (error) {
      console.warn('[ModelCatalog] Failed to refresh models.dev snapshot:', error)
      persistSnapshot()
    }
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

function getProviderCandidates(providerType: string): string[] {
  const normalizedType = normalize(providerType)
  const mapped = PROVIDER_TYPE_TO_MODELS_DEV_KEYS[normalizedType] || []
  const candidates = new Set<string>([normalizedType, ...mapped])
  return [...candidates]
}

function lookupInProviderIndex(providerKey: string, modelId: string): number | null {
  const providerMap = providerModelIndex.get(normalize(providerKey))
  if (!providerMap) return null

  const normalizedModelId = normalize(modelId)
  const shortId = shortModelId(modelId)

  return providerMap.get(normalizedModelId) ?? providerMap.get(shortId) ?? null
}

export function lookupModelsDevContextLimit(providerType: string, modelId: string): number | null {
  if (!inMemoryProviders || !modelId) return null

  for (const providerKey of getProviderCandidates(providerType)) {
    const fromProvider = lookupInProviderIndex(providerKey, modelId)
    if (fromProvider) return fromProvider
  }

  const normalizedModelId = normalize(modelId)
  const shortId = shortModelId(modelId)
  return globalModelIndex.get(normalizedModelId) ?? globalModelIndex.get(shortId) ?? null
}

export function initializeModelCatalog() {
  if (initialized) return
  initialized = true

  loadSnapshotFromDisk()
  void refreshModelCatalog(true)

  refreshTimer = setInterval(() => {
    void refreshModelCatalog(false)
  }, CATALOG_REFRESH_TTL_MS)

  ;(refreshTimer as any).unref?.()
}

export function getModelCatalogStatus() {
  return {
    hasSnapshot: Boolean(inMemoryProviders),
    providersIndexed: providerModelIndex.size,
    modelsIndexed: globalModelIndex.size,
    lastCheckedAt,
    lastUpdatedAt,
  }
}
