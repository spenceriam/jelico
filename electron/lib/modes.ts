// Mode system - defines how the AI behaves
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export type AgentMode = 'auto' | 'explore' | 'execute' | 'plan' | 'review' | 'security-review' | 'pr-review'

// ============================================
// Modular Prompt Loading
// ============================================

// Get the prompts directory path
function getPromptsDir(): string {
  // In development, __dirname is dist-electron after compilation
  // Prompts are in electron/prompts (source) not dist-electron/prompts

  // Try electron/prompts first (source location)
  const electronPath = join(__dirname, '..', 'electron', 'prompts')
  if (existsSync(electronPath)) return electronPath

  // Try relative to dist-electron (compiled location)
  const devPath = join(__dirname, '..', 'prompts')
  if (existsSync(devPath)) return devPath

  // Fallback to prompts inside dist-electron (production bundle)
  const prodPath = join(__dirname, 'prompts')
  if (existsSync(prodPath)) return prodPath

  console.error('[Prompts] Could not find prompts directory, tried:', {
    electronPath,
    devPath,
    prodPath,
    __dirname,
  })
  return electronPath // Default
}

// Load a prompt file and return its contents
export function loadPromptFile(category: string, name: string): string | null {
  const promptsDir = getPromptsDir()
  const filePath = join(promptsDir, category, `${name}.md`)

  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8')
    }
  } catch (e) {
    console.error(`[Prompts] Failed to load ${category}/${name}.md:`, e)
  }
  return null
}

// Load multiple prompt files and concatenate
export function loadPrompts(files: Array<{ category: string; name: string }>): string {
  const parts: string[] = []

  for (const { category, name } of files) {
    const content = loadPromptFile(category, name)
    if (content) {
      parts.push(content)
    }
  }

  return parts.join('\n\n')
}

// Cache for loaded prompts (avoid repeated file reads)
const promptCache = new Map<string, string>()

export function getCachedPrompt(category: string, name: string): string | null {
  const key = `${category}/${name}`

  if (!promptCache.has(key)) {
    const content = loadPromptFile(category, name)
    if (content) {
      promptCache.set(key, content)
    }
  }

  return promptCache.get(key) || null
}

// Clear cache (useful for development/hot reload)
export function clearPromptCache(): void {
  promptCache.clear()
}

// Get the core persona from file (required - no embedded fallback)
export function getPersona(): string {
  const persona = getCachedPrompt('core', 'persona')
  if (!persona) {
    console.error('[Prompts] CRITICAL: Failed to load core/persona.md - using minimal fallback')
    return 'You are Jelico, an AI assistant. Always acknowledge what the user asked before taking action.'
  }
  return persona
}

export interface ModeDefinition {
  id: AgentMode
  name: string
  systemPrompt: string
}

export const modes: Record<AgentMode, ModeDefinition> = {
  auto: {
    id: 'auto',
    name: 'Auto',
    systemPrompt: `You are Jelico, an AI productivity assistant. Analyze each request and choose the optimal approach:
- Simple questions: Answer directly and concisely
- Research needed: Gather information before responding
- Changes required: Explain what you'll do, then execute
- Complex project: Break it down into steps

Be efficient. Take action when appropriate. Ask for clarification only when truly needed.`,
  },

  explore: {
    id: 'explore',
    name: 'Explore',
    systemPrompt: `You are Jelico in Explore mode. Focus on understanding:
- Read files and documentation thoroughly
- Search for relevant information
- Analyze patterns and structures
- Build comprehensive mental models
- Explain your findings clearly

IMPORTANT: Do NOT make any modifications. Ask before changing anything.
You can only read and analyze - no writes, no executions.`,
  },

  execute: {
    id: 'execute',
    name: 'Execute',
    systemPrompt: `You are Jelico in Execute mode. Get things done efficiently:
- Make changes confidently
- Use all available tools
- Handle errors gracefully
- Report progress clearly
- Work fast but carefully

You have full access to read, write, and execute. Take action without asking for permission on each step.`,
  },

  plan: {
    id: 'plan',
    name: 'Plan',
    systemPrompt: `You are Jelico in Plan mode. Focus on strategic planning:
- Break down complex goals into actionable steps
- Identify dependencies and risks
- Estimate effort and complexity
- Create clear roadmaps and specifications
- Think through edge cases

Output concrete, actionable plans. Be specific about what needs to be done.
You can read files to understand context, but avoid making changes.`,
  },

  review: {
    id: 'review',
    name: 'Review',
    systemPrompt: `You are Jelico in Review mode. Focus on quality assurance:
- Check for issues, bugs, and potential problems
- Suggest improvements and optimizations
- Verify requirements are met
- Test edge cases mentally
- Review code for best practices

Be constructive. Prioritize important issues over minor style concerns.
Explain your findings and provide specific recommendations.`,
  },

  'security-review': {
    id: 'security-review',
    name: 'Security Review',
    systemPrompt: `You are Jelico in Security Review mode. Focus on identifying vulnerabilities:
- READ-ONLY: You cannot modify files or run commands
- Analyze code for security vulnerabilities (OWASP Top 10)
- Focus on high-confidence issues (>80% certainty)
- Check for: injection, auth bypass, crypto issues, secrets exposure
- Skip: DoS, rate limiting, test file issues, theoretical concerns
- Only report exploitable vulnerabilities with real impact

Be precise. Minimize false positives. Explain exploitation scenarios.`,
  },

  'pr-review': {
    id: 'pr-review',
    name: 'PR Review',
    systemPrompt: `You are Jelico in PR Review mode. Focus on code review:
- Understand the PR's purpose and approach
- Review for correctness, quality, performance
- Check test coverage and edge cases
- Be constructive and specific with line references
- Acknowledge good decisions
- Prioritize important issues over nitpicks

Provide structured feedback: highlights, suggestions, questions, summary.`,
  },
}

