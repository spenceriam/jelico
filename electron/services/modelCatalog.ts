import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import {
  buildModelsDevIndexes,
  type ModelsDevIndexes,
  type ModelsDevLookupOptions,
  type ModelsDevModelMetadata,
  lookupModelsDevContextLimitInIndexes,
  lookupModelsDevModelMetadataInIndexes,
  lookupModelsDevOutputLimitInIndexes,
} from './modelsDevResolver'

const MODELS_DEV_URL = 'https://models.dev/api.json'
const CATALOG_REFRESH_TTL_MS = 6 * 60 * 60 * 1000 // 6h

interface ModelCatalogSnapshot {
  etag?: string | null
  lastCheckedAt?: number
  lastUpdatedAt?: number
  providers: Record<string, unknown>
}

function getCatalogCachePath(): string {
  return path.join(app.getPath('userData'), 'models-dev-catalog.json')
}

let initialized = false
let inMemoryProviders: Record<string, unknown> | null = null
let indexes: ModelsDevIndexes = buildModelsDevIndexes({})
let etag: string | null = null
let lastCheckedAt = 0
let lastUpdatedAt = 0
let refreshInFlight: Promise<void> | null = null
let refreshTimer: NodeJS.Timeout | null = null

function rebuildIndexes(providers: Record<string, unknown>) {
  indexes = buildModelsDevIndexes(providers)
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

export function lookupModelsDevContextLimit(
  providerType: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): number | null {
  if (!inMemoryProviders || !modelId) return null
  return lookupModelsDevContextLimitInIndexes(indexes, providerType, modelId, options)
}

export function lookupModelsDevOutputLimit(
  providerType: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): number | null {
  if (!inMemoryProviders || !modelId) return null
  return lookupModelsDevOutputLimitInIndexes(indexes, providerType, modelId, options)
}

export function lookupModelsDevModelMetadata(
  providerType: string,
  modelId: string,
  options?: ModelsDevLookupOptions
): ModelsDevModelMetadata | null {
  if (!inMemoryProviders || !modelId) return null
  return lookupModelsDevModelMetadataInIndexes(indexes, providerType, modelId, options)
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
    providersIndexed: indexes.providerModelIndex.size,
    modelsIndexed: indexes.globalModelIndex.size,
    outputModelsIndexed: indexes.globalModelOutputIndex.size,
    metadataModelsIndexed: indexes.globalModelMetadataIndex.size,
    lastCheckedAt,
    lastUpdatedAt,
  }
}
