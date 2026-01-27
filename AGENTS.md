# AGENTS.md

## Setup commands
- Install dependencies: `npm install`
- Start development server: `npm run dev` (Vite + Electron, check ports 5173/5174)
- Build for production: `npm run build`
- Preview production build: `npm run preview`

## Project overview
Jelico is an AI Productivity Desktop built with Electron, React, TypeScript, and Vite. It provides a frictionless AI assistant experience with multi-provider support (Anthropic, OpenAI, Google), workspace management, conversation persistence, and a soul/memory system that learns user patterns and preferences over time.

**Current Version:** 0.1.0

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

## Greeting system

Time-aware, soulful greetings in ChatArea:
- **Morning** (5am-12pm): Fresh, productive greetings
- **Afternoon** (12pm-5pm): Check-in style greetings
- **Evening** (5pm-9pm): Winding down but helpful
- **Night** (9pm-5am): Generic soulful greetings (non-judgmental about late hours)

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

## Environment variables
No environment variables required for basic operation. AI provider API keys are stored in the database and managed via Settings UI.

## Build and deployment
- Production build outputs to `dist/` (renderer) and `dist-electron/` (main process)
- Electron-builder creates platform-specific installers
- Single executable distribution for each platform
