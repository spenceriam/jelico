# Jelico

## AI Productivity Desktop

*Get stuff done. Frictionlessly.*

---

## Philosophy

Jelico is not a coding tool. It's not a chatbot. It's a **productivity multiplier** that happens to be great at everything - writing, research, analysis, coding, project management, and creative work.

### Core Principles

1. **Frictionless** - Zero config to start. One click to do anything. No "are you sure?" dialogs.
2. **Parallel** - Work on multiple things simultaneously via git worktrees and sub-agents.
3. **Skilled** - Load specialized skills on-demand. Writing, research, code, analysis, design.
4. **Agentic** - Agents spawn agents. Delegate and orchestrate complex workflows.
5. **Contextual** - Understands your workspace, projects, and preferences deeply.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Workspaces & Worktrees](#workspaces--worktrees)
3. [Skills System](#skills-system)
4. [Agent Hierarchy](#agent-hierarchy)
5. [Provider System](#provider-system)
6. [Artifacts & Canvas](#artifacts--canvas)
7. [UI/UX Design](#uiux-design)
8. [MCP Integration](#mcp-integration)
9. [Implementation](#implementation)

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              JELICO                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Workspace  │  │   Skills    │  │   Agents    │  │  Artifacts  │    │
│  │  Manager    │  │   Engine    │  │   Runtime   │  │   Canvas    │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐    │
│  │                        Core Runtime                             │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │    │
│  │  │ Provider │  │   MCP    │  │ Session  │  │    Event     │   │    │
│  │  │  Router  │  │  Bridge  │  │  Store   │  │     Bus      │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
jelico/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── workers/
│       ├── agent-worker.ts      # Isolated agent execution
│       └── preview-worker.ts    # Sandboxed previews
├── src/
│   ├── core/
│   │   ├── runtime.ts           # Core orchestration
│   │   ├── events.ts            # Event bus
│   │   └── config.ts            # App configuration
│   ├── workspace/
│   │   ├── types.ts
│   │   ├── manager.ts           # Workspace lifecycle
│   │   ├── worktree.ts          # Git worktree operations
│   │   └── project.ts           # Project detection & config
│   ├── skills/
│   │   ├── types.ts
│   │   ├── registry.ts          # Skill discovery & loading
│   │   ├── engine.ts            # Skill execution
│   │   └── builtin/
│   │       ├── writer.ts
│   │       ├── researcher.ts
│   │       ├── coder.ts
│   │       ├── analyst.ts
│   │       ├── designer.ts
│   │       └── planner.ts
│   ├── agents/
│   │   ├── types.ts
│   │   ├── runtime.ts           # Agent lifecycle
│   │   ├── orchestrator.ts      # Multi-agent coordination
│   │   ├── spawner.ts           # Sub-agent creation
│   │   └── modes/
│   │       ├── auto.ts
│   │       ├── explore.ts
│   │       ├── execute.ts
│   │       ├── plan.ts
│   │       └── review.ts
│   ├── providers/
│   │   ├── types.ts
│   │   ├── router.ts            # Smart provider selection
│   │   ├── registry.ts
│   │   └── implementations/
│   ├── artifacts/
│   │   ├── types.ts
│   │   ├── canvas.ts
│   │   ├── renderer.ts
│   │   └── previews/
│   ├── mcp/
│   │   ├── bridge.ts
│   │   ├── tools.ts
│   │   └── servers/
│   ├── ui/
│   │   ├── App.tsx
│   │   ├── layouts/
│   │   ├── components/
│   │   └── hooks/
│   └── stores/
│       ├── workspace.ts
│       ├── agents.ts
│       ├── artifacts.ts
│       └── session.ts
├── skills/                      # User-installable skills
│   └── .gitkeep
├── agents/                      # Custom agent definitions
│   └── .gitkeep
└── package.json
```

---

## Workspaces & Worktrees

### Concept

A **Workspace** is Jelico's container for work. It can be:
- A folder on disk
- A git repository
- A collection of related files
- A virtual workspace (cloud-synced)

**Worktrees** enable parallel work streams within a git repo - perfect for:
- Experimenting without breaking main
- Working on multiple features simultaneously
- Having an agent work on a branch while you work on another
- A/B testing approaches

### Types

```typescript
// src/workspace/types.ts

export interface Workspace {
  id: string;
  name: string;
  type: 'folder' | 'git' | 'virtual';
  path: string;
  gitInfo?: GitInfo;
  worktrees: Worktree[];
  activeWorktree: string | null;
  projectConfig?: ProjectConfig;
  createdAt: number;
  lastAccessed: number;
}

export interface GitInfo {
  remote?: string;
  branch: string;
  status: GitStatus;
  hasUncommitted: boolean;
}

export interface GitStatus {
  staged: number;
  modified: number;
  untracked: number;
  ahead: number;
  behind: number;
}

export interface Worktree {
  id: string;
  name: string;
  path: string;
  branch: string;
  isMain: boolean;
  createdAt: number;
  purpose?: string;          // "feature/auth", "experiment/new-ui", "agent/research"
  assignedAgent?: string;    // Agent ID working in this worktree
  status: 'active' | 'stale' | 'merged';
}

export interface ProjectConfig {
  name: string;
  type: ProjectType;
  instructions?: string;     // AGENTS.md, CLAUDE.md, etc.
  skills: string[];          // Auto-loaded skills
  defaultMode: string;
  env?: Record<string, string>;
}

export type ProjectType = 
  | 'generic'
  | 'node'
  | 'python'
  | 'rust'
  | 'go'
  | 'docs'
  | 'monorepo';
```

### Worktree Manager

```typescript
// src/workspace/worktree.ts

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { Worktree, Workspace } from './types';

const execAsync = promisify(exec);

export class WorktreeManager {
  private workspace: Workspace;

  constructor(workspace: Workspace) {
    this.workspace = workspace;
  }

  /**
   * Create a new worktree for parallel work
   */
  async create(options: {
    name: string;
    branch?: string;
    baseBranch?: string;
    purpose?: string;
  }): Promise<Worktree> {
    const { name, branch, baseBranch = 'main', purpose } = options;
    const branchName = branch || `worktree/${name}`;
    const worktreePath = path.join(this.workspace.path, '..', `.jelico-${name}`);

    // Create new branch and worktree
    await execAsync(
      `git worktree add -b ${branchName} ${worktreePath} ${baseBranch}`,
      { cwd: this.workspace.path }
    );

    const worktree: Worktree = {
      id: crypto.randomUUID(),
      name,
      path: worktreePath,
      branch: branchName,
      isMain: false,
      createdAt: Date.now(),
      purpose,
      status: 'active',
    };

    return worktree;
  }

  /**
   * List all worktrees
   */
  async list(): Promise<Worktree[]> {
    const { stdout } = await execAsync(
      'git worktree list --porcelain',
      { cwd: this.workspace.path }
    );

    const worktrees: Worktree[] = [];
    const entries = stdout.split('\n\n').filter(Boolean);

    for (const entry of entries) {
      const lines = entry.split('\n');
      const wtPath = lines.find(l => l.startsWith('worktree '))?.slice(9);
      const branch = lines.find(l => l.startsWith('branch '))?.slice(7).replace('refs/heads/', '');
      
      if (wtPath && branch) {
        worktrees.push({
          id: crypto.randomUUID(),
          name: path.basename(wtPath),
          path: wtPath,
          branch,
          isMain: wtPath === this.workspace.path,
          createdAt: Date.now(),
          status: 'active',
        });
      }
    }

    return worktrees;
  }

  /**
   * Switch active worktree
   */
  async switch(worktreeId: string): Promise<void> {
    const worktree = this.workspace.worktrees.find(w => w.id === worktreeId);
    if (!worktree) throw new Error('Worktree not found');
    
    // Update workspace path context
    this.workspace.activeWorktree = worktreeId;
  }

  /**
   * Merge worktree back to main
   */
  async merge(worktreeId: string, options?: { 
    squash?: boolean;
    deleteAfter?: boolean;
  }): Promise<void> {
    const worktree = this.workspace.worktrees.find(w => w.id === worktreeId);
    if (!worktree) throw new Error('Worktree not found');

    const mainPath = this.workspace.path;
    const { squash = false, deleteAfter = true } = options || {};

    // Merge branch
    const mergeCmd = squash 
      ? `git merge --squash ${worktree.branch}`
      : `git merge ${worktree.branch}`;
    
    await execAsync(mergeCmd, { cwd: mainPath });

    if (deleteAfter) {
      await this.remove(worktreeId);
    }
  }

  /**
   * Remove a worktree
   */
  async remove(worktreeId: string): Promise<void> {
    const worktree = this.workspace.worktrees.find(w => w.id === worktreeId);
    if (!worktree) throw new Error('Worktree not found');
    if (worktree.isMain) throw new Error('Cannot remove main worktree');

    await execAsync(
      `git worktree remove ${worktree.path} --force`,
      { cwd: this.workspace.path }
    );

    // Optionally delete branch
    await execAsync(
      `git branch -D ${worktree.branch}`,
      { cwd: this.workspace.path }
    ).catch(() => {}); // Ignore if branch doesn't exist
  }

  /**
   * Create a worktree for an agent to work in
   */
  async createForAgent(agentId: string, task: string): Promise<Worktree> {
    const safeName = task.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const worktree = await this.create({
      name: `agent-${safeName}`,
      purpose: task,
    });
    
    worktree.assignedAgent = agentId;
    return worktree;
  }
}
```

### Workspace UI Component

```typescript
// src/ui/components/WorkspaceSelector.tsx

import React from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { 
  FolderIcon, 
  GitBranchIcon, 
  PlusIcon,
  CheckIcon,
} from 'lucide-react';

export const WorkspaceSelector: React.FC = () => {
  const { 
    workspace, 
    worktrees, 
    activeWorktree,
    createWorktree,
    switchWorktree,
  } = useWorkspace();

  if (!workspace) return null;

  return (
    <div className="workspace-selector">
      {/* Current workspace */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
        <FolderIcon className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium">{workspace.name}</span>
      </div>

      {/* Worktree tabs */}
      {worktrees.length > 1 && (
        <div className="flex items-center gap-1 mt-2">
          {worktrees.map((wt) => (
            <button
              key={wt.id}
              onClick={() => switchWorktree(wt.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs
                transition-colors
                ${activeWorktree === wt.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
              `}
            >
              <GitBranchIcon className="w-3 h-3" />
              {wt.name}
              {wt.assignedAgent && (
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </button>
          ))}
          
          <button
            onClick={() => createWorktree()}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="New worktree"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Skills System

### Concept

**Skills** are specialized capability modules that enhance Jelico's abilities. They're like plugins but focused on *what* Jelico can do well, not *how* it works.

Skills include:
- System prompts optimized for the task
- Relevant tools and MCP servers
- Output templates and formats
- Workflow patterns

### Types

```typescript
// src/skills/types.ts

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  
  // Capability definition
  systemPrompt: string;
  tools: SkillTool[];
  mcpServers?: string[];
  
  // Behavior
  outputFormats: OutputFormat[];
  workflows: Workflow[];
  
  // Activation
  triggers?: SkillTrigger[];     // Auto-activate on certain inputs
  filePatterns?: string[];       // Auto-activate for certain files
  
  // Composition
  composable: boolean;           // Can combine with other skills
  requires?: string[];           // Required skills
  conflicts?: string[];          // Incompatible skills
}

export interface SkillTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: string;               // Function path or MCP tool reference
}

export interface OutputFormat {
  id: string;
  name: string;
  mimeType: string;
  template?: string;
  renderer?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  parallel?: boolean;
}

export interface WorkflowStep {
  id: string;
  action: string;
  inputs: Record<string, unknown>;
  outputs: string[];
  condition?: string;
}

export interface SkillTrigger {
  type: 'keyword' | 'intent' | 'fileType' | 'command';
  pattern: string;
  confidence: number;
}

export interface SkillContext {
  activeSkills: Skill[];
  combinedPrompt: string;
  availableTools: SkillTool[];
  outputFormats: OutputFormat[];
}
```

### Built-in Skills

```typescript
// src/skills/builtin/writer.ts

import type { Skill } from '../types';

export const writerSkill: Skill = {
  id: 'writer',
  name: 'Writer',
  description: 'Professional writing - documents, emails, articles, creative content',
  icon: '✍️',
  version: '1.0.0',

  systemPrompt: `You are an expert writer with mastery across formats:

## Capabilities
- Long-form: articles, reports, documentation, books
- Short-form: emails, messages, social posts, summaries  
- Creative: stories, scripts, poetry, marketing copy
- Technical: specifications, proposals, white papers

## Principles
- Clarity over cleverness
- Active voice, concrete language
- Structure that serves the content
- Appropriate tone for audience

## Process
1. Understand the purpose and audience
2. Structure before writing
3. Draft efficiently
4. Refine for impact

When writing, produce complete, polished output ready for use.`,

  tools: [
    {
      name: 'create_document',
      description: 'Create a formatted document (markdown, docx, pdf)',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          format: { enum: ['markdown', 'docx', 'pdf', 'html'] },
        },
        required: ['title', 'content'],
      },
      handler: 'skills.writer.createDocument',
    },
    {
      name: 'improve_text',
      description: 'Improve existing text for clarity, tone, or style',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          goal: { enum: ['clarity', 'concise', 'formal', 'casual', 'persuasive'] },
        },
        required: ['text', 'goal'],
      },
      handler: 'skills.writer.improveText',
    },
  ],

  outputFormats: [
    { id: 'markdown', name: 'Markdown', mimeType: 'text/markdown' },
    { id: 'docx', name: 'Word Document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { id: 'pdf', name: 'PDF', mimeType: 'application/pdf' },
    { id: 'html', name: 'HTML', mimeType: 'text/html' },
  ],

  workflows: [
    {
      id: 'blog-post',
      name: 'Blog Post',
      description: 'Research and write a blog post',
      steps: [
        { id: 'research', action: 'web_search', inputs: { query: '{{topic}}' }, outputs: ['sources'] },
        { id: 'outline', action: 'generate', inputs: { type: 'outline' }, outputs: ['outline'] },
        { id: 'draft', action: 'generate', inputs: { type: 'draft', outline: '{{outline}}' }, outputs: ['draft'] },
        { id: 'refine', action: 'improve_text', inputs: { text: '{{draft}}', goal: 'clarity' }, outputs: ['final'] },
      ],
    },
  ],

  triggers: [
    { type: 'keyword', pattern: 'write|draft|compose|email|article|blog', confidence: 0.7 },
    { type: 'intent', pattern: 'content_creation', confidence: 0.8 },
  ],

  filePatterns: ['*.md', '*.txt', '*.doc', '*.docx'],
  composable: true,
};
```

```typescript
// src/skills/builtin/researcher.ts

import type { Skill } from '../types';

export const researcherSkill: Skill = {
  id: 'researcher',
  name: 'Researcher',
  description: 'Deep research - web search, analysis, synthesis, fact-checking',
  icon: '🔍',
  version: '1.0.0',

  systemPrompt: `You are an expert researcher with rigorous methodology:

## Capabilities
- Web research with source verification
- Academic and technical literature review
- Data gathering and analysis
- Competitive intelligence
- Fact-checking and verification

## Principles
- Multiple sources for every claim
- Prefer primary sources
- Note confidence levels
- Acknowledge limitations
- Cite everything

## Process
1. Define research questions
2. Identify source types needed
3. Gather systematically
4. Synthesize findings
5. Present with citations

Always provide sources. Never fabricate information.`,

  tools: [
    {
      name: 'deep_search',
      description: 'Multi-source research on a topic',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          sources: { 
            type: 'array', 
            items: { enum: ['web', 'academic', 'news', 'social'] },
          },
          depth: { enum: ['quick', 'standard', 'thorough'] },
        },
        required: ['query'],
      },
      handler: 'skills.researcher.deepSearch',
    },
    {
      name: 'verify_claim',
      description: 'Fact-check a specific claim',
      inputSchema: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          context: { type: 'string' },
        },
        required: ['claim'],
      },
      handler: 'skills.researcher.verifyClaim',
    },
  ],

  mcpServers: ['web-search', 'fetch', 'arxiv'],

  outputFormats: [
    { id: 'report', name: 'Research Report', mimeType: 'text/markdown' },
    { id: 'briefing', name: 'Executive Briefing', mimeType: 'text/markdown' },
    { id: 'sources', name: 'Annotated Sources', mimeType: 'application/json' },
  ],

  workflows: [
    {
      id: 'market-research',
      name: 'Market Research',
      description: 'Comprehensive market analysis',
      steps: [
        { id: 'landscape', action: 'deep_search', inputs: { query: '{{topic}} market landscape', depth: 'thorough' }, outputs: ['landscape'] },
        { id: 'competitors', action: 'deep_search', inputs: { query: '{{topic}} competitors', depth: 'standard' }, outputs: ['competitors'] },
        { id: 'trends', action: 'deep_search', inputs: { query: '{{topic}} trends 2024 2025', depth: 'standard' }, outputs: ['trends'] },
        { id: 'synthesize', action: 'generate', inputs: { type: 'report' }, outputs: ['report'] },
      ],
    },
  ],

  triggers: [
    { type: 'keyword', pattern: 'research|find out|look up|investigate|analyze', confidence: 0.7 },
    { type: 'intent', pattern: 'information_seeking', confidence: 0.8 },
  ],

  composable: true,
};
```

```typescript
// src/skills/builtin/coder.ts

import type { Skill } from '../types';

export const coderSkill: Skill = {
  id: 'coder',
  name: 'Coder',
  description: 'Software development - write, debug, refactor, explain code',
  icon: '💻',
  version: '1.0.0',

  systemPrompt: `You are an expert software engineer:

## Capabilities
- Write clean, maintainable code in any language
- Debug systematically
- Refactor for clarity and performance
- Explain complex concepts simply
- Review code for issues

## Principles
- Simplicity over cleverness
- Readability counts
- Test what matters
- Document intent, not mechanics
- Small, focused changes

## Process
1. Understand the requirement fully
2. Consider edge cases
3. Write minimal working solution
4. Refine and test
5. Document if needed

Produce working code. Explain only when asked.`,

  tools: [
    {
      name: 'read_file',
      description: 'Read a file from the workspace',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      handler: 'mcp.filesystem.read_file',
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
      handler: 'mcp.filesystem.write_file',
    },
    {
      name: 'run_command',
      description: 'Execute a shell command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          cwd: { type: 'string' },
        },
        required: ['command'],
      },
      handler: 'mcp.shell.run',
    },
    {
      name: 'search_code',
      description: 'Search for patterns in code',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          filePattern: { type: 'string' },
        },
        required: ['pattern'],
      },
      handler: 'mcp.filesystem.search',
    },
  ],

  mcpServers: ['filesystem', 'git', 'shell'],

  outputFormats: [
    { id: 'code', name: 'Code', mimeType: 'text/plain' },
    { id: 'diff', name: 'Diff', mimeType: 'text/x-diff' },
  ],

  workflows: [
    {
      id: 'debug',
      name: 'Systematic Debug',
      description: '7-step debugging process',
      steps: [
        { id: 'reproduce', action: 'run_command', inputs: { command: '{{repro_command}}' }, outputs: ['error'] },
        { id: 'isolate', action: 'search_code', inputs: { pattern: '{{error_pattern}}' }, outputs: ['locations'] },
        { id: 'hypothesize', action: 'generate', inputs: { type: 'hypotheses' }, outputs: ['hypotheses'] },
        { id: 'test', action: 'run_command', inputs: { command: '{{test_command}}' }, outputs: ['results'] },
        { id: 'fix', action: 'write_file', inputs: { path: '{{file}}', content: '{{fix}}' }, outputs: ['fixed'] },
        { id: 'verify', action: 'run_command', inputs: { command: '{{verify_command}}' }, outputs: ['verified'] },
        { id: 'prevent', action: 'generate', inputs: { type: 'test' }, outputs: ['test'] },
      ],
    },
  ],

  triggers: [
    { type: 'keyword', pattern: 'code|implement|fix|debug|refactor|function|class', confidence: 0.7 },
    { type: 'fileType', pattern: '\\.(ts|js|py|rs|go|java|cpp|c|rb)$', confidence: 0.9 },
  ],

  filePatterns: ['*.ts', '*.js', '*.py', '*.rs', '*.go', '*.java', '*.cpp', '*.c', '*.rb'],
  composable: true,
};
```

```typescript
// src/skills/builtin/analyst.ts

import type { Skill } from '../types';

export const analystSkill: Skill = {
  id: 'analyst',
  name: 'Analyst',
  description: 'Data analysis - spreadsheets, visualization, insights, modeling',
  icon: '📊',
  version: '1.0.0',

  systemPrompt: `You are an expert data analyst:

## Capabilities
- Analyze spreadsheets and datasets
- Create visualizations
- Statistical analysis
- Financial modeling
- Business intelligence

## Principles
- Let data tell the story
- Question assumptions
- Visualize for clarity
- Quantify uncertainty
- Actionable insights

## Process
1. Understand the question
2. Assess data quality
3. Explore and clean
4. Analyze systematically
5. Visualize and explain

Always show your work. Explain findings in plain language.`,

  tools: [
    {
      name: 'analyze_data',
      description: 'Analyze a dataset or spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          questions: { type: 'array', items: { type: 'string' } },
        },
        required: ['file'],
      },
      handler: 'skills.analyst.analyzeData',
    },
    {
      name: 'create_chart',
      description: 'Create a visualization',
      inputSchema: {
        type: 'object',
        properties: {
          type: { enum: ['line', 'bar', 'scatter', 'pie', 'heatmap'] },
          data: { type: 'object' },
          options: { type: 'object' },
        },
        required: ['type', 'data'],
      },
      handler: 'skills.analyst.createChart',
    },
    {
      name: 'run_python',
      description: 'Execute Python code for analysis',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
        },
        required: ['code'],
      },
      handler: 'runtime.python.execute',
    },
  ],

  outputFormats: [
    { id: 'report', name: 'Analysis Report', mimeType: 'text/markdown' },
    { id: 'chart', name: 'Chart', mimeType: 'image/svg+xml' },
    { id: 'xlsx', name: 'Spreadsheet', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ],

  triggers: [
    { type: 'keyword', pattern: 'analyze|chart|graph|data|spreadsheet|excel|csv', confidence: 0.7 },
    { type: 'fileType', pattern: '\\.(csv|xlsx|xls|json|parquet)$', confidence: 0.9 },
  ],

  filePatterns: ['*.csv', '*.xlsx', '*.xls', '*.json', '*.parquet'],
  composable: true,
};
```

```typescript
// src/skills/builtin/planner.ts

import type { Skill } from '../types';

export const plannerSkill: Skill = {
  id: 'planner',
  name: 'Planner',
  description: 'Project planning - roadmaps, specs, task breakdown, coordination',
  icon: '📋',
  version: '1.0.0',

  systemPrompt: `You are an expert project planner:

## Capabilities
- Break down complex projects
- Create actionable roadmaps
- Write specifications
- Estimate effort
- Identify risks and dependencies

## Principles
- Start with outcomes
- Small, deliverable chunks
- Dependencies explicit
- Buffer for unknowns
- Review and adapt

## Artifacts
- PRDs (Product Requirements Documents)
- Technical specifications
- Project roadmaps
- Task breakdowns
- AGENTS.md files

Be concrete. Every plan should be actionable.`,

  tools: [
    {
      name: 'create_plan',
      description: 'Create a project plan',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'string' },
          constraints: { type: 'array', items: { type: 'string' } },
          format: { enum: ['roadmap', 'prd', 'spec', 'tasks'] },
        },
        required: ['goal'],
      },
      handler: 'skills.planner.createPlan',
    },
    {
      name: 'estimate_effort',
      description: 'Estimate effort for tasks',
      inputSchema: {
        type: 'object',
        properties: {
          tasks: { type: 'array', items: { type: 'string' } },
          context: { type: 'string' },
        },
        required: ['tasks'],
      },
      handler: 'skills.planner.estimateEffort',
    },
  ],

  outputFormats: [
    { id: 'roadmap', name: 'Roadmap', mimeType: 'text/markdown' },
    { id: 'prd', name: 'PRD', mimeType: 'text/markdown' },
    { id: 'tasks', name: 'Task List', mimeType: 'application/json' },
    { id: 'gantt', name: 'Gantt Chart', mimeType: 'text/mermaid' },
  ],

  workflows: [
    {
      id: 'project-kickoff',
      name: 'Project Kickoff',
      description: 'Full project planning workflow',
      steps: [
        { id: 'goals', action: 'generate', inputs: { type: 'goals' }, outputs: ['goals'] },
        { id: 'breakdown', action: 'create_plan', inputs: { goal: '{{goals}}', format: 'tasks' }, outputs: ['tasks'] },
        { id: 'estimate', action: 'estimate_effort', inputs: { tasks: '{{tasks}}' }, outputs: ['estimates'] },
        { id: 'roadmap', action: 'create_plan', inputs: { goal: '{{goals}}', format: 'roadmap' }, outputs: ['roadmap'] },
        { id: 'spec', action: 'create_plan', inputs: { goal: '{{goals}}', format: 'spec' }, outputs: ['spec'] },
      ],
    },
  ],

  triggers: [
    { type: 'keyword', pattern: 'plan|roadmap|spec|prd|breakdown|tasks|project', confidence: 0.7 },
    { type: 'intent', pattern: 'project_planning', confidence: 0.8 },
  ],

  composable: true,
};
```

### Skill Engine

```typescript
// src/skills/engine.ts

