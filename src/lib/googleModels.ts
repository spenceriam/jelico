type GoogleModelLike = {
  baseModelId?: string
  id?: string
  name?: string
}

const GOOGLE_SPECIALIZED_MODEL_KEYWORDS = [
  'embedding',
  'embed',
  'aqa',
  'tts',
  'transcribe',
  'image',
  'video',
  'vision',
  'live',
  'audio',
]

function trimGoogleModelId(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^models\//i, '')
}

export function getGoogleModelVariantId(model: Partial<GoogleModelLike>): string {
  return trimGoogleModelId(model.id || model.name || model.baseModelId || '')
}

export function getGoogleModelId(model: Partial<GoogleModelLike>): string {
  return trimGoogleModelId(model.baseModelId || model.id || model.name || '')
}

function normalizeGoogleModelVariantId(model: GoogleModelLike): string {
  return getGoogleModelVariantId(model).toLowerCase()
}

function getGoogleModelVersion(model: GoogleModelLike): number {
  const normalizedId = normalizeGoogleModelVariantId(model)
  const match = normalizedId.match(/gemini-[a-z-]*?(\d+(?:\.\d+)?)/)
  return match ? Number.parseFloat(match[1]) : 0
}

function isExperimentalGoogleModel(model: GoogleModelLike): boolean {
  const normalizedId = normalizeGoogleModelVariantId(model)
  return normalizedId.includes('gemini-exp-') || normalizedId.includes('experimental')
}

export function isSpecializedGoogleModel(model: GoogleModelLike): boolean {
  const normalizedId = normalizeGoogleModelVariantId(model)
  return GOOGLE_SPECIALIZED_MODEL_KEYWORDS.some((keyword) => normalizedId.includes(keyword))
}

function isPreviewGoogleModel(model: GoogleModelLike): boolean {
  const normalizedId = normalizeGoogleModelVariantId(model)
  return normalizedId.includes('preview') || normalizedId.includes('experimental') || normalizedId.includes('-exp')
}

function getGoogleModelVariantWeight(model: GoogleModelLike): number {
  const normalizedId = normalizeGoogleModelVariantId(model)

  if (normalizedId.includes('pro')) return 0
  if (normalizedId.includes('flash-lite')) return 2
  if (normalizedId.includes('flash')) return 1
  return 3
}

function getGooglePreviewRevisionParts(model: GoogleModelLike): number[] {
  const normalizedId = normalizeGoogleModelVariantId(model)
  const match = normalizedId.match(/(?:preview|experimental|exp)(?:-[a-z]+)*-(\d+(?:-\d+)*)$/)
  if (!match) return []

  return match[1]
    .split('-')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part))
}

export function compareGoogleModels(a: GoogleModelLike, b: GoogleModelLike): number {
  const specializedDelta = Number(isSpecializedGoogleModel(a)) - Number(isSpecializedGoogleModel(b))
  if (specializedDelta !== 0) return specializedDelta

  const experimentalDelta = Number(isExperimentalGoogleModel(a)) - Number(isExperimentalGoogleModel(b))
  if (experimentalDelta !== 0) return experimentalDelta

  const previewDelta = Number(isPreviewGoogleModel(a)) - Number(isPreviewGoogleModel(b))
  if (previewDelta !== 0) return previewDelta

  const versionDelta = getGoogleModelVersion(b) - getGoogleModelVersion(a)
  if (versionDelta !== 0) return versionDelta

  const variantDelta = getGoogleModelVariantWeight(a) - getGoogleModelVariantWeight(b)
  if (variantDelta !== 0) return variantDelta

  const aPreviewRevision = getGooglePreviewRevisionParts(a)
  const bPreviewRevision = getGooglePreviewRevisionParts(b)
  const previewRevisionLength = Math.max(aPreviewRevision.length, bPreviewRevision.length)
  for (let index = 0; index < previewRevisionLength; index += 1) {
    const aPart = aPreviewRevision[index] ?? 0
    const bPart = bPreviewRevision[index] ?? 0
    if (aPart !== bPart) return bPart - aPart
  }

  return getGoogleModelVariantId(a).localeCompare(getGoogleModelVariantId(b)) ||
    getGoogleModelId(a).localeCompare(getGoogleModelId(b))
}

export function sortGoogleModels<T extends GoogleModelLike>(models: T[]): T[] {
  return [...models].sort(compareGoogleModels)
}

export function selectPreferredGoogleModels<T extends GoogleModelLike>(models: T[]): T[] {
  const preferredByBaseModel = new Map<string, T>()

  for (const model of sortGoogleModels(models)) {
    const baseModelId = getGoogleModelId(model)
    if (!baseModelId || preferredByBaseModel.has(baseModelId)) continue
    preferredByBaseModel.set(baseModelId, model)
  }

  return [...preferredByBaseModel.values()]
}
