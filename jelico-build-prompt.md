# Jelico Build Prompt — Plan Mode

## Project Setup

Initialize a new private GitHub repository called `jelico`. This is an Electron-based AI productivity desktop application that combines the best of Claude Desktop, Open WebUI, and agentic coding tools like Claude Code/OpenCode.

## Reference Materials

The following files contain the complete specification and UI mockups:

**Specifications:**
- `docs/jelico-ux-guide.md` — Complete UX specification with user flows, interactions, keyboard shortcuts
- `docs/jelico-clean-mockups.md` — Text-based UI mockups (vanilla Claude.ai/Open WebUI style)

**HTML Mockups (working examples of the design):**
- `mockups/01-main-interface.html` — Main app layout with sidebar, chat, artifacts panel
- `mockups/02-provider-setup.html` — First-launch provider selection and configuration
- `mockups/03-dialogs-overlays.html` — Command palette, spawn agent dialog, agent detail view
- `mockups/04-mcp-settings.html` — MCP server configuration settings

The design should feel like **Claude.ai or Open WebUI with functional additions** — clean, minimal, system fonts, not over-designed. One subtle accent color (amber), everything else is grays.

---

## Core Architecture

### Tech Stack
- **Framework:** Electron + React (Vite)
- **State:** Zustand
- **Styling:** Tailwind CSS
- **AI SDK:** Vercel AI SDK (supports multiple providers)
- **Database:** SQLite via better-sqlite3 (conversations, settings)
- **Keychain:** keytar (secure API key storage)
- **MCP:** @modelcontextprotocol/sdk

### Directory Structure
```
jelico/
├── electron/
│   ├── main.ts              # Main process
│   ├── preload.ts           # Preload script
│   ├── ipc/                  # IPC handlers
│   │   ├── providers.ts     # Provider management
│   │   ├── conversations.ts # Chat persistence
│   │   ├── mcp.ts           # MCP server lifecycle
│   │   ├── git.ts           # Git/worktree operations
│   │   └── agents.ts        # Sub-agent management
│   └── services/
│       ├── database.ts      # SQLite operations
│       ├── keychain.ts      # Secure credential storage
│       └── mcp-manager.ts   # MCP server process management
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── Sidebar/
│   │   ├── Chat/
│   │   ├── Canvas/
│   │   ├── Header/
│   │   ├── ModeSelector/
│   │   ├── CommandPalette/
│   │   ├── Dialogs/
│   │   └── Settings/
│   ├── stores/
│   │   ├── chat.ts
│   │   ├── providers.ts
│   │   ├── agents.ts
│   │   ├── workspace.ts
│   │   └── ui.ts
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useProviders.ts
│   │   ├── useMCP.ts
│   │   └── useKeyboard.ts
│   ├── lib/
│   │   ├── ai.ts            # Vercel AI SDK wrapper
│   │   ├── tools.ts         # Tool definitions
│   │   └── mcp-client.ts    # MCP client
│   └── styles/
│       └── globals.css
├── docs/
│   ├── jelico-ux-guide.md
│   └── jelico-clean-mockups.md
├── mockups/
│   └── *.html
└── package.json
```

---

## Feature Implementation Plan

### Phase 1: Foundation
1. **Electron Shell**
   - Main/renderer process setup
   - IPC bridge for all native operations
   - Window management (remember size/position)

2. **Provider System**
   - Provider configuration UI (first-launch flow)
   - Secure API key storage via keytar
   - Provider registry supporting: Anthropic, OpenAI, Google, Ollama, OpenRouter, custom OpenAI-compatible
   - Model listing per provider

3. **Basic Chat**
   - Message input with markdown support
   - Streaming responses via Vercel AI SDK
   - Conversation persistence (SQLite)
   - Conversation list in sidebar

### Phase 2: Core Features
4. **Mode System**
   - Five modes: Auto, Explore, Execute, Plan, Review
   - Mode selector in header (tab key to cycle)
   - Mode affects system prompt and available tools
   - Persist mode per workspace

5. **MCP Integration**
   - Built-in servers: Filesystem, Git
   - MCP server lifecycle management
   - Tool execution in chat
   - Tool results display (collapsible)
   - Custom server configuration UI

6. **Artifacts/Canvas**
   - Detect code blocks in responses
   - Split view: Chat | Canvas
   - File tabs for multi-file artifacts
   - Code view with syntax highlighting
   - Preview for HTML/React/Mermaid/SVG
   - Version history with diff

### Phase 3: Workspace & Git
7. **Workspace Management**
   - Open folder as workspace
   - Workspace selector in sidebar
   - Recent workspaces

8. **Git Worktrees**
   - Worktree tabs in header
   - Create/switch/delete worktrees
   - Merge dialog with options
   - Visual indicator for agent worktrees

### Phase 4: Agents
9. **Sub-Agent System**
   - Spawn agent dialog (name, task, skills, options)
   - Agent runs in background with own context
   - Agent sidebar showing active agents
   - Agent detail view (progress, stats, activity log)
   - Agent completion merges results to main chat
   - Optional: agent gets own worktree for code changes