import type { Skill, SkillContext, SkillTool } from './types';
import { skillRegistry } from './registry';

export class SkillEngine {
  private activeSkills: Map<string, Skill> = new Map();

  /**
   * Activate a skill
   */
  activate(skillId: string): void {
    const skill = skillRegistry.get(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    // Check conflicts
    for (const activeSkill of this.activeSkills.values()) {
      if (activeSkill.conflicts?.includes(skillId)) {
        throw new Error(`Skill ${skillId} conflicts with ${activeSkill.id}`);
      }
    }

    // Load required skills
    for (const required of skill.requires || []) {
      if (!this.activeSkills.has(required)) {
        this.activate(required);
      }
    }

    this.activeSkills.set(skillId, skill);
  }

  /**
   * Deactivate a skill
   */
  deactivate(skillId: string): void {
    this.activeSkills.delete(skillId);
  }

  /**
   * Auto-detect skills from input
   */
  detectSkills(input: string, files?: string[]): string[] {
    const detected: Array<{ id: string; confidence: number }> = [];

    for (const skill of skillRegistry.getAll()) {
      for (const trigger of skill.triggers || []) {
        if (trigger.type === 'keyword') {
          const regex = new RegExp(trigger.pattern, 'i');
          if (regex.test(input)) {
            detected.push({ id: skill.id, confidence: trigger.confidence });
          }
        }
      }

      // Check file patterns
      if (files && skill.filePatterns) {
        for (const file of files) {
          for (const pattern of skill.filePatterns) {
            if (new RegExp(pattern).test(file)) {
              detected.push({ id: skill.id, confidence: 0.9 });
            }
          }
        }
      }
    }

    // Return unique skills sorted by confidence
    const unique = [...new Map(detected.map(d => [d.id, d])).values()];
    return unique
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map(d => d.id);
  }

  /**
   * Build combined context from active skills
   */
  buildContext(): SkillContext {
    const skills = Array.from(this.activeSkills.values());
    
    // Combine system prompts
    const combinedPrompt = skills
      .map(s => `## ${s.name} Skill\n\n${s.systemPrompt}`)
      .join('\n\n---\n\n');

    // Collect all tools
    const tools: SkillTool[] = skills.flatMap(s => s.tools);

    // Collect output formats
    const outputFormats = skills.flatMap(s => s.outputFormats);

    return {
      activeSkills: skills,
      combinedPrompt,
      availableTools: tools,
      outputFormats,
    };
  }

  /**
   * Get MCP servers needed for active skills
   */
  getRequiredMCPServers(): string[] {
    const servers = new Set<string>();
    for (const skill of this.activeSkills.values()) {
      for (const server of skill.mcpServers || []) {
        servers.add(server);
      }
    }
    return Array.from(servers);
  }
}

export const skillEngine = new SkillEngine();
```

---

## Agent Hierarchy

### Concept

Agents are autonomous AI workers that can:
- Work independently on tasks
- Spawn sub-agents for parallel work
- Report back to parent agents
- Use worktrees for isolation
- Have their own mode and skill context

This creates a **hierarchy** where the main agent (you're talking to) can delegate to specialist sub-agents.

### Types

```typescript
// src/agents/types.ts

export type AgentMode = 'auto' | 'explore' | 'execute' | 'plan' | 'review';

export interface Agent {
  id: string;
  name: string;
  type: 'main' | 'sub';
  mode: AgentMode;
  status: AgentStatus;
  
