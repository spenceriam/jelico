/**
 * Sub-Agent Management Service
 *
 * Provides bi-directional communication between the main AI and sub-agents.
 * Sub-agents can:
 * - Pause and ask the main AI questions
 * - Continue working after receiving feedback
 * - Be explicitly dismissed (which clears their memory)
 *
 * Memory lifecycle:
 * - Memory persists until explicitly dismissed or orphan cleanup
 * - Orphaned agents (idle too long, parent dead) are auto-cleaned
 */

import { streamText, tool, type CoreMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { providerDb } from './database'
import { keychainService } from './keychain'
import { validateArtifact } from './artifactValidator'
import { artifactStreamManager } from './artifactStreamManager'
import { extractPartialArtifactContent } from './artifactUtils'
import { normalizeToolSchemas, createToolCallRepair } from '../lib/tooling'

// Configuration
const ORPHAN_CHECK_INTERVAL_MS = 60 * 1000 // Check for orphans every minute
const COMPLETED_AGENT_TTL_MS = 30 * 60 * 1000 // Keep completed agents for 30 min before cleanup
const DEAD_PARENT_GRACE_PERIOD_MS = 5 * 60 * 1000 // 5 min grace after parent dies
const DEFAULT_AGENT_LIMIT = 30 // Max sub-agents per conversation before requiring permission

// Track agent limits per conversation (can be increased with permission)
const conversationAgentLimits = new Map<string, number>()
const conversationAgentCounts = new Map<string, number>()

// Random first names for sub-agents (diverse, gender-neutral mix)
// 200+ gender-neutral names for sub-agents
const AGENT_FIRST_NAMES = [
  // A
  'Aiden', 'Alex', 'Alexis', 'Ali', 'Angel', 'Ari', 'Aria', 'Ariel', 'Ash', 'Aspen', 'August', 'Avery',
  // B
  'Bailey', 'Beck', 'Blake', 'Blue', 'Bobby', 'Brett', 'Brook', 'Brooklyn',
  // C
  'Cameron', 'Campbell', 'Carmen', 'Carson', 'Casey', 'Cedar', 'Charlie', 'Chris', 'Clay', 'Coby', 'Cody', 'Colby', 'Corey', 'Cruz',
  // D
  'Dakota', 'Dallas', 'Dana', 'Danny', 'Darcy', 'Denver', 'Devon', 'Drew', 'Dylan',
  // E
  'Echo', 'Eden', 'Elliott', 'Ellis', 'Ember', 'Emerson', 'Emery', 'Ever',
  // F
  'Fallon', 'Finley', 'Finn', 'Florian', 'Flynn', 'Frankie',
  // G
  'Gale', 'Gray', 'Greer',
  // H
  'Hadley', 'Harley', 'Harper', 'Hayden', 'Haven', 'Hero', 'Hollis', 'Honor',
  // I-J
  'Indigo', 'Ivory', 'Jace', 'Jackie', 'Jade', 'Jaden', 'Jamie', 'Jazz', 'Jess', 'Jesse', 'Jo', 'Jordan', 'Jude', 'Jules', 'Justice',
  // K
  'Kai', 'Kam', 'Karma', 'Keaton', 'Kelly', 'Kelsey', 'Kendall', 'Kennedy', 'Kerry', 'Kit', 'Koda',
  // L
  'Lake', 'Lane', 'Landry', 'Lark', 'Laurel', 'Lee', 'Leigh', 'Lennon', 'Lennox', 'Leo', 'Logan', 'London', 'Luca', 'Luna', 'Lyric',
  // M
  'Mackenzie', 'Marley', 'Marlowe', 'Max', 'Memphis', 'Micah', 'Mika', 'Milan', 'Monroe', 'Morgan', 'Murphy',
  // N
  'Nash', 'Navy', 'Nico', 'Noel', 'North', 'Nova',
  // O
  'Oak', 'Ocean', 'Oakley', 'Olive', 'Onyx', 'Ori',
  // P
  'Palmer', 'Parker', 'Pat', 'Payton', 'Peyton', 'Perry', 'Phoenix', 'Piper', 'Presley',
  // Q-R
  'Quinn', 'Raven', 'Ray', 'Reagan', 'Reed', 'Reese', 'Remi', 'Remy', 'Riley', 'Rio', 'River', 'Robin', 'Rory', 'Rowan', 'Royal', 'Rumi', 'Ryan',
  // S
  'Sage', 'Sam', 'Sasha', 'Sawyer', 'Scout', 'Sean', 'Shay', 'Shea', 'Sidney', 'Sky', 'Skyler', 'Sloane', 'Sol', 'Spencer', 'Storm', 'Story', 'Sunday', 'Sunny', 'Sydney',
  // T
  'Tanner', 'Tate', 'Taylor', 'Teagan', 'Terry', 'Theo', 'Toby', 'Tony', 'Tory', 'Tracy', 'True',
  // V-W
  'Val', 'Vesper', 'West', 'Whitney', 'Wil', 'Winter', 'Wren', 'Wynne',
  // X-Z
  'Xen', 'Yael', 'Yuki', 'Zane', 'Zara', 'Zeke', 'Zen', 'Zion', 'Zoe'
]

// Track used names per conversation to avoid duplicates
const usedNamesPerConversation = new Map<string, Set<string>>()

// Cache for agent prompts (loaded once from disk)
const agentPromptCache = new Map<string, string>()

/**
 * Load agent prompt from file with caching
 * Returns the prompt content or empty string if not found
 */
function loadAgentPrompt(agentType: string): string {
  if (agentPromptCache.has(agentType)) {
    return agentPromptCache.get(agentType)!
  }

  try {
    // Determine path based on whether we're in development or production
    const promptsDir = process.env.NODE_ENV === 'development'
      ? path.join(__dirname, '..', 'prompts', 'agents')
      : path.join(__dirname, 'prompts', 'agents')

    const promptPath = path.join(promptsDir, `${agentType}.md`)

    if (fs.existsSync(promptPath)) {
      const content = fs.readFileSync(promptPath, 'utf-8')
      agentPromptCache.set(agentType, content)
      return content
    }
  } catch (error) {
    console.error(`Failed to load agent prompt for ${agentType}:`, error)
  }

  return ''
}

/**
 * Get a unique random first name for a sub-agent in a conversation
 */
function getUniqueAgentFirstName(conversationId?: string): string {
  const key = conversationId || 'default'

  // Get or create the set of used names for this conversation
  if (!usedNamesPerConversation.has(key)) {
    usedNamesPerConversation.set(key, new Set())
  }
  const usedNames = usedNamesPerConversation.get(key)!

  // If all names are used, reset (unlikely with 60+ names)
  if (usedNames.size >= AGENT_FIRST_NAMES.length) {
    usedNames.clear()
  }

  // Find an unused name
  let attempts = 0
  let name: string
  do {
    name = AGENT_FIRST_NAMES[Math.floor(Math.random() * AGENT_FIRST_NAMES.length)]
    attempts++
  } while (usedNames.has(name) && attempts < 100)

  usedNames.add(name)
  return name
}

/**
 * Generate a display name from task description
 * Converts task descriptions into friendly action phrases
 */
function generateDisplayName(firstName: string, task: string): string {
  // Extract a short action from the task
  const lowerTask = task.toLowerCase()

  // Common patterns to extract action
  if (lowerTask.includes('create')) {
    const match = task.match(/create\s+(?:a\s+)?(.+?)(?:\s+as\s+|\s+with\s+|\s+for\s+|$)/i)
    if (match) {
      const target = match[1].split(/[.,!?]/)[0].trim().slice(0, 30)
      return `${firstName}: Creating ${target}`
    }
    return `${firstName}: Creating`
  }

  if (lowerTask.includes('read') || lowerTask.includes('analyze')) {
    const action = lowerTask.includes('analyze') ? 'Analyzing' : 'Reading'
    const match = task.match(/(?:read|analyze)\s+(?:and\s+\w+\s+)?(.+?)(?:\s+and\s+|\s+for\s+|$)/i)
    if (match) {
      const target = match[1].split(/[.,!?]/)[0].trim().slice(0, 30)
      return `${firstName}: ${action} ${target}`
    }
    return `${firstName}: ${action}`
  }

  if (lowerTask.includes('search') || lowerTask.includes('find')) {
    const action = 'Searching'
    const match = task.match(/(?:search|find)\s+(?:for\s+)?(.+?)(?:\s+in\s+|\s+and\s+|$)/i)
    if (match) {
      const target = match[1].split(/[.,!?]/)[0].trim().slice(0, 30)
      return `${firstName}: ${action} for ${target}`
    }
    return `${firstName}: ${action}`
  }

  if (lowerTask.includes('research')) {
    return `${firstName}: Researching`
  }

  if (lowerTask.includes('summarize')) {
    return `${firstName}: Summarizing`
  }

  if (lowerTask.includes('review') || lowerTask.includes('check')) {
    return `${firstName}: Reviewing`
  }

  if (lowerTask.includes('fix') || lowerTask.includes('debug')) {
    return `${firstName}: Debugging`
  }

  if (lowerTask.includes('implement') || lowerTask.includes('build')) {
    return `${firstName}: Building`
  }

  // Fallback: use first few words of task
  const words = task.split(/\s+/).slice(0, 4).join(' ')
  const truncated = words.length > 25 ? words.slice(0, 25) + '...' : words
  return `${firstName}: ${truncated}`
}

/**
 * Generate a compact summary of artifact content for main AI context.
 * Keeps summaries short (~150-200 chars) to minimize context impact.
 */
function generateArtifactSummary(type: string, title: string, content: string): string {
  const maxLen = 200

  if (type === 'html') {
    // Extract key features from HTML
    const features: string[] = []
    if (content.includes('<button')) features.push('buttons')
    if (content.includes('<input') || content.includes('<form')) features.push('inputs')
    if (content.includes('<canvas')) features.push('canvas')
    if (content.includes('fetch(') || content.includes('XMLHttpRequest')) features.push('API calls')
    if (content.includes('localStorage') || content.includes('sessionStorage')) features.push('storage')
    if (content.includes('addEventListener') || content.includes('onclick')) features.push('interactivity')
    if (content.includes('@keyframes') || content.includes('animation')) features.push('animations')
    if (content.includes('grid') || content.includes('flex')) features.push('modern layout')
    const featureStr = features.length > 0 ? `Features: ${features.slice(0, 4).join(', ')}` : ''
    const lineCount = content.split('\n').length
    return `HTML app "${title}" (${lineCount} lines). ${featureStr}`.slice(0, maxLen)
  }

  if (type === 'code') {
    // Extract function/class names
    const funcMatches = content.match(/(?:function|const|let|var)\s+(\w+)/g)?.slice(0, 5) || []
    const classMatches = content.match(/class\s+(\w+)/g)?.slice(0, 3) || []
    const exports = content.match(/export\s+(?:default\s+)?(?:function|class|const)\s+(\w+)/g)?.slice(0, 3) || []
    const items = [...new Set([...classMatches, ...funcMatches, ...exports])].slice(0, 5)
    const itemStr = items.length > 0 ? `Defines: ${items.join(', ')}` : ''
    const lineCount = content.split('\n').length
    return `Code "${title}" (${lineCount} lines). ${itemStr}`.slice(0, maxLen)
  }

  if (type === 'mermaid') {
    // Extract diagram type
    const diagramType = content.match(/^(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|gitGraph)/m)?.[1] || 'diagram'
    const nodeCount = (content.match(/\[.*?\]|\(.*?\)|{.*?}/g) || []).length
    return `Mermaid ${diagramType} "${title}" with ~${nodeCount} nodes`.slice(0, maxLen)
  }

  if (type === 'svg') {
    const elementTypes = [...new Set(content.match(/<(circle|rect|path|line|polygon|text|ellipse|g)/g)?.map(m => m.slice(1)) || [])]
    return `SVG "${title}" with ${elementTypes.slice(0, 4).join(', ') || 'graphics'}`.slice(0, maxLen)
  }

  if (type === 'document') {
    // Extract first heading or sentence
    const headingMatch = content.match(/^#+ (.+)$/m)
    const firstLine = headingMatch?.[1] || content.split('\n')[0]?.slice(0, 80) || ''
    const wordCount = content.split(/\s+/).length
    return `Document "${title}" (~${wordCount} words). ${firstLine}`.slice(0, maxLen)
  }

  // Fallback
  return `${type} artifact "${title}" (${content.length} chars)`.slice(0, maxLen)
}

export type SubAgentStatus =
  | 'pending'
  | 'running'
  | 'waiting_for_input' // Paused, waiting for main AI response
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'dismissed' // Explicitly dismissed, memory cleared

export interface SubAgentQuestion {
  question: string
  context?: string // Additional context about what the agent needs
  options?: string[] // Suggested options if applicable
  askedAt: number
}

// Progress update from sub-agent self-reporting
export interface ProgressUpdate {
  message: string
  phase?: string // e.g., "research", "building", "testing"
  timestamp: number
}

export interface SubAgentRecord {
  id: string
  parentStreamId: string // The stream that spawned this agent
  conversationId?: string // Parent conversation ID for cleanup tracking
  name: string // Internal task-based name (e.g., "WordleCreator")
  displayName: string // UI display name (e.g., "Maya: Creating Wordle")
  task: string
  mode: 'auto' | 'explore' | 'execute' | 'plan' | 'review' | 'security-review' | 'pr-review'
  status: SubAgentStatus
  progress: string // Streaming content so far
  result: string | null // Final result
  error: string | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  lastActivityAt: number // For orphan detection
  // Bi-directional communication
  pendingQuestion: SubAgentQuestion | null // Question waiting for main AI
  // Self-reported progress updates
  progressUpdates: ProgressUpdate[]
  // Disposable memory - conversation history for this agent
  messages: CoreMessage[]
  // Tool calls made by this agent
  toolCalls: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    output?: unknown
    error?: string  // Track tool-level errors
    duration?: number  // Track how long the tool took
  }>
  // Tool failure tracking for debugging
  toolFailures: Array<{
    toolName: string
    error: string
    input: Record<string, unknown>
    timestamp: number
  }>
  // Artifacts created by this agent
  createdArtifacts: Array<{
    id: string
    title: string
    type: string
    summary: string  // Compact description for main AI context
  }>
  // Auto-continue attempts for premature completion detection
  autoContinueAttempts: number
  // Force summary mode - disables tools to force text output
  forceSummaryMode: boolean
  // Track why the model stopped (for debugging premature completions)
  lastFinishReason: string | null
  // Provider info for continuation
  providerId: string
  model: string
  workspacePath?: string
  siblingContext?: string // Info about other agents working in parallel
}

// In-memory storage for active sub-agents
// Memory persists until explicitly dismissed or orphan cleanup
const activeAgents = new Map<string, SubAgentRecord>()

// Track abort controllers for cancellation
const agentAbortControllers = new Map<string, AbortController>()

// Event emitters for progress updates
type ProgressCallback = (agentId: string, agent: SubAgentRecord) => void
const progressListeners = new Map<string, Set<ProgressCallback>>()

// Global progress callback for IPC forwarding
type GlobalProgressCallback = (agentId: string, agent: SubAgentRecord) => void
let globalProgressCallback: GlobalProgressCallback | null = null

// Throttle tracking for progress updates (prevent IPC flooding)
const lastProgressUpdate = new Map<string, number>()
const PROGRESS_THROTTLE_MS = 500  // Only send progress updates every 500ms per agent

// Throttle tracking for artifact preview updates (prevent Monaco editor issues)
const lastArtifactPreviewUpdate = new Map<string, number>()
const ARTIFACT_PREVIEW_THROTTLE_MS = 150  // Only send artifact previews every 150ms

/**
 * Set global progress callback for IPC forwarding
 */
export function setGlobalProgressCallback(callback: GlobalProgressCallback | null) {
  globalProgressCallback = callback
}

/**
 * Check if enough time has passed to send another progress update
 */
function shouldSendProgressUpdate(agentId: string, forceImportant: boolean = false): boolean {
  if (forceImportant) return true  // Always send important updates (status changes)

  const now = Date.now()
  const lastUpdate = lastProgressUpdate.get(agentId) || 0
  if (now - lastUpdate >= PROGRESS_THROTTLE_MS) {
    lastProgressUpdate.set(agentId, now)
    return true
  }
  return false
}

// Track active parent streams (for orphan detection)
const activeParentStreams = new Set<string>()

// Orphan cleanup interval
let orphanCleanupInterval: NodeJS.Timeout | null = null

/**
 * Start orphan cleanup process
 *
 * Cleanup rules (status-based, not just timeout):
 * - NEVER cleanup agents that are: running, waiting_for_input (main AI might respond)
 * - Only cleanup if parent stream is DEAD (not just inactive)
 * - Even then, give a grace period for the main AI to potentially reconnect
 * - Completed/failed agents: cleanup after TTL if no one retrieves them
 */
export function startOrphanCleanup() {
  if (orphanCleanupInterval) return

  orphanCleanupInterval = setInterval(() => {
    const now = Date.now()
    let cleaned = 0

    for (const [id, agent] of activeAgents.entries()) {
      // Skip already dismissed agents
      if (agent.status === 'dismissed') continue

      const isParentDead = !activeParentStreams.has(agent.parentStreamId)
      const timeSinceActivity = now - agent.lastActivityAt

      // Determine if this agent should be cleaned up
      let shouldCleanup = false
      let reason = ''

      switch (agent.status) {
        case 'running':
        case 'waiting_for_input':
          // Active agents: only cleanup if parent is dead AND grace period exceeded
          if (isParentDead && timeSinceActivity > DEAD_PARENT_GRACE_PERIOD_MS) {
            shouldCleanup = true
            reason = 'parent dead + grace period exceeded'
          }
          break

        case 'completed':
        case 'failed':
        case 'cancelled':
          // Terminal states: cleanup after TTL if parent is dead
          if (isParentDead && timeSinceActivity > COMPLETED_AGENT_TTL_MS) {
            shouldCleanup = true
            reason = 'terminal state + parent dead + TTL exceeded'
          }
          break

        case 'pending':
          // Pending agents that never started: cleanup if parent dead
          if (isParentDead && timeSinceActivity > DEAD_PARENT_GRACE_PERIOD_MS) {
            shouldCleanup = true
            reason = 'never started + parent dead'
          }
          break
      }

      if (shouldCleanup) {
        // Cancel if running
        const controller = agentAbortControllers.get(id)
        if (controller) {
          controller.abort()
          agentAbortControllers.delete(id)
        }

        // Mark as dismissed and clear memory
        agent.status = 'dismissed'
        agent.messages = []
        agent.pendingQuestion = null
        activeAgents.delete(id)
        cleaned++

        console.log(`[SubAgents] Orphan cleanup: ${agent.name} (${id}) - ${reason}`)
      }
    }

    if (cleaned > 0) {
      console.log(`[SubAgents] Cleaned up ${cleaned} orphaned agent(s)`)
    }
  }, ORPHAN_CHECK_INTERVAL_MS)
}

/**
 * Stop orphan cleanup process
 */
export function stopOrphanCleanup() {
  if (orphanCleanupInterval) {
    clearInterval(orphanCleanupInterval)
    orphanCleanupInterval = null
  }
}

/**
 * Register a parent stream as active
 */
export function registerParentStream(streamId: string) {
  activeParentStreams.add(streamId)
}

/**
 * Unregister a parent stream (marks its agents for potential cleanup)
 */
export function unregisterParentStream(streamId: string) {
  activeParentStreams.delete(streamId)
}

/**
 * Spawn a new sub-agent
 */
export async function spawnSubAgent(params: {
  parentStreamId: string
  conversationId?: string
  name: string
  task: string
  mode?: 'auto' | 'explore' | 'execute' | 'plan' | 'review' | 'security-review' | 'pr-review'
  providerId: string
  model: string
  workspacePath?: string
  siblingContext?: string // Info about other agents working in parallel
}): Promise<string> {
  // Check agent limit for this conversation
  if (params.conversationId) {
    const currentCount = conversationAgentCounts.get(params.conversationId) || 0
    const limit = conversationAgentLimits.get(params.conversationId) || DEFAULT_AGENT_LIMIT

    if (currentCount >= limit) {
      throw new Error(
        `AGENT_LIMIT_EXCEEDED: You have reached the limit of ${limit} sub-agents for this conversation. ` +
        `To spawn more agents, you must ask the user for permission and explain why additional agents are needed. ` +
        `Current count: ${currentCount}/${limit}`
      )
    }

    // Increment count
    conversationAgentCounts.set(params.conversationId, currentCount + 1)
  }

  const agentId = randomUUID()
  const now = Date.now()

  // Generate unique display name with random first name
  const firstName = getUniqueAgentFirstName(params.conversationId)
  const displayName = generateDisplayName(firstName, params.task)

  // Auto-generate sibling context from other active agents (if not manually provided)
  // This helps agents coordinate and avoid duplicating work
  let effectiveSiblingContext = params.siblingContext || ''
  if (!effectiveSiblingContext && params.conversationId) {
    const siblingAgents = Array.from(activeAgents.values())
      .filter(a =>
        a.conversationId === params.conversationId &&
        a.status !== 'completed' &&
        a.status !== 'dismissed' &&
        a.status !== 'failed' &&
        a.status !== 'cancelled'
      )
    if (siblingAgents.length > 0) {
      effectiveSiblingContext = siblingAgents
        .map(a => `- ${a.displayName.split(':')[0]}: ${a.task.slice(0, 80)}${a.task.length > 80 ? '...' : ''}`)
        .join('\n')
      console.log(`[SubAgents] Auto-injected sibling context: ${siblingAgents.length} active agents`)
    }
  }

  const agent: SubAgentRecord = {
    id: agentId,
    parentStreamId: params.parentStreamId,
    conversationId: params.conversationId,
    name: params.name,
    displayName,
    task: params.task,
    mode: params.mode || 'auto',
    status: 'pending',
    progress: '',
    result: null,
    error: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    lastActivityAt: now,
    pendingQuestion: null,
    progressUpdates: [],
    messages: [],
    toolCalls: [],
    toolFailures: [],
    createdArtifacts: [],
    autoContinueAttempts: 0,
    forceSummaryMode: false,
    lastFinishReason: null,
    providerId: params.providerId,
    model: params.model,
    workspacePath: params.workspacePath,
    siblingContext: effectiveSiblingContext,
  }

  activeAgents.set(agentId, agent)

  console.log(`[SubAgents] Spawning: ${displayName} (${params.model})`)

  // Start the agent asynchronously
  runSubAgent(agentId)
    .then(() => {})
    .catch((error) => {
      console.error(`[SubAgents] Agent ${params.name} FAILED:`, error.message)
      console.error(`[SubAgents] Error stack:`, error.stack?.split('\n').slice(0, 5).join('\n'))
      const agent = activeAgents.get(agentId)
      if (agent && agent.status !== 'dismissed') {
        agent.status = 'failed'
        agent.error = error.message
        agent.completedAt = Date.now()
        agent.lastActivityAt = Date.now()
        notifyProgress(agentId, agent)
      }
    })

  return agentId
}

/**
 * Run a sub-agent (internal)
 */
/**
 * Create provider client
 *
 * Provider types map to API structures:
 * - anthropic: Anthropic native API
 * - openai: OpenAI native API
 * - google: Google Generative AI API
 * - Everything else: OpenAI-compatible API (with baseURL override)
 *
 * OpenAI-compatible includes: openrouter, ollama, zai, custom, local, etc.
 * All use the same createOpenAI() with different baseURL.
 */
function getProviderClient(providerConfig: any, apiKey: string | null) {
  switch (providerConfig.type) {
    // Native APIs
    case 'anthropic':
      return createAnthropic({ apiKey: apiKey || '' })
    case 'openai':
      return createOpenAI({
        apiKey: apiKey || '',
        baseURL: providerConfig.base_url || undefined,
      })
    case 'google':
      return createGoogleGenerativeAI({ apiKey: apiKey || '' })

    // OpenAI-compatible APIs (all use createOpenAI with baseURL)
    case 'openrouter':
      return createOpenAI({
        apiKey: apiKey || '',
        baseURL: providerConfig.base_url || 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': 'https://github.com/jelico-app/jelico',
          'X-Title': 'Jelico',
        },
      })
    case 'ollama':
      return createOpenAI({
        apiKey: 'ollama',
        baseURL: providerConfig.base_url || 'http://localhost:11434/v1',
      })

    // Z.ai providers (OpenAI-compatible)
    case 'zai':
      return createOpenAI({
        apiKey: apiKey || '',
        baseURL: 'https://api.z.ai/api/paas/v4',
      })
    case 'zai-china':
      return createOpenAI({
        apiKey: apiKey || '',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      })
    case 'zai-coding':
      return createOpenAI({
        apiKey: apiKey || '',
        baseURL: 'https://api.z.ai/api/coding/paas/v4',
      })
    case 'zai-coding-china':
      return createOpenAI({
        apiKey: apiKey || '',
        baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4',
      })

    // Generic compatible providers
    case 'custom':
    case 'openai-compatible':
    case 'anthropic-compatible':
    case 'local':
      return createOpenAI({
        apiKey: apiKey || 'local',
        baseURL: providerConfig.base_url || 'http://localhost:8080/v1',
      })

    default:
      // Fallback: treat unknown as OpenAI-compatible if it has a base_url
      if (providerConfig.base_url) {
        console.warn(`[SubAgents] Unknown provider type '${providerConfig.type}', treating as OpenAI-compatible`)
        return createOpenAI({
          apiKey: apiKey || '',
          baseURL: providerConfig.base_url,
        })
      }
      throw new Error(`Unknown provider type: ${providerConfig.type}`)
  }
}

