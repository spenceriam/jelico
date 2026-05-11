## [0.39.2] - 2026-05-11

### Highlights
- Gemini setup can now find current Gemini 3 models more reliably, including preview models that may not appear in every live API response.
- Alibaba Qwen setup now separates International, US, and China DashScope endpoints, and Test Connection can validate those presets through DashScope's documented chat endpoint when model listing is unavailable.
- Z.ai and other uncommon provider setups now validate more of the real request path before a chat starts.

### Fixed
- **Gemini Model Discovery** - Google model loading now uses the current paginated API and keeps documented Gemini 3 chat models available when live discovery is incomplete.
- **DashScope Region Setup** - Alibaba Qwen presets now use region-specific compatible endpoints, block obvious base URL or model-region mismatches, and fall back to the documented chat endpoint when compatible model listing is unavailable.
- **Manual Provider Models** - Compatible and Z.ai provider setup now preserves manually typed model IDs even when live model discovery returns a different model list.
- **Uncommon Provider Validation** - Z.ai provider setup now checks compatible model/chat endpoints and uses GLM context and output limits so failures surface earlier and with clearer messages.

## [0.39.0] - 2026-03-17

### Highlights
- Jelico can now use built-in and custom skills from `SKILL.md` files and pull in the ones that match your request automatically.
- Soul and memory learning now feed back into prompts more deliberately, with scoped context that stays relevant to the current task.
- You can now back up Jelico to GitHub and restore conversations, soul data, artifacts, sandbox files, and custom skills from that backup.

### New
- **Skills Library** — Jelico now includes a built-in skills shelf plus custom `SKILL.md` support, so reusable instructions can be saved locally and injected when they match what you are asking for.
- **Contextual Learning** — Jelico now remembers scoped preferences and corrections across conversations and workspaces, then uses that memory more carefully in later prompts.
- **GitHub Backup** — You can now send backups to a GitHub repository manually, on change, or on a schedule, then restore that snapshot later.

### Changed
- **Learning Relevance** — Learned memories and soul context are now ranked against the current task so repo-specific guidance can stay available without flooding unrelated prompts.
- **Skills Management UI** — Skills settings now separate built-in skills from custom ones and use a clearer compact layout for browsing and editing.

### Fixed
- **Restore Safety** — Backup restore now validates payloads, limits restored files to Jelico-managed paths, and creates a local safety snapshot before overwriting backup-managed data.
- **Learning Toast Noise** — “Remembered for next time” notices now only appear when Jelico captures a genuinely new learning.

## [0.38.2] - 2026-03-16

### Highlights
- Research and planning turns now show the full todo-plan preview in chat instead of cutting each step off with ellipses.
- Todo completion is more reliable across models and providers, so the last task no longer gets stuck incomplete just because a backend returned a slightly different status word.
- In-progress conversations in the sidebar shimmer again in both dark and light themes, making active chats easier to spot at a glance.

### Fixed
- **Full Plan Preview Text** — Todo-plan previews now keep the full visible text for each listed step instead of truncating every line before it reaches chat.
- **Cross-Provider Todo Completion** — Todo status handling now accepts equivalent completion/progress words from different models and providers, so the existing todo panel reflects the actual completed state more reliably.
- **Sidebar Processing Shimmer** — Conversation rows marked In Progress now restore the animated shimmer treatment in both dark and light mode.

## [0.38.1] - 2026-03-14

### Highlights
- Generic compatible providers no longer borrow a different vendor's large output-token cap just because the model name matches a models.dev entry.
- Streamed chat turns on providers like Nous Research now avoid the unsupported request shape that caused simple prompts to fail before any response text appeared.

### Fixed
- **Compatible Provider Output Caps** — Jelico now skips foreign models.dev output-limit guesses for generic compatible providers unless the provider itself matches by name or endpoint, so unsupported `max_tokens` values are no longer injected into normal streamed chats.