10. **Skills System**
    - Built-in skills: Writer, Researcher, Coder, Analyst, Planner
    - Skills affect system prompt and tool availability
    - Auto-activate skills based on task detection
    - Manual skill selection in spawn dialog

### Phase 5: Polish
11. **Command Palette**
    - ⌘K to open
    - Fuzzy search all commands
    - Keyboard shortcuts displayed
    - Recent commands

12. **Keyboard Shortcuts**
    - Full keyboard navigation
    - Customizable shortcuts
    - Shortcuts reference panel

13. **Settings**
    - General (theme, font size)
    - Providers management
    - MCP servers
    - Keyboard shortcuts
    - Privacy settings

---

## Mode Definitions

Each mode sets a different system prompt prefix and enables/disables tools:

| Mode | Purpose | Tools |
|------|---------|-------|
| Auto | AI decides approach | All |
| Explore | Read-only understanding | Read-only (no writes) |
| Execute | Full tool access | All |
| Plan | Strategic planning | Read-only + planning tools |
| Review | QA and improvements | All + review-specific |

---

## Data Models

### Provider
```typescript
interface Provider {
  id: string;
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom';
  name: string;
  baseUrl?: string;
  defaultModel: string;
  models: Model[];
  isDefault: boolean;
}
```

### Conversation
```typescript
interface Conversation {
  id: string;
  title: string;
  workspaceId?: string;
  messages: Message[];
  mode: Mode;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Agent
```typescript
interface Agent {
  id: string;
  name: string;
  task: string;
  skills: Skill[];
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  steps: AgentStep[];
  worktreeId?: string;
  tokensUsed: { input: number; output: number };
  startedAt: Date;
  completedAt?: Date;
}
```

### MCPServer
```typescript
interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  tools: MCPTool[];
  isBuiltIn: boolean;
  isEnabled: boolean;
  status: 'running' | 'stopped' | 'error';
}
```

---

## Key Implementation Details

### Vercel AI SDK Usage
```typescript
import { generateText, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

// Dynamic provider selection
const getProvider = (providerId: string) => {
  const config = getProviderConfig(providerId);
  switch (config.type) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey });
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    // ... etc
  }
};
```

### MCP Tool Execution
```typescript
// Convert MCP tools to Vercel AI SDK tool format
const mcpToolsToAITools = (mcpTools: MCPTool[]) => {
  return mcpTools.reduce((acc, tool) => {
    acc[tool.name] = {
      description: tool.description,
      parameters: tool.inputSchema,
      execute: async (args) => {
        return await mcpClient.callTool(tool.name, args);
      }
    };
    return acc;
  }, {});
};
```

### Agent Background Execution
```typescript
// Agents run as separate chat contexts
const runAgent = async (agent: Agent) => {
  const systemPrompt = buildAgentPrompt(agent.task, agent.skills);
  
  while (agent.status === 'running') {
    const result = await streamText({
      model: getModel(agent.model),
      system: systemPrompt,
      messages: agent.messages,
      tools: getToolsForSkills(agent.skills),
      onToolCall: (call) => updateAgentActivity(agent.id, call),
    });
    
    // Update progress, check for completion
    updateAgentProgress(agent.id, result);
  }
};
```

---

## Design Tokens (from mockups)

```css
:root {
  /* Backgrounds */
  --bg: #1a1a1a;
  --surface: #252525;
  --surface-hover: #2f2f2f;
  
  /* Borders */
  --border: #333;
  
  /* Text */
  --text: #e5e5e5;
  --text-secondary: #888;
  --text-muted: #666;
  
  /* Accent */
  --accent: #d97706;
  
  /* Status */
  --success: #22c55e;
  --error: #ef4444;
}

/* Typography - System fonts only */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

---

## Getting Started

1. Initialize repo and install dependencies:
```bash
mkdir jelico && cd jelico
git init
npm init -y
npm install electron electron-builder vite @vitejs/plugin-react react react-dom
npm install zustand ai @ai-sdk/anthropic @ai-sdk/openai
npm install better-sqlite3 keytar
npm install @modelcontextprotocol/sdk
npm install tailwindcss postcss autoprefixer
npm install -D typescript @types/react @types/node
```

2. Copy reference docs and mockups to `docs/` and `mockups/`

3. Set up Electron + Vite boilerplate

4. Implement Phase 1 (Foundation)

---

## Success Criteria

- [ ] Can add providers and securely store API keys
- [ ] Can chat with any configured provider
- [ ] Conversations persist and appear in sidebar
- [ ] Mode selector works (Tab to cycle)
- [ ] MCP tools work (filesystem read/write)
- [ ] Artifacts display in canvas with preview
- [ ] Can spawn background agents
- [ ] Agents show progress in sidebar
- [ ] Workspaces with git worktree support
- [ ] Command palette (⌘K) works
- [ ] Feels like Claude.ai — clean, fast, invisible UI
