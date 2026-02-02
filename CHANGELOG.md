# Changelog

All notable changes to Jelico will be documented in this file.

## [0.7.44] - 2026-02-02

### Changed
- **Todo panel complete rework**
  - Moved from above input to sticky bottom of chat message area
  - Claude Code style: simple, clean, collapsible
  - Collapsed view shows current in-progress task
  - Expanded view shows full task list
  - New status types: `failed` (✗ red), `cancelled` (— strikethrough)
  - Status icons: ○ pending, ◉ in_progress, ✓ done, ✗ failed, — cancelled

### Fixed
- **PermissionDialog crash when preview is an object**
  - Now properly stringifies object previews (e.g., package.json)
  - Prevents "Objects are not valid as a React child" error

## [0.7.43] - 2026-02-02

### Added
- **Sidebar date grouping**
  - Conversations organized into Today, Yesterday, Earlier sections
  - Groups based on `updatedAt` timestamp (active old chats bubble up)
  - Empty groups automatically hidden
  - Subtle dividers between date groups

- **Days-old badges**
  - Shows `Xd` badge for conversations 2+ days old (e.g., `3d`, `14d`)
  - Small faint text with tabular-nums for alignment
  - Only appears in Earlier group (Today/Yesterday don't need it)
  - Uses `createdAt` for age calculation

## [0.7.42] - 2026-02-02

### Changed
- **Sub-agent delegation overhaul**
  - Reframed sub-agents as "research team" that handles heavy lifting
  - Added clear WHY to delegate: context drift prevention, token efficiency, model flexibility
  - Explicit WHEN rules: ALWAYS delegate exploration/search/research, do directly only for targeted edits
  - Sibling awareness: sub-agents automatically see what other agents are working on
  - Updated both `modes.ts` (JELICO_PERSONA) and `sub-agents.md` with consistent guidance

### Technical
- Auto-sibling context injection in `subagents.ts` - agents receive context about active siblings
- Framing emphasizes being good stewards of API usage, not wasteful with tokens

## [0.7.41] - 2026-02-02

### Added
- **Sandbox-aware file writing**
  - `write_file` now automatically uses per-conversation sandbox when no workspace is selected
  - Files go to `~/.jelico/sandbox/{conversation-id}/` directory
  - User informed when files are written to sandbox

- **Sandbox files in sidebar**
  - Conversations now show sandbox files in expandable tree (like artifacts)
  - Package icon badge indicates conversations with sandbox files
  - Files limited to 10 with "+N more files" indicator

- **Cross-sandbox search setting**
  - New toggle in Settings > General > Sandbox
  - Disabled by default
  - Warning that AI only searches when user explicitly requests it
  - System prompt enforces the rule that AI must NEVER auto-search other sandboxes

- **Sandbox documentation**
  - New `electron/prompts/capabilities/sandbox.md` prompt file
  - Injected into all AI conversations
  - Documents sandbox behavior and critical cross-sandbox rules

### Changed
- **Artifact versioning notation**
  - Changed from `r1, r2, r3` to `v1, v2, v3` for clearer version indication

- **Greeting system expanded**
  - Now 1500+ unique combinations (up from ~950)
  - Added 2 new tones: `curious` and `playful`
  - Added night-specific questions and statements
  - Added craft/coding-specific questions (14 new)
  - Added 10 special greetings (5% chance, memorable)
  - Improved name personalization with more variety

### Fixed
- **Artifacts not showing on UI load**
  - All artifacts now loaded at startup via `loadArtifacts()` call
  - Sidebar shows artifact badges immediately without clicking conversations

## [0.7.40] - 2026-02-01

### Changed
- **Parallel sub-agent spawning emphasized**
  - Updated prompts to strongly encourage spawning multiple sub-agents simultaneously
  - Added explicit parallel vs serial examples in modes.ts and sub-agents.md
  - Research tasks should spawn agents in parallel for efficiency

## [0.7.39] - 2026-02-01

### Changed
- **Sub-agents are now research-only**
  - Sub-agents can: read files, search, web fetch, gather information
  - Sub-agents cannot: create artifacts (removed create_artifact tool)
  - Main AI creates all artifacts directly using create_artifact
  - Simpler architecture, more reliable artifact creation

- **Updated all prompts for new architecture**
  - JELICO_PERSONA: artifact creation is direct, sub-agents for research
  - sub-agents.md: simplified to research-only role
  - artifacts.md: removed delegation instructions

## [0.7.38] - 2026-02-01

### Fixed
- **Sub-agent name parameter deprecated**
  - Removed name examples from all prompts (was causing "WordleCreator" style names)
  - Names are now always auto-generated with friendly first names
  - Tool description marks `name` parameter as DEPRECATED

- **Premature completion debug logging**
  - Added detailed logging to diagnose sub-agents completing without artifacts
  - Logs tool call names, artifact status, and detection flags

## [0.7.37] - 2026-02-01

### Fixed
- **Summary generation timeout**
  - Added 30-second timeout for post-completion summary generation
  - Prevents main AI from hanging indefinitely after sub-agent completes

## [0.7.36] - 2026-02-01

### Added
- **Artifact summaries in sub-agent results**
  - `wait_for_agent` now returns compact summaries of each artifact created
  - Main AI receives context like: "HTML app (45 lines). Features: buttons, inputs, interactivity"
  - Prevents duplicate creation by giving main AI full awareness of what exists

- **Silent knowledge pre-loading**
  - System automatically injects relevant documentation based on user's message
  - AI receives context without needing to announce "let me check the docs"
  - Matches: artifacts, sub-agents, security review, PR review, tools, etc.

## [0.7.35] - 2026-02-01

### Fixed
- **Simplified artifact ownership prompts**
  - Cleaner wait_for_agent message: `[Artifacts in Canvas: {names} - do not recreate]`
  - Concise sub-agents.md section about artifact ownership (3 lines, not verbose)
  - Brief persona.md reminder to check `artifacts_created` before creating artifacts

## [0.7.34] - 2026-02-01

### Fixed
- **Duplicate artifact creation by main AI**
  - Main AI now receives explicit message when sub-agent creates artifacts
  - Updated system prompts to explain artifacts live in Canvas, not on disk
  - Expanded premature completion detection to catch missing output regardless of report_progress

## [0.7.33] - 2026-02-01

### Fixed
- **Duplicate spinners in sub-agent display**
  - Replaced spinning loader in expanded status with pulsing braille indicator
  - Header spinner is sufficient; expanded view shows pulsing dot instead

### Changed
- **Expanded agent name pool**
  - 141 gender-neutral names (up from 62)
  - Better coverage for conversations with many sub-agents

## [0.7.32] - 2026-02-01

### Fixed
- **Sub-agent display names**
  - Now shows friendly first name from agent store (e.g., "Maya: Creating Wordle")
  - Previously showed internal names like "WordleCreator"

## [0.7.31] - 2026-02-01

### Fixed
- **Stop button losing partial response**
  - Now saves partial content and tool calls before clearing state
  - Shows "(Stopped)" if no content but tool calls were made

- **Sub-agent premature completion detection**
  - Enhanced detection to catch agents that call report_progress without actual output
  - Auto-continues agents that prematurely stop

## [0.7.30] - 2026-02-01

### Fixed
- **Monaco editor going blank during artifact streaming**
  - Added 150ms throttle to artifact preview updates
  - Previously sent updates on every text delta (potentially 100s/second)
  - Final preview sent before lock release to ensure complete content visible

### Changed
- **Sub-agent status indicator**
  - Show spinner instead of "running" badge (redundant with spinner)
  - Only show status badge for completed/failed states

## [0.7.29] - 2026-02-01

### Changed
- **Simplified sub-agent display**
  - Removed Task, Actions, and Result sections from sub-agent panel
  - Now shows only: agent name, status badge, live update, and errors
  - Background details stay between main AI and sub-agents only
  - Cleaner UI that doesn't overwhelm users with internal operations

## [0.7.28] - 2026-02-01

### Added
- **Right-click context menu with spellcheck**
  - Native Chrome-style spellcheck enabled in prompt box and text fields
  - Misspelled words show correction suggestions at top of menu
  - "Add to Dictionary" option for personal words
  - Full editing menu: Undo, Redo, Cut, Copy, Paste, Delete, Select All
  - Link options: Open in browser, Copy link address
  - Works on any text selection (chat messages, code blocks, etc.)

- **ClarificationPanel wired to UI**
  - AI can now ask multiple-choice questions before proceeding
  - Panel appears inline in chat with accent border styling
  - Radio buttons for single-select, checkboxes for multi-select
  - "Other" option with text input for custom answers

### Fixed
- **"Finishing up" status too generic**
  - Now shows specific status based on pending tool (e.g., "Creating artifact...", "Running command...")
  - Falls back to "Running [tool_name]..." for unknown tools
  - Shows "Processing response..." when no specific tool pending

## [0.7.25] - 2026-02-01

### Fixed
- **Monaco editor blank during streaming**
  - Throttled auto-scroll to every 100ms to prevent layout thrashing
  - Use `revealLineNearTop` instead of `revealLine` to keep content visible
  - Fixes the "disappearing content" issue during rapid artifact streaming

- **Sub-agent premature completion after report_progress**
  - Clarified in tool description that reporting is NOT task completion
  - Changed return from `success: true` to `reported: true`
  - Added explicit instruction to continue working after reporting
  - Prevents models from stopping after first progress report

### Added
- **Sidebar QoL improvements**
  - Hover tooltip showing conversation created date
  - Auto-expand artifact tree for active conversation
  - Left accent bar indicator for active chat selection

### Note
- Right-click context menu already works natively in prompt box (no changes needed)

## [0.7.24] - 2026-02-01

### Changed
- **User-friendly status text for all tool calls**
  - No more raw tool names shown in status line (e.g., "Running cancel_agent...")
  - All tools now have human-readable in-progress and completed messages
  - Default fallback changed from "Running {name}..." to "Working..."
  - Default completed fallback changed from "{name} done" to "Done"

- **Shimmer animation scoped to status line only**
  - Removed shimmer/pulse from sub-agent sections
  - Removed animate-pulse from Canvas streaming indicators
  - Only the main status line shimmers during AI turn

- **Elapsed time shows whole seconds only**
  - Changed from "5.3s" to "5s" format
  - No milliseconds or decimals displayed

### Fixed
- **Agent limit errors now handled gracefully**
  - `spawn_agent` catches `AGENT_LIMIT_EXCEEDED` error
  - Returns actionable suggestion instead of crashing
  - Main AI can explain limit to user and request permission

- **[REQUEST] marker now functional**
  - Sub-agents can use `[REQUEST]` to ask for capabilities
  - Was documented but not actually parsed - now added to clarification markers

## [0.7.23] - 2026-02-01

### Added
- **Sub-agent self-reporting via `report_progress` tool**
  - Sub-agents can now report their status to main AI and user in real-time
  - Updates appear in UI as agent works (e.g., "[building] Creating navigation component")
  - Main AI receives progress summary when `wait_for_agent` returns
  - Prevents appearance of "runaway" processes - user always knows what agent is doing

### Changed
- **Sub-agent system prompt** now instructs agents to report progress at natural checkpoints
- **wait_for_agent returns `progress_updates`** - array of all status messages from agent
- **Agent progress events include `latestUpdate`** - forwarded to UI in real-time
- **ToolCallDisplay shows latest status** - inline with agent name when running

## [0.7.22] - 2026-02-01

### Added
- **cancel_agent tool**: Main AI can now cancel stuck or misbehaving sub-agents
  - Immediately aborts running agent
  - Returns clear error if agent already completed
  - Enables recovery when agents hang or loop

### Changed
- **Strengthened main AI persona** (`persona.md`)
  - Added error recovery guidance
  - Systematic approach to sub-agent failures
  - When to retry vs escalate to user
  - Never give up after single failure

- **Enhanced sub-agent orchestration docs** (`sub-agents.md`)
  - Complete rewrite with clearer patterns
  - Explicit decision tree for when to delegate
  - Error handling patterns (timeout, failure, iteration)
  - Structured feedback guidance
  - Best practices for parallel execution

- **Improved sub-agent system prompt**
  - Added time management guidance
  - Graceful completion before timeout
  - What to do when encountering errors
  - Required elements in final response
  - Prioritize working result over perfection

## [0.7.21] - 2026-02-01

### Fixed
- **State isolation when switching conversations**
  - Streaming preview cleared when switching conversations
  - Streaming state (content, tool calls) reset on conversation switch
  - Prevents work from one chat appearing in another

- **Sub-agent display name shown correctly**
  - Shows friendly name like "Maya: Creating Wordle" instead of "WordleCreator"
  - Display name passed from backend through spawn and progress events
  - Agents now tracked per conversation for proper isolation

- **Monaco editor blank on initial render**
  - Added `min-h-0` to flex containers (HtmlViewer, CodeViewer, CanvasPanel)
  - Fixes flexbox height calculation issue that caused Monaco to render with 0 height
  - Editor now appears immediately instead of only after content grows

- **Status line stuck on "Generating spawn_agent"**
  - `toolInputProgress` now cleared when tool completes
  - Status properly updates to show next tool (e.g., "Waiting for sub-agent...")

- **Streaming preview not cleared on error/stop**
  - `streamingPreview` now cleared in `onStreamError` and `stopStreaming`
  - Prevents stale artifact content showing in Canvas after errors

- **Mode transition indicator stuck after conversation switch**
  - Mode transition timeout now tracked and cancelled on conversation switch
  - Prevents orphaned callbacks from updating wrong conversation's state

- **Clarification timeout memory leak**
  - Clarification request timeouts now stored and properly cancelled
  - Timeouts cleaned up when response received, stream stopped, or request handled

### Changed
- **Sub-agent status display simplified**
  - Removed "Working..." text - spinner already indicates activity
  - Status now just shows "running", "completed", "failed"

- **continue_agent documentation improved**
  - Clarifies it only works when agent is NOT running
  - Explains valid statuses: waiting_for_input, completed, failed
  - Warns that calling during "running" status will error

## [0.7.20] - 2026-01-31

### Fixed
- **Canvas panel respects user close during artifact generation**
  - Canvas only auto-opens for NEW artifacts, not on every streaming update
  - If user closes canvas during generation, it stays closed
  - Next NEW artifact will open canvas again
  - Tracks `streamingOpenedFor` to detect when artifact title changes

## [0.7.19] - 2026-01-31

### Fixed
- **Sub-agent completion at stream end**: Increased timeout from 30s to 2min per agent
  - Complex tasks (like artifact generation with large content) now complete properly
  - Logs artifact creation when agents finish

- **Turn summary with sub-agent artifacts**: Summary now includes artifacts created by sub-agents
  - Summary generation triggers if sub-agents were used (even without other tool calls)
  - Artifacts listed with title, type, and which agent created them
  - Fallback summary also includes artifact list

### Changed
- **Updated sub-agents documentation**: Added `artifacts_created` field documentation
  - Clear guidance on checking artifacts after wait_for_agent
  - Added timeout handling section
  - Added summarization best practices

## [0.7.18] - 2026-01-31

### Changed
- **Faster conversation title generation**: Title is now generated immediately when you send your first message
  - No longer waits for AI to finish responding before generating title
  - Runs in parallel with main AI response for quick sidebar update
  - Falls back to user's message text until AI title is ready

## [0.7.17] - 2026-01-31

### Fixed
- **Sub-agent artifact tracking**: Main AI now knows when sub-agents create artifacts
  - `wait_for_agent` and `get_agent_status` return `artifacts_created` field
  - Prevents main AI from saying "the agent didn't create the artifact" when it actually did
  - Each artifact entry includes { title, type }

- **Conversation title truncation**: Removed 50-character limit with "..." on initial titles
  - Titles now use full message text until AI generates a proper short title
  - CSS word-wrap handles display of longer titles in sidebar

### Changed
- Updated `wait_for_agent` tool description to explain artifact detection
- Sub-agents now track created artifacts in their record for reporting

## [0.7.16] - 2026-01-31

### Changed
- **Tool call display improvements**:
  - Tool calls collapsed by default - users click to expand
  - All sub-sections (Task, Actions, Parameters, Result) collapsed by default
  - "Completed actions" section groups finished tools
  - Active tool calls remain visible during streaming

- **Live Output for sub-agents**:
  - Renamed "Live Output" to "Thinking" with animated dots indicator
  - Pulsing accent border to indicate active streaming
  - Auto-scroll to show latest output as sub-agent works
  - Visual distinction from static content

- **Elapsed time display**:
  - Positioned directly next to status text (not right-aligned)
  - Shared `formatElapsedTime()` utility for consistency
  - Supports seconds, minutes, and hours formats (e.g., "45.2s", "2m 30s", "1h 15m")
  - Same formatting used in both streaming status and "Completed in" message

- **Sidebar conversation titles**:
  - Word-wrap enabled for long titles (no more ellipsis truncation)
  - Titles can span multiple lines as needed

### Fixed
- Created `src/utils/format.ts` for shared formatting utilities
- Removed unused clarification imports that caused build errors

## [0.7.15] - 2026-01-31

### Added
- **AskUserQuestion tool**: AI can now ask clarifying questions before proceeding with tasks. Questions appear inline in chat with multiple-choice options plus "Other" for custom input.
  - `ask_user_question` tool with subject, questions (1-4), and options (2-4 per question)
  - Multi-select support for non-mutually-exclusive choices
  - Accent-border styling matching TodoPanel
  - Click-then-submit interaction pattern

### Changed
- **ClarificationPanel component**: New inline UI for AI clarification requests
  - Header: "Clarification required for: {subject}"
  - Radio buttons for single-select, checkboxes for multi-select
  - "Other..." option with expandable text input
  - Submit button enabled only when all questions answered

## [0.7.14] - 2026-01-31

### Changed
- **Enhanced todo documentation**: Added detailed examples of WHEN to use and WHEN NOT to use task tracking (inspired by Claude Code). Includes complete workflow examples, task completion requirements, and common scenarios.
- **Git safety rules**: Added strict git safety protocols to prevent destructive operations without explicit user consent (no force push, no hard reset, no amending without asking, prefer specific file staging).
- **Improved context compaction**: Rewrote summarization template with 10 structured sections (Claude Code-style) for better context preservation across compaction:
  - Primary request and intent
  - Files and code sections with snippets
  - Errors and fixes
  - All user messages (preserved separately)
  - Pending vs completed tasks
  - Current work and next steps

## [0.7.13] - 2026-01-31

### Fixed
- **Todo tools not used**: AI now knows about `todo_write`, `todo_read`, `todo_check` tools and when to use them. Previously the tools existed but weren't mentioned in the system prompt.

### Changed
- **Enhanced persona prompt**: Adopted Claude Code-style guidance:
  - Professional objectivity over validation
  - No time estimates ("this will take 5 minutes")
  - Avoid over-engineering (don't add features beyond what's asked)
  - Clean deletions (remove unused code completely)
  - Security awareness for code changes
- **Task tracking documentation**: Clear guidance on WHEN to use todo tools (3+ step tasks)
- **Tool reference**: Enhanced todo section with workflow examples

## [0.7.12] - 2026-01-31

### Added
- **Random first name sub-agent naming**: Sub-agents now get friendly display names like "Maya: Creating Wordle" or "Kai: Analyzing code" instead of "WordleCreator". Each conversation uses unique names from a pool of 60+ gender-neutral names.
- **Modular prompt system**: System prompts now loaded from `electron/prompts/` directory for easier maintenance and customization:
  - `core/persona.md` - Jelico's personality and behavior guidelines
  - `capabilities/sub-agents.md` - Sub-agent documentation
  - `capabilities/artifacts.md` - Artifact creation documentation
  - `capabilities/tools.md` - Tool reference guide
- **Lean system prompt option**: `buildLeanSystemPrompt()` for minimal context when full docs aren't needed

### Changed
- **Sub-agent system prompt**: Uses the random first name (e.g., "You are Maya...") for more natural interaction
- **Display name generation**: Automatically extracts action from task (Creating, Analyzing, Searching, etc.)

## [0.7.11] - 2026-01-31

### Fixed
- **System prompt sub-agent examples**: Fixed examples that showed `wait_for_agent("AgentName")` - should use `{ agent_id: result.agent_id }`. This was teaching models incorrect API usage.
- **continue_agent example**: Fixed parameter name from `agentId` to `agent_id` and `message` to `response`.

## [0.7.10] - 2026-01-31

### Fixed
- **Stream timeout during sub-agent work**: Increased overall stream timeout from 5 to 10 minutes (`STREAM_TIMEOUT_MS`). Previously the stream would abort while waiting for complex sub-agent artifact generation.
- **Missing agent_id validation**: Added explicit validation for `wait_for_agent` when model sends empty `{}`. Now returns clear error message instead of cryptic "Agent not found".

## [0.7.9] - 2026-01-31

### Changed
- **Hidden wait_for_agent from chat**: The `wait_for_agent` tool call is now hidden from the message stream. The status bar already shows "Waiting for sub-agent..." during this time, so the tool card was redundant.

## [0.7.8] - 2026-01-31

### Fixed
- **Streaming stops on window switch**: Added `backgroundThrottling: false` to prevent Electron from throttling IPC updates when the window loses focus. Artifact streaming now continues updating even when switching to other apps.

### Changed
- **Sub-agent panel auto-expands**: Sub-agent details now automatically expand when the agent is running so you can see progress immediately.
- **Clearer sub-agent expand indicator**: Added "View/Hide" button with chevron to make it obvious the panel is expandable.

## [0.7.7] - 2026-01-31

### Changed
- **Increased wait_for_agent timeout**: Default timeout increased from 60 seconds to 300 seconds (5 minutes) to allow complex artifact generation to complete without premature timeout.

## [0.7.6] - 2026-01-31

### Fixed
- **Stop button now cancels running sub-agents**: When user clicks stop, running sub-agents are immediately cancelled instead of continuing in background.

## [0.7.5] - 2026-01-31

### Fixed
- **Inactivity timeout during wait_for_agent**: Main stream no longer times out while waiting for sub-agent. The `wait_for_agent` tool now keeps the activity timeout alive by resetting it every 10 seconds.
- **Excessive progress notifications**: Sub-agent text-delta events are now throttled to max 1 update per 500ms, preventing IPC flooding that caused UI glitches.
- **Duplicate text on timeout**: Fixed issue where streamed text was sent again after stream timeout/abort.

## [0.7.4] - 2026-01-31

### Changed
- **Removed duplicate "Generating" indicators**: Canvas header already shows generating state, so removed redundant indicators from:
  - MonacoEditor overlay
  - HtmlViewer toolbar
  - CodeViewer toolbar
  - MermaidViewer toolbar
  - DocumentViewer toolbar

## [0.7.3] - 2026-01-31

### Changed
- **Streaming preview header**: Removed file size display ("Generating X KB...") - now just shows "Generating..."

## [0.7.2] - 2026-01-31

### Added
- **Debug logging for sub-agents**: Added comprehensive logging for sub-agent lifecycle events to diagnose completion issues
  - Logs when progress events are forwarded to frontend
  - Logs agent status at stream finish
  - Warns if global callback is missing when agent completes

## [0.7.1] - 2026-01-31

### Fixed
- **Sub-agent completion**: Canvas "Generating" indicator now clears when sub-agent completes without creating an artifact
- **Monaco Editor theme**: Custom Jelico dark theme applied correctly (was showing default light theme)
- **spawn_agent status indicator**: Now shows sub-agent status (running/completed/failed) instead of tool completion status

### Changed
- **"Streaming" renamed to "Generating"**: All UI text now uses "Generating" terminology consistently
- **Sub-agent panel collapsed by default**: Task details start collapsed and can be expanded by user

## [0.7.0] - 2026-01-31

### Added
- **Sub-agent artifact creation**: Sub-agents can now create artifacts that stream to Canvas in real-time
- **Monaco Editor**: Replaced textarea with Monaco Editor for all code/HTML editing with syntax highlighting, auto-complete, and inline validation
- **AI artifact validation**: Backend validation (HTML structure, JS syntax, Mermaid diagram types) before artifact creation
- **Auto-save with validation**: Edits auto-save after 1 second debounce, blocked if Monaco reports errors
- **Diff view**: See line-by-line changes between original and edited artifact content
- **Artifact streaming preview**: Watch artifact content stream in as AI generates it, then switch to preview
- **Sub-agent review workflow**: Main AI validates sub-agent artifacts and can request fixes via continue_agent

### Changed
- **Source tab renamed to Editor**: Reflects that content is now editable
- **Sub-agent system prompt**: Now includes instructions for artifact creation and review process
- **Main AI system prompt**: Instructs delegation of artifact creation to sub-agents for context efficiency

## [0.5.4] - 2026-01-30

### Added
- **Resizable panels**: Chat and artifact pane boundary is now draggable to resize either panel (300-800px range, persisted to localStorage)
- **Artifact versioning**: Revision tracking system (r1, r2, etc.) with dropdown selector in canvas header - only shows when multiple revisions exist
- **Vertical scroll for artifacts**: Content uses scrollbar instead of scaling to fit

### Changed
- **Canvas panel**: Dynamic width instead of fixed, with resize handle between chat and canvas areas
- **Artifact database schema**: Added `base_artifact_id` and `revision` fields for version tracking

### Fixed
- **TypeScript build errors**: Fixed unknown type issues in JSX conditional expressions

## [0.5.3] - 2026-01-30

### Added
- **Artifact content streaming**: Shows raw code/text in real-time while `create_artifact` tool is executing, before switching to the finished artifact view
- **Contextual status messages**: Processing indicator now shows what the AI is actually doing with context from tool arguments (e.g., "Reading .../src/App.tsx", "Running: npm test...", "Creating: Login Component")

### Changed
- **Tool call display hierarchy**: Added visual indentation with vertical connector lines for better readability of tool parameters, results, and sub-agent activities
- **Sub-agent panel**: Reorganized with hierarchical indentation showing Agent → Task → Actions → Result structure
- **Status text variety**: Different status messages for each tool type and phase (Thinking → Responding → tool-specific → Finishing up)

## [0.5.2] - 2026-01-30

### Changed
- **Speech-to-text temporarily disabled**: Hidden microphone settings tab and voice input button due to WASM crashes on Windows ARM64. The onnxruntime-web backend crashes with access violation during transcription. Will revisit when better ARM64 support is available.

## [0.5.1] - 2026-01-30

### Fixed
- **Speech worker CDN loading**: Transformers.js now loads from CDN via dynamic import, fixing bundling issues with Node.js module dependencies
- **Lazy worker spawn**: Worker only spawns when user downloads a model or starts transcription, not on settings page mount
- **Model download feedback**: Added timeout (5 min) and error tracking to prevent silent hangs
- **CSP for audio playback**: Added `media-src 'self' blob:` to allow recorded audio playback
- **Recording data capture**: Added timeslice to MediaRecorder for reliable data collection

## [0.5.0] - 2026-01-30

### Added
- **Cross-platform speech recognition**: Moved from Node.js native modules to Web Worker with WASM backend, enabling local Whisper on Windows ARM64 and all platforms
- **Speech Web Worker**: New `src/workers/speech.worker.ts` runs transformers.js in browser context
- **Speech Client API**: New `src/lib/speechClient.ts` provides clean interface for speech features
- **Microphone test with playback**: Records 3 seconds and plays back to verify hardware works
- **Transcription test with metrics**: Shows processing time, audio length, and realtime speed multiplier

### Changed
- **Separated mic test from transcription test**: Better UX flow - test hardware first, then test model
- **Test Transcription section**: Only appears after downloading a model
- **Recording duration**: Mic test uses 3 seconds, transcription test uses 5 seconds

### Fixed
- **Windows ARM64 speech recognition**: No longer requires native onnxruntime-node or sharp binaries
- **Speech recognition privacy**: All processing remains fully local via WASM

## [0.3.11] - 2026-01-29

### Added
- **Sub-agent limit**: Cap of 30 sub-agents per conversation by default
- **Permission system**: When limit reached, AI must ask user for permission to spawn more
- **IPC handlers**: `getAgentLimit` and `increaseAgentLimit` for managing agent quotas

## [0.3.10] - 2026-01-29

### Added
- **AI-generated conversation titles**: After first exchange, AI generates a meaningful title based on the conversation content

### Fixed
- **Blank chat titles**: Placeholder shows "Pasted text..." or "Image prompt..." while AI title is generated
- Added debug logging to diagnose sub-agent text-delta structure

## [0.3.9] - 2026-01-29

### Fixed
- **Pasted content not showing in user messages**: Fixed two bugs:
  1. `sendMessage` wasn't passing `attachments` to `addMessage`
  2. `MessageData` interface in MessageList was missing `attachments` field

## [0.3.8] - 2026-01-29

### Changed
- **Removed AgentPanel**: Sub-agent status now displays inline under spawn_agent tool calls
- **Spawn agent display**: Shows "Sub-agent: [task]" instead of generic "Spawn Agent" label
- **Artifact links inline**: Created artifacts now show clickable links under create_artifact tool calls (removed sticky footer notification)
- **Message timestamps**: Timestamps appear on hover for all messages
- **Context bar redesign**: Bar now always visible (toggle with click), thicker, positioned left of percentage

### Removed
- AgentPanel component from below chat view
- Sticky "Created: artifact" notifications at bottom of chat

## [0.3.7] - 2026-01-29

### Fixed
- **Pasted content not displayed in user messages**: User message bubbles now show attached/pasted content instead of appearing blank when only attachments were sent

## [0.3.6] - 2026-01-29

### Fixed
- **Sub-agents not spawning**: Fixed "crypto is not defined" error by importing `randomUUID` from Node's crypto module instead of relying on global `crypto` object (Windows compatibility)
- **HTML preview JavaScript not executing**: Updated Content Security Policy to allow inline scripts (`'unsafe-inline'`) and iframe content (`frame-src blob: data:`), enabling interactive HTML artifacts with onclick handlers

## [0.3.5] - 2026-01-29

### Fixed
- Tool call persistence and state management bugs
- Sub-agent completion handling
- Compaction issues

## [0.3.4] - 2026-01-28

### Fixed
- Tool call state management bugs

## [0.3.3] - 2026-01-28

### Added
- Initial sub-agent orchestration system
- HTML artifact preview with sandbox

### Fixed
- Copy button functionality
- Usage stats parsing
- Text alignment issues
