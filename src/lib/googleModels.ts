type GoogleModelLike = {
  baseModelId?: string
  id: string
  name: string
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

export function getGoogleModelId(model: Partial<GoogleModelLike>): string {
  return trimGoogleModelId(model.baseModelId || model.id || model.name || '')
}

function normalizeGoogleModelId(model: GoogleModelLike): string {
  return getGoogleModelId(model).toLowerCase()
}

function getGoogleModelVersion(model: GoogleModelLike): number {
  const normalizedId = normalizeGoogleModelId(model)
  const match = normalizedId.match(/gemini-[a-z-]*?(\d+(?:\.\d+)?)/)
  return match ? Number.parseFloat(match[1]) : 0
}

function isExperimentalGoogleModel(model: GoogleModelLike): boolean {
  const normalizedId = normalizeGoogleModelId(model)
  return normalizedId.includes('gemini-exp-') || normalizedId.includes('experimental')
}

function isSpecializedGoogleModel(model: GoogleModelLike): boolean {
  const normalizedId = normalizeGoogleModelId(model)
  return GOOGLE_SPECIALIZED_MODEL_KEYWORDS.some((keyword) => normalizedId.includes(keyword))
}

function isPreviewGoogleModel(model: GoogleModelLike): boolean {
  const normalizedId = normalizeGoogleModelId(model)
  return normalizedId.includes('preview') || normalizedId.includes('experimental') || normalizedId.includes('-exp')
}

function getGoogleModelVariantWeight(model: GoogleModelLike): number {
  const normalizedId = normalizeGoogleModelId(model)

  if (normalizedId.includes('pro')) return 0
  if (normalizedId.includes('flash-lite')) return 2
  if (normalizedId.includes('flash')) return 1
  return 3
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

  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

export function sortGoogleModels<T extends GoogleModelLike>(models: T[]): T[] {
  return [...models].sort(compareGoogleModels)
}
