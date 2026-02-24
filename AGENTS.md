# AGENTS.md

## Purpose of Jelico

**What Jelico IS:**

Jelico is a local-first AI desktop assistant. A native app where you chat with AI, and the AI can actually DO things - read your files, run commands, create code artifacts, and learn your preferences over time.

**Core Baseline Features (what users actually do):**

1. **Chat** - User sends a message → AI streams a response. Multi-turn conversations persisted to local database. Switch between conversations in the sidebar.

2. **Tool Calling** - AI executes tools during responses:
   - `read_file` - Read any file content
   - `write_file` - Create/update files
   - `list_directory` - Explore folder structure
   - `search_files` - Find files by pattern
   - `execute_command` - Run terminal commands
   - `create_artifact` / `update_artifact` - Create visual outputs
   - `todo_write` / `todo_read` / `todo_check` - Task tracking for multi-step work
   - Tool calls are displayed in real-time and persisted with messages

3. **Artifacts** - AI creates persistent outputs shown in the Canvas panel:
   - Code (syntax highlighted, downloadable)
   - Documents (markdown rendered)
   - HTML (sandboxed preview)
   - SVG (rendered visually)
   - Mermaid diagrams (flowcharts, sequences, etc.)
   - Artifacts persist per-conversation and survive reload

4. **Memory System** - Facts and context stored across scopes:
   - Global memories (apply everywhere)
   - Workspace memories (apply to specific project)
   - Conversation memories (apply to specific chat)
   - Used to maintain context the AI should "remember"

5. **Soul System** - Learns user patterns over time:
   - Patterns: Observed behaviors (coding style, preferences)
   - Corrections: Mistakes the AI made and how to fix them
   - Preferences: User-stated likes/dislikes
   - Confidence scores decay if not reinforced
   - **CRITICAL**: Soul context should be injected into every AI prompt

6. **Workspaces** - Project folder context:
   - Select a folder as active workspace
   - AI knows the workspace path for file operations
   - Git branch awareness
   - Sandbox mode for no-workspace experimentation

7. **Multi-Provider** - Use any AI provider:
   - Anthropic, OpenAI, Google, OpenRouter, Ollama, local models
   - API keys stored securely in OS keychain
   - Switch providers/models per conversation

8. **Context Compaction** - When context window fills:
   - Summarize old messages to free tokens
   - Preserve recent messages intact
   - Tool call outcomes summarized (not raw JSON)

**What Makes Jelico Different:**

The Soul/Memory system should make Jelico increasingly personalized - it learns YOUR coding style, YOUR preferences, YOUR common mistakes. Every conversation teaches it to help YOU better.

**Current Status:** Soul/Memory systems exist but need verification that they're properly injected into AI prompts.

## Setup commands
- Install dependencies: `npm install`
- Start development server: `npm run dev` (Vite + Electron, check ports 5173/5174)
- Start stable local app (no hot-reload): `npm run dev:stable`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

## Project overview
Jelico is an AI Productivity Desktop built with Electron, React, TypeScript, and Vite. It provides a frictionless AI assistant experience with multi-provider support (Anthropic, OpenAI, Google), workspace management, conversation persistence, and a soul/memory system that learns user patterns and preferences over time.

**Current Version:** 0.33.0

**License:** GNU General Public License v3.0 (GPL-3.0-or-later)
- See LICENSE file in project root
- Copyleft: derivative works must also be GPL-3.0
- Users have freedom to run, study, share, and modify the software

## Development workflow discipline
- **CRITICAL**: NEVER commit or push changes without explicit user approval
- **ALWAYS** ask for user confirmation before any git operations
- **DEBUGGING**: Use console logs and testing to verify fixes before committing
- **WORKFLOW**: Make changes → Test → Get user approval → Then (and only then) commit → Push
- **Branch management**: Only commit to the correct branch
- **Code quality**: Ensure all changes work and are properly tested before seeking approval

## Version Bumping Protocol

**CRITICAL**: AI agents MUST follow this semantic versioning workflow when making releases.

### Semantic Versioning Format

Version numbers follow the format: **MAJOR.MINOR.PATCH** (e.g., 1.2.3)

- **MAJOR** (X.0.0): Breaking changes, API changes, architectural overhauls, database schema migrations
  - Example: 0.1.0 → 1.0.0
- **MINOR** (0.X.0): New features, new components, significant enhancements (backwards compatible)
  - Example: 0.1.0 → 0.2.0
- **PATCH** (0.0.X): Bug fixes, typos, minor tweaks, performance improvements (backwards compatible)
  - Example: 0.1.0 → 0.1.1