// Markers that indicate the sub-agent needs clarification
const CLARIFICATION_MARKERS = [
  '[QUESTION]',
  '[REQUEST]',
  '[NEED CLARIFICATION]',
  '[WAITING FOR INPUT]',
  '[PAUSED]',
]

/**
 * Parse agent response to detect if it's asking a question
 */
function parseAgentResponse(text: string): { isQuestion: boolean; question?: SubAgentQuestion; cleanText: string } {
  // Check for explicit markers
  for (const marker of CLARIFICATION_MARKERS) {
    if (text.includes(marker)) {
      const markerIndex = text.indexOf(marker)
      const questionStart = markerIndex + marker.length
      const questionText = text.substring(questionStart).trim()

      return {
        isQuestion: true,
        question: {
          question: questionText || text,
          askedAt: Date.now(),
        },
        cleanText: text.substring(0, markerIndex).trim(),
      }
    }
  }

  // Check for question patterns at the end (heuristic)
  const lastSentence = text.split(/[.!]\s+/).pop()?.trim() || ''
  if (lastSentence.endsWith('?') && (
    lastSentence.toLowerCase().includes('should i') ||
    lastSentence.toLowerCase().includes('do you want') ||
    lastSentence.toLowerCase().includes('can you clarify') ||
    lastSentence.toLowerCase().includes('what would you') ||
    lastSentence.toLowerCase().includes('which option') ||
    lastSentence.toLowerCase().includes('please confirm')
  )) {
    return {
      isQuestion: true,
      question: {
        question: lastSentence,
        context: text.substring(0, text.lastIndexOf(lastSentence)).trim(),
        askedAt: Date.now(),
      },
      cleanText: text,
    }
  }

  return { isQuestion: false, cleanText: text }
}