  // Hierarchy
  parentId?: string;
  children: string[];
  
  // Context
  skills: string[];
  worktreeId?: string;
  task?: AgentTask;
  
  // Execution
  messages: AgentMessage[];
  artifacts: string[];
  
  // Metrics
  tokensUsed: number;
  toolCalls: number;
  startedAt: number;
  completedAt?: number;
}

export type AgentStatus = 
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting'      // Waiting for sub-agent
  | 'blocked'      // Needs user input
  | 'completed'
  | 'failed';

export interface AgentTask {
  id: string;
  description: string;
  goal: string;
  constraints?: string[];
  deadline?: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deliverables: string[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface SpawnOptions {
  name: string;
  task: AgentTask;
  mode?: AgentMode;
  skills?: string[];
  useWorktree?: boolean;
  parallel?: boolean;        // Run in background
  reportInterval?: number;   // ms between status updates
}

export interface AgentReport {
  agentId: string;
  status: AgentStatus;
  progress: number;          // 0-100
  summary: string;
  artifacts: string[];
  blockers?: string[];
  nextSteps?: string[];
}
```

### Agent Runtime

```typescript
// src/agents/runtime.ts

import { EventEmitter } from 'events';
import type { Agent, AgentMode, AgentTask, AgentMessage, SpawnOptions, AgentReport } from './types';
import { skillEngine } from '../skills/engine';
import { providerManager } from '../providers/manager';
import { workspaceManager } from '../workspace/manager';

export class AgentRuntime extends EventEmitter {
  private agents = new Map<string, Agent>();
  private mainAgentId: string | null = null;

  /**
   * Create the main agent (user-facing)
   */
  createMainAgent(): Agent {
    const agent: Agent = {
      id: crypto.randomUUID(),
      name: 'Jelico',
      type: 'main',
      mode: 'auto',
      status: 'idle',
      children: [],
      skills: [],
      messages: [],
      artifacts: [],
      tokensUsed: 0,
      toolCalls: 0,
      startedAt: Date.now(),
    };

    this.agents.set(agent.id, agent);
    this.mainAgentId = agent.id;
    return agent;
  }

  /**
   * Spawn a sub-agent for delegated work
   */
  async spawn(parentId: string, options: SpawnOptions): Promise<Agent> {
    const parent = this.agents.get(parentId);
    if (!parent) throw new Error('Parent agent not found');

    const agent: Agent = {
      id: crypto.randomUUID(),
      name: options.name,
      type: 'sub',
      mode: options.mode || 'execute',
      status: 'idle',
      parentId,
      children: [],
      skills: options.skills || [],
      task: options.task,
      messages: [],
      artifacts: [],
      tokensUsed: 0,
      toolCalls: 0,
      startedAt: Date.now(),
    };

    // Create worktree if requested
    if (options.useWorktree) {
      const workspace = workspaceManager.getActive();
      if (workspace) {
        const worktree = await workspace.worktreeManager.createForAgent(
          agent.id,
          options.task.description
        );
        agent.worktreeId = worktree.id;
      }
    }

    // Register agent
    this.agents.set(agent.id, agent);
    parent.children.push(agent.id);

    // Start execution if parallel
    if (options.parallel) {
      this.executeInBackground(agent.id);
    }

    this.emit('agent:spawned', agent);
    return agent;
  }

  /**
   * Execute agent's task in background
   */
  private async executeInBackground(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.task) return;

    agent.status = 'thinking';
    this.emit('agent:status', agent);

    try {
      // Build context with skills
      for (const skillId of agent.skills) {
        skillEngine.activate(skillId);
      }
      const context = skillEngine.buildContext();

      // Create system message
      const systemMessage = this.buildSystemMessage(agent, context);
      agent.messages.push(systemMessage);

      // Execute task with tool loop
      await this.executeTask(agent);

      agent.status = 'completed';
      agent.completedAt = Date.now();
    } catch (error) {
      agent.status = 'failed';
      this.emit('agent:error', { agent, error });
    }

    this.emit('agent:completed', agent);
    
    // Report back to parent
    if (agent.parentId) {
      this.reportToParent(agent);
    }
  }

  /**
   * Execute task with tool loop
   */
  private async executeTask(agent: Agent): Promise<void> {
    const maxIterations = 50;
    let iteration = 0;

    while (iteration < maxIterations && agent.status !== 'completed') {
      iteration++;
      agent.status = 'thinking';

      // Get AI response
      const response = await providerManager.complete(agent.messages);
      agent.tokensUsed += response.usage.inputTokens + response.usage.outputTokens;

      // Add assistant message
      const assistantMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        toolCalls: response.toolCalls,
      };
      agent.messages.push(assistantMessage);

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        agent.status = 'executing';
        
        for (const toolCall of response.toolCalls) {
          agent.toolCalls++;
          const result = await this.executeTool(agent, toolCall);
          
          agent.messages.push({
            id: crypto.randomUUID(),
            role: 'tool',
            content: JSON.stringify(result),
            timestamp: Date.now(),
            toolResults: [{ toolCallId: toolCall.id, result }],
          });
        }
      } else {
        // No tool calls = task complete
        break;
      }
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(agent: Agent, toolCall: any): Promise<unknown> {
    // Route to appropriate handler (MCP, skill, etc.)
    this.emit('tool:call', { agent, toolCall });
    
    // Implementation would call MCP or skill handler
    return { status: 'ok' };
  }

  /**
   * Report sub-agent status to parent
   */
  private reportToParent(agent: Agent): void {
    const parent = this.agents.get(agent.parentId!);
    if (!parent) return;

    const report: AgentReport = {
      agentId: agent.id,
      status: agent.status,
      progress: agent.status === 'completed' ? 100 : 50,
      summary: this.summarizeWork(agent),
      artifacts: agent.artifacts,
    };

    this.emit('agent:report', { parent, report });

    // Add report to parent's context
    parent.messages.push({
      id: crypto.randomUUID(),
      role: 'system',
      content: `Sub-agent "${agent.name}" completed:\n${report.summary}`,
      timestamp: Date.now(),
    });
  }

  /**
   * Summarize agent's work
   */
  private summarizeWork(agent: Agent): string {
    // Would use AI to summarize
    return `Completed task: ${agent.task?.description}`;
  }

  /**
   * Build system message for agent
   */
  private buildSystemMessage(agent: Agent, context: any): AgentMessage {
    const parts = [
      `You are ${agent.name}, a sub-agent working on a specific task.`,
      '',
      `## Your Task`,
      agent.task?.description,
      '',
      `## Goal`,
      agent.task?.goal,
      '',
      `## Deliverables`,
      agent.task?.deliverables.map(d => `- ${d}`).join('\n'),
      '',
      context.combinedPrompt,
    ];

    return {
      id: crypto.randomUUID(),
      role: 'system',
      content: parts.join('\n'),
      timestamp: Date.now(),
    };
  }

  /**
   * Get agent by ID
   */
  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get main agent
   */
  getMain(): Agent | undefined {
    return this.mainAgentId ? this.agents.get(this.mainAgentId) : undefined;
  }

  /**
   * Get all sub-agents of a parent
   */
  getChildren(parentId: string): Agent[] {
    const parent = this.agents.get(parentId);
    if (!parent) return [];
    return parent.children.map(id => this.agents.get(id)!).filter(Boolean);
  }

  /**
   * Set agent mode
   */
  setMode(agentId: string, mode: AgentMode): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.mode = mode;
      this.emit('agent:mode', agent);
    }
  }
}

