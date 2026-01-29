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

import { streamText, type CoreMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { providerDb } from './database'
import { keychainService } from './keychain'

// Configuration
const ORPHAN_CHECK_INTERVAL_MS = 60 * 1000 // Check for orphans every minute
const COMPLETED_AGENT_TTL_MS = 30 * 60 * 1000 // Keep completed agents for 30 min before cleanup
const DEAD_PARENT_GRACE_PERIOD_MS = 5 * 60 * 1000 // 5 min grace after parent dies

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

export interface SubAgentRecord {
  id: string
  parentStreamId: string // The stream that spawned this agent
  conversationId?: string // Parent conversation ID for cleanup tracking
  name: string
  task: string
  mode: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
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
  // Disposable memory - conversation history for this agent
  messages: CoreMessage[]
  // Tool calls made by this agent
  toolCalls: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    output?: unknown
  }>
  // Provider info for continuation
  providerId: string
  model: string
  workspacePath?: string
}

// In-memory storage for active sub-agents
// Memory persists until explicitly dismissed or orphan cleanup
const activeAgents = new Map<string, SubAgentRecord>()

// Track abort controllers for cancellation
const agentAbortControllers = new Map<string, AbortController>()

// Event emitters for progress updates
type ProgressCallback = (agentId: string, agent: SubAgentRecord) => void
const progressListeners = new Map<string, Set<ProgressCallback>>()

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
  mode?: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
  providerId: string
  model: string
  workspacePath?: string
}): Promise<string> {
  const agentId = crypto.randomUUID()
  const now = Date.now()

  const agent: SubAgentRecord = {
    id: agentId,
    parentStreamId: params.parentStreamId,
    conversationId: params.conversationId,
    name: params.name,
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
    messages: [],
    toolCalls: [],
    providerId: params.providerId,
    model: params.model,
    workspacePath: params.workspacePath,
  }

  activeAgents.set(agentId, agent)

  // Start the agent asynchronously
  runSubAgent(agentId)
    .catch((error) => {
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
 * Run a sub-agent (internal)
 */
async function runSubAgent(agentId: string): Promise<void> {
  const agent = activeAgents.get(agentId)
  if (!agent || agent.status === 'dismissed') return

  // Mark as running
  agent.status = 'running'
  agent.startedAt = agent.startedAt || Date.now()
  agent.lastActivityAt = Date.now()
  notifyProgress(agentId, agent)

  // Get provider config and API key
  const providerConfig = providerDb.get(agent.providerId)
  if (!providerConfig) {
    throw new Error(`Provider not found: ${agent.providerId}`)
  }

  const apiKey = await keychainService.getApiKey(agent.providerId)
  const client = getProviderClient(providerConfig, apiKey)

  // Create abort controller
  const abortController = new AbortController()
  agentAbortControllers.set(agentId, abortController)

  // Build initial messages if this is a fresh start
  if (agent.messages.length === 0) {
    const systemPrompt = buildSubAgentSystemPrompt(agent.name, agent.task, agent.mode, agent.workspacePath)
    agent.messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: agent.task },
    ]
  }

  try {
    // Stream response
    // IMPORTANT: Use .chat() to get Chat Completions API endpoint
    // Using client(model) defaults to Responses API which doesn't support
    // tool calling on most providers (OpenRouter, Ollama, Z.ai, etc.)
    const response = await streamText({
      model: client.chat(agent.model),
      messages: agent.messages,
      abortSignal: abortController.signal,
    })

    // Accumulate the result
    let fullText = ''
    for await (const chunk of response.textStream) {
      if (agent.status === 'dismissed') break

      fullText += chunk
      agent.progress = fullText
      agent.lastActivityAt = Date.now()
      notifyProgress(agentId, agent)
    }

    if (agent.status === 'dismissed') return

    // Check if agent is asking a question
    const parsed = parseAgentResponse(fullText)

    // Add response to conversation memory
    agent.messages.push({ role: 'assistant', content: fullText })

    if (parsed.isQuestion && parsed.question) {
      // Agent is pausing for clarification
      agent.status = 'waiting_for_input'
      agent.pendingQuestion = parsed.question
      agent.progress = parsed.cleanText
      agent.lastActivityAt = Date.now()
      notifyProgress(agentId, agent)
      console.log(`[SubAgents] ${agent.name} paused with question: ${parsed.question.question}`)
    } else {
      // Agent completed
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

  console.log(`[SubAgents] Dismissed agent: ${agent.name} (${agentId})`)
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
  workspacePath?: string
): string {
  let prompt = `You are ${name}, a focused sub-agent working on a specific task.

Your task: ${task}

## Guidelines
- Stay focused on your assigned task
- Be concise and direct in your response
- Provide actionable results that can be used by the orchestrating AI

## Asking for Clarification
If you need clarification or have a question for the main AI:
1. Provide any partial work or context you have so far
2. Then write [QUESTION] followed by your question
3. The main AI will respond and you can continue

Example:
"I've analyzed the code structure and found 3 potential approaches.
[QUESTION] Should I prioritize performance or readability for this refactor?"

Only ask questions when truly necessary - try to complete the task autonomously when possible.
`

  if (workspacePath) {
    prompt += `\n## Workspace Context\n${workspacePath}\n`
  }

  switch (mode) {
    case 'explore':
      prompt += '\n## Mode: EXPLORE\nFocus on analysis and research. Do not suggest changes.'
      break
    case 'execute':
      prompt += '\n## Mode: EXECUTE\nProvide implementation details and code.'
      break
    case 'plan':
      prompt += '\n## Mode: PLAN\nCreate structured plans and strategies.'
      break
    case 'review':
      prompt += '\n## Mode: REVIEW\nReview and critique, suggest improvements.'
      break
    default:
      prompt += '\n## Mode: AUTO\nUse your best judgment for the task.'
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
  progress?: string
  result?: string | null
  error?: string | null
  isComplete?: boolean
  hasQuestion?: boolean
  question?: SubAgentQuestion | null
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
    progress: agent.progress,
    result: agent.result,
    error: agent.error,
    isComplete: isTerminal,
    hasQuestion: agent.status === 'waiting_for_input' && !!agent.pendingQuestion,
    question: agent.pendingQuestion,
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
}> {
  return new Promise((resolve) => {
    const agent = activeAgents.get(agentId)

    if (!agent) {
      resolve({ success: false, error: 'Agent not found' })
      return
    }

    // Update activity timestamp
    agent.lastActivityAt = Date.now()

    // Already in a resolvable state?
    if (agent.status === 'completed') {
      resolve({ success: true, result: agent.result || '' })
      return
    }

    if (agent.status === 'failed') {
      resolve({ success: false, error: agent.error || 'Agent failed' })
      return
    }

    if (agent.status === 'cancelled' || agent.status === 'dismissed') {
      resolve({ success: false, error: 'Agent was cancelled or dismissed' })
      return
    }

    if (agent.status === 'waiting_for_input') {
      resolve({
        success: true,
        hasQuestion: true,
        question: agent.pendingQuestion,
      })
      return
    }

    // Set up timeout
    const timeout = setTimeout(() => {
      cleanup()
      resolve({ success: false, timedOut: true, error: 'Timed out waiting for agent' })
    }, timeoutMs)

    // Listen for state changes
    const listener: ProgressCallback = (id, updatedAgent) => {
      if (id !== agentId) return

      // Update activity on any progress
      updatedAgent.lastActivityAt = Date.now()

      if (updatedAgent.status === 'completed') {
        cleanup()
        resolve({ success: true, result: updatedAgent.result || '' })
      } else if (updatedAgent.status === 'failed') {
        cleanup()
        resolve({ success: false, error: updatedAgent.error || 'Agent failed' })
      } else if (updatedAgent.status === 'cancelled' || updatedAgent.status === 'dismissed') {
        cleanup()
        resolve({ success: false, error: 'Agent was cancelled or dismissed' })
      } else if (updatedAgent.status === 'waiting_for_input') {
        cleanup()
        resolve({
          success: true,
          hasQuestion: true,
          question: updatedAgent.pendingQuestion,
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
function notifyProgress(agentId: string, agent: SubAgentRecord) {
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

// Export types
export type { ProgressCallback }
