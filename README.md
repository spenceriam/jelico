# Jelico

Jelico is a local-first AI desktop assistant. It's a native Electron app where you chat with AI and the AI can actually do things: read files, run commands, create artifacts, and learn your preferences over time.

<!-- TODO: Replace with a real GIF or screenshot -->
![Jelico app preview](docs/assets/jelico-demo.gif)

## Why Jelico

- Local-first data and conversations (SQLite, stored on your machine)
- Multi-provider AI support (Anthropic, OpenAI, Google, OpenRouter, Ollama, local models)
- Tool calling with visible, persistent tool history
- Artifacts panel for code, documents, HTML previews, SVG, Mermaid, and more
- Memory + "Soul" system that learns your preferences and patterns over time
- Workspace-aware with per-conversation sandboxes

## Quick Start

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Install & Run (Dev)

```bash
npm install
npm run dev
```

The Vite dev server uses port 5173 and will try 5174 if 5173 is in use.

### Build (Production)

```bash
npm run build
```

### Preview (Production Renderer)

```bash
npm run preview
```

## Scripts

- `npm run dev` - Start Vite + Electron dev server
- `npm run build` - Typecheck, build renderer, build Electron app
- `npm run preview` - Preview production renderer
- `npm run build:mac` / `build:win` / `build:linux` – Platform-specific builds

## What’s Included

- **Chat**: Streaming responses with conversation persistence
- **Tool Calling**: File read/write, command execution, and more (displayed in UI)
- **Artifacts**: Persistent outputs shown in the Canvas panel
- **Memory System**: Global/workspace/conversation memory scopes
- **Soul System**: Learns patterns, corrections, and preferences over time
- **Workspaces**: Folder-aware context + sandbox per conversation
- **Multi-Provider**: Swap models per conversation
- **Context Compaction**: Summarizes older chat to save tokens

## Data Storage

- SQLite DB: `{userData}/jelico.db`
- Soul profile: `{userData}/soul.json`
- Sandbox: `{userData}/sandbox/{conversation-id}/`

## Project Structure

```
.
├── electron/          # Electron main process + IPC handlers
├── src/               # React renderer (UI)
├── src/components/    # UI components
├── src/stores/        # Zustand stores
├── src/lib/           # Utilities
├── src/data/          # Static data (changelog, modes)
├── docs/              # Documentation
└── build/             # App icons and build resources
```

## Tech Stack

- Electron
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand
- SQLite (better-sqlite3)
- Vercel AI SDK (multi-provider)

## License

GPL-3.0-or-later. See `LICENSE` for details.

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` for setup, workflow, and guidelines.

## Status

Current version: 0.9.1

If you want a specific section added (installation, contributing, architecture deep dive), tell me what to include.