export const agentRuntime = new AgentRuntime();
```

### Mode Definitions

```typescript
// src/agents/modes/index.ts

import type { AgentMode } from '../types';

export interface ModeDefinition {
  id: AgentMode;
  name: string;
  shortcut: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  canSpawnAgents: boolean;
  autoApprove: boolean;
}

export const modes: Record<AgentMode, ModeDefinition> = {
  auto: {
    id: 'auto',
    name: 'Auto',
    shortcut: 'A',
    description: 'I decide the best approach for each task',
    systemPrompt: `Analyze each request and choose the optimal approach:
- Simple questions: Answer directly
- Research needed: Switch to explore
- Changes required: Switch to execute
- Complex project: Switch to plan

Be efficient. Don't over-explain mode switches.`,
    capabilities: ['read', 'search', 'spawn'],
    canSpawnAgents: true,
    autoApprove: false,
  },

  explore: {
    id: 'explore',
    name: 'Explore',
    shortcut: 'E',
    description: 'Deep understanding - read, search, analyze',
    systemPrompt: `Focus on understanding:
- Read files and documentation
- Search for relevant information
- Analyze patterns and structures
- Build comprehensive mental models

NO modifications. Ask before changing anything.`,
    capabilities: ['read', 'search', 'web'],
    canSpawnAgents: false,
    autoApprove: true,
  },

  execute: {
    id: 'execute',
    name: 'Execute',
    shortcut: 'X',
    description: 'Get it done - full tool access',
    systemPrompt: `Execute efficiently:
- Make changes confidently
- Use all available tools
- Handle errors gracefully
- Report progress clearly

Work fast but carefully. Ask only when truly blocked.`,
    capabilities: ['read', 'write', 'execute', 'search', 'web', 'spawn'],
    canSpawnAgents: true,
    autoApprove: false,
  },

  plan: {
    id: 'plan',
    name: 'Plan',
    shortcut: 'P',
    description: 'Strategic planning - roadmaps, specs, breakdown',
    systemPrompt: `Plan comprehensively:
- Break down complex goals
- Identify dependencies
- Estimate effort
- Create actionable artifacts

Output concrete plans, not vague directions.`,
    capabilities: ['read', 'write', 'search', 'spawn'],
    canSpawnAgents: true,
    autoApprove: true,
  },

  review: {
    id: 'review',
    name: 'Review',
    shortcut: 'R',
    description: 'Quality assurance - review, test, improve',
    systemPrompt: `Review thoroughly:
- Check for issues and bugs
- Suggest improvements
- Verify requirements met
- Test edge cases

Be constructive. Prioritize important issues.`,
    capabilities: ['read', 'execute', 'search'],
    canSpawnAgents: false,
    autoApprove: true,
  },
};