### AI Agent Workflow for Version Bumping

**Step 1: Analyze Changes**
Before creating a release, review all changes and categorize them.

**Step 2: Ask User for Confirmation**
Present your analysis to the user and ask for confirmation:
```
Based on the changes, I've identified:
- [List key changes]

I recommend a [PATCH/MINOR/MAJOR] version bump because [reasoning].

Current version: X.Y.Z
Proposed version: X.Y.Z

Does this classification seem correct? Should I proceed with this version bump?
```

**Step 3: Update Changelog**
Before bumping version, update the changelog at `src/data/changelog.ts`:
- Add new entry at the TOP of the changelog array
- Use current date in format "YYYY-MM-DD"
- Categorize changes: added, changed, fixed, removed, security
- Write clear, user-friendly descriptions
- Keep descriptions concise and benefit-focused

**Step 4: Apply Version Bump**
After updating changelog, bump the version:
```bash
npm version patch  # or minor, or major
git push && git push --tags
```

**Step 5: Document in Commit**
- Include version in commit message: `v0.2.0: Add onboarding flow`
- List what changed to justify the bump type

### Decision Tree for AI Agents

**MAJOR bump (X.0.0)** - Use when:
- Changing IPC API signatures
- Restructuring database schema requiring migration
- Changing store schemas in breaking ways
- Removing or renaming public components
- Any change requiring existing data migration

**MINOR bump (0.X.0)** - Use when:
- Adding new feature or component
- Adding new modes or panels
- Significant enhancement to existing feature
- Adding new IPC handlers
- New user-facing functionality

**PATCH bump (0.0.X)** - Use when:
- Fixing bugs or errors
- Correcting typos in UI text
- CSS/styling fixes or adjustments
- Performance optimizations
- Dependency updates (no breaking changes)
- Accessibility improvements

**SKIP version bump** - Use when:
- Updating documentation only (README, AGENTS.md)
- Changing development configurations
- Updating .gitignore or similar tooling files

### Examples

**PATCH: 0.1.0 → 0.1.1**
- "Fix greeting display when no user name set"
- "Correct keyboard shortcut display on Windows"
- "Improve message list scroll performance"

**MINOR: 0.1.0 → 0.2.0**
- "Add onboarding flow with personality capture"
- "Add artifact persistence to database"
- "Add context compaction system"

**MAJOR: 0.5.0 → 1.0.0**
- "Redesign database schema for multi-workspace support"
- "Change IPC API structure for plugin system"
- "Remove deprecated conversation format"

### Verification Commands

```bash
# Check current version
grep '"version"' package.json

# Check if tags exist
git tag -l | tail -5

# View recent version bumps
git log --oneline --grep="version" -10
```

### Human Override

Users can always override AI agent version decisions:
- Manually edit package.json
- Run `npm version X.Y.Z` to set specific version
- AI agents should defer to user judgment when corrected

---

## Architecture

- **Frontend**: React 18 with TypeScript, built with Vite
- **Desktop**: Electron for native desktop experience
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: Zustand stores
- **Database**: SQLite via better-sqlite3 (in Electron main process)
- **AI Integration**: AI SDK v6 with multi-provider support
- **Icons**: Lucide React

## Key directories
- `src/components/` - React components (Chat, Layout, Settings, Onboarding, etc.)
- `src/stores/` - Zustand state stores (chat, providers, ui, workspaces, etc.)
- `src/lib/` - Frontend utilities and helpers
- `src/data/` - Static data (changelog, modes)
- `electron/` - Electron main process code
- `electron/ipc/` - IPC handlers (ai, backup, memory, providers, etc.)
- `electron/services/` - Backend services (database, soul, compaction)
- `electron/lib/` - Shared utilities
- `electron/prompts/` - Modular system prompt files (see below)

## Modular Prompt System

System prompts are loaded from markdown files in `electron/prompts/`:

```
electron/prompts/
├── core/
│   └── persona.md       # Jelico's personality and behavior guidelines
├── capabilities/
│   ├── sub-agents.md    # Sub-agent delegation and orchestration
│   ├── artifacts.md     # Artifact creation documentation
│   ├── sandbox.md       # Per-conversation sandbox behavior
│   ├── spec-driven.md   # Spec-driven development guidance
│   └── tools.md         # Tool reference guide
└── agents/
    └── plan.md          # Plan mode agent reference
```

**Functions in `electron/lib/modes.ts`:**
- `loadPromptFile(category, name)` - Load a single prompt file
- `getCachedPrompt(category, name)` - Load with caching
- `buildSystemPrompt(mode, options)` - Build full system prompt with modular files
- `buildLeanSystemPrompt(mode, options)` - Minimal context version