/**
 * Validate text output quality - not just length, but actual content
 * Detects filler text, repetition, and ensures substantive output
 * Returns: { isValid: boolean, reason?: string, score: number }
 */
function validateOutputQuality(text: string, task: string): { isValid: boolean; reason?: string; score: number } {
  if (!text || text.trim().length === 0) {
    return { isValid: false, reason: 'empty output', score: 0 }
  }

  const cleanText = text.trim()
  const wordCount = cleanText.split(/\s+/).length
  const sentenceCount = (cleanText.match(/[.!?]+/g) || []).length
  const uniqueWords = new Set(cleanText.toLowerCase().split(/\s+/).filter(w => w.length > 3))

  // Minimum thresholds
  if (cleanText.length < 50) {
    return { isValid: false, reason: 'too short (< 50 chars)', score: 10 }
  }
  if (wordCount < 15) {
    return { isValid: false, reason: 'too few words (< 15)', score: 15 }
  }

  // Detect filler/placeholder patterns (expanded)
  const fillerPatterns = [
    /^(ok|okay|done|completed|finished|yes|no|sure|alright)\.?$/i,
    /^i (will|can|am going to|shall) /i,  // Promises without action
    /^let me /i,  // Setup without content
    /^here('s| is) (the|my|a) /i,  // Often incomplete
    /^i('ve| have) (searched|looked|read|found|completed|finished)/i,  // Claims without details
    /^(task|work|research) (is )?(complete|done|finished)/i,  // Premature completion claims
    /^(i |the )?(search|analysis|research) (is |was )?(complete|successful)/i,
    /^based on (my |the )?(research|analysis|findings)/i,  // Often followed by nothing
  ]

  for (const pattern of fillerPatterns) {
    if (pattern.test(cleanText) && wordCount < 40) {
      return { isValid: false, reason: 'filler/placeholder text detected', score: 20 }
    }
  }

  // Detect repetitive/padded content (anti-gaming)
  const wordRatio = uniqueWords.size / wordCount
  if (wordCount > 30 && wordRatio < 0.3) {
    return { isValid: false, reason: 'repetitive content detected', score: 25 }
  }

  // Detect lorem ipsum or obvious filler
  if (/lorem ipsum|placeholder|example text|sample content/i.test(cleanText)) {
    return { isValid: false, reason: 'placeholder content detected', score: 15 }
  }

  // Detect excessive use of generic phrases (anti-gaming)
  const genericPhrases = [
    'in conclusion', 'to summarize', 'in summary', 'as mentioned',
    'it is important', 'it should be noted', 'generally speaking',
    'in general', 'for the most part', 'as a result'
  ]
  const genericCount = genericPhrases.filter(p => cleanText.toLowerCase().includes(p)).length
  if (genericCount >= 3 && wordCount < 100) {
    return { isValid: false, reason: 'excessive generic phrases', score: 25 }
  }

  // Check for actual content indicators
  let score = 0

  // Good indicators (add points)
  if (cleanText.includes('found') || cleanText.includes('discovered')) score += 15
  if (cleanText.includes('result') || cleanText.includes('summary')) score += 10
  if (/https?:\/\//.test(cleanText)) score += 15  // Actual URLs
  if (/\.(js|ts|py|go|rs|md|json|html|css)/.test(cleanText)) score += 10  // File references
  if (sentenceCount >= 3) score += 15  // Multiple sentences
  if (sentenceCount >= 5) score += 10  // Even more sentences
  if (wordCount >= 50) score += 15  // Substantial content
  if (wordCount >= 100) score += 15  // Even more content
  if (wordCount >= 200) score += 10  // Very detailed
  if (/\d+/.test(cleanText)) score += 5  // Contains numbers (often data)
  if (cleanText.includes('\n') && cleanText.split('\n').length >= 3) score += 10  // Structured output
  if (uniqueWords.size >= 30) score += 10  // Good vocabulary diversity
  if (/```|`[^`]+`/.test(cleanText)) score += 10  // Code references
  if (/\*\*|##|- /.test(cleanText)) score += 5  // Markdown formatting (lists, headers)

  // Task-specific validation
  const taskLower = task.toLowerCase()
  if (taskLower.includes('search') || taskLower.includes('find')) {
    // Search tasks should mention what was found or not found
    if (!cleanText.toLowerCase().includes('found') &&
        !cleanText.toLowerCase().includes('result') &&
        !cleanText.toLowerCase().includes('no ') &&
        !cleanText.toLowerCase().includes("couldn't") &&
        !cleanText.toLowerCase().includes("didn't")) {
      score -= 15
    }
  }
  if (taskLower.includes('read') || taskLower.includes('analyze')) {
    // Analysis tasks should have substantial content
    if (wordCount < 30) score -= 15
  }

  // Minimum acceptable score
  const isValid = score >= 40
  return {
    isValid,
    reason: isValid ? undefined : `low quality score (${score})`,
    score
  }
}

/**
 * Callback for sending artifacts to the main window
 */
type SendArtifactCallback = (artifact: {
  type: string
  title: string
  content: string
  language?: string
}) => void

/**
 * Get tools for sub-agents
 * Sub-agents are RESEARCH ONLY - they can read/search files and web
 * They do NOT create artifacts (main AI does that directly)
 * They do NOT get agent management tools (can't spawn sub-sub-agents)
 */
function getSubAgentTools(
  mode: string,
  workspacePath?: string,
  agentContext?: {
    agentId: string
    agentName: string
    sendArtifact?: SendArtifactCallback
  }
) {
  // Read-only modes: explore, plan, security-review
  const readOnlyModes = ['explore', 'plan', 'security-review']
  const canWrite = !readOnlyModes.includes(mode)
  const canExecute = mode === 'auto' || mode === 'execute' || mode === 'review' || mode === 'pr-review'

  const tools: Record<string, any> = {}

  // Read file tool - always available
  tools.read_file = tool({
    description: 'Read the contents of a file at the specified path',
    parameters: z.object({
      path: z.string().describe('The file path to read'),
    }),
    execute: async ({ path }) => {
      try {
        const fs = await import('fs/promises')
        const content = await fs.readFile(path, 'utf-8')
        return { success: true, content }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },
  })

  // List directory tool - always available
  tools.list_directory = tool({
    description: 'List files and directories at the specified path',
    parameters: z.object({
      path: z.string().describe('The directory path to list'),
    }),
    execute: async ({ path }) => {
      try {
        const fs = await import('fs/promises')
        const entries = await fs.readdir(path, { withFileTypes: true })
        const items = entries.map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        }))
        return { success: true, items }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },
  })

  // Search files tool - always available
  tools.search_files = tool({
    description: 'Search for files matching a pattern',
    parameters: z.object({
      directory: z.string().describe('The directory to search in'),
      pattern: z.string().describe('Glob pattern to match files'),
    }),
    execute: async ({ directory, pattern }) => {
      try {
        const { glob } = await import('glob')
        const files = await glob(pattern, { cwd: directory })
        return { success: true, files }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },
  })

  // Web search tool - always available
  tools.web_search = tool({
    description: `Search the web for information using DuckDuckGo.
Returns instant answers, related topics, and web results.`,
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      try {
        const encodedQuery = encodeURIComponent(query)
        const response = await fetch(
          `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
        )

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`)
        }

        const data = await response.json()

        const results: any = {
          query,
          abstract: data.Abstract || null,
          abstractSource: data.AbstractSource || null,
          abstractURL: data.AbstractURL || null,
          answer: data.Answer || null,
          definition: data.Definition || null,
          relatedTopics: (data.RelatedTopics || []).slice(0, 5).map((topic: any) => ({
            text: topic.Text,
            url: topic.FirstURL,
          })).filter((t: any) => t.text),
        }

        if (results.abstract || results.answer || results.definition || results.relatedTopics.length > 0) {
          return { success: true, results }
        }

        return {
          success: true,
          results: {
            query,
            message: 'No instant answer found. Try using web_fetch with specific URLs.',
          },
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },
  })

  // Web fetch tool - always available
  tools.web_fetch = tool({
    description: `Fetch content from a URL. Returns the text content of the page.`,
    parameters: z.object({
      url: z.string().describe('The URL to fetch'),
    }),
    execute: async ({ url }) => {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Jelico/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        })

        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
        }

        const html = await response.text()

        // Simple HTML to text conversion
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim()

        // Truncate if too long
        const maxLength = 10000
        if (text.length > maxLength) {
          text = text.substring(0, maxLength) + '\n\n[Content truncated...]'
        }

        return { success: true, url, content: text }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },
  })

  // Write file tool - only if canWrite
  if (canWrite) {
    tools.write_file = tool({
      description: 'Write content to a file at the specified path',
      parameters: z.object({
        path: z.string().describe('The file path to write to'),
        content: z.string().describe('The content to write'),
      }),
      execute: async ({ path, content }) => {
        try {
          const fs = await import('fs/promises')
          const pathModule = await import('path')
          await fs.mkdir(pathModule.dirname(path), { recursive: true })
          await fs.writeFile(path, content, 'utf-8')
          return { success: true, message: `File written to ${path}` }
        } catch (error: any) {
          return { success: false, error: error.message }
        }
      },
    })
  }

  // Execute command tool - only if canExecute
  if (canExecute) {
    tools.execute_command = tool({
      description: 'Execute a shell command',
      parameters: z.object({
        command: z.string().describe('The command to execute'),
        cwd: z.string().optional().describe('Working directory for the command'),
      }),
      execute: async ({ command, cwd }) => {
        try {
          const { exec } = await import('child_process')
          const { promisify } = await import('util')
          const execAsync = promisify(exec)

          const workingDir = cwd || workspacePath || process.env.HOME || process.cwd()

          const result = await execAsync(command, {
            cwd: workingDir,
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024,
            shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
            env: { ...process.env },
          })

          return {
            success: true,
            stdout: result.stdout,
            stderr: result.stderr,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            stdout: error.stdout || '',
            stderr: error.stderr || '',
          }
        }
      },
    })
  }

  // NOTE: Sub-agents do NOT have create_artifact - main AI creates artifacts directly
  // This eliminates the complexity of sub-agent artifact creation and coordination

  // Report progress tool - always available
  // Allows sub-agent to self-report status updates to the main AI and user
  if (agentContext) {
    tools.report_progress = tool({
      description: `Report your current progress to the main AI and user. THIS IS ONLY A STATUS UPDATE - you must continue working on your task after calling this.

## IMPORTANT
- This tool ONLY reports status - it does NOT complete your task
- After calling this, you MUST continue with your actual work
- Your task is NOT done until you've created/delivered your output

## When to Use
Call this tool at natural checkpoints:
- When starting a new phase of work
- After completing a significant step
- Before a potentially long-running operation
- Every 2-3 tool calls for complex tasks

## Example Flow
1. report_progress("Starting research", "setup")
2. ... call web_search, read_file, etc. to do actual work ...
3. report_progress("Analyzing results", "analysis")
4. ... continue until task is actually complete with a summary ...`,
      parameters: z.object({
        message: z.string().describe('Brief description of what you are currently doing (e.g., "Building the navigation component")'),
        phase: z.string().optional().describe('Optional work phase (e.g., "setup", "building", "testing", "finishing")'),
      }),
      execute: async ({ message, phase }) => {
        const agent = activeAgents.get(agentContext.agentId)
        if (!agent) {
          return { success: false, error: 'Agent not found' }
        }

        // Create progress update
        const update: ProgressUpdate = {
          message,
          phase,
          timestamp: Date.now(),
        }

        // Store in agent record
        agent.progressUpdates.push(update)
        agent.lastActivityAt = Date.now()

        // Notify via global callback (forwards to UI)
        if (globalProgressCallback) {
          globalProgressCallback(agentContext.agentId, agent)
        }

        console.log(`[SubAgents] ${agent.displayName} progress: ${phase ? `[${phase}] ` : ''}${message}`)

        return {
          reported: true,
          note: 'Status update received. NOW CONTINUE WORKING - your task is not complete until you deliver the actual output (create artifact, write file, etc.)',
        }
      },
    })
  }

  return normalizeToolSchemas(tools)
}

/**
 * Run a sub-agent (internal)
 */
async function runSubAgent(agentId: string): Promise<void> {
  const agent = activeAgents.get(agentId)
  if (!agent) {
    console.error(`[SubAgents] Agent not found: ${agentId}`)
    return
  }
  if (agent.status === 'dismissed') {
    return
  }

  // Mark as running
  agent.status = 'running'
  agent.startedAt = agent.startedAt || Date.now()
  agent.lastActivityAt = Date.now()
  notifyProgress(agentId, agent)

  // Get provider config and API key
  const providerConfig = providerDb.get(agent.providerId)
  if (!providerConfig) {
    console.error(`[SubAgents] Provider not found: ${agent.providerId}`)
    throw new Error(`Provider not found: ${agent.providerId}`)
  }

  const apiKey = await keychainService.getApiKey(agent.providerId)
  const client = getProviderClient(providerConfig, apiKey)

  // Create abort controller
  const abortController = new AbortController()
  agentAbortControllers.set(agentId, abortController)

  // Build initial messages if this is a fresh start
  if (agent.messages.length === 0) {
    // Extract first name from displayName (format: "FirstName: action")
    const firstName = agent.displayName.split(':')[0].trim() || agent.name
    const systemPrompt = buildSubAgentSystemPrompt(
      firstName,
      agent.task,
      agent.mode,
      agent.workspacePath,
      agent.siblingContext
    )
    agent.messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: agent.task },
    ]
  }

  try {
    // Import BrowserWindow for IPC to renderer
    const { BrowserWindow } = await import('electron')

    // Create artifact callback that sends to renderer via IPC
    const sendArtifact: SendArtifactCallback = (artifact) => {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
      if (win) {
        // Send artifact to be added to the store
        win.webContents.send('ai:artifact:fromSubAgent', {
          ...artifact,
          agentId,
          agentName: agent.name,
        })
      }
    }

    // Get tools for this sub-agent based on its mode
    // In forceSummaryMode, disable all tools to force text output
    const tools = agent.forceSummaryMode
      ? {}  // No tools - forces model to output text only
      : getSubAgentTools(agent.mode, agent.workspacePath, {
          agentId,
          agentName: agent.name,
          sendArtifact,
        })

    if (agent.forceSummaryMode) {
      console.log(`[SubAgents] ${agent.name} in forceSummaryMode - tools disabled to force text output`)
    }

    // Stream response
    // IMPORTANT: Use .chat() to get Chat Completions API endpoint
    // Using client(model) defaults to Responses API which doesn't support
    // tool calling on most providers (OpenRouter, Ollama, Z.ai, etc.)
    const chatModel = client.chat(agent.model)
    const response = await streamText({
      model: chatModel,
      messages: agent.messages,
      tools,
      toolChoice: 'auto',
      maxSteps: 5, // Allow up to 5 tool call steps per agent run
      abortSignal: abortController.signal,
      experimental_repairToolCall: createToolCallRepair(chatModel),
    })

    // Accumulate the result using fullStream to handle text AND tool calls
    let fullText = ''
    let currentToolInput = '' // Accumulated tool input for artifact preview

    for await (const part of response.fullStream) {
      if (agent.status === 'dismissed') break

      switch (part.type) {
        case 'text-delta':
          // AI SDK may use 'text', 'textDelta', 'content', or 'chunk' depending on provider
          const textContent = (part as any).text || (part as any).textDelta || (part as any).content || (part as any).chunk
          if (textContent) {
            fullText += textContent
            agent.progress = fullText
            agent.lastActivityAt = Date.now()
            // Use throttled notification for text progress to prevent IPC flooding
            notifyProgress(agentId, agent, false)
          }
          break

        // Handle reasoning/thinking blocks from thinking models
        case 'reasoning':
        case 'reasoning-delta':
        case 'thinking':
        case 'thinking-delta':
          // For sub-agents, we just log reasoning - don't expose to UI
          const reasoningContent = (part as any).text || (part as any).content || (part as any).thinking || (part as any).reasoning || ''
          if (reasoningContent) {
            agent.lastActivityAt = Date.now()
          }
          break

        // Handle tool input streaming for artifact preview
        case 'tool-input-start': {
          const startToolName = (part as any).toolName || (part as any).name
          if (startToolName === 'create_artifact') {
            // Request preview lock from artifact stream manager
            artifactStreamManager.requestPreview(agentId, agent.name)
            // Reset accumulated input for this artifact
            currentToolInput = ''
          }
          agent.lastActivityAt = Date.now()
          break
        }

        case 'tool-input-delta': {
          const anyPart = part as any
          const inputDelta = anyPart.inputTextDelta || anyPart.delta || anyPart.argsTextDelta || ''

          if (inputDelta) {
            currentToolInput += inputDelta

            // If this agent has preview lock, stream the artifact content (throttled)
            if (artifactStreamManager.hasPreviewLock(agentId) && currentToolInput.length > 50) {
              const now = Date.now()
              const lastUpdate = lastArtifactPreviewUpdate.get(agentId) || 0

              // Throttle preview updates to prevent Monaco editor issues
              if (now - lastUpdate >= ARTIFACT_PREVIEW_THROTTLE_MS) {
                lastArtifactPreviewUpdate.set(agentId, now)
                const preview = extractPartialArtifactContent(currentToolInput)
                if (preview) {
                  artifactStreamManager.sendPreview(agentId, preview)
                }
              }
            }
          }
          agent.lastActivityAt = Date.now()
          break
        }

        case 'tool-input-end': {
          // Send final preview update before releasing lock (in case last update was throttled)
          if (artifactStreamManager.hasPreviewLock(agentId) && currentToolInput.length > 50) {
            const preview = extractPartialArtifactContent(currentToolInput)
            if (preview) {
              artifactStreamManager.sendPreview(agentId, preview)
            }
          }

          // Clean up throttle tracking
          lastArtifactPreviewUpdate.delete(agentId)

          // Release preview lock when artifact tool completes
          artifactStreamManager.releasePreview(agentId)
          agent.lastActivityAt = Date.now()
          break
        }

        case 'tool-call': {
          // Track tool calls made by this agent
          const tcToolCallId = part.toolCallId || (part as any).id
          const tcToolName = part.toolName || (part as any).name || 'unknown_tool'
          const toolArgs = (part as any).input || (part as any).args || (part as any).arguments || (part as any).parameters || {}

          if (!tcToolCallId) {
            console.warn(`[SubAgents] ${agent.name} tool-call missing toolCallId`)
            break
          }

          agent.toolCalls.push({
            id: tcToolCallId,
            name: tcToolName,
            input: toolArgs,
          })
          agent.lastActivityAt = Date.now()
          notifyProgress(agentId, agent)
          break
        }

        case 'tool-result': {
          // Update tool call with output
          const trToolCallId = part.toolCallId || (part as any).id
          const toolResult = (part as any).output || (part as any).result || (part as any).content

          if (!trToolCallId) {
            console.warn(`[SubAgents] ${agent.name} tool-result missing toolCallId`)
            break
          }

          const toolCall = agent.toolCalls.find(tc => tc.id === trToolCallId)
          if (toolCall) {
            toolCall.output = toolResult
          }
          agent.lastActivityAt = Date.now()
          notifyProgress(agentId, agent)
          break
        }

        case 'tool-error': {
          const teToolCallId = part.toolCallId || (part as any).id
          const toolError = (part as any).error || (part as any).message
          const errorMsg = typeof toolError === 'object' ? (toolError?.message || JSON.stringify(toolError)) : (toolError || 'Tool error')

          // Find the tool call to get its name and input
          const toolCall = teToolCallId ? agent.toolCalls.find(tc => tc.id === teToolCallId) : null
          const toolName = toolCall?.name || (part as any).toolName || 'unknown'
          const toolInput = toolCall?.input || {}

          // Log detailed error for debugging
          console.error(`[SubAgents] ${agent.name} TOOL ERROR:`, {
            tool: toolName,
            error: errorMsg,
            input: JSON.stringify(toolInput).slice(0, 200),
            callId: teToolCallId || 'unknown',
          })

          // Track failure for analysis
          agent.toolFailures.push({
            toolName,
            error: errorMsg,
            input: toolInput,
            timestamp: Date.now(),
          })

          if (toolCall) {
            toolCall.output = { error: errorMsg }
            toolCall.error = errorMsg
          }
          agent.lastActivityAt = Date.now()
          notifyProgress(agentId, agent)
          break
        }

        // Capture finish reason for debugging why model stopped
        case 'step-finish':
        case 'finish-step':
        case 'finish': {
          const finishReason = (part as any).finishReason || (part as any).finish_reason || (part as any).reason || 'unknown'
          agent.lastFinishReason = finishReason
          console.log(`[SubAgents] ${agent.name} step finished: ${finishReason}`)
          break
        }
      }
    }

    if (agent.status === 'dismissed') return

    // Check if agent is asking a question
    const parsed = parseAgentResponse(fullText)

    // Add response to conversation memory (with tool call context if any)
    const assistantMessage: CoreMessage = {
      role: 'assistant',
      content: fullText || (agent.toolCalls.length > 0 ? '[Used tools]' : ''),
    }
    agent.messages.push(assistantMessage)

    if (parsed.isQuestion && parsed.question) {
      // Agent is pausing for clarification
      agent.status = 'waiting_for_input'
      agent.pendingQuestion = parsed.question
      agent.progress = parsed.cleanText
      agent.lastActivityAt = Date.now()
      notifyProgress(agentId, agent)
    } else {
      // Check for premature completion - agent stopped without producing output
      const hasArtifacts = agent.createdArtifacts.length > 0

      // Creative output tools (files - sub-agents don't have create_artifact)
      const hasCreativeOutput = agent.toolCalls.some(tc =>
        ['write_file'].includes(tc.name)
      )

      // Research work tools (web search, file reading) - count as valid work done
      const hasResearchWork = agent.toolCalls.some(tc =>
        ['web_search', 'web_fetch', 'read_file', 'list_directory', 'search_files'].includes(tc.name)
      )

      // Validate text output quality (not just length)
      const outputQuality = validateOutputQuality(parsed.cleanText, agent.task)
      const hasTextResponse = outputQuality.isValid

      const calledReportProgress = agent.toolCalls.some(tc => tc.name === 'report_progress')
      const onlyCalledReportProgress = calledReportProgress &&
        agent.toolCalls.every(tc => tc.name === 'report_progress')

      // Detect if task requires creating creative output (artifacts/files)
      const taskLower = agent.task.toLowerCase()
      const taskRequiresCreativeOutput = /\b(create|build|make|implement|write|generate|develop|code)\b/.test(taskLower)

      // Research tasks need research work + text summary, not artifacts
      const taskIsResearch = /\b(research|find|search|look|analyze|investigate|explore)\b/.test(taskLower)

      // Count tool successes vs failures
      const toolSuccesses = agent.toolCalls.filter(tc => tc.output && !tc.error).length
      const toolErrors = agent.toolFailures.length

      // Debug logging for premature completion detection (silent to user, visible in console)
      console.log(`[SubAgents] ${agent.name} completion check:`, {
        finishReason: agent.lastFinishReason,
        hasArtifacts,
        hasCreativeOutput,
        hasResearchWork,
        outputQuality: { valid: outputQuality.isValid, score: outputQuality.score, reason: outputQuality.reason },
        calledReportProgress,
        onlyCalledReportProgress,
        taskRequiresCreativeOutput,
        taskIsResearch,
        toolCallNames: agent.toolCalls.map(tc => tc.name),
        toolSuccesses,
        toolErrors,
        autoContinueAttempts: agent.autoContinueAttempts,
      })

      // Premature completion detection:
      // 1. If only called report_progress with no real work - definitely premature
      // 2. If task requires creative output but none provided - premature
      // 3. If agent did any actual work but no quality text response - premature
      // 4. If agent had tool failures and no successful output - may need retry
      const hasActualWork = hasResearchWork || hasCreativeOutput || hasArtifacts
      const isPrematureNoOutput = onlyCalledReportProgress && agent.toolCalls.length > 0 && !hasArtifacts

      // For creative tasks, require artifact/file output
      const completedCreativeTask = hasCreativeOutput || hasArtifacts
      const isPrematureMissingDeliverable = taskRequiresCreativeOutput && !completedCreativeTask

      // ANY agent that did actual work should provide a quality text response
      // (unless it's a creative task that produced output - that speaks for itself)
      const isPrematureNoSummary = hasActualWork && !hasTextResponse && !completedCreativeTask

      // New: Detect if agent is struggling with tools (many failures, few successes)
      const isStrugglingWithTools = toolErrors > 2 && toolSuccesses === 0 && !hasTextResponse

      // Log premature detection decision (debug only, not shown to user)
      if (isPrematureNoOutput || isPrematureMissingDeliverable || isPrematureNoSummary || isStrugglingWithTools) {
        console.log(`[SubAgents] ${agent.name} detected as PREMATURE:`, {
          isPrematureNoOutput,
          isPrematureMissingDeliverable,
          isPrematureNoSummary,
          isStrugglingWithTools,
          hasActualWork,
          outputQuality,
          toolFailures: agent.toolFailures.map(f => ({ tool: f.toolName, error: f.error.slice(0, 100) })),
          autoContinueAttempts: agent.autoContinueAttempts,
        })
      }

      const MAX_AUTO_CONTINUE_ATTEMPTS = 10
      const needsRetry = isPrematureNoOutput || isPrematureMissingDeliverable || isPrematureNoSummary || isStrugglingWithTools

      if (needsRetry) {
        agent.autoContinueAttempts++

        if (agent.autoContinueAttempts > MAX_AUTO_CONTINUE_ATTEMPTS) {
          // Too many attempts - fail the agent silently (don't mention attempt count to user)
          agent.status = 'failed'
          agent.error = `Agent could not complete the task. Main AI should handle this directly.`
          agent.completedAt = Date.now()
          agent.lastActivityAt = Date.now()
          notifyProgress(agentId, agent)
          // Log detailed reason for debugging (not shown to user)
          const reason = isPrematureNoOutput
            ? `called report_progress ${agent.toolCalls.length} time(s) but never did actual work`
            : isStrugglingWithTools
            ? `tool failures: ${agent.toolFailures.map(f => `${f.toolName}: ${f.error.slice(0, 50)}`).join('; ')}`
            : isPrematureNoSummary
            ? `did work but never provided quality summary (score: ${outputQuality.score})`
            : `task required file output but agent never produced output`
          console.error(`[SubAgents] ${agent.name} failed after ${MAX_AUTO_CONTINUE_ATTEMPTS} attempts: ${reason}`)
          return
        }

        // Auto-continue the agent with context-appropriate reminder
        // If this is a no-summary issue, enable forceSummaryMode to disable tools
        if (isPrematureNoSummary && !isStrugglingWithTools) {
          agent.forceSummaryMode = true
          console.log(`[SubAgents] ${agent.name} enabling forceSummaryMode - tools will be disabled to force text output`)
        }

        // Build context-aware reminder message
        let reminderContent: string
        if (isStrugglingWithTools) {
          // Agent is having tool failures - give specific guidance
          const failedTools = [...new Set(agent.toolFailures.map(f => f.toolName))].join(', ')
          const recentErrors = agent.toolFailures.slice(-3).map(f => `- ${f.toolName}: ${f.error.slice(0, 100)}`).join('\n')
          reminderContent = `Some tools have encountered errors. Here's what failed:

${recentErrors}

Try a different approach:
- If a file path failed, check if it exists first with list_directory
- If web_fetch failed, try a different URL or use web_search instead
- If you can't complete the task with tools, explain what you attempted and what went wrong

Your task: ${agent.task}

Either complete the task with working tools, or provide a summary explaining what you tried and why it failed.`
        } else if (isPrematureNoSummary) {
          reminderContent = `Your tools have been DISABLED. You MUST now write your findings as text.

Your task was: ${agent.task}

You already completed the research. Now provide your findings.

WRITE YOUR SUMMARY NOW - describe:
1. What you searched for / read
2. What you found
3. Key insights or recommendations

DO NOT call any tools. Just write text. Start your response immediately.`
        } else if (isPrematureNoOutput) {
          reminderContent = `You called report_progress but then stopped. report_progress is NOT completion - it's just a status update.

Your task: ${agent.task}

REQUIRED ACTION:
1. Actually DO the work (use web_search, read_file, etc.)
2. Complete the task
3. Provide a comprehensive summary of your findings

Continue working NOW.`
        } else {
          reminderContent = `You ended without producing the required output.

Your task: ${agent.task}

This task requires you to create a file or artifact. Complete the work now.`
        }

        agent.messages.push({
          role: 'user',
          content: reminderContent,
        })
        agent.lastActivityAt = Date.now()

        // Recursively run the agent again (silent - user doesn't see retry)
        runSubAgent(agentId).catch((error) => {
          console.error(`[SubAgents] Error auto-continuing agent ${agentId}:`, error)
          agent.status = 'failed'
          agent.error = `Agent encountered an error. Main AI should handle this directly.`
          agent.completedAt = Date.now()
          notifyProgress(agentId, agent)
        })
        return // Don't mark as completed yet
      }

      // Normal completion - log final stats for debugging
      console.log(`[SubAgents] ${agent.name} COMPLETED:`, {
        finishReason: agent.lastFinishReason,
        toolCalls: agent.toolCalls.length,
        toolFailures: agent.toolFailures.length,
        outputQuality: { score: outputQuality.score, valid: outputQuality.isValid },
        textLength: parsed.cleanText?.length || 0,
        retries: agent.autoContinueAttempts,
      })

      agent.status = 'completed'
      agent.result = fullText
      agent.completedAt = Date.now()
      agent.lastActivityAt = Date.now()
      notifyProgress(agentId, agent)
    }

  } catch (error: any) {
    if (agent.status === 'dismissed') return

    if (error.name === 'AbortError') {
      agent.status = 'cancelled'
    } else {
      agent.status = 'failed'
      agent.error = error.message
    }
    agent.completedAt = Date.now()
    agent.lastActivityAt = Date.now()
    notifyProgress(agentId, agent)
    throw error
  } finally {
    agentAbortControllers.delete(agentId)
  }
}