## [0.38.0] - 2026-03-13

### Highlights
- You can now set up more hosted and local providers from dedicated presets and live model lists instead of typing everything manually.
- Provider cards in Settings now show model context and output limits, and you can drag them into your preferred order.
- Supported OpenAI reasoning models now let you save a default reasoning level per provider and override it per conversation.

### New
- **Expanded Provider Setup** — Jelico now includes clearer presets for NVIDIA NIM, Cerebras, Alibaba Qwen, Nous Research, KwaiKat, LM Studio, local servers, and custom endpoints.
- **Reasoning Effort Control** — Supported OpenAI reasoning models now let you choose a provider default reasoning level and adjust it per conversation from the header controls.

### Fixed
- **Provider Limits Reliability** — Compatible providers now fill in context and max-output metadata more reliably even when an endpoint expects a different auth header or catalog metadata is missing.
- **Reasoning Compatibility Guardrails** — Unsupported Extra High reasoning options are no longer sent to incompatible OpenAI models.
- **Prefixed Reasoning Model Detection** — Reasoning controls now stay available for compatible model IDs like `openai/gpt-5.1` and `openai/o3` instead of disappearing when a provider prefixes the model name.
- **Conversation-Specific Reasoning Sends** — Queued and background sends now keep the saved reasoning level for the conversation being sent, so another open chat cannot accidentally change how that turn runs.
- **Default Reasoning Inheritance** — Chats left on the `Default` reasoning option now inherit the provider’s configured default during both active and queued sends instead of silently dropping back to whatever the upstream API chooses.
- **Reasoning Selection Stability** — Explicit `Default` reasoning choices now stay `Default` when provider selections are restored, and deleting an unrelated provider no longer resets the active chat’s selected model or reasoning level.

### Changed
- **Live Model Discovery** — Provider setup and editing now pull model lists from provider APIs and compatible endpoints instead of relying on bundled model lists.
- **Provider Settings Overview** — Settings now keeps its context when you add another provider, shows model limits inline on each provider row, and lets you reorder providers by dragging them.

## [0.37.2] - 2026-03-13

### Highlights
- Light mode once again shows the subtle new-chat background lines across the full empty-chat canvas.
- Light-mode sidebar status groups are color-coded again so In Progress, Waiting for Input, Needs Attention, and Done do not blend into the same surface tone.

### Fixed
- **New Chat Waves in Light Mode** — The muted background wave animation now appears in light mode and spans the full new-chat area instead of only the centered content region.
- **Sidebar Status Color Coding in Light Mode** — Conversation rows in light mode now keep distinct status tinting again so active, waiting, attention, and done chats are easy to scan at a glance.

### Changed
- **Backdrop Motion Treatment** — The new-chat background now uses the intended mirrored floating-path animation while staying understated and respecting reduced-motion settings.

## [0.37.1] - 2026-03-13

### Highlights
- Updates now download to your normal Downloads folder and can restart immediately or automatically after all active AI turns finish.
- macOS updater installs are safer: Jelico now avoids wrong-architecture downloads, respects custom app bundle locations, and no longer replaces the existing app until the new copy is fully staged.
- The light-theme context meter ring is easier to read without changing the overall accent language.

### Fixed
- **Safer macOS Updates** — Intel Macs no longer get pointed at Apple Silicon DMG installers, updates now target the running app bundle location instead of assuming `/Applications`, and a failed macOS update no longer risks removing the currently installed app before the replacement is ready.
- **Safer Windows and Linux Update Apply Flow** — Downloaded installers now use platform-specific apply helpers with better fallback relaunch behavior, preserve legacy user-chosen installer files, and open Linux packages for manual install if privileged install attempts fail.
- **Context Meter Contrast** — The unfilled context ring now stays readable in light mode while keeping the same accent-driven look.