**Benefits:**
- Easier to maintain and update prompts
- Clear separation of concerns
- Hot-reload friendly for development
- Fallback to embedded prompts if files not found

## Component structure

### Layout Components
- **App.tsx**: Root component, onboarding check, main layout orchestration
- **Header**: Provider selector, settings button, right pane toggle
- **Sidebar**: Conversation history, file tree (collapsed state toggle)
- **CanvasPanel**: Artifact display, code viewer, right pane

### Chat Components
- **ChatArea**: Main chat view, handles new chat UI vs active conversation
- **ChatInput**: Message input with auto-resize, OS-aware shortcuts
- **MessageList**: Renders conversation messages
- **Message**: Individual message display with markdown support

### Onboarding Components
- **WelcomeScreen**: 5-step onboarding flow (name → intentions → preferences → additional → setup)
- **OnboardingFlow**: Orchestrates onboarding state

### Settings Components
- **Settings**: Tabbed settings panel (Providers, General, Backup)
- **BackupSettings**: Export/import data, clear all data

### Mode & Workspace
- **ModeSelector**: Mode switching (Auto, Full Execute, Plan, Explore, Review)
- **WorkspaceSelector**: Folder selection, sandbox mode

## IPC Communication

All main ↔ renderer communication via IPC handlers:

| Namespace | Purpose |
|-----------|---------|
| `window.jelico.ai` | AI chat, streaming, mode analysis |
| `window.jelico.providers` | Provider CRUD operations |
| `window.jelico.conversations` | Conversation management |
| `window.jelico.messages` | Message persistence |
| `window.jelico.artifacts` | Artifact storage |
| `window.jelico.memory` | Memory system |
| `window.jelico.soul` | Soul patterns and preferences |
| `window.jelico.backup` | Backup/restore operations |
| `window.jelico.workspaces` | Workspace management |

## Data storage

- **Database**: `{userData}/jelico.db` - SQLite database
  - Providers, conversations, messages, artifacts, memory, permissions
- **Soul**: `{userData}/soul.json` - Learned patterns and preferences
- **Sandbox**: `{userData}/sandbox/` - Temporary workspace files

## Soul system

The soul system enables Jelico to learn and remember:
- **Patterns**: Learned behaviors with confidence scores (decay over time)
- **Preferences**: User-stated preferences with confidence levels
- **Corrections**: Mistakes and their corrections for learning

Pattern categories: `coding_style`, `communication`, `mistake`, `preference`, `workflow`

## Sub-Agent Orchestration System

Jelico uses a bi-directional sub-agent system for parallel task execution.

### Random First Name Naming
Sub-agents get friendly display names instead of technical names:
- **Before**: "WordleCreator", "CodeAnalyzer", "APIFinder"
- **After**: "Maya: Creating Wordle", "Kai: Analyzing code", "Nova: Searching for APIs"

Features:
- 60+ gender-neutral first names (Aiden, Aria, Blake, Casey, etc.)
- Names are unique within each conversation
- Display name generated from task description (Creating, Analyzing, Searching, etc.)
- Display name shown in UI via `displayName` field (falls back to internal `name`)

### State Isolation
Sub-agents are tied to specific conversations:
- Each agent tracks its `conversationId`
- When switching conversations, streaming preview is cleared
- Streaming state (content, tool calls) reset on conversation switch
- Prevents work from one chat appearing in another

### Architecture
```
┌─────────────────────────────────────────────┐
│              MAIN AI (Orchestrator)          │
│  - Has ALL tools including agent management  │
│  - Spawns sub-agents with specific tasks     │
│  - Waits for sub-agent results               │
│  - Uses results to inform next steps         │
└───────┬─────────────┬─────────────┬─────────┘
        │             │             │
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │  Maya   │   │   Kai   │   │  Nova   │
   │ Limited │   │ Limited │   │ Limited │
   │ Tools   │   │ Tools   │   │ Tools   │
   └────┬────┘   └────┬────┘   └────┬────┘
        └──────── Results ─────────┘
```

### Key Design Principles
1. **Main AI as Orchestrator**: Delegates work, receives summaries, makes decisions
2. **Sub-agents are isolated**: Each has own context, tools, and task focus
3. **Parallel execution**: Multiple agents run simultaneously
4. **Context efficiency**: Main AI gets summaries, not raw data
5. **Bi-directional communication**: Sub-agents can ask questions or request capabilities