/**
 * Continue a sub-agent with a response to its question or feedback
 */
export async function continueSubAgent(
  agentId: string,
  response: string
): Promise<{ success: boolean; error?: string }> {
  const agent = activeAgents.get(agentId)

  if (!agent) {
    return { success: false, error: 'Agent not found' }
  }

  if (agent.status === 'dismissed') {
    return { success: false, error: 'Agent has been dismissed' }
  }

  if (agent.status !== 'waiting_for_input' && agent.status !== 'completed' && agent.status !== 'failed') {
    return { success: false, error: `Agent is ${agent.status}, cannot continue` }
  }

  // Add the response to conversation memory
  agent.messages.push({ role: 'user', content: response })
  agent.pendingQuestion = null
  agent.lastActivityAt = Date.now()

  // If was completed/failed, we're doing a "continue with feedback" scenario
  if (agent.status === 'completed' || agent.status === 'failed') {
    agent.result = null
    agent.error = null
    agent.completedAt = null
  }

  // Resume the agent
  runSubAgent(agentId).catch((error) => {
    console.error(`[SubAgents] Error continuing agent ${agentId}:`, error)
  })

  return { success: true }
}

/**
 * Dismiss a sub-agent and clear its memory
 */
export function dismissSubAgent(agentId: string): { success: boolean; error?: string } {
  const agent = activeAgents.get(agentId)

  if (!agent) {
    return { success: false, error: 'Agent not found' }
  }

  // Cancel if running
  const controller = agentAbortControllers.get(agentId)
  if (controller) {
    controller.abort()
    agentAbortControllers.delete(agentId)
  }

  // Clear memory and mark as dismissed
  agent.status = 'dismissed'
  agent.messages = []
  agent.pendingQuestion = null
  agent.result = null
  agent.progress = ''

  // Remove from active agents
  activeAgents.delete(agentId)

  // Clean up progress tracking to prevent memory leaks
  lastProgressUpdate.delete(agentId)

  return { success: true }
}