### Changed
- **Update Restart Flow** — Jelico now saves update installers to your default Downloads folder, uses the same restart decision flow in both the app banner and Settings, and waits for all active AI turns to finish before restarting to install.

## [0.37.0] - 2026-03-12

### Highlights
- The new chat screen now has a subtle animated paths backdrop that adds motion without distracting from the greeting, controls, or composer.
- The sidebar now groups chats by status, keeps failed chats marked for attention, and uses inline archive confirmation with toast feedback.
- macOS window docking now works with native drag behavior instead of the old custom drag handling.

### New
- **Animated New Chat Backdrop** — The empty new-chat screen now shows a muted looping paths animation that stays behind the existing layout and respects reduced-motion settings.
- **Chat Status Sections** — Conversations are now grouped under In Progress, Waiting for Input, Needs Attention, and Done so it is easier to track multiple chats inside the same workspace or sandbox.

### Fixed
- **Sidebar Status Accuracy** — Conversations now stay in Waiting for Input when a sub-agent pauses for user input, and old failed sub-agents no longer leave later successful chats stuck under Needs Attention.
- **macOS Docking** — Jelico now cooperates with macOS window docking gestures by using native drag regions in the titlebar and header.

### Changed
- **Archive Confirmation Flow** — Archiving a chat now uses an inline highlighted confirmation state in the sidebar row and a bottom-left toast after completion instead of a separate prompt dialog.

## [0.36.0] - 2026-03-10

### Highlights
- Queued messages now open immediately when added, stay available after restart, and can be managed directly from the queue panel.
- You can now edit or remove queued messages inline, or push one to run next without interrupting the current response.
- The last prompt before the latest AI reply can now be edited directly inside its chat bubble and then regenerated from the updated text and attachments.

### New
- **Queue Message Controls** — Queued messages now have direct inline controls so you can send one immediately when the conversation is idle, prioritize it next while the current response finishes, edit it, or remove it without leaving the queue panel.
- **Inline Prompt Editing Before Regenerate** — The latest user message before the most recent AI turn can now be edited in place inside the chat history, then reused for regenerate.

### Fixed
- **Collapsed Queue Visibility** — Adding a queued message during an active response now opens the queued-messages panel right away so new queued work is visible immediately.
- **Queue Recovery After Restart** — Queued messages now survive app restarts, startup loading, and failed queue handoffs instead of disappearing.
- **Queue Sync After Deletes** — Queued items for permanently deleted chats no longer come back from stale renderer state after a reload or later queue action, in-flight queue reloads no longer overwrite newer queued work after temporary load failures, and startup-time queue deletions no longer get silently restored from older disk state.
- **Queue Recovery After Startup Read Failures** — If the app hits a temporary queue read error during startup, later queue changes no longer overwrite the saved queue with a partial in-memory snapshot.
- **Queued Edit Durability** — Starting to edit a queued message no longer risks deleting it if the app reloads before you save or discard the edit.
- **Queued Message Order** — Editing a queued message no longer changes the order that queued work runs when multiple conversations have interleaved items.
- **Queued Edit Routing** — Editing a queued message now keeps the provider and model it was originally queued with instead of silently retargeting it to the current composer selection.
- **Queued Edit Draft Recovery** — Saving a queued-message edit now returns you to the draft you were already composing instead of clearing it.
- **Queued Edit Conversation Safety** — If you switch chats while a queued edit is still open, the stale edit can no longer be submitted into the wrong conversation during the transition.
- **Queued Edit Reload Safety** — Reloading conversations while a queued message is being edited no longer makes that hidden queue item reappear in the visible queue panel mid-edit.
- **Queued Edit Save Availability** — Saving an edited queued message no longer depends on the current global provider selection, so queue edits stay usable even if the provider picker is temporarily unset.
- **Prompt Edit Streaming Safety** — The last prompt can no longer be edited while a response is actively starting, which avoids saving a different prompt than the one the assistant is already answering.
- **Draft Attachment Removal** — Removing the last unsent attachment now stays removed when you switch chats and come back instead of unexpectedly reappearing in the draft.
- **Regenerate Attachment Loss** — Regenerate now keeps the original prompt attachments instead of resending only the text.