### Sub-Agent Tools
Sub-agents automatically get a subset of tools based on mode:
- `read_file`, `list_directory`, `search_files` (always)
- `web_search`, `web_fetch` (always)
- `create_artifact` (always) - creates artifacts that stream to Canvas
- `write_file`, `execute_command` (if mode allows)
- NO agent management tools (prevents recursion)

### Sub-Agent Artifact Creation
Sub-agents can create artifacts that appear in the Canvas panel:
- Content streams in real-time as the sub-agent generates it
- Main AI reviews artifacts for quality and can request fixes
- Multiple artifacts queue up (first gets preview, others wait)

**Workflow:**
1. Main AI delegates artifact creation to sub-agent
2. Sub-agent calls `create_artifact` tool
3. Content streams to Canvas (shows in Editor tab)
4. When complete, switches to Preview tab
5. Main AI reviews artifact (visual + code)
6. If issues found, main AI uses `continue_agent` to request fixes
7. Sub-agent updates artifact, repeat until quality is met

### Communication Patterns
**Sub-agent asking a question:**
```
"I've analyzed the code but found 3 approaches.
[QUESTION] Should I prioritize performance or readability?"
```

**Sub-agent requesting capability:**
```
"I need to create a pull request but don't have GitHub access.
[REQUEST] GitHub MCP access
- What: Need to create PR for these changes
- Why: Complete the implementation workflow
- Alternative: I can provide exact PR details for you to create"
```

### Sub-Agent Status Line
A compact status line shows beneath the main AI status during streaming:
- Each running sub-agent displays its name and current activity
- Indented below main status to show hierarchy
- Shows latest tool or progress update
- Only visible when agents are running for current conversation

**Files:**
- `src/components/Agents/SubAgentStatusLine.tsx` - Inline status component

### Sibling Awareness
Main AI can inform sub-agents about other agents working in parallel:
```javascript
spawn_agent({
  task: "Analyze the API layer",
  siblingContext: "Agent B is analyzing the database layer, Agent C is reviewing tests"
})
```

### When to Use Sub-Agents
- Reading multiple files (parallel reads, summarized results)
- Research tasks (web search, documentation lookup)
- Any task that would add bulk to main AI's context
- Independent subtasks that can run concurrently

## Speech Recognition (Local Whisper)

> **⚠️ CURRENTLY DISABLED**: Speech-to-text is hidden in the UI due to WASM crashes on Windows ARM64. The onnxruntime-web WASM backend crashes with access violation (0xC0000005) during transcription, even with SIMD disabled and WebGL fallback attempted. Will revisit when better ARM64 WASM support is available or native onnxruntime-node ARM64 binaries exist.

Jelico includes local speech-to-text using OpenAI's Whisper models via transformers.js.

### Architecture
```
[User speaks into microphone]
        │
        ▼
[MicrophoneSettings / ChatInput]
        │
    MediaRecorder → WebM audio
        │
    AudioContext → decode to Float32Array (16kHz)
        │
        ▼
[speechClient.ts]
        │
    Web Worker message
        │
        ▼
[speech.worker.ts]
        │
    @xenova/transformers (WASM backend)
        │
    Whisper model inference
        │
        ▼
[Transcription text returned]
```

### Key Design Decisions

1. **Renderer Process, Not Main**: Speech runs in a Web Worker in the renderer (browser context) where WASM works natively, avoiding Node.js native module issues

2. **WASM Backend**: Uses WebAssembly for cross-platform compatibility including Windows ARM64 (no native binaries required)

3. **Separated Tests**:
   - "Test Microphone" = record + playback (validates hardware)
   - "Test Transcription" = record + transcribe (validates model)

4. **Privacy First**: All processing is local - audio never leaves the device

### Files
- `src/workers/speech.worker.ts` - Web Worker running transformers.js
- `src/lib/speechClient.ts` - Client API for managing the worker
- `src/components/Settings/MicrophoneSettings.tsx` - Settings UI
- `src/components/Chat/ChatInput.tsx` - Voice input in chat

### Available Models
- Xenova/whisper-tiny (39MB) - fastest
- Xenova/whisper-base (74MB) - fast
- Xenova/whisper-small (244MB) - medium
- Xenova/whisper-medium (769MB) - slow

Models are downloaded from Hugging Face on first use and cached in browser's IndexedDB.

## Permission System

Jelico protects users from destructive AI actions with an approval workflow.

**Permission Hierarchy:**
1. DENY rules (always win)
2. Session-scoped allows (cleared on Jelico close)
3. Workspace-scoped allows (persisted per project)
4. Global defaults (configurable in Settings)
5. Built-in classifications (safe vs destructive)

