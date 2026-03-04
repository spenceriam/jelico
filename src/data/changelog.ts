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
    version: '0.34.1',
    date: '2026-03-03',
    changes: {
      fixed: [
        'Window-drag interaction guards now clear stale sessions before mousedown handling and ignore composer/clarification/permission surfaces, preventing intermittent prompt focus loss after modal interactions (Fixes #116)',
        'Prompt textarea now uses a taller active-chat minimum height and stronger top inset so long dictated or pasted drafts do not appear flush against the top border while scrolling (Fixes #95)',
      ],
    },
  },
  {
    version: '0.34.0',
    date: '2026-03-03',
    changes: {
      changed: [
        'Added active-stream mode synchronization (`ai:updateStreamMode`) so renderer mode changes are applied by backend tool policy without waiting for the next turn',
        'Refined project sibling-conversation context scoping discovered during context-window validation: sandbox chats are now isolated per conversation and worktree chats remain isolated from main-workspace conversation buckets',
      ],
      fixed: [
        'Switching to Full Execute during an active response now updates that stream\'s permission behavior immediately, preventing continued approval prompts after mode change (Fixes #82)',
        'Prompt composer no longer enters intermittent locked states in active chats; typing/attachments remain available while send gating still respects provider/model readiness (Fixes #116)',
        'Prompt textarea now preserves a consistent top inset while scrolling long drafts via adjusted composer sizing and scroll padding (Fixes #95)',
        'Context usage display and compaction checks now rely on the highest reliable per-conversation token signal, and context initialization preserves prior token history to avoid apparent resets during branch updates (Fixes #111)',
      ],
    },
  },
  {
    version: '0.33.10',
    date: '2026-03-03',
    changes: {
      fixed: [
        'Active workspace branch indicator now refreshes live after successful in-chat git branch switches (`git checkout` / `git switch`) executed through the command tool (Fixes #81)',
      ],
    },
  },
  {
    version: '0.33.9',
    date: '2026-03-03',
    changes: {
      changed: [
        'Core persona guidance is now role-adaptive by default, applying engineer-level rigor only when the task is engineering-heavy',
        'Auto mode now explicitly balances general assistant behavior with engineering depth based on task type',
        'GitHub workflow guidance now loads contextually for issue/PR/changelog/release requests, improving consistency in repository operations',
        'Assistant markdown rendering now uses improved list and divider spacing for long completion summaries',
      ],
      fixed: [
        'Added repository issue and PR templates to standardize bug/feature metadata, labels, and required root-cause/fix structure',
        'Added CI checks to enforce PR section format, required issue linkage, and an emoji-free policy for PR text and commit messages',
        'Added CI checks to flag issue titles/bodies that contain emojis and comment with correction guidance',
        'Resume shortcut detection now requires exact commands (`resume`, `restart`, or `continue`) to avoid unintended triggers on longer phrases',
      ],
    },
  },
  {
    version: '0.33.8',
    date: '2026-03-02',
    changes: {
      fixed: [
        'Interrupted tool calls at stream end now record explicit non-user cancellation causes, preventing false "canceled by user" labeling in tool history (Fixes #109)',
        'Interrupted turns now preserve resumable checkpoints and support deterministic restart from the last request, including direct "resume/restart/continue" follow-up prompts (Fixes #109)',
        'Assistant usage metadata now stores provider finishReason to improve diagnostics for partial/incomplete tool runs (Fixes #109)',
      ],
    },
  },
  {
    version: '0.33.7',
    date: '2026-03-02',
    changes: {
      fixed: [
        'Streaming completion-repair now avoids starting a second visible attempt in the same turn after output has already streamed, preventing restart-style duplicate responses (Fixes #106)',
        'Mutation expectation inference now treats pasted transcript/log blocks as context and avoids false-positive edit expectations on review-only requests (Fixes #106)',
      ],
      changed: [
        'Removed standalone local build:arm64 script; ARM64 packaging remains part of GitHub Actions release builds',
      ],
    },
  },
  {
    version: '0.33.6',
    date: '2026-02-28',
    changes: {
      fixed: [
        'Assistant progress text now streams in chronological order with tool activity on normal turns, preventing delayed text blocks from appearing out of sequence under completed tool calls (Hotfix for streaming order regression)',
      ],
      changed: [
        'Completion-sensitive text buffering is now limited to validation-repair retries, preserving live response flow for regular artifact/file turns',
      ],
    },
  },
  {
    version: '0.33.5',
    date: '2026-02-28',
    changes: {
      fixed: [
        'Sandbox follow-up artifact edits now append to existing artifact revision history (same conversation + title + type) instead of creating duplicate artifacts when models call create_artifact for iterative edits (Fixes #103)',
        'Windows app startup now enforces a single-instance lock so relaunch focuses the running window instead of creating parallel Jelico instances',
        'App shutdown now closes hidden artifact test sessions on quit/close to prevent lingering background Electron processes after window close',
      ],
      changed: [
        'Top titlebar safe-area fill, header bar, and bottom input rail now share the same bg-bg-surface shell color for consistent pane theming',
      ],
    },
  },
  {
    version: '0.33.4',
    date: '2026-02-28',
    changes: {
      fixed: [
        'Assistant kickoff text now appears before tool execution for complex artifact/file turns, with cleaner dedupe of repeated kickoff/plan text in buffered outputs (Fixes #90)',
        'Streaming text/tool interleaving now preserves readable spacing across tool boundaries, preventing merged progress text like sentence joins after tool events (Fixes #90)',
        'Message copy output now preserves real interleaved text/tool order from saved segments, instead of flattening tool history out of sequence (Fixes #90)',
        'Chat input now remains editable in centered/new-chat flows even when no provider is selected, preserving drafts and reducing stuck-composer states (Fixes #91)',
        'Active conversation deletion now immediately clears stream/conversation state and returns focus to a clean composer state, preventing transient interaction lockups (Fixes #91)',
        'Global mouse/focus safety handlers now release drag/resize interaction locks when focus is lost, reducing stuck UI edge cases during rapid navigation',
        'HTML artifact validation now ignores script/style body content when checking tag balance, reducing false truncation errors from JavaScript operators or embedded markup-like strings',
      ],
      changed: [
        'Task-aware kickoff phrasing now varies by request complexity with less repetitive boilerplate and fuller upfront plan previews for normal-sized todo lists',
        'Canvas revision reload now also keys off selected artifact update timestamps so revision history refreshes reliably after artifact changes',
      ],
    },
  },
  {
    version: '0.33.3',
    date: '2026-02-25',
    changes: {
      fixed: [
        'Chat attachment image previews now render reliably across common MIME/extension mismatches and malformed image payloads (Fixes #83)',
        'HTML artifact thumbnail capture now waits for render settle, targets the primary visual surface, and preserves a higher-fidelity expandable preview',
        'Artifact create/update preview cards now use a compact thumbnail, explicit close control, and safer fallback behavior when preview payloads fail to decode',
        'Turn completion now validates artifact/file mutation claims against successful tool evidence and retries silently once before surfacing failure',
      ],
      changed: [
        'Tool-call thumbnail previews now include update_artifact snapshots in addition to create_artifact output',
      ],
    },
  },
  {
    version: '0.33.2',
    date: '2026-02-24',
    changes: {
      fixed: [
        'Duplicate end-of-turn summary blocks no longer appear when internal todo/status tools finish after a complete response (Fixes #80)',
        'Turn finalization now uses deterministic, one-shot fallback wrap-up text instead of issuing a second model-generated summary call',
        'Fallback wrap-up text now excludes internal orchestration details and keeps tool/progress internals out of user-visible responses',
      ],
    },
  },
  {
    version: '0.33.1',
    date: '2026-02-24',
    changes: {
      fixed: [
        'Resolved provider/model TypeScript regressions that caused release builds to fail after v0.33.0 (Fixes #79)',
        'Provider setup model loading now falls back to direct model fetch when preview model discovery returns no results',
        'Patched release pipeline by moving build-tagged output to a main-backed commit with the CI fixes applied',
      ],
    },
  },
  {
    version: '0.33.0',
    date: '2026-02-24',
    changes: {
      added: [
        'Provider settings now surface inline API test status/results and clearer missing-model validation',
        'MiniMax setup split into MiniMax API and MiniMax Coding Plan presets for safer configuration',
      ],
      changed: [
        'Model selector now displays model name in the chip, uses provider/model rows in dropdown, and improves wrapping for long labels',
        'Sandbox file discovery now resolves against conversation sandbox root when no workspace is selected',
      ],
      fixed: [
        'Anthropic-compatible MiniMax endpoint normalization now targets /v1/messages path correctly (Fixes #79)',
        'Hidden active provider/model now falls back to the next visible option instead of leaving hidden selection active',
        'Tool-call repair now recovers malformed large create_artifact and write_file payloads more reliably',
        'Runtime output token cap now uses models.dev output metadata with AI SDK v6 maxOutputTokens to reduce truncated tool payloads',
      ],
    },
  },
  {
    version: '0.32.0',
    date: '2026-02-24',
    changes: {
      added: [
        'Provider/model selector redesigned to a flat read-only list with provider settings shortcut and improved long-label wrapping (Fixes #79)',
        'Conversation provider/model selection is now persisted per conversation and restored when switching chats',
        'models.dev model catalog service added for context-size lookups with launch refresh and cache persistence',
      ],
      changed: [
        'Provider settings edit flow now supports updating display name, endpoint URL, and default model from one action',
      ],
      fixed: [
        'Model selector now renders valid options for compatible and non-standard providers instead of empty sections (Fixes #79)',
        'Model switching is blocked during active streaming turns and only applies before send or after turn completion',
      ],
    },
  },
  {
    version: '0.31.0',
    date: '2026-02-23',
    changes: {
      added: [
        'Programmatic tool orchestration with execute_script (Fixes #61)',
      ],
    },
  },
  {
    version: '0.30.0',
    date: '2026-02-23',
    changes: {
      fixed: [
        'Text overflow in streaming content and tool output now wraps correctly (Fixes #60)',
      ],
    },
  },
  {
    version: '0.29.0',
    date: '2026-02-23',
    changes: {
      fixed: [
        'Canvas divider now uses dynamic max width based on window size (Fixes #59)',
      ],
    },
  },
  {
    version: '0.28.0',
    date: '2026-02-23',
    changes: {
      changed: [
        'Default typography changed from 14px to 12px (Fixes #58)',
      ],
    },
  },
  {
    version: '0.27.0',
    date: '2026-02-23',
    changes: {
      fixed: [
        'Provider/model selector is now interactive when multiple providers are configured (Fixes #55)',
      ],
    },
  },
  {
    version: '0.26.0',
    date: '2026-02-23',
    changes: {
      fixed: [
        'Editor view in canvas now renders correctly without scroll-related artifacts (Fixes #54)',
      ],
    },
  },
  {
    version: '0.24.0',
    date: '2026-02-22',
    changes: {
      added: [
        'Write file and edit file now show diff view before applying changes (Issue #53)',
      ],
    },
  },
  {
    version: '0.23.0',
    date: '2026-02-22',
    changes: {
      added: [
        'Added Minimax as a native provider option (Issue #51)',
      ],
    },
  },
  {
    version: '0.22.0',
    date: '2026-02-22',
    changes: {
      fixed: [
        'OpenAI compatible provider now strips <think> tags from Minimax and other providers (Issue #50)',
      ],
    },
  },
  {
    version: '0.19.0',
    date: '2026-02-20',
    changes: {
      added: [
        'HTML artifacts now show thumbnail preview in chat with click-to-expand lightbox',
        'Artifact thumbnails are auto-captured at 300px width during creation',
        'Git work trees are now auto-discovered and shown in workspace list',
        'Workspaces now use git command detection instead of .git folder detection',
        'Images in chat messages are now clickable for full-size preview',
        'Lightbox modal for viewing full-size images in messages',
      ],
      fixed: [
        'Git work trees were incorrectly marked as non-git repositories',
      ],
    },
  },
  {
    version: '0.18.0',
    date: '2026-02-16',
    changes: {
      added: [
        'Added a mandatory Full Execute acknowledgment dialog when switching into Full Execute mode',
        'Assistant turn footer now shows mode and model metadata before completion timing',
      ],
      changed: [
        'Renamed Execute to Full Execute in user-facing UI while keeping the internal execute identifier for compatibility',
        'Mode order is now consistent across selectors and shortcuts: Auto, Full Execute, Plan, Explore, Review',
        'New unsent chats now reset to the saved default mode preference (or Auto when unset)',
        'Mode selection visuals now keep persistent accent highlighting with clearer change-state animation',
      ],
      fixed: [
        'Full Execute permission bypass now applies only while execute mode is active for that stream and no longer changes global Allow All session state',
        'Mode rail corners now render correctly with rounded top corners on welcome/new-chat view and flat top edges in active chat view',
      ],
    },
  },
  {
    version: '0.17.0',
    date: '2026-02-14',
    changes: {
      added: [
        'Spec-driven development framework: workspace scanner detects project specs and injects them as AI context, with new-project guidance in Plan mode',
        'Sidebar collapsed groups now persist across app restarts via localStorage',
        'Provider and model selection now persists across restarts when changed from the chat header',
        'Orphan sub-agent detection and cleanup to prevent leaked background agents',
      ],
      changed: [
        'Artifact filenames shortened to ~33 characters max with 20-char slug cap and word-boundary-aware truncation',
        'Sub-agent system prompt restructured to be concise and directive, preventing report_progress-only loops',
        'Sub-agent retry logic now recognizes filesystem-only research as valid work instead of forcing web retries',
        'Spec-driven keyword matcher uses precise phrases to avoid false positives on casual usage',
      ],
      fixed: [
        'Sub-agents no longer get stuck calling only report_progress — rate-limiting blocks it until real work tools are used',
        'Double-retry amplification eliminated with circuit breaker for failed agents without research work',
        'Stopped streams now preserve sub-agent context so follow-up messages have continuity',
        'Artifact canvas now auto-recovers when files are renamed on disk by searching for the 8-char ID suffix',
        'Generic methodology guidance added to plan/persona prompts to avoid referencing user-specific framework names',
      ],
    },
  },
  {
    version: '0.16.3',
    date: '2026-02-13',
    changes: {
      added: [
        'Introduced a provider-native web adapter service so web search/fetch routes through Anthropic, OpenAI, Google, or OpenRouter capabilities instead of DuckDuckGo scraping',
      ],
      changed: [
        'Main AI web tool policy now enforces sub-agent-first research with bounded direct fallback and stronger wait-for-agent recovery logic',
        'Sub-agent web research now uses adaptive broad-to-focused query planning and richer runtime status metadata for orchestration',
      ],
      fixed: [
        'Improved sub-agent resilience for research tasks with automatic retries, shallow-search detection, and lower-confidence recovery prompts',
        'Hidden internal deferred/direct-limit web gate tool rows from chat output so users only see meaningful actions',
        'Fixed queued message \"Send now\" to run immediately and added per-item queue controls instead of global queue send semantics',
        'Added retry support for unanswered user prompts after interrupted turns without duplicating the user message',
        'Smoothed processing gradients and sidebar thread spacing to reduce abrupt shimmer cutoffs and crowded conversation rows',
      ],
    },
  },
  {
    version: '0.16.2',
    date: '2026-02-13',
    changes: {
      changed: [
        'Tool-call rows now use subtler processing gradients and cleaner in-progress states for improved scanability during long runs',
        'In-chat status rendering now stays anchored above the Todo panel with dynamic spacing as panel height changes',
      ],
      fixed: [
        'Assistant message timestamps now lock to turn start time instead of drifting to the current clock while streaming',
        'Stopped partial responses now preserve the original turn-start timestamp for accurate time tracking',
        'Todo panel now remains visible when all tasks are complete and shows an explicit completion summary',
        'Todo state now persists per conversation across app restarts and can rehydrate from prior todo_write tool history',
      ],
    },
  },
  {
    version: '0.16.1',
    date: '2026-02-13',
    changes: {
      fixed: [
        'Unified top chrome and titlebar-safe-area backgrounds so macOS header bands use consistent contrast',
        'Stabilized mode/input rail geometry and spacing to avoid layout jumps while switching chat and canvas contexts',
        'Expanded Profile tab free-text fields to fill available modal height and removed dead vertical space',
      ],
      changed: [
        'Applied final UI polish pass across pane contrast and spacing for consistent visual rhythm',
      ],
    },
  },
  {
    version: '0.16.0',
    date: '2026-02-13',
    changes: {
      added: [
        'Introduced point-based app/chat/artifact typography controls with live preview cards in Appearance settings',
        'Added global app font sizing shortcuts using double-tap Cmd/Ctrl plus/minus behavior',
      ],
      changed: [
        'Refined font-scaling behavior for header controls, context indicator, prompt actions, and chat text so scaling remains centered and proportional',
        'Updated mode rail and prompt controls to use relative sizing for improved readability at small and large point sizes',
      ],
    },
  },
  {
    version: '0.15.0',
    date: '2026-02-13',
    changes: {
      added: [
        'Added Profile and Appearance tabs with dedicated information architecture in Settings',
        'Added compact, two-column Appearance layout for theme mode, color themes, and typography controls',
      ],
      changed: [
        'Settings modal now keeps a consistent footprint across tabs to avoid jarring resizes while switching settings sections',
      ],
    },
  },
  {
    version: '0.14.1',
    date: '2026-02-13',
    changes: {
      fixed: [
        'Permission approval handling now correctly honors project/session scopes and reduces repeated prompts',
        'Permission dialog copy now better communicates the exact requested capability while simplifying noisy previews',
      ],
      changed: [
        'Permission controls and command palette entry points were reorganized to improve discoverability during active runs',
      ],
    },
  },
  {
    version: '0.14.0',
    date: '2026-02-13',
    changes: {
      added: [
        'Added queued message "Send now" injection so users can steer active AI turns without waiting for turn completion',
        'Added workspace-aware worktree controls in new-chat flows for safer concurrent sessions on shared folders',
      ],
      changed: [
        'Workspace branch visibility moved to top-bar context to reduce selector crowding and improve chat-start clarity',
      ],
    },
  },
  {
    version: '0.13.2',
    date: '2026-02-13',
    changes: {
      fixed: [
        'Todo and clarification state are now conversation-isolated, preventing cross-chat bleed-through when running multiple sessions',
        'Regenerate behavior now clears stale todo/task UI tied to replaced assistant turns',
      ],
      changed: [
        'Todo panel positioning was stabilized to stay pinned in the chat stream area while preserving readable content flow',
      ],
    },
  },
  {
    version: '0.13.1',
    date: '2026-02-13',
    changes: {
      fixed: [
        'Sandbox artifact writes are now strictly conversation-scoped, preventing unintended updates across unrelated sandbox chats',
        'Artifact resolution now respects unique artifact identities across workspace and sandbox boundaries to prevent overwrite collisions',
      ],
    },
  },
  {
    version: '0.13.0',
    date: '2026-02-13',
    changes: {
      added: [
        'Worktree-first project grouping in the sidebar so chats under a shared workspace are organized by project path',
        'Self-selection and auto-detection flow for opening new chats in a worktree when a shared workspace is already in active use',
      ],
      changed: [
        'Workspace and sandbox hierarchy labels were simplified to focus on project names and chat threads without noisy metadata',
      ],
    },
  },
  {
    version: '0.12.2',
    date: '2026-02-09',
    changes: {
      changed: [
        'Builds now always regenerate packaging icons from src/assets/branding/jelico-icon.png before electron-builder runs',
        'CI build workflow now runs icon sync before packaging to prevent stale icon artifacts from being reused',
      ],
      fixed: [
        'Corrected a missed build icon source file so macOS installer/app icons no longer fall back to the old circular J logo',
        'Installer icon outputs are now deterministic across macOS, Windows, and Linux from a single canonical branding source',
      ],
    },
  },
  {
    version: '0.12.1',
    date: '2026-02-09',
    changes: {
      changed: [
        'Build resources now use a single canonical logo source for packaging to prevent cross-platform icon drift',
        'macOS release packaging now uses build/icon.png directly instead of a separate CI icon conversion step',
      ],
      fixed: [
        'Installer and packaged app icons now consistently use the new Jelico logo across macOS, Windows, and Linux artifacts',
        'Removed legacy/duplicate icon assets that could cause old branding to reappear in future release builds',
      ],
    },
  },
  {
    version: '0.12.0',
    date: '2026-02-09',
    changes: {
      added: [
        'Settings now include desktop and sound notification controls with per-event toggles for response completion and clarification requests',
        'Markdown code blocks now include an inline copy button for quick terminal command copying',
        'Clarification requests now open in an app-level modal with independent scrolling and an explicit close action',
        'New branded logo assets and reusable Jelico logo component across onboarding and setup surfaces',
      ],
      changed: [
        'Sub-agent progress now appears inside each spawn-agent tool card instead of a duplicated global status list',
        'Sidebar branding now shows the new Jelico mark next to the app name and welcome logo styling is updated for transparent assets',
        'Context indicator now includes compaction history details and richer usage tooltips',
        'macOS app/menu naming now consistently uses Jelico in development and packaged builds',
      ],
      fixed: [
        'Resolved sub-agent retry loops where research tasks were incorrectly forced to produce file deliverables in read-only modes',
        'Stopping, ending, or failing a stream now deterministically clears stale running sub-agent rows',
        'Clarification dialogs now close cleanly when a stream is stopped and no longer get stuck on screen',
        'Context usage restoration now avoids silent percentage drops by preserving the highest reliable token signal',
      ],
    },
  },
  {
    version: '0.11.2',
    date: '2026-02-07',
    changes: {
      changed: [
        'Assistant turns now preserve interleaved text/tool history after streaming instead of collapsing tools under a separate completed-actions bucket',
        'Sandbox conversation trees now show artifact rows directly with a reveal action and a clear Transfer to Workspace action at the artifact section level',
        'Transfer dialog now always uses explicit folder picking for workspace transfer targets instead of auto-selecting the last active workspace',
      ],
      fixed: [
        'Stopping a streaming turn now marks in-flight tools as canceled and records canceled results, preventing stale running states in chat history',
        'Inline tool protocol tokens are now filtered from streamed assistant text to avoid leaking raw tool-call markers into conversation output',
        'HTML canvas previews now support full interaction in-app via safer storage shims and iframe capability updates',
        'Artifact test open now accepts HTML artifact titles as a fallback and evaluate now returns clearer execution errors and value typing',
      ],
    },
  },
  {
    version: '0.11.1',
    date: '2026-02-06',
    changes: {
      changed: [
        'Update checks are now manual-only from Settings to reduce GitHub API pressure and avoid startup rate-limit noise',
        'Update attention indicator now appears on Settings instead of a dedicated download icon in the header',
      ],
      fixed: [
        'Updates panel now shows explicit status for all outcomes: up to date, update available, or running newer than latest release',
        'Current version now displays immediately from local app metadata without requiring a release API call',
      ],
    },
  },
  {
    version: '0.11.0',
    date: '2026-02-06',
    changes: {
      added: [
        'Artifact testing tool now supports hidden browser sessions for open/click/type/evaluate/extract/wait/screenshot workflows',
        'Regenerate now warns before deleting artifacts created by the last assistant turn',
        'Regenerate impact preview now lists affected artifacts before confirmation',
      ],
      changed: [
        'HTML artifact workflow now requires self-testing by default unless users explicitly ask to skip verification',
        'Artifact verification guidance now enforces requirement-by-requirement pass/fail reporting',
        'Regenerate artifact cleanup now targets artifacts created by the assistant turn instead of broad timestamp-only matching',
      ],
      fixed: [
        'Artifact test open no longer times out after successful loads due to load-event race conditions',
        'Artifact test click now fails when no observable UI change occurs, preventing false-positive validation claims',
        'Artifact test now accepts both snake_case and camelCase session/action parameter aliases',
        'HTML artifact validation now rejects malformed undefined-wrapped attribute values before artifact creation',
      ],
    },
  },
  {
    version: '0.10.1',
    date: '2026-02-05',
    changes: {
      changed: [
        'Header context indicator now uses a circular meter with a subtle dotted ghost ring and accent progress arc',
        'Clicking the context ring now toggles inline "Context: XX%" text, and this visibility preference is remembered globally',
      ],
      fixed: [
        'Conversation context usage now restores after app restart/update instead of resetting to 0%',
        'Message usage stats are now persisted so context restoration uses actual token data when available',
        'Regenerating the last response now removes the replaced assistant message from storage to keep persisted context accurate',
      ],
    },
  },
  {
    version: '0.10.0',
    date: '2026-02-05',
    changes: {
      added: [
        'Double-click on non-interactive app surfaces now toggles the window between maximized and restored states',
        'Click-hold and drag on non-interactive app surfaces now repositions the window',
      ],
      fixed: [
        'Canvas divider drag now stays responsive when cursor passes over preview content such as iframes',
        'Sidebar and header text no longer gets accidentally selected during window drag/maximize interactions',
        'Chat area now ignores window drag/maximize gestures so text selection behaves normally in conversation content',
      ],
    },
  },
  {
    version: '0.9.4',
    date: '2026-02-04',
    changes: {
      fixed: [
        'macOS titlebar spacing now accounts for traffic lights in the sidebar and main chat',
        'Conversation workspace moves now persist and sync with the active workspace',
        'Tool calls with missing parameters now auto-repair instead of hanging',
        'App icons now use the corrected centered glyph across PNG/ICO/ICNS outputs',
      ],
      changed: [
        'Conversation rows show per-artifact Move/Reveal actions instead of a folder icon',
      ],
    },
  },
  {
    version: '0.9.3',
    date: '2026-02-04',
    changes: {
      fixed: [
        'Queued permission requests now surface on renderer startup to prevent tool-call hangs',
        'Workspace selection now updates the active conversation workspace so artifacts route correctly',
      ],
      security: [
        'HTML artifact previews no longer use allow-same-origin, preventing access to the parent app DOM',
      ],
    },
  },
  {
    version: '0.9.2',
    date: '2026-02-03',
    changes: {
      changed: [
        'Release workflow builds once per OS to avoid duplicate artifacts',
      ],
    },
  },
  {
    version: '0.9.1',
    date: '2026-02-03',
    changes: {
      changed: [
        'Release workflow disables implicit electron-builder publishing during build jobs',
        'Release job now declares write permissions for GitHub release creation',
      ],
    },
  },
  {
    version: '0.9.0',
    date: '2026-02-03',
    changes: {
      added: [
        'In-app update checks against GitHub releases on startup',
        'Download updates inside the app with progress tracking',
        'Updates section in Settings and header indicator when an update is available',
      ],
      changed: [
        'CI workflow now uploads installer artifacts from build runs',
      ],
    },
  },
  {
    version: '0.8.21',
    date: '2026-02-03',
    changes: {
      added: [
        'Workspace-based artifact storage - artifacts stored in project directory when workspace active',
        'Sandbox artifact storage - artifacts stored in sandbox when no workspace selected',
      ],
      changed: [
        'Canvas file type label now shows actual type (JavaScript, Python, etc.) not generic "Code"',
        'Artifacts with workspace go to {workspace}/.jelico/artifacts/',
        'Artifacts without workspace go to sandbox/{conversation-id}/artifacts/',
        'Migration updates existing artifacts to proper workspace/sandbox locations',
      ],
    },
  },
  {
    version: '0.8.20',
    date: '2026-02-03',
    changes: {
      changed: [
        'Canvas header now shows Reveal (folder) and Delete (trash) icons',
        'Removed footer panel from Canvas - actions consolidated to header',
        'Document type label shows "Markdown" instead of generic "Document"',
        'Artifact subtitle shows date/time (e.g., "Markdown • Feb 3, 2026, 10:30 AM")',
        'DocumentViewer "Rendered" tab renamed to "Preview" for consistency',
      ],
    },
  },
  {
    version: '0.8.19',
    date: '2026-02-03',
    changes: {
      added: [
        'File-based artifact storage - artifacts now saved as actual files, not JSON blobs',
        'Reveal in folder button - open artifact location in file manager',
        'Download artifact button - save artifacts to user-chosen location',
        'One-time migration - existing artifacts automatically converted to file storage',
      ],
      changed: [
        'Artifact database now stores metadata and file path, not content',
        'Artifacts stored in ~/.config/jelico/artifacts/{conversation-id}/',
        'File extensions determined by artifact type (html, svg, md, code language)',
      ],
    },
  },
  {
    version: '0.8.18',
    date: '2026-02-03',
    changes: {
      added: [
        'Tool failure tracking - sub-agents now track failed tool calls with details',
        'Output quality validation - detects filler text, repetition, and gaming attempts',
        'Finish reason tracking - logs why model stopped for debugging premature completions',
        'Context-aware retry messages - different guidance based on failure type',
      ],
      changed: [
        'Silent retries increased to 10 attempts (was 3), error messages hide attempt count',
        'Quality validation checks for lorem ipsum, excessive generic phrases, low word diversity',
        'Tool struggling detection - agents with 3+ failures get specific recovery guidance',
      ],
      fixed: [
        'Sub-agents outputting filler text to game length requirements',
        'No visibility into why models chose to stop mid-task',
        'Generic error messages exposed internal retry count to users',
      ],
    },
  },
  {
    version: '0.8.17',
    date: '2026-02-02',
    changes: {
      changed: [
        'Sub-agents now have tools DISABLED when forcing summary output',
        'When agent does work but no text, tools are removed to force text-only response',
        'Clearer final message tells agent tools are disabled and to write summary immediately',
      ],
      fixed: [
        'Sub-agents failing because model kept calling tools instead of writing text summary',
        'forceSummaryMode added to agent record to track when tools should be disabled',
      ],
    },
  },
  {
    version: '0.8.16',
    date: '2026-02-02',
    changes: {
      changed: [
        'Sub-agent inline prompt now CRITICALLY requires text output after tool use',
        'Sub-agents explicitly told main AI cannot see their tool call results',
        'Added debug logging to stopStreaming to diagnose lost content on stop',
      ],
      fixed: [
        'Sub-agent prompt was in wrong file (now fixed in inline buildSubAgentSystemPrompt)',
      ],
    },
  },
  {
    version: '0.8.15',
    date: '2026-02-02',
    changes: {
      changed: [
        'Sub-agent prompt now STRONGLY requires text output after any tool use',
        'Sub-agents warned that main AI cannot see their tool results directly',
        'Artifact documentation clarifies create_artifact vs update_artifact usage',
        'Copy button now available on ALL assistant messages (not just latest)',
        'Canvas properly shows artifacts when switching between conversations',
      ],
      fixed: [
        'Sub-agents failing after 3 attempts due to no text summary',
        'Canvas showing stale artifact from previous conversation',
        'MessageActions missing on older assistant messages in conversation',
      ],
    },
  },
  {
    version: '0.8.14',
    date: '2026-02-02',
    changes: {
      added: [
        'Sub-agent status line shows beneath main AI status during streaming',
        'Each running sub-agent displays name and current activity inline',
      ],
      changed: [
        'Tool call labels now show resource names (e.g., "Write File: main.tsx")',
        'Tool call result shown directly when expanded (removed nested collapsible)',
        'Permission dialog simplified: shows action in header, description directly visible',
        'Permission dialog now shows preview content for file writes and commands',
        'Clarification tabs auto-advance to next question after answering (single-select only)',
        'AI now reflects on tool results before continuing (especially after user questions)',
        'Added ask_user_question documentation to tools reference',
        'AI must use ask_user_question for ALL questions (no inline text questions)',
      ],
      fixed: [
        'Prompt files now load correctly from electron/prompts directory',
        'Sub-agents now require text summary after doing any work (not just research)',
        'Auto-continue prompts correctly guide agents to summarize their findings',
      ],
    },
  },
  {
    version: '0.8.13',
    date: '2026-02-02',
    changes: {
      changed: [
        'Permission dialog redesigned with vertical button layout and justification text',
        'Permission options reordered: Allow Once, Allow in Session, Allow in Project, Deny',
        'ClarificationPanel redesigned with tabbed interface (one question per tab)',
        'Added "Additional details" shared textarea to clarification questions',
        'TodoPanel label changed from "Tasks" to "Todo"',
        'Context bar restored to original size (w-40 h-2.5)',
        'Workspace and Model selector backgrounds now match ModeSelector styling',
      ],
      fixed: [
        'Stream timeout overflow causing immediate abort (Infinity → 0 for disabled)',
        'Permission timeout removed entirely (was 60s, now waits indefinitely)',
        'Workspace not persisting when manually changed during conversation',
        'New Chat not resetting workspace to Sandbox',
        'Workspace re-selection no longer causes welcome message reset',
        'Workspace no longer reset when submitting first message',
        'Empty todo items filtered from display',
        '"Other" option in clarification questions now clickable and functional',
      ],
      removed: [
        'Permission request timeout (users have unlimited time to respond)',
        'Stream timeouts (both activity and max timeout disabled)',
      ],
    },
  },
  {
    version: '0.8.4',
    date: '2026-02-02',
    changes: {
      changed: [
        'Context window indicator moved to header (right of model selector)',
        'Click percentage to expand/collapse context bar',
        'Input area now more compact without context indicator',
      ],
    },
  },
  {
    version: '0.8.3',
    date: '2026-02-02',
    changes: {
      changed: [
        'Sub-agent completion detection now recognizes research work (web_search, read_file)',
        'Sub-agents no longer incorrectly told to call create_artifact (they cannot)',
        'Added detailed logging for token usage tracking',
      ],
      fixed: [
        'Stream timeouts removed - long-running agents no longer get killed',
        'Sub-agents with research tasks no longer prematurely marked as failed',
        'Auto-continue messages now give correct guidance for sub-agent capabilities',
      ],
      removed: [
        'Removed 30-second activity timeout (was killing artifact generation)',
        'Removed 10-minute max stream timeout (agents can run as long as needed)',
      ],
    },
  },
  {
    version: '0.8.2',
    date: '2026-02-02',
    changes: {
      changed: [
        'Chat input is now compact (1 line) in chat view, expands as you type',
        'Welcome screen input retains taller 4-line style for discoverability',
      ],
    },
  },
  {
    version: '0.8.1',
    date: '2026-02-02',
    changes: {
      changed: [
        'ClarificationPanel moved inside chat view (sticky bottom, above TodoPanel)',
        'ClarificationPanel redesigned with collapsible TodoPanel-style UI',
        'Clarification questions now show in scrollable container (max 300px)',
        'Progress indicator shows X/Y questions answered with checkmarks',
        'TodoPanel auto-collapses when clarification questions appear',
        'Canvas now auto-collapses when switching to a conversation with no artifacts',
      ],
      fixed: [
        'Regenerate no longer shows duplicate user message in chat',
        'ClarificationPanel no longer overflows without scrollbar',
        'Canvas dot indicator now only shows for current conversation artifacts',
        'New chat now properly closes canvas panel',
      ],
      removed: [
        'Removed 5-minute timeout on ask_user_question - users have unlimited time to answer',
      ],
    },
  },
  {
    version: '0.8.0',
    date: '2026-02-02',
    changes: {
      added: [
        'Soul/memory context now injected into AI prompts (core differentiator enabled!)',
        'External content guardrails for web_fetch/web_search to prevent prompt injection',
        'Tool step limit awareness in system prompt (50 steps max with warning at 40)',
      ],
      changed: [
        'Consolidated persona to single file-based source (deleted 260-line embedded duplicate)',
        'Tool step limit increased from 10 to 50 for complex multi-file tasks',
        'File tools now resolve relative paths against workspace directory',
      ],
      fixed: [
        'Race condition in clarification requests that could cause double resolution',
        'Unbounded tool input accumulation that could exhaust memory (now capped at 10MB)',
        'Missing null check in title generation that could crash on invalid input',
        'Sandbox path escaping vulnerability (Windows paths, nested traversal)',
        'Removed switch_mode instructions for non-existent tool',
      ],
      security: [
        'Sandbox now properly blocks path traversal attacks (C:\\, foo/../../../bar)',
        'Web content wrapped in guardrail markers to prevent injection',
      ],
    },
  },
  {
    version: '0.7.55',
    date: '2026-02-02',
    changes: {
      fixed: [
        'Race condition in clarification requests that could cause double resolution',
        'Unbounded tool input accumulation that could exhaust memory (now capped at 10MB)',
        'Missing null check in title generation that could crash on invalid input',
      ],
    },
  },
  {
    version: '0.7.34',
    date: '2026-02-01',
    changes: {
      fixed: [
        'Sub-agent premature completion now catches ALL missing output cases (not just report_progress)',
        'wait_for_agent now returns explicit "DO NOT CREATE AGAIN" message when artifacts exist',
      ],
    },
  },
  {
    version: '0.7.33',
    date: '2026-02-01',
    changes: {
      changed: [
        'Sub-agent status line uses pulsing braille instead of duplicate spinner',
        'Expanded name pool from 62 to 141 gender-neutral names',
      ],
    },
  },
  {
    version: '0.7.32',
    date: '2026-02-01',
    changes: {
      fixed: [
        'Sub-agent display now uses friendly first names (e.g., "Maya: Creating Wordle")',
      ],
    },
  },
  {
    version: '0.7.31',
    date: '2026-02-01',
    changes: {
      fixed: [
        'Stop button now saves partial response instead of losing it',
        'Sub-agent premature completion detection catches more edge cases',
      ],
      changed: [
        'Sub-agent display simplified to "{Name}: {Task}" format',
        'Artifact creation shows simple indicator instead of streaming content',
        'Console logging significantly reduced for cleaner output',
      ],
    },
  },
  {
    version: '0.7.15',
    date: '2026-01-31',
    changes: {
      added: [
        'Elapsed time display next to status text while AI is working',
        'Specialized sub-agent types: security-review, pr-review with strict read-only enforcement',
        'Sub-agent prompt files: explore.md, plan.md, security-review.md, pr-review.md, general.md',
      ],
      changed: [
        'Tool calls now collapse into "Completed actions" while active tools stay visible',
        'Turn completion shows "Completed in X.Xs" instead of tokens/sec and token counts',
        'Conversation titles in sidebar now word-wrap instead of truncating with ellipsis',
      ],
    },
  },
  {
    version: '0.6.15',
    date: '2026-01-30',
    changes: {
      fixed: [
        'CRITICAL: Tool calls with empty/missing arguments now return errors instead of executing',
        'create_artifact, update_artifact, write_file, execute_command, spawn_agent validate required params',
        'Added debug logging for tool-input-start/end events to trace argument streaming issues',
        'Better handling of tool-input-end event which may contain full args (provider-dependent)',
        'Tools now return clear error messages: "Missing required parameters: X, Y, Z"',
      ],
    },
  },
  {
    version: '0.6.14',
    date: '2026-01-30',
    changes: {
      removed: [
        'switch_mode tool - was causing AI to get distracted instead of doing tasks',
        'Mode is now set by user only, not auto-switched by AI',
      ],
      fixed: [
        'Timeout now shows clear error: "Model stopped responding" instead of silent failure',
        'Inactivity timeout (30s) and max timeout (5min) both notify user with helpful message',
      ],
    },
  },
  {
    version: '0.6.13',
    date: '2026-01-30',
    changes: {
      added: [
        'Live artifact streaming - Canvas opens and shows content as it\'s being generated',
        'StreamingPreview component with auto-scroll and typing cursor animation',
        'HTML artifacts render live in iframe as they stream',
        'Code artifacts show with syntax-aware preview during generation',
      ],
      changed: [
        'Canvas auto-opens when artifact generation starts',
        'Streaming preview clears when actual artifact is created',
        'Status text still shows "Generating artifact... (X.XKB)" in chat view',
      ],
    },
  },
  {
    version: '0.6.12',
    date: '2026-01-30',
    changes: {
      added: [
        'Reasoning/thinking block support for thinking models (Kimi K2.5, o1, o3, etc.)',
        'onReasoning, onReasoningStart, onReasoningEnd IPC events for thinking model UI',
        'isReasoning and reasoningContent state in chat store',
      ],
      fixed: [
        'Text property fallbacks - now checks text, textDelta, content, chunk',
        'Tool property null checks - validates toolCallId, toolName before use',
        'Tool args property fallbacks - checks input, args, arguments, parameters',
        'Tool result property fallbacks - checks output, result, content',
        'Token usage parsing - supports snake_case (prompt_tokens, completion_tokens)',
        'Token usage parsing - supports Google AI fields (promptTokenCount, candidatesTokenCount)',
        'Sub-agent streaming - same fixes applied (text fallbacks, null checks, tool-error)',
        'Sub-agent reasoning blocks - logged but not exposed to UI',
      ],
      changed: [
        'All tool event handlers now use block scope with proper variable naming',
        'Unknown token usage formats now logged for debugging',
      ],
    },
  },
  {
    version: '0.6.11',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Tool error handling - tool-error events now logged and sent to UI',
        'web_search accepts both "query" (string) and "queries" (array) parameters',
        'create_artifact allows extra model fields via passthrough (e.g., artifact_id)',
        'Zod schemas now use passthrough() to handle model-specific extra parameters',
      ],
      added: [
        'accumulatedToolInputByCallId map for cross-request tool input storage',
      ],
    },
  },
  {
    version: '0.6.10',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Tool arguments now work when streamed via tool-input-delta (fixes web_search {}, create_artifact {} with undefined values)',
        'Accumulated tool input is parsed as JSON when tool-call event has empty args',
        'Compatible with models that stream tool arguments separately (Kimi K2.5, etc.)',
      ],
    },
  },
  {
    version: '0.6.9',
    date: '2026-01-30',
    changes: {
      added: [
        'Tool input progress display - shows "Generating artifact... (X.XKB)" during large tool inputs',
        'Activity-based timeout - stream won\'t timeout if there\'s ongoing activity',
      ],
      changed: [
        'Status text "Thinking..." renamed to "Processing..." (clearer for non-thinking models)',
        'Increased max stream timeout to 5 minutes for large artifacts',
        'Activity timeout resets on every stream event (30 second inactivity limit)',
      ],
      fixed: [
        'Large artifact generation (HTML, etc.) no longer times out during streaming',
        'Tool input streaming properly tracked for progress display',
      ],
    },
  },
  {
    version: '0.6.8',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Text streaming now works properly - AI SDK uses "text" property not "textDelta"',
        'Text now streams in real-time instead of appearing all at once at the end',
        'OpenRouter models (and all providers) now stream correctly',
      ],
    },
  },
  {
    version: '0.6.7',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Textarea focus on conversation selection (increased delay, added mount focus)',
      ],
    },
  },
  {
    version: '0.6.6',
    date: '2026-01-30',
    changes: {
      changed: [
        'System prompt: AI must research/search before asking user questions',
        'AI should use web_search when it doesn\'t know something, not ask the user',
        'Only ask user for personal preferences, goals, and decisions they must make',
      ],
    },
  },
  {
    version: '0.6.5',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Braille animation now displays correctly (CSS specificity fix)',
        'Removed duplicate "Thinking" indicator from MessageList',
      ],
      removed: [
        'ThinkingIndicator from MessageList - status line handles this now',
      ],
    },
  },
  {
    version: '0.6.4',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Textarea cursor now appears after deleting a conversation',
        'Auto-focus input when conversation changes',
      ],
    },
  },
  {
    version: '0.6.3',
    date: '2026-01-30',
    changes: {
      removed: [
        'Fake "I\'ll work through this for you" fallback injection - AI MUST respond first naturally',
      ],
      fixed: [
        'AI responses now show actual model behavior, not injected fallbacks',
      ],
    },
  },
  {
    version: '0.6.2',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Status line now appears in chat view as final row (not in input area)',
        'Braille animation displays inline with status text in message flow',
      ],
    },
  },
  {
    version: '0.6.1',
    date: '2026-01-30',
    changes: {
      fixed: [
        'Message ordering - AI acknowledgment now appears BEFORE tool calls, not after',
        'Interleaved message segments - text and tool calls render in arrival order',
      ],
      changed: [
        'Chat store tracks streaming segments to preserve content order',
        'Message component renders segments sequentially during streaming',
      ],
    },
  },
  {
    version: '0.6.0',
    date: '2026-01-30',
    changes: {
      added: [
        'Todo System - AI can now show task progress with accent-colored panel',
        'Three todo tools: todo_write (create/update), todo_read (check state), todo_check (validate task)',
        'Visual task indicators: ☐ pending, ◉ in_progress (animated), ☑ done',
        'Collapsible todo panel with progress counter (e.g., "2/4 completed")',
      ],
      changed: [
        'Todo panel appears between Mode Selector and Chat Input when AI creates tasks',
      ],
    },
  },
  {
    version: '0.5.9',
    date: '2026-01-30',
    changes: {
      added: [
        'Status line completion feedback - shows "✓ Read package.json" briefly when tools complete',
        'Contextual completion messages based on tool type and arguments',
      ],
      fixed: [
        'Mode switch tool parameter name (was "to_mode", now "mode") - UI now updates correctly',
        'Removed confusing checkmark text injection from message content',
      ],
      changed: [
        'Tool completion feedback now appears in shimmer status line, not message text',
      ],
    },
  },
  {
    version: '0.5.8',
    date: '2026-01-30',
    changes: {
      added: [
        'Harness-level tool feedback enforcement - Jelico now GUARANTEES feedback after every tool call',
        'Contextual feedback injection (e.g., "✓ File read.", "✓ Command executed.")',
      ],
      changed: [
        'Tool feedback no longer relies on AI compliance - harness injects if AI doesn\'t respond',
        'Feedback triggers before next tool call starts AND at stream end',
      ],
    },
  },
  {
    version: '0.5.7',
    date: '2026-01-30',
    changes: {
      added: [
        'Mode switching tool - AI can now switch modes dynamically in Auto mode (Plan → Explore → Execute → Review)',
        'Automatic acknowledgment injection - if AI jumps straight to tools, "I\'ll work through this" is shown',
        'One-liner feedback after tool calls - AI reacts to each tool result, not just at the end',
      ],
      changed: [
        'AI persona updated with mode switching workflow and tool reaction guidelines',
      ],
    },
  },
  {
    version: '0.5.6',
    date: '2026-01-30',
    changes: {
      changed: [
        'AI persona strengthened - acknowledgment requirement moved to top of system prompt',
      ],
      fixed: [
        'Resize handle getting stuck when mouse released - listeners no longer re-added on width change',
        'Canvas panel resize now sets proper cursor and disables text selection during drag',
      ],
    },
  },
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
