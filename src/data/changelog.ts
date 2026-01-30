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
    version: '0.5.5',
    date: '2026-01-30',
    changes: {
      added: [
        'Permission system - AI now asks before destructive actions (file writes, dangerous commands)',
        'Permissions Settings tab - configure "Allow All" session mode, view saved permissions',
        'Message queue UI - sliding panel shows queued messages when sending during AI response',
        'Mode switching display - status text shows when AI switches modes in Auto mode',
        '800+ unique greeting combinations - questions stand alone, statements get tone-matched follow-ups',
      ],
      changed: [
        'Greeting system completely rewritten for more natural, non-repetitive interactions',
        'ModeSelector animates with ring effect during mode transitions',
      ],
    },
  },
  {
    version: '0.5.4',
    date: '2026-01-30',
    changes: {
      added: [
        'Resizable artifact panels - drag to resize canvas panel width',
        'Artifact versioning - artifacts show revision numbers (r1, r2, etc.)',
        'Contextual status text - shows what tool is executing (Reading file, Running command, etc.)',
      ],
      fixed: [
        'Artifact streaming now properly creates artifacts during response',
        'Canvas panel respects saved width preference',
      ],
    },
  },
  {
    version: '0.5.3',
    date: '2026-01-30',
    changes: {
      added: [
        'Braille loader animation - new animated dots indicator replacing spinner',
        'Left-justified status text with contextual tool information',
      ],
      changed: [
        'AI persona strengthened - must acknowledge before calling tools',
        'Tool call display collapsed by default, click to expand',
        'Context bar hidden by default, click percentage to show',
      ],
      fixed: [
        'Avatar display for user and assistant messages',
        'Auto-scroll to bottom on new messages',
      ],
    },
  },
  {
    version: '0.5.2',
    date: '2026-01-30',
    changes: {
      changed: [
        'Speech-to-text disabled due to WASM crashes on Windows ARM64',
        'AI persona improved - acknowledges user before executing tools',
        'Sub-agent plumbing hidden from conversation display',
      ],
    },
  },
  {
    version: '0.5.1',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Speech worker loading from CDN with lazy initialization',
        'CSP policy for WASM and CDN resources',
        'Renderer crash handling - silent reload instead of error dialog',
      ],
    },
  },
  {
    version: '0.5.0',
    date: '2026-01-30',
    changes: {
      added: [
        'Local speech recognition via Whisper WASM (currently disabled)',
        'Speech worker running in renderer process for cross-platform compatibility',
        'Multiple Whisper model options (tiny, base, small, medium)',
      ],
      changed: [
        'Sidebar dividers cleaned up with consistent styling',
        'Font matching across UI components',
      ],
      fixed: [
        'Speech recognition platform detection for Windows ARM64',
        'ONNX runtime issues with microphone recording',
      ],
    },
  },
  {
    version: '0.4.0',
    date: '2026-01-30',
    changes: {
      added: [
        'Sub-agent sibling awareness - agents can now be informed about other agents working in parallel',
        'Capability request pattern - sub-agents can request tools or capabilities via [REQUEST] marker',
        'Sub-agent tool call display - see what tools sub-agents are using in real-time',
        'Main AI delegation guidance - encourages spawning sub-agents for parallel, context-efficient work',
        'Pasted content persistence - pasted text/images now saved with messages and display on reload',
      ],
      changed: [
        'Sub-agent UI redesign - shows task, progress, tool calls, and results in organized panel',
        'Main AI system prompt updated to emphasize orchestrator role and sub-agent benefits',
        'Sub-agent progress now sends full text instead of truncated for better display',
      ],
      fixed: [
        'Sub-agent text capture - fixed property name mismatch (text vs textDelta) for result collection',
        'Pasted content not showing in user messages - attachments now persist to database correctly',
        'TypeScript types for AI IPC methods (generateTitle, getAgentLimit, increaseAgentLimit)',
      ],
    },
  },
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