export function getMode(id: AgentMode): ModeDefinition {
  return modes[id];
}

export function cycleMode(current: AgentMode, direction: 1 | -1 = 1): AgentMode {
  const order: AgentMode[] = ['auto', 'explore', 'execute', 'plan', 'review'];
  const idx = order.indexOf(current);
  const next = (idx + direction + order.length) % order.length;
  return order[next];
}
```

### Agent Spawning UI

```typescript
// src/ui/components/AgentSpawner.tsx

import React, { useState } from 'react';
import { agentRuntime } from '../../agents/runtime';
import { skillRegistry } from '../../skills/registry';
import { BotIcon, PlusIcon, GitBranchIcon } from 'lucide-react';

interface AgentSpawnerProps {
  parentId: string;
  onSpawn: (agentId: string) => void;
}

export const AgentSpawner: React.FC<AgentSpawnerProps> = ({ parentId, onSpawn }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [task, setTask] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [useWorktree, setUseWorktree] = useState(false);
  const [parallel, setParallel] = useState(true);

  const skills = skillRegistry.getAll();

  const handleSpawn = async () => {
    const agent = await agentRuntime.spawn(parentId, {
      name: name || 'Sub-agent',
      task: {
        id: crypto.randomUUID(),
        description: task,
        goal: task,
        priority: 'normal',
        deliverables: ['Completed task'],
      },
      skills: selectedSkills,
      useWorktree,
      parallel,
    });

    onSpawn(agent.id);
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setTask('');
    setSelectedSkills([]);
    setUseWorktree(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 
                   hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
      >
        <BotIcon className="w-4 h-4" />
        Spawn Agent
      </button>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-4">
      <h3 className="text-sm font-medium text-white flex items-center gap-2">
        <BotIcon className="w-4 h-4" />
        Spawn Sub-Agent
      </h3>

      <input
        type="text"
        placeholder="Agent name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded 
                   text-sm text-white placeholder-gray-500"
      />

      <textarea
        placeholder="What should this agent do?"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded 
                   text-sm text-white placeholder-gray-500 resize-none"
      />

      {/* Skills */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block">Skills</label>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => {
                setSelectedSkills(prev =>
                  prev.includes(skill.id)
                    ? prev.filter(s => s !== skill.id)
                    : [...prev, skill.id]
                );
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedSkills.includes(skill.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {skill.icon} {skill.name}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={useWorktree}
            onChange={(e) => setUseWorktree(e.target.checked)}
            className="rounded border-gray-600"
          />
          <GitBranchIcon className="w-4 h-4" />
          Use worktree
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={parallel}
            onChange={(e) => setParallel(e.target.checked)}
            className="rounded border-gray-600"
          />
          Run in background
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSpawn}
          disabled={!task.trim()}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded 
                     hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Spawn
        </button>
      </div>
    </div>
  );
};
```

### Active Agents Panel

```typescript
// src/ui/components/ActiveAgents.tsx

import React from 'react';
import { useAgents } from '../../hooks/useAgents';
import { BotIcon, CheckIcon, LoaderIcon, AlertIcon, GitBranchIcon } from 'lucide-react';

export const ActiveAgents: React.FC = () => {
  const { agents, mainAgent } = useAgents();
  const subAgents = agents.filter(a => a.type === 'sub');

  if (subAgents.length === 0) return null;

  return (
    <div className="border-t border-gray-800 p-4">
      <h3 className="text-xs font-medium text-gray-400 mb-3">Active Agents</h3>
      
      <div className="space-y-2">
        {subAgents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg"
          >
            <StatusIcon status={agent.status} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">
                  {agent.name}
                </span>
                {agent.worktreeId && (
                  <GitBranchIcon className="w-3 h-3 text-gray-500" />
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {agent.task?.description}
              </p>
            </div>

            <div className="text-xs text-gray-500">
              {agent.tokensUsed.toLocaleString()} tokens
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckIcon className="w-4 h-4 text-green-400" />;
    case 'thinking':
    case 'executing':
      return <LoaderIcon className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'failed':
      return <AlertIcon className="w-4 h-4 text-red-400" />;
    default:
      return <BotIcon className="w-4 h-4 text-gray-400" />;
  }
};
```

---

## UI/UX Design

### Design Principles

1. **Zero friction** - No unnecessary confirmations. Smart defaults.
2. **Glanceable** - Status visible at a glance. No hunting for info.
3. **Keyboard-first** - Everything accessible via keyboard.
4. **Progressive disclosure** - Simple by default, power when needed.
5. **Context-aware** - UI adapts to current task and mode.

### Main Layout

```typescript
// src/ui/App.tsx

import React, { useEffect } from 'react';
import { Sidebar } from './layouts/Sidebar';
import { MainPanel } from './layouts/MainPanel';
import { ArtifactsPanel } from './layouts/ArtifactsPanel';
import { CommandPalette } from './components/CommandPalette';
import { useKeyboard } from '../hooks/useKeyboard';
import { useArtifacts } from '../hooks/useArtifacts';

export const App: React.FC = () => {
  const { artifacts } = useArtifacts();
  const showArtifacts = artifacts.length > 0;

  // Global keyboard shortcuts
  useKeyboard({
    'Tab': () => cycleMode(1),
    'Shift+Tab': () => cycleMode(-1),
    'Cmd+K': () => openCommandPalette(),
    'Cmd+N': () => newChat(),
    'Cmd+O': () => openWorkspace(),
    'Cmd+B': () => toggleSidebar(),
    'Escape': () => cancel(),
  });

  return (
    <div className="h-screen flex bg-gray-950 text-white overflow-hidden">
      {/* Sidebar - workspaces, chats, settings */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 flex min-w-0">
        {/* Chat/work panel */}
        <MainPanel className={showArtifacts ? 'w-1/2' : 'w-full'} />

        {/* Artifacts panel - code, preview, outputs */}
        {showArtifacts && (
          <ArtifactsPanel className="w-1/2 border-l border-gray-800" />
        )}
      </main>

      {/* Command palette overlay */}
      <CommandPalette />
    </div>
  );
};
```

### Header with Mode & Model

```typescript
// src/ui/components/Header.tsx

import React from 'react';
import { useAgents } from '../../hooks/useAgents';
import { useProviders } from '../../hooks/useProviders';
import { ModeSelector } from './ModeSelector';
import { ModelSelector } from './ModelSelector';
import { WorkspaceSelector } from './WorkspaceSelector';
import { SettingsIcon, SparklesIcon } from 'lucide-react';

export const Header: React.FC = () => {
  const { mainAgent } = useAgents();
  const { activeModel } = useProviders();

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-gray-800">
      {/* Left - Workspace */}
      <WorkspaceSelector />

      {/* Center - Mode selector */}
      <ModeSelector mode={mainAgent?.mode || 'auto'} />

      {/* Right - Model & settings */}
      <div className="flex items-center gap-3">
        <ModelSelector />
        
        <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
```

### Mode Selector (Frictionless)

```typescript
// src/ui/components/ModeSelector.tsx

import React from 'react';
import { modes, cycleMode } from '../../agents/modes';
import type { AgentMode } from '../../agents/types';
import { useAgents } from '../../hooks/useAgents';

interface ModeSelectorProps {
  mode: AgentMode;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode }) => {
  const { setMode } = useAgents();
  const currentMode = modes[mode];

  return (
    <div className="flex items-center">
      {/* Mode tabs */}
      <div className="flex bg-gray-800/50 rounded-lg p-1">
        {Object.values(modes).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`
              relative px-4 py-1.5 text-sm font-medium rounded-md
              transition-all duration-150
              ${m.id === mode
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
              }
            `}
          >
            <span className="relative z-10">{m.name}</span>
            
            {/* Keyboard hint */}
            <span className="ml-1.5 text-xs text-gray-500">
              {m.shortcut}
            </span>
          </button>
        ))}
      </div>

      {/* Current mode description */}
      <span className="ml-4 text-sm text-gray-500">
        {currentMode.description}
      </span>
    </div>
  );
};
```

### Command Palette

```typescript
// src/ui/components/CommandPalette.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useCommand } from '../../hooks/useCommand';
import { SearchIcon, ArrowRightIcon } from 'lucide-react';

interface Command {
  id: string;
  name: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const { isOpen, close, execute } = useCommand();
  const [query, setQuery] = useState('');

  const commands: Command[] = useMemo(() => [
    // Modes
    { id: 'mode-auto', name: 'Switch to Auto mode', shortcut: 'A', category: 'Modes', action: () => setMode('auto') },
    { id: 'mode-explore', name: 'Switch to Explore mode', shortcut: 'E', category: 'Modes', action: () => setMode('explore') },
    { id: 'mode-execute', name: 'Switch to Execute mode', shortcut: 'X', category: 'Modes', action: () => setMode('execute') },
    { id: 'mode-plan', name: 'Switch to Plan mode', shortcut: 'P', category: 'Modes', action: () => setMode('plan') },
    { id: 'mode-review', name: 'Switch to Review mode', shortcut: 'R', category: 'Modes', action: () => setMode('review') },
    
    // Skills
    { id: 'skill-writer', name: 'Activate Writer skill', category: 'Skills', action: () => activateSkill('writer') },
    { id: 'skill-researcher', name: 'Activate Researcher skill', category: 'Skills', action: () => activateSkill('researcher') },
    { id: 'skill-coder', name: 'Activate Coder skill', category: 'Skills', action: () => activateSkill('coder') },
    { id: 'skill-analyst', name: 'Activate Analyst skill', category: 'Skills', action: () => activateSkill('analyst') },
    
    // Workspace
    { id: 'ws-new', name: 'New chat', shortcut: '⌘N', category: 'Workspace', action: () => newChat() },
    { id: 'ws-open', name: 'Open workspace', shortcut: '⌘O', category: 'Workspace', action: () => openWorkspace() },
    { id: 'ws-worktree', name: 'Create worktree', category: 'Workspace', action: () => createWorktree() },
    
    // Agents
    { id: 'agent-spawn', name: 'Spawn sub-agent', category: 'Agents', action: () => spawnAgent() },
    { id: 'agent-list', name: 'View active agents', category: 'Agents', action: () => showAgents() },
  ], []);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filtered) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filtered]);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <SearchIcon className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
            autoFocus
          />
        </div>

        {/* Commands list */}
        <div className="max-h-80 overflow-y-auto py-2">
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-xs font-medium text-gray-500">
                {category}
              </div>
              {cmds.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => { execute(cmd.action); close(); }}
                  className="w-full flex items-center justify-between px-4 py-2 
                             hover:bg-gray-800 text-left transition-colors"
                >
                  <span className="text-sm text-white">{cmd.name}</span>
                  {cmd.shortcut && (
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### Frictionless Input

```typescript
// src/ui/components/ChatInput.tsx

import React, { useState, useRef, useCallback } from 'react';
import { useChat } from '../../hooks/useChat';
import { useSkills } from '../../hooks/useSkills';
import { SendIcon, PaperclipIcon, MicIcon, StopIcon } from 'lucide-react';

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const { sendMessage, isLoading, stop } = useChat();
  const { detectAndActivate } = useSkills();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return;
    
    // Auto-detect and activate relevant skills
    detectAndActivate(input);
    
    sendMessage(input);
    setInput('');
  }, [input, isLoading, sendMessage, detectAndActivate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="border-t border-gray-800 p-4">
      <div className="flex items-end gap-3 bg-gray-800/50 rounded-xl p-3">
        {/* Attach button */}
        <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700">
          <PaperclipIcon className="w-5 h-5" />
        </button>

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to do?"
          rows={1}
          className="flex-1 bg-transparent text-white placeholder-gray-500 
                     outline-none resize-none min-h-[24px] max-h-[200px]"
        />

        {/* Voice button */}
        <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700">
          <MicIcon className="w-5 h-5" />
        </button>

        {/* Send/Stop button */}
        {isLoading ? (
          <button 
            onClick={stop}
            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
          >
            <StopIcon className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Hint */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-xs text-gray-500">
          Enter to send · Shift+Enter for new line · Tab to cycle modes
        </span>
        <span className="text-xs text-gray-500">
          ⌘K for commands
        </span>
      </div>
    </div>
  );
};
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Cycle mode forward |
| `Shift+Tab` | Cycle mode backward |
| `⌘K` | Command palette |
| `⌘N` | New chat |
| `⌘O` | Open workspace |
| `⌘B` | Toggle sidebar |
| `⌘/` | Show shortcuts |
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Escape` | Cancel / close |
| `⌘Z` | Undo |
| `⌘Shift+Z` | Redo |
| `⌘1-5` | Switch to mode 1-5 |

---

## Implementation Roadmap

### Phase 1: Core (Weeks 1-3)
- [ ] Electron + React + Vite scaffold
- [ ] Provider system with routing
- [ ] Basic chat with streaming
- [ ] Session persistence

### Phase 2: Skills (Weeks 4-5)
- [ ] Skill type system
- [ ] Built-in skills (writer, researcher, coder, analyst, planner)
- [ ] Auto-detection from input
- [ ] Skill combination

### Phase 3: Agents (Weeks 6-7)
- [ ] Agent runtime
- [ ] Mode system
- [ ] Sub-agent spawning
- [ ] Agent status UI

### Phase 4: Workspaces (Weeks 8-9)
- [ ] Workspace manager
- [ ] Git worktree integration
- [ ] Project detection
- [ ] Worktree UI

### Phase 5: Artifacts (Weeks 10-11)
- [ ] Artifact detection
- [ ] Monaco code canvas
- [ ] Live preview (HTML, React, Mermaid)
- [ ] Diff viewer

### Phase 6: Polish (Weeks 12-14)
- [ ] Command palette
- [ ] Keyboard shortcuts
- [ ] MCP integration
- [ ] Settings UI
- [ ] Packaging

---

## Quick Reference for AI Assistants

When working on Jelico:

**Architecture**: Electron main + React renderer + Worker threads for agents

**Key Concepts**:
- **Workspaces** - Folders/repos with worktree support
- **Skills** - Capability modules (writer, researcher, coder, analyst, planner)
- **Agents** - Main agent + spawnable sub-agents with hierarchical reporting
- **Modes** - Auto, Explore, Execute, Plan, Review (Tab to cycle)

**Key Files**:
- `src/workspace/` - Workspace and worktree management
- `src/skills/` - Skill system and built-ins
- `src/agents/` - Agent runtime and modes
- `src/providers/` - AI provider abstraction
- `src/ui/` - React components

**Design Principles**:
1. Frictionless - no unnecessary prompts
2. Keyboard-first - everything has a shortcut
3. Context-aware - UI adapts to task
4. Parallel - worktrees + sub-agents for concurrent work

```bash
# Setup
npm create vite@latest jelico -- --template react-ts
cd jelico
npm install electron electron-builder
npm install @anthropic-ai/sdk openai
npm install zustand @monaco-editor/react
npm install simple-git keytar
```