**Default Classifications:**
| Action | Default |
|--------|---------|
| Read files | Auto-allow |
| Web search/fetch | Auto-allow |
| Spawn sub-agents | Auto-allow |
| Write/create files | Ask first |
| Modify/delete files | Ask first |
| Shell (safe: git status, ls, npm run) | Auto-allow |
| Shell (destructive: rm, kill, reset --hard) | Ask first |

**Destructive Command Detection:**
- File deletion: `rm`, `rmdir`, `unlink`, `del`
- Git destructive: `reset --hard`, `clean -f`, `push --force`
- Process control: `kill -9`, `pkill`, `taskkill /F`
- Database: `DROP TABLE`, `TRUNCATE`

**Settings > Permissions Tab:**
- "Allow All (This Session)" toggle with warning
- View session permissions
- View workspace permissions
- Pending permission requests are queued in the main process and fetched by the renderer on startup to prevent missed prompts.

**HTML Artifact Preview Safety:**
- HTML previews run in a sandboxed iframe without `allow-same-origin` to prevent access to the parent app DOM.

**Files:**
- `electron/services/permissionChecker.ts` - Core permission checking
- `src/stores/permissions.ts` - Session permission state
- `src/components/Settings/PermissionsSettings.tsx` - Settings UI

## Tool calls and context management

**Tool Call Display (UI):**
- **During streaming:** Active tool calls shown normally with spinner, completed actions collapse into "Completed actions" section
- **After turn:** All tool calls collapse into "Completed actions" (expandable)
- **Elapsed time:** Shown next to status text while streaming (e.g., "(12.3s)")
- **Completion stats:** Shows only "Completed in X.Xs" after turn finishes (no tokens/sec or token counts displayed)

**Tool Call Persistence:**
- Tool calls and results are saved to the database with each message
- When reloading a conversation, full tool history is preserved
- Uses AI SDK's normalized format (works with all providers)

**Context Compaction:**
- Compaction summarizes conversation to save tokens when context window fills
- Tool calls are NOT preserved through compaction (too verbose)
- Instead, the TEXT content describes what tools did
- This allows AI to know "we tried X and it failed" without the full JSON
- Design principle: Summarize outcomes, not raw tool data

## Greeting system

1500+ unique greeting combinations in ChatArea, designed to never repeat:

**Structure:**
- **Question greetings** (70+): Stand alone, including coding-specific questions
- **Statement greetings** (64): Paired with tone-matched follow-ups (51)
- **Special greetings** (10): Rare (5% chance) memorable greetings
- **Distribution**: 55% questions, 40% statements with follow-ups, 5% special

**Time periods:**
- **Morning** (5am-12pm): Fresh, productive greetings
- **Afternoon** (12pm-5pm): Check-in style greetings
- **Evening** (5pm-9pm): Winding down but helpful
- **Night** (9pm-5am): Night owl, coding-specific greetings

**Tones** (for statement+follow-up pairs):
- **Warm**: Welcoming, supportive
- **Energetic**: Action-oriented, ready to build
- **Calm**: Patient, no pressure
- **Curious**: Interested in user's projects
- **Playful**: Code-themed humor ("The compiler awaits")

Greetings personalize with user name when available from soul preferences.

## Sandbox System

Per-conversation sandbox for file creation when no workspace is selected.

**Architecture:**
- Each conversation gets its own sandbox: `~/.jelico/sandbox/{conversation-id}/`
- Files created without a workspace go to the conversation's sandbox
- Sandbox files shown in sidebar under each conversation
- Export button to copy sandbox files to a real directory

**Key Rules:**
- Sandbox is per-conversation (no cross-pollination)
- AI/sub-agents MUST NOT search other sandboxes without explicit user request
- Even with "Allow cross-sandbox search" enabled, user must explicitly ask
- System prompt enforces this rule

**Files:**
- `electron/services/sandbox.ts` - Sandbox directory management
- `electron/ipc/sandbox.ts` - IPC handlers for sandbox operations
- `electron/prompts/capabilities/sandbox.md` - AI rules for sandbox behavior
- `src/stores/sandbox.ts` - Frontend sandbox state
- `src/components/Workspace/WorkspaceSelector.tsx` - Sandbox UI in workspace picker

**Settings:**
- "Allow cross-conversation sandbox search" toggle in Settings > General > Sandbox
- Disabled by default
- Warning that AI only searches when explicitly requested

## Spec-Driven Development

Jelico automatically scans workspaces for project specification documents and injects them as AI context.

