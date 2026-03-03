# Changelog

All notable changes to Jelico are documented in this file.

## [0.34.0] - 2026-03-03

### Highlights
- Switching to Full Execute during an active response now takes effect immediately for that in-progress turn.
- The prompt box now stays editable in active chats and keeps visible top padding while you edit long, scrolling drafts.
- Context usage no longer appears to reset after branch-switch actions in chat.

### Fixed
- **Mid-Response Full Execute** — Changing from Auto to Full Execute during a running response now immediately stops per-action approval prompts for that stream.
- **Prompt Box Lockups** — The prompt composer no longer intermittently blocks typing in active chats, so drafts remain editable while responses stream.
- **Prompt Scroll Padding** — Long prompt text now retains a clear top inset while scrolling, improving readability and editing comfort.
- **Context Meter Stability** — Context tracking now keeps the highest reliable token signal, preventing branch-related visual drops in context-window percentage.

### Changed
- **Live Stream Mode Sync** — Mode changes in the UI now sync to the active backend stream so runtime tool policy reflects your current mode without waiting for a new turn.

## [0.33.10] - 2026-03-03

### Highlights
- Branch changes made during an active chat now reflect immediately in the header branch badge after successful `git checkout` or `git switch` commands.

### Fixed
- **Live Branch Display During Chat** — When Jelico runs a successful branch switch command in an active chat, the workspace branch label now updates right away instead of showing stale branch context until restart.

## [0.33.9] - 2026-03-03

### Highlights
- Jelico now defaults to a multi-faceted assistant style and only shifts into full engineering rigor when the task is engineering-heavy.
- GitHub issue/PR workflows are now standardized with templates and automated checks for structure, linkage, and emoji-free text.
- Long completion summaries are more readable with improved list spacing and divider layout.

### Fixed
- **Issue and PR Consistency** — Added repository templates so bug and feature requests include the right labels and required context fields by default.
- **GitHub Quality Gates** — Added CI checks that enforce PR section format, required `Fixes #<issue-number>` linkage, and emoji-free PR and commit text.
- **Issue Text Enforcement** — Added issue-style checks that flag emoji use in issue titles/bodies and provide correction guidance.
- **Resume Shortcut Precision** — Resume/restart/continue shortcuts now trigger only on exact command input, preventing accidental matches on longer phrases.

### Changed
- **Adaptive Assistant Behavior** — Jelico now stays general-purpose by default and applies engineer-depth only when a task clearly requires engineering work.
- **GitHub Context Guidance** — GitHub workflow instructions now load automatically on issue/PR/release-style requests to reduce formatting drift.
- **Summary Readability** — Assistant markdown list and divider spacing now renders with better visual separation in dense completion summaries.

## [0.33.8] - 2026-03-02

### Highlights
- Tool actions that ended mid-stream are now labeled as interrupted instead of incorrectly showing as user-canceled.
- Restarting interrupted turns now reliably resumes from the last request, including when you type quick follow-ups like "Resume".

### Fixed
- **Tool Cancellation Accuracy** — Incomplete tool calls at stream end now carry explicit interruption metadata so the UI no longer mislabels them as user cancellations.
- **Interrupted Turn Recovery** — Interrupted turns now keep resumable checkpoints and can deterministically restart from the prior request state.
- **Stream Finish Diagnostics** — Assistant usage metadata now includes provider finish reason details to improve debugging of partial tool runs.

## [0.33.7] - 2026-03-02

### Fixed
- **Single-Turn Streaming Stability** — Assistant responses no longer restart mid-turn and append a second attempt in the same message.
- **Review Prompt Classification** — Long pasted transcripts are now treated as analysis context so review-only requests are not misclassified as edit requests.

### Changed
- **Local Build Scripts** — Removed the standalone local `build:arm64` script. ARM64 release artifacts remain part of GitHub Actions builds.

## [0.33.6] - 2026-02-28

### Fixed
- **Streaming Message Order** — Assistant progress text now appears in the right chronological order with tool activity instead of being delayed and dumped as a late block under completed actions.

### Changed
- **Live Response Flow** — Buffering for completion-sensitive turns is now limited to validation-retry paths, so normal turns stream naturally while tools run.

## [0.33.5] - 2026-02-28

### Fixed
- **Sandbox Artifact Revisions** — Follow-up edits to the same artifact in Sandbox now update the original artifact chain instead of creating duplicate artifact entries.
- **Duplicate App Launches** — Opening Jelico while it is already running now focuses the existing window instead of starting another instance.
- **Background Exit Cleanup** — Closing Jelico now also closes hidden artifact test windows so the app exits cleanly without lingering background processes.

