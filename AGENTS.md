# AGENTS.md - Jelico AI Agent Guidelines

## Project Overview

Jelico is an AI Productivity Desktop built with Electron, React, TypeScript, and Vite. It provides a frictionless AI assistant experience with multi-provider support, workspace management, and a soul/memory system.

**Current Version:** 0.1.0

---

## Version Bumping Protocol

### Semantic Versioning (MAJOR.MINOR.PATCH)

| Type | When to Use | Examples |
|------|-------------|----------|
| **MAJOR** (X.0.0) | Breaking changes, API changes, architectural overhauls, database schema changes that require migration | Changing IPC API signatures, restructuring store schemas |
| **MINOR** (0.X.0) | New features, new components, significant enhancements (backwards compatible) | Adding new modes, new onboarding flow, new UI panels |
| **PATCH** (0.0.X) | Bug fixes, typos, minor tweaks, performance improvements, styling fixes | Fixing greeting logic, updating dependencies, UI polish |

### Required Workflow

1. **Analyze Changes**: Review all modifications in the current branch
2. **Present Findings**: Summarize changes to user and recommend version bump type
3. **Get Approval**: Wait for explicit user confirmation before proceeding
4. **Update Changelog**: Add entry to `src/data/changelog.ts` BEFORE bumping version
5. **Bump Version**: Run `npm version patch|minor|major` in the feature branch
6. **Commit**: Ensure version bump is committed with clear message

### Critical Rules

- **NEVER bump version without explicit user approval**
- **ALWAYS update changelog before bumping**
- Version bumping occurs within the feature branch PRIOR to creating a pull request
- Include version change in commit message: `v0.2.0: Add onboarding flow`

---

## Git Workflow

### Branch Naming
```
feature/{brief-description}
fix/{brief-description}
refactor/{brief-description}
```

### Commit Messages
- Use imperative mood: "Add feature" not "Added feature"
- Be concise but descriptive
- Reference issues if applicable: `Fix #42: Resolve memory leak`

### Commit Rules

- **NEVER commit without explicit user approval**
- **NEVER push without explicit user approval**
- Stage specific files, avoid `git add -A` or `git add .`
- Run `git status` before committing to verify staged files

---

## Architecture Overview

### Directory Structure
```
jelico/
├── electron/           # Electron main process
│   ├── ipc/           # IPC handlers (ai, backup, memory, etc.)
│   ├── lib/           # Shared utilities
│   └── services/      # Database, soul, compaction services
├── src/               # React renderer process
│   ├── components/    # React components
│   ├── stores/        # Zustand state stores
│   ├── lib/           # Frontend utilities
│   └── data/          # Static data (changelog, modes, etc.)
└── dist-electron/     # Compiled Electron output
```

### Key Technologies
- **Electron**: Desktop application framework
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Zustand**: State management
- **AI SDK v6**: Multi-provider AI integration
- **SQLite (better-sqlite3)**: Local database via electron services

### Data Storage
- **Database**: `{userData}/jelico.db` - Conversations, messages, artifacts, memory
- **Soul**: `{userData}/soul.json` - Learned patterns and preferences
- **Settings**: Managed via database and Zustand stores

---

## Development Commands

```bash
npm run dev      # Start development server (Vite + Electron)
npm run build    # Production build
npm run preview  # Preview production build
```

### Ports
- Development server: 5173 (primary), 5174 (fallback)

---

## Code Standards

### TypeScript
- Use strict mode
- Prefer interfaces over types for object shapes
- Export types alongside implementations

### React
- Functional components with hooks
- Use `useMemo` and `useCallback` for performance
- Keep components focused and composable

### Styling
- Tailwind CSS for all styling
- Use design tokens: `text-primary`, `bg-surface`, `accent`, etc.
- Follow existing patterns in codebase

### IPC Communication
- All main ↔ renderer communication via IPC handlers
- Handlers defined in `electron/ipc/`
- Exposed to renderer via `electron/preload.ts`
- Accessed in React via `window.jelico.*`

---

## AI Provider Support

Jelico supports multiple AI providers:
- **Anthropic** (Claude models)
- **OpenAI** (GPT models)
- **Google** (Gemini models)

Provider configuration stored in database, managed via Settings UI.

---

## Soul System

The soul system enables Jelico to learn and remember:
- **Patterns**: Learned behaviors with confidence scores
- **Preferences**: User-stated preferences
- **Corrections**: Mistakes and their corrections

Patterns decay over time if not reinforced. Confidence thresholds determine when patterns are applied.

---

## Testing Checklist

Before marking work complete:
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] UI renders correctly
- [ ] IPC handlers respond properly
- [ ] Database operations persist correctly
- [ ] Existing functionality not broken
