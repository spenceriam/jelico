import type { AgentMode } from './modes'

type ToolMutationPolicy = {
  canWriteFiles: boolean
  canExecuteCommands: boolean
}

export interface ModeCapabilities {
  main: ToolMutationPolicy
  subAgent: ToolMutationPolicy
}

export interface ExecutionPolicy {
  mode: AgentMode
  fullExecuteEnabled?: boolean
}

let capabilityMatrixValidated = false

// Single capability source of truth used by:
// - Main tool exposure
// - Sub-agent tool exposure
// - Permission risk classification for spawn_agent
export const MODE_CAPABILITY_MATRIX: Record<AgentMode, ModeCapabilities> = {
  auto: {
    main: { canWriteFiles: true, canExecuteCommands: true },
    subAgent: { canWriteFiles: true, canExecuteCommands: true },
  },
  execute: {
    main: { canWriteFiles: true, canExecuteCommands: true },
    subAgent: { canWriteFiles: true, canExecuteCommands: true },
  },
  plan: {
    main: { canWriteFiles: false, canExecuteCommands: false },
    subAgent: { canWriteFiles: false, canExecuteCommands: false },
  },
  explore: {
    main: { canWriteFiles: false, canExecuteCommands: false },
    subAgent: { canWriteFiles: false, canExecuteCommands: false },
  },
  review: {
    main: { canWriteFiles: true, canExecuteCommands: true },
    subAgent: { canWriteFiles: true, canExecuteCommands: true },
  },
  'security-review': {
    main: { canWriteFiles: false, canExecuteCommands: false },
    subAgent: { canWriteFiles: false, canExecuteCommands: false },
  },
  'pr-review': {
    main: { canWriteFiles: true, canExecuteCommands: true },
    subAgent: { canWriteFiles: true, canExecuteCommands: true },
  },
}

export function getModeCapabilities(mode: AgentMode): ModeCapabilities {
  return MODE_CAPABILITY_MATRIX[mode] || MODE_CAPABILITY_MATRIX.auto
}

export function getEffectiveModeCapabilities(policy: AgentMode | ExecutionPolicy): ModeCapabilities {
  const mode = typeof policy === 'string' ? policy : policy.mode
  const fullExecuteEnabled = typeof policy === 'string' ? mode === 'execute' : policy.fullExecuteEnabled === true
  if (!fullExecuteEnabled) {
    return getModeCapabilities(mode === 'execute' ? 'auto' : mode)
  }

  return {
    main: { canWriteFiles: true, canExecuteCommands: true },
    subAgent: { canWriteFiles: true, canExecuteCommands: true },
  }
}

export function canSubAgentMutate(mode: AgentMode): boolean {
  const caps = getEffectiveModeCapabilities(mode).subAgent
  return caps.canWriteFiles || caps.canExecuteCommands
}

export function assertCapabilityMatrix(): void {
  if (capabilityMatrixValidated) {
    return
  }

  const requiredModes: AgentMode[] = [
    'auto',
    'execute',
    'plan',
    'explore',
    'review',
    'security-review',
    'pr-review',
  ]

  for (const mode of requiredModes) {
    const entry = MODE_CAPABILITY_MATRIX[mode]
    if (!entry) {
      throw new Error(`Missing capability matrix entry for mode: ${mode}`)
    }
    if (!entry.main || !entry.subAgent) {
      throw new Error(`Invalid capability matrix entry for mode: ${mode}`)
    }
  }

  capabilityMatrixValidated = true
}
