# Changelog

All notable changes to Jelico will be documented in this file.

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