**How it works:**
1. On each message, `scanWorkspaceSpecs()` scans the workspace root and common doc directories (`docs/`, `specs/`, `.specs/`, `planning/`, etc.)
2. Detected spec files are prioritized: high (`*spec*`, `*prd*`, `*requirements*`, `*architecture*`), medium (`*plan*`, `*roadmap*`, `*overview*`), low (`README.md`, `TODO.md`)
3. Spec content is injected into the system prompt within a 4000-char budget
4. In **Plan mode** with an empty workspace, the AI offers to create specs; in **Auto mode** it does not push documentation

**Contextual keyword matcher:**
- Fires on specific phrases: "specification doc", "project spec", "create a spec", "spec-driven", etc.
- Loads `capabilities/spec-driven.md` guidance which instructs the AI to **ask before creating** specs

**Files:**
- `electron/services/specScanner.ts` - Workspace scanning and content formatting
- `electron/prompts/capabilities/spec-driven.md` - AI guidance for spec workflows
- `electron/ipc/ai.ts` - Integration point in system prompt pipeline

## Todo System (AI Task Tracking)

The AI can show its work plan to users via a visual task tracker with accent-colored border.

**Tools:**
| Tool | Purpose |
|------|---------|
| `todo_write` | Create/update task list (call at start of multi-step tasks) |
| `todo_read` | Get current task state |
| `todo_check` | Validate working on right task (auto-updates to in_progress) |

**Task Status:**
- `pending` (☐) - Not started yet
- `in_progress` (◉) - Currently working (animated pulse)
- `done` (☑) - Completed (strikethrough text)

**Workflow Example:**
```javascript
// At task start: plan all steps
todo_write({ tasks: [
  { id: "1", text: "Read requirements", status: "pending" },
  { id: "2", text: "Implement feature", status: "pending" },
  { id: "3", text: "Write tests", status: "pending" }
]})

// Before each step: validate and auto-start
todo_check({ taskId: "1" }) // Sets task 1 to in_progress

// After completing: update status
todo_write({ tasks: [
  { id: "1", text: "Read requirements", status: "done" },
  { id: "2", text: "Implement feature", status: "in_progress" },
  { id: "3", text: "Write tests", status: "pending" }
]})
```

**UI Component:**
- Panel appears between Mode Selector and Chat Input
- Only visible when todos exist (otherwise completely hidden)
- Collapsible header shows progress count (e.g., "2/4 completed")
- 2px accent-colored border with glow effect

**Files:**
- `src/stores/todos.ts` - Zustand state management
- `src/components/Todo/TodoPanel.tsx` - UI component
- `electron/ipc/ai.ts` - Tool definitions (todo_write, todo_read, todo_check)

## Progress tracking

- **Phase 1-7 Complete**: Core functionality, UI, artifacts, memory, soul system
- **Phase 8 Complete**: Onboarding flow, backup/restore, versioning
- **Current Focus**: Testing, polish, user feedback integration

## Code style
- TypeScript strict mode enabled
- Functional components with hooks
- Component files use PascalCase naming
- Store files use camelCase naming
- Interfaces exported alongside implementations
- Use design tokens: `text-primary`, `bg-surface`, `accent`, etc.

## Changelog management
- **Location**: `src/data/changelog.ts`
- **Structure**: Array of `ChangelogEntry` objects with version, date, and categorized changes
- **Always update**: Add new entry at TOP of array BEFORE running `npm version`
- **Categories**: added, changed, fixed, removed, security

## User-Friendly Changelog Workflow

**CRITICAL**: Every PR that changes user-facing functionality MUST update both changelogs.

### Two Changelogs

1. **Technical Changelog** (`src/data/changelog.ts`)
   - For developers
   - Includes issue references like `(Fixes #123)`
   - Technical language

2. **User-Friendly Changelog** (`CHANGELOG.md` in repo root)
   - For end users
   - Plain English, no issue numbers
   - Explains what the change means for users
   - Appears as a tab in GitHub repo

### When Creating a PR

**ALWAYS** update `CHANGELOG.md` if your PR:
- Adds a new feature users can see or use
- Fixes a bug users might have experienced
- Changes how something looks or behaves
- Improves performance or reliability

**Format for CHANGELOG.md:**
```markdown
## [X.Y.Z] - YYYY-MM-DD

### New
- **Feature Name** — Plain English description of what it does and why users care.

### Fixed
- **Bug Name** — What was broken and how it's better now.

### Changed
- **Thing Changed** — What changed and how it affects users.
```

**Writing Tips:**
- Use "New" for features, "Fixed" for bugs, "Changed" for improvements/modifications
- Lead with the user benefit: "AI can now..." or "You can now..."
- Avoid technical jargon (no "async functions," "race conditions," etc.)
- Keep it to one sentence per bullet
- Add new versions at the TOP of the file

