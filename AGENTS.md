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
- Build for production: `npm run build`
- Preview production build: `npm run preview`

## Project overview
Jelico is an AI Productivity Desktop built with Electron, React, TypeScript, and Vite. It provides a frictionless AI assistant experience with multi-provider support (Anthropic, OpenAI, Google), workspace management, conversation persistence, and a soul/memory system that learns user patterns and preferences over time.

**Current Version:** 0.5.8

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
- **ModeSelector**: Mode switching (Auto, Code, Write, Think, Research)
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
   │ Agent A │   │ Agent B │   │ Agent C │
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
- `write_file`, `execute_command` (if mode allows)
- NO agent management tools (prevents recursion)

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

**Files:**
- `electron/services/permissionChecker.ts` - Core permission checking
- `src/stores/permissions.ts` - Session permission state
- `src/components/Settings/PermissionsSettings.tsx` - Settings UI

## Tool calls and context management

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

800+ unique greeting combinations in ChatArea, designed to never repeat:

**Structure:**
- **Question greetings** (50+): Stand alone, no follow-up needed
- **Statement greetings** (33): Paired with tone-matched follow-ups (27)
- **Distribution**: 60% questions, 40% statements with follow-ups

**Time periods:**
- **Morning** (5am-12pm): Fresh, productive greetings
- **Afternoon** (12pm-5pm): Check-in style greetings
- **Evening** (5pm-9pm): Winding down but helpful
- **Night** (9pm-5am): Calm/warm tone greetings (non-judgmental about late hours)

**Tones** (for statement+follow-up pairs):
- **Warm**: Welcoming, supportive
- **Energetic**: Action-oriented, ready to build
- **Calm**: Patient, no pressure

Greetings personalize with user name when available from soul preferences.

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
