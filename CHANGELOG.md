# Changelog

All notable changes to Jelico will be documented in this file.

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
