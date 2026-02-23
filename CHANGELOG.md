# Changelog

All notable changes to Jelico are documented in this file.

## [0.31.0] - 2026-02-23

### New
- **Script Runner** — AI can now run Node.js scripts to automate tasks. This lets the AI do things like process multiple files at once, filter data, or chain several actions together before giving you a result. Scripts run in a sandbox with a 10-second timeout and require your permission first.

## [0.30.0] - 2026-02-23

### Fixed
- **Text Wrapping** — Long messages and command output now wrap correctly instead of overflowing horizontally. No more scrolling sideways to read AI responses or terminal output.

## [0.29.0] - 2026-02-23

### Fixed
- **Canvas Resizing** — The divider between chat and canvas now lets you resize more freely. It adapts to your window size and respects the sidebar width, so you can make the canvas as wide as you need (while keeping enough space for chat).

## [0.28.0] - 2026-02-23

### Changed
- **Smaller Text** — Default font size reduced from 14px to 12px. More content fits on screen without scrolling.

## [0.27.0] - 2026-02-23

### Fixed
- **Provider Switching** — The provider and model selector now works reliably when you have multiple providers configured. No more unresponsive dropdowns when switching between AI providers.

## [0.26.0] - 2026-02-23

### Fixed
- **Code Editor** — The code editor in the canvas panel now renders correctly and doesn't get glitchy when you scroll. Monaco editor handles its own scrolling properly now.

## [0.25.0] - 2026-02-23

### New
- **Diff Previews** — When the AI writes or edits a file, you now see a side-by-side diff before the changes are applied. Review what changed before accepting.

## [0.24.0] - 2026-02-22

### New
- **Minimax Support** — Added Minimax as a native provider option. No more workaround needed to use Minimax models.

### Fixed
- **Think Tags** — Minimax and other providers that emit thinking blocks now have those tags stripped automatically. Cleaner responses.

## [0.23.0] - 2026-02-22

### New
- **Image Previews** — Images in chat messages are now clickable. Click to open a full-size lightbox view.

## [0.22.0] - 2026-02-22

### New
- **Git Worktrees** — Jelico now recognizes git worktrees and shows them in your workspace list. Work on multiple branches simultaneously.

## [0.21.0] - 2026-02-22

### New
- **Artifact Thumbnails** — HTML artifacts now show a thumbnail preview in chat. See a mini screenshot before opening the full artifact.

## [0.20.0] - 2026-02-22

### Fixed
- **Todo Persistence** — The built-in todo panel now saves to the database instead of localStorage. Your todos stay in sync across sessions and don't drift.

---

*For technical details and issue references, see the detailed changelog in `src/data/changelog.ts`.*