/**
 * Dismiss all sub-agents for a conversation
 */
export function dismissAgentsForConversation(conversationId: string): number {
  let dismissed = 0

  for (const [id, agent] of activeAgents.entries()) {
    if (agent.conversationId === conversationId) {
      dismissSubAgent(id)
      dismissed++
    }
  }

  return dismissed
}

/**
 * Build system prompt for sub-agent
 */
function buildSubAgentSystemPrompt(
  name: string,
  task: string,
  mode: string,
  workspacePath?: string,
  siblingContext?: string
): string {
  let prompt = `You are ${name}, a focused research sub-agent.

Your task: ${task}

## CRITICAL: You MUST Output Text (NON-NEGOTIABLE)

**After using ANY tools, you MUST write a detailed text response (at least 100 words).**

❌ WRONG: Call web_search → [end turn with no text]
❌ WRONG: Call report_progress + web_search → [end turn with no text]
❌ WRONG: Output just "Done" or "I searched for X"

✅ RIGHT: Call tools → Write detailed summary of findings

**The main AI CANNOT see your tool results.** They only see your text output.
If you use tools but don't write text summarizing what you found, you have FAILED.

## Your Role

You are a RESEARCH agent. Your job is to gather information and report findings.
- Read files, search codebases, fetch web content
- Analyze and summarize what you find IN TEXT
- Return clear, actionable findings to the main AI

**You do NOT create artifacts.** The main AI handles all artifact creation.

## Guidelines
- Stay focused on your assigned task
- **ALWAYS output substantial text summarizing your work** (REQUIRED!)
- Report progress so the user knows you're working
- Complete your research fully before finishing

## Progress Reporting

Use \`report_progress\` at checkpoints to show status (but this is NOT your final output):
- \`report_progress({ message: "Reading config files", phase: "research" })\`
- \`report_progress({ message: "Analyzing component structure", phase: "analysis" })\`

**report_progress is NOT completion!** After reporting progress, you must CONTINUE working and eventually output your findings as text.

## Your Final Response (REQUIRED)

After doing research, you MUST write a substantial text response with:
1. **Summary** - Key findings in 2-3 sentences
2. **Details** - Relevant specifics the main AI needs
3. **Recommendations** - If applicable, what should be done next

**If you don't write this summary, you have FAILED your task.**

## Communication with Main AI

### Asking Questions
If you need clarification or have a question:
1. Provide any partial work or context you have so far
2. Write [QUESTION] followed by your question
3. The main AI will respond and you can continue

Example:
"I've analyzed the code structure and found 3 potential approaches.
[QUESTION] Should I prioritize performance or readability for this refactor?"

### Requesting Capabilities
If you need a tool or capability you don't have:
1. Explain what you've tried or why you need it
2. Write [REQUEST] followed by what you need
3. The main AI may grant it, do it for you, or provide alternatives

Example:
"I found the files that need updating but I don't have write access.
[REQUEST] Write access to update src/config.ts
- What: Need to modify the API endpoint configuration
- Why: Current endpoint is deprecated
- Alternative: I can provide the exact changes for you to apply"

Only ask when truly necessary - try to complete the task autonomously when possible.

## Time Management & Graceful Completion

The main AI has a timeout waiting for you (typically 5 minutes). Work efficiently:

**Before timeout runs out:**
- If you sense time pressure, prioritize delivering a working result over perfection
- For artifacts: A complete but simple version is better than an incomplete complex one
- For research: Key findings first, details second

**If your task is complex:**
- Focus on the core requirement first
- Add enhancements only after the basics work
- Document what you completed vs. what remains

**If you encounter errors:**
- Try an alternative approach before giving up
- If stuck, return what you have with a clear explanation
- Don't loop infinitely on the same error

**Your final response should include:**
1. What you accomplished (be specific)
2. Any artifacts created (title and brief description)
3. Limitations or known issues (if any)
4. Suggestions for next steps (if the task isn't fully complete)
`

  // Add sibling context if provided
  if (siblingContext) {
    prompt += `\n## Sibling Agents
You are part of a coordinated effort. Other agents are working in parallel:
${siblingContext}

Your results will be combined with theirs by the main AI. Focus on your specific task but be aware of the bigger picture.
`
  }

  if (workspacePath) {
    prompt += `\n## Workspace Context\nWorking in: ${workspacePath}\n`
  }

  // Load specialized agent prompts based on mode
  // These prompts include detailed instructions, read-only enforcement, and output formats
  switch (mode) {
    case 'explore': {
      const explorePrompt = loadAgentPrompt('explore')
      if (explorePrompt) {
        prompt += '\n\n' + explorePrompt
      } else {
        prompt += '\n## Mode: EXPLORE\n=== READ-ONLY MODE ===\nYou can ONLY analyze code. You cannot modify files, create files, or run commands that change state.\nFocus on searching, reading, and summarizing findings.'
      }
      break
    }
    case 'plan': {
      const planPrompt = loadAgentPrompt('plan')
      if (planPrompt) {
        prompt += '\n\n' + planPrompt
      } else {
        prompt += '\n## Mode: PLAN\n=== READ-ONLY MODE ===\nYou can ONLY analyze code and create implementation plans. You cannot modify files, create files, or run commands.\nFocus on exploring the codebase and designing step-by-step plans.'
      }
      break
    }
    case 'security-review': {
      const securityPrompt = loadAgentPrompt('security-review')
      if (securityPrompt) {
        prompt += '\n\n' + securityPrompt
      } else {
        prompt += '\n## Mode: SECURITY REVIEW\n=== READ-ONLY MODE ===\nYou are a security engineer reviewing code for vulnerabilities.\nFocus on high-confidence security issues with real exploitation potential.'
      }
      break
    }
    case 'pr-review': {
      const prPrompt = loadAgentPrompt('pr-review')
      if (prPrompt) {
        prompt += '\n\n' + prPrompt
      } else {
        prompt += '\n## Mode: PR REVIEW\nYou are reviewing a pull request. Provide constructive feedback on code quality, correctness, and best practices.'
      }
      break
    }
    case 'execute':
      prompt += '\n## Mode: EXECUTE\nProvide implementation details and code. You can make changes to files and run commands.'
      break
    case 'review':
      prompt += '\n## Mode: REVIEW\nReview and critique code, suggest improvements. Be constructive and specific.'
      break
    default: {
      // For 'auto' and other modes, use general agent prompt
      const generalPrompt = loadAgentPrompt('general')
      if (generalPrompt) {
        prompt += '\n\n' + generalPrompt
      } else {
        prompt += '\n## Mode: AUTO\nUse your best judgment for the task.'
      }
    }
  }

  return prompt
}