export function getModeSystemPrompt(mode: AgentMode, includePersona: boolean = true): string {
  const modePrompt = modes[mode]?.systemPrompt || modes.auto.systemPrompt

  if (includePersona) {
    return `${getPersona()}\n\n## Current Mode: ${modes[mode]?.name || 'Auto'}\n${modePrompt}`
  }

  return modePrompt
}

// Build complete system prompt with persona, mode, and optional context
export function buildSystemPrompt(
  mode: AgentMode,
  options?: {
    userContext?: string // Memories and preferences
    workspaceContext?: string // Current workspace info
    soulLearnings?: string // Learned patterns
    includeSubAgents?: boolean // Include sub-agent documentation (default: true)
    includeArtifacts?: boolean // Include artifact documentation (default: true)
  }
): string {
  const parts: string[] = [getPersona()]

  // Add soul learnings if available
  if (options?.soulLearnings) {
    parts.push(`## What I've Learned About You\n${options.soulLearnings}`)
  }

  // Add user context (memories)
  if (options?.userContext) {
    parts.push(options.userContext)
  }

  // Add workspace context
  if (options?.workspaceContext) {
    parts.push(`## Current Workspace\n${options.workspaceContext}`)
  }

  // Add sub-agent documentation (default: include)
  if (options?.includeSubAgents !== false) {
    const subAgentDocs = getCachedPrompt('capabilities', 'sub-agents')
    if (subAgentDocs) {
      parts.push(subAgentDocs)
    }
  }

  // Add artifact documentation (default: include)
  if (options?.includeArtifacts !== false) {
    const artifactDocs = getCachedPrompt('capabilities', 'artifacts')
    if (artifactDocs) {
      parts.push(artifactDocs)
    }
  }

  // Add sandbox documentation (always include - it's critical)
  const sandboxDocs = getCachedPrompt('capabilities', 'sandbox')
  if (sandboxDocs) {
    parts.push(sandboxDocs)
  }

  // Add mode-specific instructions
  const modeDef = modes[mode] || modes.auto
  parts.push(`## Current Mode: ${modeDef.name}\n${modeDef.systemPrompt}`)

  return parts.join('\n\n')
}

// Build a LEAN system prompt that references capabilities without full docs
// Use this when you want to minimize context but still let AI know what's available
export function buildLeanSystemPrompt(
  mode: AgentMode,
  options?: {
    userContext?: string
    workspaceContext?: string
    soulLearnings?: string
  }
): string {
  const parts: string[] = [getPersona()]

  // Add soul learnings if available
  if (options?.soulLearnings) {
    parts.push(`## What I've Learned About You\n${options.soulLearnings}`)
  }

  // Add user context (memories)
  if (options?.userContext) {
    parts.push(options.userContext)
  }

  // Add workspace context
  if (options?.workspaceContext) {
    parts.push(`## Current Workspace\n${options.workspaceContext}`)
  }

  // Add capability summary instead of full docs
  parts.push(`## Available Capabilities

You have access to these capabilities. Tool descriptions contain detailed usage instructions.

### Artifacts
Create visual content for the Canvas panel using \`create_artifact\`.
- Types: code, html, document, svg, mermaid
- YOU create artifacts directly - do not delegate to sub-agents

### Sub-Agents (Research Only)
Spawn sub-agents for research tasks: reading files, searching, web fetching.
- Sub-agents gather information; YOU create artifacts
- Use \`wait_for_agent\` to get results (REQUIRED after spawning)

### Tools
File ops: read_file, list_directory, search_files, write_file
Web: web_search, web_fetch
Execution: execute_command
See each tool's description for detailed parameters and return values.`)

  // Add mode-specific instructions
  const modeDef = modes[mode] || modes.auto
  parts.push(`## Current Mode: ${modeDef.name}\n${modeDef.systemPrompt}`)

  return parts.join('\n\n')
}
