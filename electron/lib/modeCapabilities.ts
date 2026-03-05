import type { AgentMode } from './modes'

type ToolMutationPolicy = {
  canWriteFiles: boolean
  canExecuteCommands: boolean
}

export interface ModeCapabilities {
  main: ToolMutationPolicy
  subAgent: ToolMutationPolicy
}

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

export function canSubAgentMutate(mode: AgentMode): boolean {
  const caps = getModeCapabilities(mode).subAgent
  return caps.canWriteFiles || caps.canExecuteCommands
}

export function assertCapabilityMatrix(): void {
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
}