/**
 * Heartbeat - main AI signals it's still interested in this agent
 * Prevents orphan cleanup while main AI is actively using the agent
 */
export function heartbeatAgent(agentId: string): boolean {
  const agent = activeAgents.get(agentId)
  if (!agent || agent.status === 'dismissed') return false

  agent.lastActivityAt = Date.now()
  return true
}

/**
 * Get sub-agent status and result
 */
export function getSubAgentStatus(agentId: string): {
  found: boolean
  status?: SubAgentStatus
  displayName?: string  // Friendly name like "Maya: Creating Wordle"
  progress?: string
  result?: string | null
  error?: string | null
  isComplete?: boolean
  hasQuestion?: boolean
  question?: SubAgentQuestion | null
  createdArtifacts?: Array<{ id: string; title: string; type: string; summary: string }>
  progressUpdates?: ProgressUpdate[]
} {
  const agent = activeAgents.get(agentId)
  if (!agent) {
    return { found: false }
  }

  // Update activity timestamp when status is checked
  agent.lastActivityAt = Date.now()

  const isTerminal = agent.status === 'completed' ||
                     agent.status === 'failed' ||
                     agent.status === 'cancelled' ||
                     agent.status === 'dismissed'

  return {
    found: true,
    status: agent.status,
    displayName: agent.displayName,
    progress: agent.progress,
    result: agent.result,
    error: agent.error,
    isComplete: isTerminal,
    hasQuestion: agent.status === 'waiting_for_input' && !!agent.pendingQuestion,
    question: agent.pendingQuestion,
    createdArtifacts: agent.createdArtifacts.length > 0 ? agent.createdArtifacts : undefined,
    progressUpdates: agent.progressUpdates.length > 0 ? agent.progressUpdates : undefined,
  }
}

