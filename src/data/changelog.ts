/**
 * Jelico Changelog
 *
 * Format: Each entry represents a version with its changes.
 * Categories: added, changed, fixed, removed, security
 *
 * Update this file BEFORE running `npm version` command.
 */

export interface ChangelogEntry {
  version: string
  date: string
  changes: {
    added?: string[]
    changed?: string[]
    fixed?: string[]
    removed?: string[]
    security?: string[]
  }
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.2.0',
    date: '2026-01-27',
    changes: {
      added: [
        'General Settings panel with appearance, user profile, default mode, and memory settings',
        'Theme system with 5 color themes (Gold, Midnight Blue, Forest, Lavender, Rose)',
        'Dark/Light/System theme mode support',
        'ModelSelector as reusable component',
        'Settings button and model selector in new chat view',
      ],
      changed: [
        'Settings tabs reordered: General → Providers → Skills → Backup',
        'Workspace selector uses stacked layout (name on top, branch below)',
        'Header hidden in new chat view for cleaner UI',
        'Model selector moved next to workspace selector in header',
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2025-01-27',
    changes: {
      added: [
        'Initial Jelico Phase 1 implementation',
        'Multi-provider AI support (Anthropic, OpenAI, Google)',
        'Conversation management with SQLite persistence',
        'Mode system (Auto, Code, Write, Think, Research)',
        'Workspace management with folder selection',
        'Soul system for learning user patterns and preferences',
        'Onboarding flow with personality capture',
        'Soulful greeting system with time-aware messages',
        'Artifact panel for code and content display',
        'Agent panel for sub-agent orchestration',
        'Context window tracking and compaction support',
        'Processing indicators with shimmer animations',
        'Backup and restore functionality',
        'Settings panel with provider configuration',
      ],
      changed: [
        'OS-aware keyboard shortcuts (Cmd for Mac, Ctrl for Windows/Linux)',
        'Centered new chat UI with stacked layout',
        'Four-line tall prompt input by default',
      ],
      fixed: [
        'ESM/CommonJS module compatibility for Electron',
        'TypeScript strict mode compliance',
      ],
      security: [
        'Updated AI SDK to v6.0.56',
        'Updated @ai-sdk packages to v3.x',
        'Updated electron-builder to v26.4.0',
      ],
    },
  },
]

/**
 * Get the current version from changelog
 */
export function getCurrentVersion(): string {
  return changelog[0]?.version ?? '0.0.0'
}

/**
 * Get changelog entries for display
 */
export function getChangelogForDisplay(): ChangelogEntry[] {
  return changelog
}
