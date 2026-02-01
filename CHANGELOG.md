# Changelog

All notable changes to Jelico will be documented in this file.

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