/**
 * Wait for sub-agent to complete or pause with a question
 */
export function waitForSubAgent(
  agentId: string,
  timeoutMs: number = 60000
): Promise<{
  success: boolean
  result?: string
  error?: string
  timedOut?: boolean
  hasQuestion?: boolean
  question?: SubAgentQuestion | null
  createdArtifacts?: Array<{ id: string; title: string; type: string; summary: string }>
  progressUpdates?: ProgressUpdate[]
}> {
  return new Promise((resolve) => {
    const agent = activeAgents.get(agentId)

    if (!agent) {
      resolve({ success: false, error: 'Agent not found' })
      return
    }

    // Update activity timestamp
    agent.lastActivityAt = Date.now()

    // Helper to include progress updates in response
    const getProgressUpdates = () =>
      agent.progressUpdates.length > 0 ? agent.progressUpdates : undefined

    // Already in a resolvable state?
    if (agent.status === 'completed') {
      resolve({
        success: true,
        result: agent.result || '',
        createdArtifacts: agent.createdArtifacts.length > 0 ? agent.createdArtifacts : undefined,
        progressUpdates: getProgressUpdates(),
      })
      return
    }

    if (agent.status === 'failed') {
      resolve({
        success: false,
        error: agent.error || 'Agent failed',
        progressUpdates: getProgressUpdates(),
      })
      return
    }

    if (agent.status === 'cancelled' || agent.status === 'dismissed') {
      resolve({
        success: false,
        error: 'Agent was cancelled or dismissed',
        progressUpdates: getProgressUpdates(),
      })
      return
    }

    if (agent.status === 'waiting_for_input') {
      resolve({
        success: true,
        hasQuestion: true,
        question: agent.pendingQuestion,
        progressUpdates: getProgressUpdates(),
      })
      return
    }

    // Set up timeout
    const timeout = setTimeout(() => {
      cleanup()
      resolve({
        success: false,
        timedOut: true,
        error: 'Timed out waiting for agent',
        progressUpdates: getProgressUpdates(),
      })
    }, timeoutMs)

    // Listen for state changes
    const listener: ProgressCallback = (id, updatedAgent) => {
      if (id !== agentId) return

      // Update activity on any progress
      updatedAgent.lastActivityAt = Date.now()

      if (updatedAgent.status === 'completed') {
        cleanup()
        resolve({
          success: true,
          result: updatedAgent.result || '',
          createdArtifacts: updatedAgent.createdArtifacts.length > 0 ? updatedAgent.createdArtifacts : undefined,
          progressUpdates: updatedAgent.progressUpdates.length > 0 ? updatedAgent.progressUpdates : undefined,
        })
      } else if (updatedAgent.status === 'failed') {
        cleanup()
        resolve({
          success: false,
          error: updatedAgent.error || 'Agent failed',
          progressUpdates: updatedAgent.progressUpdates.length > 0 ? updatedAgent.progressUpdates : undefined,
        })
      } else if (updatedAgent.status === 'cancelled' || updatedAgent.status === 'dismissed') {
        cleanup()
        resolve({
          success: false,
          error: 'Agent was cancelled or dismissed',
          progressUpdates: updatedAgent.progressUpdates.length > 0 ? updatedAgent.progressUpdates : undefined,
        })
      } else if (updatedAgent.status === 'waiting_for_input') {
        cleanup()
        resolve({
          success: true,
          hasQuestion: true,
          question: updatedAgent.pendingQuestion,
          progressUpdates: updatedAgent.progressUpdates.length > 0 ? updatedAgent.progressUpdates : undefined,
        })
      }
    }

    addProgressListener(agentId, listener)

    function cleanup() {
      clearTimeout(timeout)
      removeProgressListener(agentId, listener)
    }
  })
}