### Changed
- **Queue Panel Polish** — Queued message previews now wrap naturally, use clearer action icons and tooltips, alternate row surfaces for easier scanning, stay consistent across new-chat and active-chat layouts, and let the queued send action reserve the very next runnable turn without stopping the active response.

## [0.35.3] - 2026-03-10

### Highlights
- Light mode now has clearer surface separation across the sidebar, header, chat canvas, and composer so the interface no longer feels washed out.
- Tool-call cards, status text, and running-action shimmer are easier to read while artifact and file actions are in progress.
- Update prompts and titlebar/header surfaces now hold their contrast better in light mode, including the area behind the macOS traffic lights.

### Fixed
- **Light Theme Contrast** — Off-white surfaces in the sidebar, top bar, bottom rail, chat canvas, message bubbles, and update prompts were retuned so panels and actions stay readable without changing the layout.
- **Tool Call Readability** — Tool action titles, in-progress artifact labels, context meter visibility, and processing gradients now remain legible in light mode, including grouped tool rows and sidebar activity states.

### Changed
- **Light Theme Palette** — Accent shades and supporting text colors were adjusted to keep the same visual identity while providing stronger contrast on bright backgrounds.

## [0.35.2] - 2026-03-09

### Highlights
- Kimi coding endpoints that expose provider-specific model names now resolve to the correct model limits instead of falling back to generic provider defaults.
- Large artifact generations on compatible Kimi providers are less likely to truncate when the endpoint uses a service-specific model name such as `kimi-for-coding`.

### Fixed
- **Provider-Specific Kimi Names** — Anthropic-compatible Kimi endpoints that return names like `kimi-for-coding` now map to the correct underlying Kimi model metadata, so Jelico can apply the right context and output limits.
- **Artifact Truncation on Kimi Coding Plans** — Large HTML artifact turns on Kimi coding providers now inherit the expected output cap instead of relying on an opaque provider default when the endpoint uses a provider-defined model name.

### Changed
- **Compatible Model Resolution** — Jelico now uses compatible-provider endpoint metadata together with the selected model name when resolving model capabilities and limits from models.dev.

## [0.35.1] - 2026-03-09

### Highlights
- Artifact and file tool runs that are interrupted by provider stream termination now show provider interruption context instead of looking like a local tool failure.
- Incomplete mutation turns now have a deterministic recovery retry path, reducing stuck artifact/test workflows after partial tool starts.

### Fixed
- **Interrupted Tool Attribution** — When a stream ends after tool input starts but before a final tool result, Jelico now labels the interruption as provider-driven so the failure source is clear.
- **Mutation Turn Recovery** — Artifact and file mutation turns now retry completion validation deterministically after interrupted tool starts, so recovery is no longer skipped just because progress was already visible.

### Changed
- **Completion-Sensitive Streaming** — Artifact/file mutation turns now buffer assistant text while still showing kickoff and tool activity, making retries safer without duplicate narrative output.

# Changelog

All notable changes to Jelico are documented in this file.

## [0.35.0] - 2026-03-04

### Highlights
- You can now archive chats instead of deleting them, then restore them later from an Archived section grouped by project or Sandbox.
- Update handling is now proactive: Jelico checks in the background and shows a bottom-right banner to download or apply updates when ready.
- Chat and tool readability improved with consolidated repeated tool actions, wider single-pane chat layout, and cleaner spacing between assistant text blocks.

