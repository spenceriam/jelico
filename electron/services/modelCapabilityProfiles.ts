export type GuidanceLevel = 'low' | 'normal' | 'high'
export type DelegationStyle = 'minimal' | 'balanced' | 'parallel-first'

export interface ModelsDevCapabilityMetadata {
  reasoning?: boolean | null
  toolCall?: boolean | null
}

export interface ModelCapabilityProfile {
  profileId: string
  toolUseGuidance: GuidanceLevel
  reminderAggressiveness: GuidanceLevel
  maxRetries: number
  retryBaseDelayMs: number
  delegationStyle: DelegationStyle
  source: 'default' | 'provider_override'
}

export interface ModelCapabilityProfileOverride {
  toolUseGuidance?: GuidanceLevel
  reminderAggressiveness?: GuidanceLevel
  maxRetries?: number
  retryBaseDelayMs?: number
  delegationStyle?: DelegationStyle
}

export type ModelCapabilityProfileMap = Record<string, ModelCapabilityProfileOverride>

const DEFAULT_PROFILE: Omit<ModelCapabilityProfile, 'profileId' | 'source'> = {
  toolUseGuidance: 'normal',
  reminderAggressiveness: 'normal',
  maxRetries: 2,
  retryBaseDelayMs: 1000,
  delegationStyle: 'balanced',
}

function clampRetryCount(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const normalized = Math.floor(Number(value))
  if (normalized < 0) return 0
  if (normalized > 6) return 6
  return normalized
}

function clampDelay(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const normalized = Math.floor(Number(value))
  if (normalized < 100) return 100
  if (normalized > 10000) return 10000
  return normalized
}

function resolveDefaultProfile(
  providerType: string,
  _modelId: string,
  metadata?: ModelsDevCapabilityMetadata | null
): Omit<ModelCapabilityProfile, 'source'> {
  const normalizedProvider = providerType.toLowerCase()

  if (normalizedProvider === 'ollama' || normalizedProvider === 'local') {
    return {
      profileId: 'local-model',
      toolUseGuidance: 'high',
      reminderAggressiveness: 'high',
      maxRetries: 3,
      retryBaseDelayMs: 1300,
      delegationStyle: 'parallel-first',
    }
  }

  if (metadata) {
    if (metadata.reasoning === true) {
      return {
        profileId: 'metadata-reasoning-model',
        ...DEFAULT_PROFILE,
        reminderAggressiveness: 'high',
        maxRetries: 3,
        retryBaseDelayMs: 1200,
      }
    }

    if (metadata.toolCall === false) {
      return {
        profileId: 'metadata-no-tool-call',
        ...DEFAULT_PROFILE,
        toolUseGuidance: 'low',
        reminderAggressiveness: 'high',
        maxRetries: 1,
        retryBaseDelayMs: 700,
        delegationStyle: 'minimal',
      }
    }

    return {
      profileId: 'metadata-standard-model',
      ...DEFAULT_PROFILE,
    }
  }

  return {
    profileId: 'balanced-fallback',
    ...DEFAULT_PROFILE,
  }
}

function pickOverride(
  modelId: string,
  overrides?: ModelCapabilityProfileMap | null
): ModelCapabilityProfileOverride | null {
  if (!overrides) return null
  if (overrides[modelId]) return overrides[modelId]

  const normalizedModel = modelId.toLowerCase()
  let wildcardOverride: ModelCapabilityProfileOverride | null = null

  for (const [key, value] of Object.entries(overrides)) {
    if (key === '*') {
      wildcardOverride = value
      continue
    }
    if (normalizedModel.includes(key.toLowerCase())) return value
  }

  return wildcardOverride
}

export function resolveModelCapabilityProfile(params: {
  providerType: string
  modelId: string
  modelsDevMetadata?: ModelsDevCapabilityMetadata | null
  providerOverrides?: ModelCapabilityProfileMap | null
}): ModelCapabilityProfile {
  const defaults = resolveDefaultProfile(params.providerType, params.modelId, params.modelsDevMetadata)
  const override = pickOverride(params.modelId, params.providerOverrides)

  if (!override) {
    return {
      ...defaults,
      source: 'default',
    }
  }

  return {
    profileId: `${defaults.profileId}-override`,
    toolUseGuidance: override.toolUseGuidance || defaults.toolUseGuidance,
    reminderAggressiveness: override.reminderAggressiveness || defaults.reminderAggressiveness,
    maxRetries: clampRetryCount(override.maxRetries, defaults.maxRetries),
    retryBaseDelayMs: clampDelay(override.retryBaseDelayMs, defaults.retryBaseDelayMs),
    delegationStyle: override.delegationStyle || defaults.delegationStyle,
    source: 'provider_override',
  }
}

function isNeutralDefaultProfile(profile: ModelCapabilityProfile): boolean {
  return (
    profile.source === 'default' &&
    profile.toolUseGuidance === DEFAULT_PROFILE.toolUseGuidance &&
    profile.reminderAggressiveness === DEFAULT_PROFILE.reminderAggressiveness &&
    profile.maxRetries === DEFAULT_PROFILE.maxRetries &&
    profile.retryBaseDelayMs === DEFAULT_PROFILE.retryBaseDelayMs &&
    profile.delegationStyle === DEFAULT_PROFILE.delegationStyle
  )
}

export function buildModelCapabilityProfilePrompt(profile: ModelCapabilityProfile): string {
  if (isNeutralDefaultProfile(profile)) {
    return ''
  }

  const delegationLine = profile.delegationStyle === 'parallel-first'
    ? 'Prefer helper-agent delegation early for broad research and fan-out tasks.'
    : profile.delegationStyle === 'minimal'
      ? 'Prefer direct execution unless delegation is clearly needed.'
      : 'Use balanced delegation: direct action for focused work, helper agents for fan-out.'

  return `## Active Model Capability Profile
- Profile: ${profile.profileId} (${profile.source})
- Tool-use guidance: ${profile.toolUseGuidance}
- Reminder aggressiveness: ${profile.reminderAggressiveness}
- Retry policy: max ${profile.maxRetries} retries (base delay ${profile.retryBaseDelayMs}ms)
- Delegation style: ${profile.delegationStyle}
- Never emit pseudo tool syntax in assistant text (for example: [TOOL_CALL] ... [/TOOL_CALL]); use actual tool calls only.

Follow this profile for reliability and consistency.
${delegationLine}`
}