### Example

**Technical changelog entry:**
```typescript
{
  version: '0.27.0',
  date: '2026-02-23',
  changes: {
    fixed: [
      'Provider/model selector non-interactive when multiple providers configured (Fixes #55)',
    ],
  },
}
```

**User-friendly changelog entry:**
```markdown
## [0.27.0] - 2026-02-23

### Fixed
- **Provider Switching** — The provider and model selector now works reliably when you have multiple providers configured. No more unresponsive dropdowns when switching between AI providers.
```

## Development server notes
- Default port: 5173, automatically tries 5174 if 5173 is in use
- Electron launches after Vite server is ready
- Hot reload enabled for renderer process
- Main process requires restart for changes

## Testing checklist

Before marking work complete:
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] UI renders correctly in Electron
- [ ] IPC handlers respond properly
- [ ] Database operations persist and reload correctly
- [ ] Existing functionality not broken
- [ ] New features work as expected

## Capability Test Prompt

Use this prompt to verify Jelico's core capabilities are working. Feed this to Jelico and verify each test passes:

```
Run these tests in order and report pass/fail for each:

1. TERMINAL: Run `echo "TERMINAL_OK"` and confirm you see the output
2. FILE READ: Read package.json and tell me the version number
3. ARTIFACT TEXT: Create a text artifact with "Hello World"
4. ARTIFACT MARKDOWN: Create a markdown artifact with a heading, bullet list, and code block
5. ARTIFACT TABLE: Create a markdown table with 3 columns and 3 rows
6. ARTIFACT HTML: Create an interactive HTML page with a button that increments a counter when clicked - I will verify the button works
7. SUB-AGENT: Spawn a sub-agent to calculate 15 * 7 and report what result you received back

At the end, give me a summary table: Test | Status | Notes
```

**Expected Results:**
- Tests 1-6 should pass if baseline functionality works
- Test 7 (sub-agents) verifies bi-directional agent communication
- HTML test requires manual verification (click the button, counter should increment)
- Sub-agent test should return "105" as the calculation result

## Environment variables
No environment variables required for basic operation. AI provider API keys are stored in the database and managed via Settings UI.

## Build and deployment
- Production build outputs to `dist/` (renderer) and `dist-electron/` (main process)
- Electron-builder creates platform-specific installers
- Single executable distribution for each platform

## Updates
- Update checks are manual-only via Settings > Updates and use GitHub Releases (latest non-prerelease)
- Updates panel shows Current/Latest versions and explicit status (up to date, update available, local newer)
- Updates can be downloaded inside the app from Settings > Updates
- Update assets come from release installers attached to GitHub Releases

---

## Future Considerations

### Phase C: Skills System

A skills system would allow Jelico to have specialized, invocable behaviors similar to Claude Code's slash commands.

**Concept:**
- Skills are specialized prompts/behaviors invoked via `/skill-name` syntax
- Each skill can have its own prompt, tools, and workflow
- Skills can be user-defined or built-in

**Example Skills:**
```
/commit - Create a well-formatted git commit
/pr - Create a pull request with proper description
/test - Run tests and analyze failures
/refactor - Refactor selected code with explanation
/explain - Explain code in detail
/security-scan - Scan for security vulnerabilities
```

**Implementation Approach:**
1. Create `electron/prompts/skills/` directory for skill prompts
2. Add skill registry in `electron/lib/skills.ts`
3. Parse `/skill-name` from user input
4. Inject skill-specific prompt into system context
5. Optionally spawn dedicated sub-agent for skill execution

**Skill Definition Format:**
```typescript
interface Skill {
  name: string           // e.g., "commit"
  description: string    // Shown in /help
  prompt: string         // Skill-specific instructions
  mode?: AgentMode       // Force mode for skill
  args?: SkillArg[]      // Expected arguments
  userInvocable: boolean // Can user call directly?
}
```

**Files to Create:**
- `electron/prompts/skills/*.md` - Individual skill prompts
- `electron/lib/skills.ts` - Skill registry and invocation
- Update chat input to parse `/` commands

---

### Phase D: System Reminders

System reminders are contextual hints injected into tool results to help the AI make better decisions.

**Concept:**
- After certain tool calls, inject a `<system-reminder>` with contextual guidance
- Reminds AI of capabilities, best practices, or current state
- Does not require full context window (small injection)

**Example Reminders:**

After reading a file:
```xml
<system-reminder>
Consider whether this file requires any follow-up:
- If it imports other files, you may want to read those too
- If it contains tests, check if they pass
- If it has TODO comments, note them for the user
</system-reminder>
```