### Changed
- **Shell Color Consistency** — The top bar and bottom chat rail now match the left pane surface color for a consistent UI shell appearance.

## [0.33.4] - 2026-02-28

### Changed
- **Smarter First Response** — The assistant now gives a clearer, more task-aware opening message before running actions, so larger asks feel planned without sounding repetitive.
- **Plan Visibility** — Upfront plan previews now show more of the actual step list for normal-sized tasks, so you see the intended workflow earlier.

### Fixed
- **Streaming Readability** — Progress text no longer gets jammed together around tool activity, improving turn-by-turn readability while the assistant is working.
- **Response Ordering in Copy/History** — Copied assistant output now preserves the real text/tool order from the turn instead of flattening actions out of sequence.
- **Composer Reliability** — The message box remains usable in more edge cases (including new-chat/provider-not-selected flows and post-delete transitions), with draft behavior preserved.
- **Artifact Validation Stability** — HTML artifact validation now avoids false "truncated/unclosed tag" failures caused by script content that looks like HTML tokens.

## [0.33.3] - 2026-02-25

### Fixed
- **Image Attachment Reliability** — Image uploads now preview correctly even when file MIME metadata is incomplete or inconsistent, reducing broken image cards in chat.
- **Artifact Snapshot Timing** — HTML artifact snapshots now wait for render completion and capture the main visual area, so thumbnails better match what you see in the live preview.
- **Thumbnail and Lightbox UX** — Artifact preview cards now use a smaller thumbnail, cleaner presentation, and a clear close button when viewing the expanded image.
- **Artifact Update Visibility** — Updating an existing artifact now also returns preview imagery so create/update workflows stay consistent.
- **False Completion Claims** — When artifact/file edits are requested, completion text is now gated by actual successful tool evidence, with one silent self-repair attempt before returning an error.

## [0.33.2] - 2026-02-24

### Fixed
- **Duplicate Final Summaries** — Assistant turns no longer append a second summary block after a complete response when internal task-tracking tools finish late.
- **End-of-Turn Stability** — Missing wrap-ups are now filled with a deterministic one-time fallback instead of triggering another model-generated summary pass.
- **Response Privacy Boundaries** — Fallback wrap-up text now avoids exposing internal orchestration details so users only see task-relevant outcomes.

## [0.33.1] - 2026-02-24

### Fixed
- **Release Build Stability** — Fixed provider/model TypeScript issues that caused the `v0.33.0` release build jobs to fail.
- **Provider Model Loading** — Provider setup now falls back to an alternate model fetch path when preview model discovery returns no results.
- **Release Pipeline Recovery** — This patch rebases the release tag onto the fixed `main` commit so build and release can complete successfully.

## [0.33.0] - 2026-02-24

### New
- **Provider Controls in Settings** — Provider cards now include inline API test status feedback and clearer validation when model IDs are missing.
- **MiniMax Setup Presets** — Setup now separates MiniMax API and MiniMax Coding Plan paths to reduce configuration mistakes.

### Changed
- **Model Picker UX** — The selected chip now shows model name, dropdown options use `Provider / Model`, and long names wrap better at larger font sizes.
- **Sandbox Tool Scoping** — In sandbox mode, file discovery tools now stay inside the conversation sandbox root instead of scanning the app repository.

### Fixed
- **MiniMax Anthropic Endpoint** — Anthropic-compatible MiniMax requests now normalize correctly to the `/v1/messages` path.
- **Large Tool Payload Stability** — Artifact and file tool-call parsing now better recovers malformed large payloads from model output.
- **Output Truncation Handling** — Runtime output limits now use `models.dev` output metadata with AI SDK v6 `maxOutputTokens`, reducing cut-off responses.
- **Hidden Model Selection** — Hiding the active provider/model now falls back to the next visible option instead of keeping a hidden selection active.

## [0.32.0] - 2026-02-24

### New
- **Provider/Model Selector Refresh** — The model picker now shows cleaner `Provider / Model` choices with a read-only dropdown, better wrapping for long names at larger font sizes, and direct access to Provider settings from the gear icon.
- **Conversation Model Tracking** — Changing the selected provider/model now stays tied to the active conversation so switching chats restores the right provider/model combination.

### Changed
- **Provider Editing in Settings** — The provider edit action now lets you update display name, endpoint URL, and default model in one place.
- **Context Window Source Priority** — Context size lookup now prioritizes `models.dev` data with local caching and automatic refresh behavior at launch.

### Fixed
- **Missing Models in Selector** — Provider/model dropdown no longer renders empty sections for newer provider types; every configured provider now produces a valid selectable option.
- **Long Label Truncation** — Long provider/model strings no longer get cut off with ellipses in the dropdown, preventing ambiguous selections.

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