### New
- **Content Search Tool** — Jelico can now search file contents directly with regex and return file, line, and snippet matches so it can target reads faster.
- **Capability Profiles** — Provider/model-specific behavior profiles now tune retry, reminder, and delegation behavior for different model strengths.
- **Docs Guide Prompt Routing** — Self-help questions about Jelico now trigger a dedicated docs-guide context path instead of loading full capability docs on every turn.
- **Task Graph Upgrades** — Task tracking now supports owner, dependencies, blocked reason, and history so multi-agent coordination is more reliable.
- **Artifact Screenshot Capture** — The canvas now has a screenshot action that copies to clipboard and auto-attaches `Screenshot-xxxx.png` into chat.

### Fixed
- **Link Opening Behavior** — Clicking links in chat now opens your default system browser instead of an in-app window, preserving web auth sessions.
- **Tool Call Noise** — Consecutive repeated tool calls are now grouped into a single expandable action, including artifact testing chains.
- **Single-Pane Chat Width** — Chat now uses wider desktop space when the canvas is closed, reducing empty margins.
- **Message Spacing** — Assistant response blocks now have clearer vertical separation in dense multi-block turns.
- **Worktree Cleanup Reliability** — Deleting worktree-backed workspaces now removes the underlying worktree and clears stale active workspace references.

### Changed
- **Conversation Deletion Flow** — Delete now archives by default, with explicit restore and permanent-delete controls in the sidebar.
- **Update Flow UX** — Update checks now run at startup and periodically, with toast-style prompts for Download/Apply/Later and release-note access.
- **Worktrunk New-Chat Flow** — Worktree isolation preferences now persist and new-chat wording is clearer for non-Git users.
- **Composer and Queue Polish** — Prompt-box helper text, spacing, and queued-message layout are now more consistent between welcome and active chat screens.
- **Archive Presentation Polish** — Archive age display now uses compact time formats and archive cards better match the muted settings-outline style.
- **Branding Refresh** — Welcome and sidebar branding now use the updated V2 assets, and Windows packaging uses the new multi-size app icon set.

## [0.34.2] - 2026-03-04

### Highlights
- Multi-action responses now keep readable text blocks around tool activity instead of collapsing into a single dense paragraph.
- Worktree cleanup is more reliable: deleted worktrees are removed from recent workspace lists and worktree labels stay consistent.
- Linux update/install targeting is more reliable on modern Ubuntu and other distros through better package selection and dependency metadata.

### Fixed
- **Response Readability Around Actions** — Assistant text now preserves clearer block separation when multiple tool actions run in one turn, so progress updates are easier to follow.
- **Worktree Workspace Cleanup** — Removed worktrees no longer linger in recent workspace lists, and worktree entries now use clearer path-based naming to avoid branch-label confusion.
- **GitHub Issue Lookup Delegation** — Direct GitHub issue and PR lookups are now routed away from web-research sub-agents and toward deterministic GitHub CLI workflows.

### Changed
- **Linux Update Asset Selection** — Linux update recommendations now choose distro-appropriate package formats first (`.deb` for Debian/Ubuntu families and `.rpm` for Fedora/RHEL/SUSE families), with AppImage as fallback.
- **Linux Package Dependencies** — Debian/RPM build dependency lists were refreshed to use modern runtime packages instead of deprecated ones that fail on newer Ubuntu installs.

## [0.34.1] - 2026-03-03

### Highlights
- Prompt input no longer intermittently loses focus after clarification or permission UI flows.
- Long dictated or pasted drafts now maintain a clearer top inset in the prompt box while scrolling.

### Fixed
- **Prompt Focus Reliability** — The app now clears stale window-drag interaction state before new clicks and excludes composer and modal surfaces from drag handling, so the prompt remains clickable and editable.
- **Prompt Top Padding** — Active chat composer spacing was adjusted to preserve visible top breathing room for multi-line dictation and long scrolling drafts.

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
- **Conversation Scope Refinement** — During context-window testing, conversation-linking scope was refined so sandbox chats stay per-conversation and worktree chats stay isolated, while non-worktree workspace chats remain project-linked.

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
