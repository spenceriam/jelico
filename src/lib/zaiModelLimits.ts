function normalizeModelId(modelId?: string | null): string {
  return String(modelId || '').trim().toLowerCase()
}

export function findZaiContextFallback(modelId?: string | null): number | null {
  const normalized = normalizeModelId(modelId)
  if (!normalized) return null

  if (normalized.includes('glm-4-long')) return 1000000
  if (normalized.includes('glm-4.6v')) return 128000
  if (normalized.includes('glm-4.5v')) return 64000
  if (normalized.includes('glm-4.5-flash')) return 200000
  if (normalized.includes('glm-5')) return 200000
  if (normalized.includes('glm-4.7')) return 200000
  if (normalized.includes('glm-4.6')) return 200000
  if (normalized.includes('glm-4.5')) return 128000
  if (normalized.includes('glm-4-32b')) return 128000

  return null
}

export function findZaiOutputFallback(modelId?: string | null): number | null {
  const normalized = normalizeModelId(modelId)
  if (!normalized) return null

  if (normalized.includes('glm-4.6v')) return 32000
  if (normalized.includes('glm-4.5v')) return 16000
  if (normalized.includes('glm-4.5-flash')) return 98304
  if (normalized.includes('glm-5')) return 128000
  if (normalized.includes('glm-4.7')) return 128000
  if (normalized.includes('glm-4.6')) return 128000
  if (normalized.includes('glm-4.5')) return 98304
  if (normalized.includes('glm-4-32b')) return 16000

  return null
}
