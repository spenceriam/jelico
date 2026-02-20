/**
 * Jelico Changelog
 *
 * Format: Each entry represents a version with its changes.
 * Categories: added, changed, fixed, removed, security
 */

interface ChangelogEntry {
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
    version: '1.0.0',
    date: '2026-02-21',
    changes: {
      added: [
        'HTML artifacts now show thumbnail preview in chat with click-to-expand lightbox (Issue #32)',
        'Artifact thumbnails are auto-captured at 300px width during creation (Issue #32)',
        'Git work trees are now auto-discovered and shown in workspace list (Issue #36)',
        'Workspaces now use git command detection instead of .git folder detection (Issue #36)',
        'Images in chat messages are now clickable for full-size preview (Issue #41)',
        'Lightbox modal for viewing full-size images in messages (Issue #41)',
        'Added Minimax as a native provider option (Issue #51)',
        'Write file and edit file now show diff view before applying changes (Issue #53)',
        'Added execute_script tool for programmatic tool orchestration (Issue #61)',
      ],
      fixed: [
        'Git work trees were incorrectly marked as non-git repositories (Issue #36)',
        'OpenAI compatible provider now strips <think> tags from Minimax and other providers (Issue #50)',
        'Editor view in canvas rendering issues - removed conflicting overflow scroll (Issue #54)',
        'Provider/model selector now properly retains model selection when switching providers (Issue #55)',
        'ModelSelector now includes all provider types including Z.ai and Minimax (Issue #55)',
        'Default typography changed from 14px to 12px (Issue #58)',
        'Canvas divider now uses dynamic max width based on window size (Issue #59)',
        'Canvas respects sidebar width when calculating available space (Issue #59)',
        'Fixed text overflow in streaming content and tool output (Issue #60)',
        'Added overflow-wrap to assistant markdown rendering (Issue #60)',
      ],
    },
  },
  {
    version: '0.18.0',
    date: '2026-02-16',
    changes: {
      added: [
        'Added agent modes: coding, architect, review',
        'Added agent mode selector in chat input',
        'Added agent mode-specific system prompts',
        'Added agent mode-specific tool access',
      ],
      fixed: [
        'Fixed agent mode not persisting between sessions',
        'Fixed agent mode tool access not being enforced',
      ],
    },
  },
  {
    version: '0.17.0',
    date: '2026-02-15',
    changes: {
      added: [
        'Added todo panel for tracking multi-step tasks',
        'Added todo_write, todo_read, todo_check tools',
        'Added todo panel UI with progress indicators',
      ],
      fixed: [
        'Fixed todo state not syncing between windows',
        'Fixed todo panel not collapsing properly',
      ],
    },
  },
  {
    version: '0.16.0',
    date: '2026-02-14',
    changes: {
      added: [
        'Added canvas panel for viewing artifacts',
        'Added artifact creation and display',
        'Added HTML artifact rendering',
        'Added artifact test screenshot capture',
      ],
      fixed: [
        'Fixed canvas panel not resizing properly',
        'Fixed artifact rendering issues',
      ],
    },
  },
  {
    version: '0.15.0',
    date: '2026-02-13',
    changes: {
      added: [
        'Added provider management UI',
        'Added OpenAI, Anthropic, Google providers',
        'Added custom provider configuration',
        'Added provider API key management',
      ],
      fixed: [
        'Fixed provider configuration not persisting',
        'Fixed provider API key storage issues',
      ],
    },
  },
  {
    version: '0.14.0',
    date: '2026-02-12',
    changes: {
      added: [
        'Added workspace management',
        'Added workspace creation and switching',
        'Added workspace-specific settings',
        'Added workspace git integration',
      ],
      fixed: [
        'Fixed workspace not loading on startup',
        'Fixed workspace git detection issues',
      ],
    },
  },
  {
    version: '0.13.0',
    date: '2026-02-11',
    changes: {
      added: [
        'Added chat history persistence',
        'Added conversation search',
        'Added conversation export',
        'Added conversation deletion',
      ],
      fixed: [
        'Fixed chat history not loading',
        'Fixed conversation search performance',
      ],
    },
  },
  {
    version: '0.12.0',
    date: '2026-02-10',
    changes: {
      added: [
        'Added file attachment support',
        'Added image attachment preview',
        'Added drag-and-drop file upload',
      ],
      fixed: [
        'Fixed file attachment not working',
        'Fixed image preview not displaying',
      ],
    },
  },
  {
    version: '0.11.0',
    date: '2026-02-09',
    changes: {
      added: [
        'Added streaming response support',
        'Added typing indicators',
        'Added message timestamps',
      ],
      fixed: [
        'Fixed streaming not working',
        'Fixed message order issues',
      ],
    },
  },
  {
    version: '0.10.0',
    date: '2026-02-08',
    changes: {
      added: [
        'Initial release of Jelico',
        'Basic chat functionality',
        'Multi-provider AI support',
        'File system integration',
        'Tool calling (read_file, write_file, execute_command)',
      ],
    },
  },
]