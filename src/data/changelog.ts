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
    version: '0.3.5',
    date: '2026-01-29',
    changes: {
      fixed: [
        'Tool calls and results now persist to database - conversation reload preserves full tool history',
        'Compaction message format mismatch - fixed data corruption during context compaction',
      ],
      added: [
        'Message update API for modifying existing messages',
      ],
    },
  },
  {
    version: '0.3.4',
    date: '2026-01-29',
    changes: {
      fixed: [
        'Tool call status now correctly updates to complete when result arrives',
        'Stop streaming now properly clears tool call and result state',
      ],
    },
  },
  {
    version: '0.3.3',
    date: '2026-01-29',
    changes: {
      fixed: [
        'AI response disappearing - added try/catch to stream end handler to prevent lost messages',
        'Tool calls not showing for providers without streaming support - fallback to show on tool-call event',
        'Empty AI responses now saved correctly (tool-only responses)',
        'Duplicate Settings icon - now shows in header only when sidebar is collapsed',
      ],
      changed: [
        'Artifacts now appear as collapsible sub-tree under each conversation in sidebar',
        'Removed separate Artifacts section from sidebar bottom',
      ],
    },
  },
  {
    version: '0.3.2',
    date: '2026-01-29',
    changes: {
      fixed: [
        'Async tool call display - tools now show immediately when triggered instead of after completion',
        'Multi-step tool calling - AI can now execute up to 10 tool call steps instead of stopping early',
        'Undefined text appearing in chat stream during tool call processing',
        'Execute command failures on Windows - improved shell handling and working directory',
        'React crash caused by undefined icon components for unknown artifact types',
      ],
      added: [
        'OS environment context - Jelico now detects OS and suggests appropriate terminal commands',
        'Tool call status lifecycle display (starting, executing, complete, error)',
      ],
    },
  },
  {
    version: '0.3.1',
    date: '2026-01-27',
    changes: {
      added: [
        'File attachments support with paperclip icon in prompt box',
        'Drag and drop file support for images, text, PDF, and documents',
        'Attachments are now sent to the AI (multimodal support)',
        'Pasted content auto-collapse for content >10 lines (click to expand/collapse)',
        'Voice input using local Whisper model (speech-to-text)',
        'Microphone Settings tab for device and model configuration',
        'Multiple Whisper models available (Tiny to Medium)',
        'Recording timer with 2-minute limit',
        'Voice transcription appends to existing text (multi-round dictation)',
      ],
      changed: [
        'Prompt box now has visual divider between text area and action icons',
        'Send button and icons now in dedicated row at bottom of prompt box',
      ],
    },
  },
  {
    version: '0.3.0',
    date: '2026-01-27',
    changes: {
      added: [
        'Working dark/light/system theme modes',
        'Five color themes with full dark and light variants',
      ],
      changed: [
        'Theme system now uses CSS variables for real-time switching',
        'Onboarding profile data now saves as preferences for easy editing in Settings',
        'Removed memory decay - Jelico remembers everything forever',
        'Simplified Memory & Learning section in General Settings',
      ],
      fixed: [
        'Profile data from onboarding now pre-fills in General Settings',
        'Color theme changes apply immediately',
      ],
    },
  },
  {
    version: '0.2.1',
    date: '2026-01-27',
    changes: {
      changed: [
        'Moved settings icon next to model selector in new chat view',
      ],
    },
  },
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