After multiple tool calls:
```xml
<system-reminder>
The task tools haven't been used recently. Consider using TaskCreate
to track progress on multi-step work. Only use if relevant.
</system-reminder>
```

After file write:
```xml
<system-reminder>
File was modified. Remember to:
- Run relevant tests if they exist
- Check for TypeScript errors if it's a .ts file
- Consider related files that may need updating
</system-reminder>
```

**Implementation Approach:**
1. Create reminder registry with trigger conditions
2. After tool execution, check if reminder should fire
3. Append reminder XML to tool result
4. Rate-limit reminders (don't spam every call)

**Reminder Types:**
- **Capability Reminders**: "You have X tool available for this"
- **Best Practice Reminders**: "Remember to check Y after doing Z"
- **State Reminders**: "Current mode is X, you can/cannot do Y"
- **Progress Reminders**: "Consider updating task status"

**Files to Create:**
- `electron/lib/reminders.ts` - Reminder registry and logic
- `electron/prompts/reminders/*.md` - Reminder templates

---

### Phase E: Multi-Model Architecture

Different models for different tasks - main AI uses a smarter model, sub-agents use faster/cheaper models.

**Concept:**
- Main AI handles complex reasoning, synthesis, user interaction → stronger model
- Sub-agents handle research grunt work (read, search, summarize) → lighter model
- Similar to Claude Code's Opus/Sonnet/Haiku tiering
- Most API providers offer multiple model tiers to leverage

**Model Tier Examples:**

| Provider | Main AI (Smarter) | Sub-Agents (Faster) |
|----------|-------------------|---------------------|
| Z.ai | GLM 4.7 | GLM 4.7-Flash |
| OpenAI | GPT 5.2 | GPT 5.2-mini/nano |
| Anthropic | Claude Opus | Claude Haiku |
| Google | Gemini Ultra | Gemini Flash |

**Future Enhancement - Specialized Models:**
- Coding models vs chat models (e.g., GPT 5.2-codex vs GPT 5.2)
- Route code-heavy tasks to coding-optimized models
- Route general chat/planning to general models

**Implementation Approach:**
1. Add `subAgentModel` setting per provider (separate from main model)
2. Update `spawnAgent` to use sub-agent model from settings
3. Settings UI: "Sub-Agent Model" dropdown per provider
4. Default: same as main model (current behavior)
5. Optional: auto-select lighter tier if available

**Settings Schema:**
```typescript
interface ProviderSettings {
  model: string          // Main AI model
  subAgentModel?: string // Sub-agent model (optional, defaults to main)
  apiKey: string
}
```

**Files to Modify:**
- `src/stores/providers.ts` - Add subAgentModel to provider config
- `src/components/Settings/ProvidersSettings.tsx` - Sub-agent model selector
- `electron/services/subagents.ts` - Use subAgentModel when spawning
- `electron/ipc/ai.ts` - Pass sub-agent model to agent spawn

**Benefits:**
- Cost efficiency: lighter models for research = lower API costs
- Speed: faster models for sub-agents = quicker research cycles
- Quality: main AI keeps strong model for final synthesis
- Flexibility: users choose trade-offs per their budget/needs

---

### Sub-Agent Specialized Types

Current specialized sub-agent types (implemented):

| Mode | Purpose | Capabilities |
|------|---------|--------------|
| `explore` | Fast file search, codebase analysis | Read-only: search, read, list |
| `plan` | Architecture, implementation planning | Read-only: analyze and design |
| `security-review` | Security vulnerability scanning | Read-only: find vulnerabilities |
| `pr-review` | Code review for pull requests | Read + limited execute |
| `execute` | Make changes to files/code | Full access |
| `review` | General code review | Read + limited execute |

**Agent System Prompt Location:**
- **Primary:** `buildSubAgentSystemPrompt()` function in `electron/services/subagents.ts` - This is the ACTUAL prompt used by sub-agents
- **Reference Files:** `electron/prompts/agents/*.md` - Documentation/reference only (NOT loaded by sub-agents)

**IMPORTANT:** Sub-agent prompts are built inline in `buildSubAgentSystemPrompt()`, not loaded from files. To modify sub-agent behavior, edit that function directly.

**Adding New Agent Types:**
1. Add mode to `AgentMode` type in `electron/lib/modes.ts`
2. Update `buildSubAgentSystemPrompt` in `electron/services/subagents.ts` with mode-specific instructions
3. Update `getSubAgentTools` to set appropriate tool access
4. Optionally update `electron/prompts/agents/` files as documentation reference
