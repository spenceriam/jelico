export type GuidanceLevel = 'low' | 'normal' | 'high'
export type DelegationStyle = 'minimal' | 'balanced' | 'parallel-first'

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

function resolveDefaultProfile(providerType: string, modelId: string): Omit<ModelCapabilityProfile, 'source'> {
  const normalizedModel = modelId.toLowerCase()
  const normalizedProvider = providerType.toLowerCase()

  if (/mini|small|haiku|flash/.test(normalizedModel)) {
    return {
      profileId: 'small-model-assist',
      toolUseGuidance: 'high',
      reminderAggressiveness: 'high',
      maxRetries: 3,
      retryBaseDelayMs: 1200,
      delegationStyle: 'parallel-first',
    }
  }

  if (/reasoning|o1|o3|r1|deep/.test(normalizedModel)) {
    return {
      profileId: 'reasoning-model',
      toolUseGuidance: 'low',
      reminderAggressiveness: 'low',
      maxRetries: 1,
      retryBaseDelayMs: 900,
      delegationStyle: 'minimal',
    }
  }

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

  return {
    profileId: 'balanced-default',
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
  for (const [key, value] of Object.entries(overrides)) {
    if (key === '*') return value
    if (normalizedModel.includes(key.toLowerCase())) return value
  }

  return null
}

export function resolveModelCapabilityProfile(params: {
  providerType: string
  modelId: string
  providerOverrides?: ModelCapabilityProfileMap | null
}): ModelCapabilityProfile {
  const defaults = resolveDefaultProfile(params.providerType, params.modelId)
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

export function buildModelCapabilityProfilePrompt(profile: ModelCapabilityProfile): string {
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

Follow this profile for reliability and consistency.
${delegationLine}`
}

