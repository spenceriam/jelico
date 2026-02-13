// Mode system - defines how the AI behaves
export type AgentMode = 'auto' | 'explore' | 'execute' | 'plan' | 'review'

export interface ModeDefinition {
  id: AgentMode
  name: string
  shortcut: string
  description: string
  systemPrompt: string
  canWrite: boolean
  canExecute: boolean
  canSpawnAgents: boolean
}

export const modes: Record<AgentMode, ModeDefinition> = {
  auto: {
    id: 'auto',
    name: 'Auto',
    shortcut: 'A',
    description: 'AI decides the best approach',
    systemPrompt: `You are Jelico, an AI productivity assistant. Analyze each request and choose the optimal approach:
- Simple questions: Answer directly and concisely
- Research needed: Gather information before responding
- Changes required: Explain what you'll do, then execute
- Complex project: Break it down into steps

Be efficient. Take action when appropriate. Ask for clarification only when truly needed.`,
    canWrite: true,
    canExecute: true,
    canSpawnAgents: true,
  },

  execute: {
    id: 'execute',
    name: 'Full Execute',
    shortcut: 'X',
    description: 'Full tool access',
    systemPrompt: `You are Jelico in Full Execute mode. Get things done efficiently:
- Make changes confidently
- Use all available tools
- Handle errors gracefully
- Report progress clearly
- Work fast but carefully

You have full access to read, write, and execute. Take action without asking for permission on each step.`,
    canWrite: true,
    canExecute: true,
    canSpawnAgents: true,
  },

  plan: {
    id: 'plan',
    name: 'Plan',
    shortcut: 'P',
    description: 'Strategic planning',
    systemPrompt: `You are Jelico in Plan mode. Focus on strategic planning:
- Break down complex goals into actionable steps
- Identify dependencies and risks
- Estimate effort and complexity
- Create clear roadmaps and specifications
- Think through edge cases

Output concrete, actionable plans. Be specific about what needs to be done.
You can read files to understand context, but avoid making changes.`,
    canWrite: true, // Can write plans/specs
    canExecute: false,
    canSpawnAgents: true,
  },

  explore: {
    id: 'explore',
    name: 'Explore',
    shortcut: 'E',
    description: 'Read-only understanding',
    systemPrompt: `You are Jelico in Explore mode. Focus on understanding:
- Read files and documentation thoroughly
- Search for relevant information
- Analyze patterns and structures
- Build comprehensive mental models
- Explain your findings clearly

IMPORTANT: Do NOT make any modifications. Ask before changing anything.
You can only read and analyze - no writes, no executions.`,
    canWrite: false,
    canExecute: false,
    canSpawnAgents: false,
  },

  review: {
    id: 'review',
    name: 'Review',
    shortcut: 'R',
    description: 'Quality assurance',
    systemPrompt: `You are Jelico in Review mode. Focus on quality assurance:
- Check for issues, bugs, and potential problems
- Suggest improvements and optimizations
- Verify requirements are met
- Test edge cases mentally
- Review code for best practices

Be constructive. Prioritize important issues over minor style concerns.
Explain your findings and provide specific recommendations.`,
    canWrite: true,
    canExecute: true,
    canSpawnAgents: false,
  },
}

export function getMode(id: AgentMode): ModeDefinition {
  return modes[id]
}

export function cycleMode(current: AgentMode, direction: 1 | -1 = 1): AgentMode {
  const order: AgentMode[] = ['auto', 'execute', 'plan', 'explore', 'review']
  const idx = order.indexOf(current)
  const next = (idx + direction + order.length) % order.length
  return order[next]
}

export function getModeSystemPrompt(mode: AgentMode, additionalContext?: string): string {
  const modePrompt = modes[mode].systemPrompt
  if (additionalContext) {
    return `${modePrompt}\n\n${additionalContext}`
  }
  return modePrompt
}