/**
 * Get all active sub-agents for a parent stream
 */
export function getSubAgentsForStream(parentStreamId: string): SubAgentRecord[] {
  const agents: SubAgentRecord[] = []
  for (const agent of activeAgents.values()) {
    if (agent.parentStreamId === parentStreamId) {
      agents.push(agent)
    }
  }
  return agents
}

/**
 * Cancel a sub-agent
 */
export function cancelSubAgent(agentId: string): boolean {
  const agent = activeAgents.get(agentId)
  if (!agent || agent.status !== 'running') {
    return false
  }

  const controller = agentAbortControllers.get(agentId)
  if (controller) {
    controller.abort()
  }

  agent.status = 'cancelled'
  agent.completedAt = Date.now()
  notifyProgress(agentId, agent)

  return true
}

/**
 * Cancel all running agents for a parent stream
 * Called when user explicitly stops - cancels running agents immediately
 */
export function cancelAgentsForStream(parentStreamId: string): number {
  let cancelled = 0

  for (const [id, agent] of activeAgents.entries()) {
    if (agent.parentStreamId === parentStreamId && agent.status === 'running') {
      cancelSubAgent(id)
      cancelled++
    }
  }

  return cancelled
}

/**
 * Dismiss all agents for a parent stream
 * Called when the parent stream ends - gives agents grace period before actual cleanup
 */
export function dismissAgentsForStream(parentStreamId: string): number {
  let dismissed = 0

  for (const [id, agent] of activeAgents.entries()) {
    if (agent.parentStreamId === parentStreamId) {
      // For running/waiting agents, just let them be cleaned up naturally
      // by the orphan cleanup after grace period
      if (agent.status === 'completed' || agent.status === 'failed' || agent.status === 'cancelled') {
        // Terminal states can be dismissed immediately
        dismissSubAgent(id)
        dismissed++
      }
      // Note: running/waiting_for_input agents will be caught by orphan cleanup
      // after the grace period, giving main AI a chance to continue them
    }
  }

  return dismissed
}

/**
 * Get summary of all sub-agent work for context
 * Useful for main AI to see what sub-agents have done
 */
export function getSubAgentsSummary(parentStreamId: string): string {
  const agents = getSubAgentsForStream(parentStreamId)

  if (agents.length === 0) {
    return 'No sub-agents have been spawned.'
  }

  let summary = 'Sub-agent activity:\n\n'

  for (const agent of agents) {
    summary += `**${agent.name}** (${agent.status})\n`
    summary += `Task: ${agent.task}\n`

    if (agent.result) {
      // Truncate long results
      const resultPreview = agent.result.length > 500
        ? agent.result.substring(0, 500) + '...'
        : agent.result
      summary += `Result: ${resultPreview}\n`
    } else if (agent.error) {
      summary += `Error: ${agent.error}\n`
    } else if (agent.status === 'running') {
      summary += `Progress: ${agent.progress.length} chars generated...\n`
    }

    summary += '\n'
  }

  return summary
}

// Progress notification helpers
// isImportant: true for status changes, false for text progress (throttled)
function notifyProgress(agentId: string, agent: SubAgentRecord, isImportant: boolean = true) {
  // Throttle non-important updates (text progress) to prevent IPC flooding
  if (!isImportant && !shouldSendProgressUpdate(agentId, false)) {
    return  // Skip this update, too soon after last one
  }

  // Notify per-agent listeners (always, for waitForSubAgent to work)
  const listeners = progressListeners.get(agentId)

  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(agentId, agent)
      } catch (e) {
        console.error('Error in progress listener:', e)
      }
    }
  }

  // Notify global callback for IPC forwarding
  if (globalProgressCallback) {
    try {
      globalProgressCallback(agentId, agent)
    } catch (e) {
      console.error('Error in global progress callback:', e)
    }
  } else if (agent.status === 'completed' || agent.status === 'failed') {
    console.warn(`[SubAgents] WARNING: No global callback when agent ${agent.name} finished!`)
  }
}

function addProgressListener(agentId: string, listener: ProgressCallback) {
  let listeners = progressListeners.get(agentId)
  if (!listeners) {
    listeners = new Set()
    progressListeners.set(agentId, listeners)
  }
  listeners.add(listener)
}

function removeProgressListener(agentId: string, listener: ProgressCallback) {
  const listeners = progressListeners.get(agentId)
  if (listeners) {
    listeners.delete(listener)
    if (listeners.size === 0) {
      progressListeners.delete(agentId)
    }
  }
}

// ============================================
// Agent Limit Management
// ============================================

/**
 * Get the current agent count and limit for a conversation
 */
export function getAgentLimit(conversationId: string): {
  current: number
  limit: number
  remaining: number
} {
  const current = conversationAgentCounts.get(conversationId) || 0
  const limit = conversationAgentLimits.get(conversationId) || DEFAULT_AGENT_LIMIT
  return {
    current,
    limit,
    remaining: Math.max(0, limit - current),
  }
}

/**
 * Increase the agent limit for a conversation (user granted permission)
 */
export function increaseAgentLimit(conversationId: string, additionalAgents: number = 10): {
  newLimit: number
  current: number
} {
  const currentLimit = conversationAgentLimits.get(conversationId) || DEFAULT_AGENT_LIMIT
  const newLimit = currentLimit + additionalAgents
  conversationAgentLimits.set(conversationId, newLimit)

  const current = conversationAgentCounts.get(conversationId) || 0
  return { newLimit, current }
}

/**
 * Reset agent count for a conversation (e.g., on conversation clear)
 */
export function resetAgentCount(conversationId: string): void {
  conversationAgentCounts.delete(conversationId)
  conversationAgentLimits.delete(conversationId)
  usedNamesPerConversation.delete(conversationId)
}

// Export types
export type { ProgressCallback }
