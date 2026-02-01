import { ipcMain, BrowserWindow } from 'electron'
import { streamText, tool, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { providerDb } from '../services/database'
import { keychainService } from '../services/keychain'
import { getModeSystemPrompt, type AgentMode } from '../lib/modes'
import {
  checkPermission,
  requestPermission,
  classifyCommand,
} from '../services/permissionChecker'
import {
  spawnSubAgent,
  getSubAgentStatus,
  waitForSubAgent,
  getSubAgentsForStream,
  getSubAgentsSummary,
  continueSubAgent,
  dismissSubAgent,
  dismissAgentsForStream,
  cancelAgentsForStream,
  registerParentStream,
  unregisterParentStream,
  startOrphanCleanup,
  heartbeatAgent,
  setGlobalProgressCallback,
  getAgentLimit,
  increaseAgentLimit,
} from '../services/subagents'
import { validateArtifact } from '../services/artifactValidator'
import { extractPartialArtifactContent } from '../services/artifactUtils'

// Start orphan cleanup on module load
startOrphanCleanup()

// Store active streams for cancellation
const activeStreams = new Map<string, AbortController>()

// Track pending clarification requests (requestId -> resolver)
interface PendingClarification {
  resolve: (answers: Record<string, string[]>) => void
  reject: (error: Error) => void
  channelId: string
}
const pendingClarifications = new Map<string, PendingClarification>()

// Debug flag - controlled by environment
const DEBUG_API_REQUESTS = process.env.DEBUG_AI === 'true' || process.env.NODE_ENV === 'development'

// Store accumulated tool input by toolCallId - needed because some providers stream args
// via tool-input-delta but don't populate the final tool-call args (SDK bug workaround)
const accumulatedToolInputByCallId = new Map<string, string>()

// Streaming timeout in ms (5 minutes for large artifacts)
const STREAM_TIMEOUT_MS = 600000 // 10 minutes - must be longer than wait_for_agent timeout

// Activity timeout - reset on any stream activity (30 seconds)
const ACTIVITY_TIMEOUT_MS = 30000

// Max retries for transient errors
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

// Helper to check if error is retryable
function isRetryableError(error: any): boolean {
  const message = error?.message?.toLowerCase() || ''
  return (
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    error?.status === 429 ||
    error?.status === 503 ||
    error?.status === 502
  )
}

// Sleep helper for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Debug logger that doesn't override global fetch
function logAIRequest(url: string, method: string, body: any) {
  if (!DEBUG_API_REQUESTS) return

  // Only log AI API requests
  if (!url.includes('openrouter') && !url.includes('openai') && !url.includes('anthropic') && !url.includes('google')) {
    return
  }

  console.log('[DEBUG AI] URL:', url)
  console.log('[DEBUG AI] Method:', method)

  if (body) {
    console.log('[DEBUG AI] Has tools:', !!body.tools)
    console.log('[DEBUG AI] Tool count:', body.tools?.length || 0)
    if (body.tools?.length > 0) {
      console.log('[DEBUG AI] Tool names:', body.tools.map((t: any) => t.function?.name || t.name))
    }
    console.log('[DEBUG AI] Model:', body.model)
    console.log('[DEBUG AI] Message count:', body.messages?.length)
    console.log('[DEBUG AI] Tool choice:', body.tool_choice)
  }
}

function getProviderInstance(providerConfig: any, apiKey: string) {
  switch (providerConfig.type) {
    case 'anthropic':
      return createAnthropic({ apiKey })
    case 'openai':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url || undefined,
      })
    case 'google':
      return createGoogleGenerativeAI({ apiKey })
    case 'openrouter':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url || 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': 'https://github.com/jelico-app/jelico',
          'X-Title': 'Jelico',
        },
      })
    case 'ollama':
      return createOpenAI({
        apiKey: 'ollama', // Ollama doesn't need a real key
        baseURL: providerConfig.base_url || 'http://localhost:11434/v1',
      })
    case 'custom':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url,
      })

    // Z.ai providers
    case 'zai':
      return createOpenAI({
        apiKey,
        baseURL: 'https://api.z.ai/api/paas/v4',
      })
    case 'zai-china':
      return createOpenAI({
        apiKey,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      })
    case 'zai-coding':
      return createOpenAI({
        apiKey,
        baseURL: 'https://api.z.ai/api/coding/paas/v4',
      })
    case 'zai-coding-china':
      return createOpenAI({
        apiKey,
        baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4',
      })

    // Generic compatible providers
    case 'openai-compatible':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url,
      })
    case 'anthropic-compatible':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url,
      })
    case 'local':
      return createOpenAI({
        apiKey: apiKey || 'local',
        baseURL: providerConfig.base_url || 'http://localhost:8080/v1',
      })

    default:
      throw new Error(`Unknown provider type: ${providerConfig.type}`)
  }
}

// Tool result tracking for proper context
interface ToolExecution {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
  startTime: number
  endTime?: number
}

// Todo state type for type safety
interface TodoTask {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'done'
}

// Define built-in tools
function getBuiltInTools(
  mode: AgentMode,
  streamContext: {
    channelId: string
    providerId: string
    model: string
    workspacePath?: string
    resetActivityTimeout?: () => void  // Allows blocking tools to keep stream alive
  },
  toolTracker: Map<string, ToolExecution>,
  sendArtifact?: (artifact: any) => void,
  sendSpawnAgent?: (agent: any) => void,
  sendUpdateArtifact?: (update: { id: string; updates: any }) => void,
  sendModeSwitch?: (fromMode: AgentMode, toMode: AgentMode, reason: string) => void,
  sendTodos?: (todos: TodoTask[]) => void,
  getTodos?: () => TodoTask[]
) {
  const canWrite = mode !== 'explore'
  const canExecute = mode === 'auto' || mode === 'execute' || mode === 'review'
  const canSpawnAgents = mode === 'auto' || mode === 'execute' || mode === 'plan'

  const tools: Record<string, any> = {}

  // Note: switch_mode tool removed - was causing AI to get distracted
  // instead of doing the actual task. Mode is now set by user only.

  // Todo tools - for tracking multi-step task progress
  // Always available - helps AI show work plan to user
  tools.todo_write = tool({
    description: `Create or update your task list. Use this at the START of multi-step tasks to show your plan.
The todo list appears in the UI with accent-colored border, showing your progress.

WHEN TO USE:
- At the start of any task with 3+ steps
- When planning your approach
- To update task status as you work

STATUS VALUES:
- "pending": Not started yet (☐)
- "in_progress": Currently working on this (◉ animated)
- "done": Completed (☑)

WORKFLOW:
1. At task start: todo_write with all steps as "pending"
2. Before each step: update that task to "in_progress"
3. After completing: update to "done"

Keep tasks clear and concise. The user sees this as a progress tracker.`,
    parameters: z.object({
      tasks: z.array(z.object({
        id: z.string().describe('Unique task ID (e.g., "1", "2", "3")'),
        text: z.string().describe('Clear, concise task description'),
        status: z.enum(['pending', 'in_progress', 'done']).describe('Current status'),
      })).describe('The complete task list'),
    }),
    execute: async ({ tasks }) => {
      if (sendTodos) {
        sendTodos(tasks)
      }
      const completed = tasks.filter(t => t.status === 'done').length
      return {
        success: true,
        message: `Task list updated: ${completed}/${tasks.length} completed`,
        tasks,
      }
    },
  })

  tools.todo_read = tool({
    description: `Read the current task list. Use this to check your progress or remind yourself of the plan.
Returns the current state of all tasks.`,
    parameters: z.object({}),
    execute: async () => {
      const tasks = getTodos ? getTodos() : []
      if (tasks.length === 0) {
        return {
          success: true,
          message: 'No tasks defined yet. Use todo_write to create a task list.',
          tasks: [],
        }
      }
      const completed = tasks.filter(t => t.status === 'done').length
      const inProgress = tasks.find(t => t.status === 'in_progress')
      return {
        success: true,
        tasks,
        progress: `${completed}/${tasks.length} completed`,
        currentTask: inProgress ? inProgress.text : null,
      }
    },
  })

  tools.todo_check = tool({
    description: `Validate you're working on the right task before taking action.
Call this before starting work on a task to ensure proper sequencing.
Returns validation result and updates the task status if valid.`,
    parameters: z.object({
      taskId: z.string().describe('The ID of the task you are about to work on'),
    }),
    execute: async ({ taskId }) => {
      const tasks = getTodos ? getTodos() : []
      const task = tasks.find(t => t.id === taskId)

      if (!task) {
        return {
          success: false,
          error: `Task "${taskId}" not found. Available tasks: ${tasks.map(t => t.id).join(', ')}`,
        }
      }

      if (task.status === 'done') {
        return {
          success: false,
          error: `Task "${taskId}" is already done. Move to the next task.`,
        }
      }

      // Auto-update status to in_progress
      const updatedTasks = tasks.map(t =>
        t.id === taskId ? { ...t, status: 'in_progress' as const } : t
      )
      if (sendTodos) {
        sendTodos(updatedTasks)
      }

      return {
        success: true,
        message: `Now working on: ${task.text}`,
        task: { ...task, status: 'in_progress' },
      }
    },
  })

  // Spawn sub-agent tool - for parallel task execution (bi-directional)
  if (canSpawnAgents) {
    tools.spawn_agent = tool({
      description: `Spawn a sub-agent to work on a task. The agent runs in the background while you continue.

## When to Use
- Creating artifacts (HTML, code, diagrams) - ALWAYS delegate to sub-agents
- Reading multiple files - spawn agents to read in parallel
- Research tasks - let agents search and summarize
- Any task that would bulk up your context

## What Happens
1. You call spawn_agent → returns { agent_id: "uuid-..." }
2. Sub-agent starts working immediately in background
3. If task involves artifacts, content streams to Canvas (user sees it building)
4. You MUST call wait_for_agent({ agent_id }) to get results

## What You'll Receive Back (from wait_for_agent)
- success: boolean
- result: The sub-agent's complete response text
- If artifact was created: the content is INCLUDED in result for your review
- has_question: true if agent needs your help
- error: if something went wrong

## Sub-Agent Capabilities
- Can read files, search, web search/fetch
- Can create artifacts that stream to Canvas
- Can ask you questions via [QUESTION] marker
- Can request capabilities via [REQUEST] marker

CRITICAL: You MUST call wait_for_agent before finishing your response.`,
      parameters: z.object({
        name: z.string().optional().describe('A short name for the agent (e.g., "Test Runner", "Code Reviewer"). Auto-generated if not provided.'),
        task: z.string().describe('The detailed task description for the agent'),
        mode: z.enum(['auto', 'explore', 'execute', 'plan', 'review'])
          .optional()
          .describe('The mode for the agent (defaults to auto)'),
        siblingContext: z.string().optional().describe('Info about other agents working in parallel (e.g., "Agent B is researching API docs"). Helps agents understand the bigger picture.'),
      }),
      execute: async ({ name, task, mode: agentMode, siblingContext }) => {
        // CRITICAL: Validate required parameters
        if (!task) {
          console.error('[AI] spawn_agent called without task')
          return {
            success: false,
            error: 'Missing required parameter: task. You MUST provide a task description when calling spawn_agent.',
          }
        }
        // Auto-generate name if not provided
        const agentName = name || `Agent-${Date.now().toString(36).slice(-4)}`
        // Spawn the sub-agent using the service
        const agentId = await spawnSubAgent({
          parentStreamId: streamContext.channelId,
          name: agentName,
          task,
          mode: agentMode || 'auto',
          providerId: streamContext.providerId,
          model: streamContext.model,
          workspacePath: streamContext.workspacePath,
          siblingContext,
        })

        // Notify the UI
        if (sendSpawnAgent) {
          sendSpawnAgent({ id: agentId, name: agentName, task, mode: agentMode || 'auto' })
        }

        return {
          success: true,
          agent_id: agentId,
          message: `Agent "${agentName}" spawned. You MUST call wait_for_agent("${agentId}") to get results before finishing.`,
        }
      },
    })

    // Get sub-agent status - check on a spawned agent
    tools.get_agent_status = tool({
      description: `Check a sub-agent's status without blocking. Returns immediately.

## Use Cases
- Check if an agent finished before calling wait_for_agent
- See what an agent has generated so far (progress field)
- Check if agent has a question waiting

## Return Values
- status: "pending" | "running" | "completed" | "failed" | "waiting_for_input"
- is_complete: true if agent finished (completed or failed)
- has_question: true if agent needs your response
- progress: Text generated so far (only while running)
- result: Final result (only when completed)`,
      parameters: z.object({
        agent_id: z.string().describe('The ID of the agent to check (from spawn_agent result)'),
      }),
      execute: async ({ agent_id }) => {
        const status = getSubAgentStatus(agent_id)

        if (!status.found) {
          return {
            success: false,
            error: `Agent not found: ${agent_id}. The agent may have been dismissed.`,
          }
        }

        return {
          success: true,
          status: status.status,
          is_complete: status.isComplete,
          has_question: status.hasQuestion,
          question: status.question?.question,
          question_context: status.question?.context,
          result: status.result,
          progress: status.isComplete ? undefined : status.progress,
          error: status.error,
          // Include artifact info so main AI knows what was created
          artifacts_created: status.createdArtifacts?.map(a => ({
            title: a.title,
            type: a.type,
          })),
        }
      },
    })

    // Wait for sub-agent completion or question - blocking wait
    tools.wait_for_agent = tool({
      description: `Wait for a sub-agent to complete and get its results. REQUIRED after spawn_agent.

## What This Does
- Blocks until the agent finishes (completes, fails, or asks a question)
- Returns the agent's full response including any artifact content
- Default timeout: 5 minutes (300 seconds)

## Return Values
- success: true if agent completed successfully
- result: The agent's complete response text
- artifacts_created: Array of artifacts the agent created (each has title, type)
- has_question: true if agent needs clarification - use continue_agent to respond
- question: The agent's question text (if has_question is true)
- timed_out: true if agent didn't finish in time
- error: Error message if failed

## Checking for Artifacts
The artifacts_created field tells you what the agent built:
- If artifacts_created is present, the agent created content visible in the Canvas
- Each artifact has { title, type } - e.g. { title: "Daily Wordle", type: "html" }
- The artifacts are ALREADY visible to the user - no need to create them again

## After Receiving Results
If the agent created an artifact:
1. Check artifacts_created to see what was built
2. The artifact is already in the Canvas - tell the user it's ready
3. If quality issues, use continue_agent to ask for fixes

## If Agent Has a Question
- has_question will be true
- Read the question field
- Use continue_agent({ agent_id, response: "your answer" }) to respond
- Then call wait_for_agent again to get final results`,
      parameters: z.object({
        agent_id: z.string().describe('The ID of the agent to wait for (from spawn_agent result)'),
        timeout_seconds: z.number().optional().describe('Maximum seconds to wait (default: 300)'),
      }),
      execute: async ({ agent_id, timeout_seconds }) => {
        // Validate agent_id is provided (some models send empty {})
        if (!agent_id) {
          return {
            success: false,
            error: 'Missing agent_id parameter. You must provide the agent_id from spawn_agent result.',
          }
        }

        const timeoutMs = (timeout_seconds || 300) * 1000

        // Keep the main stream alive while waiting by resetting activity timeout
        // This prevents the stream from timing out while blocked on wait_for_agent
        let keepAliveInterval: NodeJS.Timeout | null = null
        if (streamContext.resetActivityTimeout) {
          keepAliveInterval = setInterval(() => {
            streamContext.resetActivityTimeout?.()
          }, 10000) // Reset every 10 seconds
        }

        try {
          const result = await waitForSubAgent(agent_id, timeoutMs)

          if (result.timedOut) {
            return {
              success: false,
              timed_out: true,
              error: `Agent did not respond within ${timeout_seconds || 300} seconds`,
            }
          }

          if (result.hasQuestion) {
            return {
              success: true,
              has_question: true,
              question: result.question?.question,
              question_context: result.question?.context,
              message: 'Agent is waiting for your response. Use continue_agent to provide clarification.',
            }
          }

          return {
            success: result.success,
            result: result.result,
            error: result.error,
            // Include artifact info so main AI knows what was created
            artifacts_created: result.createdArtifacts?.map(a => ({
              title: a.title,
              type: a.type,
            })),
          }
        } finally {
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval)
          }
        }
      },
    })

    // Continue a sub-agent with feedback or answer to question
    tools.continue_agent = tool({
      description: `Send a message to a sub-agent to continue its work.

## Use Cases
1. **Answer a question**: Agent asked something (has_question=true) - provide your answer
2. **Request fixes**: Artifact has issues - tell agent what to fix
3. **Request status**: Agent taking long - ask for progress update
4. **Provide more context**: Agent needs additional information

## Example: Fixing an Artifact
After reviewing an artifact and finding issues:
continue_agent({
  agent_id: "<the agent_id>",
  response: "The button click handler is missing. Please add an onclick that increments the counter."
})
Then call wait_for_agent again to get the updated result.

## What Happens
- Your message is sent to the agent
- Agent continues working with its full memory preserved
- Agent will respond with updated results
- You must call wait_for_agent again to get those results`,
      parameters: z.object({
        agent_id: z.string().describe('The ID of the agent to continue'),
        response: z.string().describe('Your response, clarification, or feedback for the agent'),
      }),
      execute: async ({ agent_id, response }) => {
        const result = await continueSubAgent(agent_id, response)

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          }
        }

        return {
          success: true,
          message: `Agent will continue with your feedback. Use wait_for_agent to get the result.`,
        }
      },
    })

    // Dismiss a sub-agent and clear its memory
    tools.dismiss_agent = tool({
      description: `Dismiss a sub-agent and clear its memory.
Use this when you no longer need an agent's results or to free up resources.
The agent will be stopped if running and its conversation memory will be cleared.`,
      parameters: z.object({
        agent_id: z.string().describe('The ID of the agent to dismiss'),
      }),
      execute: async ({ agent_id }) => {
        const result = dismissSubAgent(agent_id)

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          }
        }

        return {
          success: true,
          message: 'Agent dismissed and memory cleared.',
        }
      },
    })

    // Get summary of all sub-agents for this conversation
    tools.get_agents_summary = tool({
      description: `Get an overview of all sub-agents you've spawned.

## Returns
- agent_count: Total number of agents
- running: Number still working
- completed: Number finished successfully
- failed: Number that failed
- summary: Text summary of each agent's task and status

## When to Use
- Before finishing, to ensure all agents are accounted for
- To see overall progress of parallel work
- To identify any agents that failed and need attention`,
      parameters: z.object({}),
      execute: async () => {
        const agents = getSubAgentsForStream(streamContext.channelId)
        const summary = getSubAgentsSummary(streamContext.channelId)

        return {
          success: true,
          agent_count: agents.length,
          completed: agents.filter(a => a.status === 'completed').length,
          running: agents.filter(a => a.status === 'running').length,
          failed: agents.filter(a => a.status === 'failed').length,
          summary,
        }
      },
    })
  }

  // Create artifact tool - always available
  // This allows the AI to create code, documents, HTML, etc. that appear in the Canvas
  tools.create_artifact = tool({
    description: `Create an artifact (code, document, HTML, SVG, or diagram) that will be displayed in the Canvas panel.
Use this when generating substantial content that the user may want to reference, edit, or download.
Types:
- code: Source code in any programming language
- document: Markdown document
- html: HTML content for preview
- svg: SVG graphics
- mermaid: Mermaid diagram syntax

IMPORTANT: You MUST provide all required parameters (type, title, content). Do not call this tool with empty arguments.`,
    parameters: z.object({
      type: z.enum(['code', 'document', 'html', 'svg', 'mermaid']).describe('The type of artifact'),
      title: z.string().describe('A short, descriptive title'),
      content: z.string().describe('The artifact content'),
      language: z.string().optional().describe('For code artifacts: the programming language (e.g., javascript, python)'),
    }).passthrough(), // Allow extra fields from models
    execute: async ({ type, title, content, language }) => {
      // CRITICAL: Validate required parameters - never execute with empty args
      if (!type || !title || !content) {
        const missing = []
        if (!type) missing.push('type')
        if (!title) missing.push('title')
        if (!content) missing.push('content')
        console.error('[AI] create_artifact called with missing required parameters:', missing)
        return {
          success: false,
          error: `Missing required parameters: ${missing.join(', ')}. You MUST provide type, title, and content when calling create_artifact.`,
        }
      }

      // Validate artifact content before creating
      const validation = validateArtifact(type, content, language)
      if (!validation.valid) {
        console.error('[AI] Artifact validation failed:', validation.errors)
        return {
          success: false,
          error: `Artifact validation failed:\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`,
          validationErrors: validation.errors,
        }
      }

      // Log warnings but still create
      if (validation.warnings.length > 0) {
        console.warn('[AI] Artifact validation warnings:', validation.warnings)
      }

      if (sendArtifact) {
        sendArtifact({ type, title, content, language })
      }
      return {
        success: true,
        message: `Artifact "${title}" created successfully`,
        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      }
    },
  })

  // Update artifact tool - always available
  // Allows AI to modify existing artifacts
  tools.update_artifact = tool({
    description: `Update an existing artifact in the Canvas panel.
Use this to modify, improve, or fix content in an artifact that already exists.
You must know the artifact ID from the existing artifacts context.

IMPORTANT: You MUST provide id, type, and content parameters. Do not call this tool with empty arguments.`,
    parameters: z.object({
      id: z.string().describe('The ID of the artifact to update'),
      type: z.enum(['code', 'document', 'html', 'svg', 'mermaid']).describe('The type of artifact (needed for validation)'),
      title: z.string().optional().describe('New title (if changing)'),
      content: z.string().describe('The updated content'),
      language: z.string().optional().describe('For code artifacts: the programming language (if changing)'),
    }),
    execute: async ({ id, type, title, content, language }) => {
      // CRITICAL: Validate required parameters
      if (!id || !content || !type) {
        const missing = []
        if (!id) missing.push('id')
        if (!type) missing.push('type')
        if (!content) missing.push('content')
        console.error('[AI] update_artifact called with missing required parameters:', missing)
        return {
          success: false,
          error: `Missing required parameters: ${missing.join(', ')}. You MUST provide id, type, and content when calling update_artifact.`,
        }
      }

      // Validate artifact content before updating
      const validation = validateArtifact(type, content, language)
      if (!validation.valid) {
        console.error('[AI] Artifact update validation failed:', validation.errors)
        return {
          success: false,
          error: `Artifact validation failed:\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`,
          validationErrors: validation.errors,
        }
      }

      // Log warnings but still update
      if (validation.warnings.length > 0) {
        console.warn('[AI] Artifact update validation warnings:', validation.warnings)
      }

      if (sendUpdateArtifact) {
        sendUpdateArtifact({ id, updates: { title, content, language } })
      }
      return {
        success: true,
        message: `Artifact "${id}" updated successfully`,
        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      }
    },
  })

  // Read file tool - always available
  tools.read_file = tool({
    description: 'Read the contents of a file at the specified path. You MUST provide the path parameter.',
    parameters: z.object({
      path: z.string().describe('The file path to read'),
    }),
    execute: async ({ path }) => {
      if (!path) {
        console.error('[AI] read_file called without path')
        return { success: false, error: 'Missing required parameter: path. You MUST provide a file path to read.' }
      }
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

  // Web search tool - using DuckDuckGo HTML search for better results
  tools.web_search = tool({
    description: `Search the web for information.
Returns search results with titles, snippets, and URLs.
Use this to find current information, documentation, or answers to questions.`,
    parameters: z.object({
      query: z.string().optional().describe('The search query'),
      // Some models send "queries" as an array instead of "query" as a string
      queries: z.array(z.string()).optional().describe('Alternative: array of search queries'),
    }).passthrough(),
    execute: async (args) => {
      // Handle both "query" (string) and "queries" (array) parameters
      let query = args.query
      if (!query && args.queries && args.queries.length > 0) {
        query = args.queries[0] // Use first query from array
        console.log('[web_search] Using first query from queries array:', query)
      }
      if (!query) {
        return { success: false, error: 'No search query provided' }
      }
      try {
        // Try DuckDuckGo instant answer first
        const encodedQuery = encodeURIComponent(query)
        const instantResponse = await fetch(
          `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
        )

        if (instantResponse.ok) {
          const data = await instantResponse.json()

          // If we got a good instant answer, return it
          if (data.Abstract || data.Answer || data.Definition) {
            return {
              success: true,
              results: {
                query,
                type: 'instant_answer',
                abstract: data.Abstract || null,
                abstractSource: data.AbstractSource || null,
                abstractURL: data.AbstractURL || null,
                answer: data.Answer || null,
                definition: data.Definition || null,
                relatedTopics: (data.RelatedTopics || []).slice(0, 5).map((topic: any) => ({
                  text: topic.Text,
                  url: topic.FirstURL,
                })).filter((t: any) => t.text),
              },
            }
          }
        }

        // Fallback: Use DuckDuckGo HTML lite for actual search results
        const htmlResponse = await fetch(
          `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Jelico/1.0)',
              'Accept': 'text/html',
            },
          }
        )

        if (htmlResponse.ok) {
          const html = await htmlResponse.text()

          // Extract search results from HTML
          const results: Array<{ title: string; url: string; snippet: string }> = []

          // Simple regex to extract result links and snippets
          const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
          const snippetRegex = /<td[^>]+class="result-snippet"[^>]*>([^<]+)/gi

          let match
          const urls: string[] = []
          const titles: string[] = []
          const snippets: string[] = []

          while ((match = linkRegex.exec(html)) !== null) {
            urls.push(match[1])
            titles.push(match[2].trim())
          }

          while ((match = snippetRegex.exec(html)) !== null) {
            snippets.push(match[1].trim())
          }

          for (let i = 0; i < Math.min(urls.length, 5); i++) {
            results.push({
              title: titles[i] || 'Untitled',
              url: urls[i],
              snippet: snippets[i] || '',
            })
          }

          if (results.length > 0) {
            return {
              success: true,
              results: {
                query,
                type: 'search_results',
                items: results,
              },
            }
          }
        }

        // Final fallback
        return {
          success: true,
          results: {
            query,
            type: 'no_results',
            message: 'No search results found. Try web_fetch with a specific URL for more information.',
          },
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },
  })

  // Web fetch tool - always available
  tools.web_fetch = tool({
    description: `Fetch content from a URL.
Returns the text content of the page (HTML stripped to plain text for readability).
Use this to read documentation, articles, or any web page content.`,
    parameters: z.object({
      url: z.string().describe('The URL to fetch'),
      selector: z.string().optional().describe('Optional CSS selector to extract specific content (e.g., "main", "article", ".content")'),
    }),
    execute: async ({ url, selector }) => {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Jelico/1.0; +https://github.com/jelico)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        })

        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
        }

        const html = await response.text()

        // Simple HTML to text conversion
        // Remove script and style tags
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
          // Convert common elements to readable format
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/h[1-6]>/gi, '\n\n')
          .replace(/<li>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          // Remove remaining tags
          .replace(/<[^>]+>/g, '')
          // Decode HTML entities
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          // Clean up whitespace
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim()

        // Truncate if too long
        const maxLength = 15000
        if (text.length > maxLength) {
          text = text.substring(0, maxLength) + '\n\n[Content truncated...]'
        }

        return {
          success: true,
          url,
          content: text,
          contentLength: text.length,
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },
  })

  // Ask user question tool - always available
  // Allows AI to ask clarifying questions before proceeding
  tools.ask_user_question = tool({
    description: `Ask the user for clarification before proceeding with a task.
Use this when you need to make a decision that depends on user preference, or when you need more information.

## When to Use
- Before starting tasks with multiple valid approaches
- When implementation details need user input
- When making decisions that affect project structure
- To confirm destructive or significant changes

## Parameters
- subject: Brief description of the task requiring clarification
- questions: Array of 1-4 questions, each with:
  - header: Short label (12 chars max) like "Auth method", "Library"
  - question: The full question to ask
  - options: 2-4 choices, each with label and description
  - multiSelect: true to allow multiple selections

## What Happens
1. A clarification UI appears inline in chat
2. User selects options or types custom "Other" response
3. You receive their answers and can proceed

Note: If recommended option, list it first with "(Recommended)" suffix.`,
    parameters: z.object({
      subject: z.string().describe('Brief description of the task requiring clarification'),
      questions: z.array(z.object({
        header: z.string().max(12).describe('Short label for the question (max 12 chars)'),
        question: z.string().describe('The full question to ask'),
        options: z.array(z.object({
          label: z.string().describe('Option label (add "(Recommended)" suffix if preferred)'),
          description: z.string().optional().describe('Additional context for this option'),
        })).min(2).max(4),
        multiSelect: z.boolean().optional().describe('Allow multiple selections (default: false)'),
      })).min(1).max(4),
    }),
    execute: async ({ subject, questions }) => {
      const { randomUUID } = await import('crypto')
      const requestId = randomUUID()

      // Build the request to send to UI
      const clarificationRequest = {
        id: requestId,
        subject,
        questions: questions.map((q, idx) => ({
          id: `q-${idx}`,
          question: q.question,
          header: q.header,
          options: q.options,
          multiSelect: q.multiSelect || false,
          selectedOptions: [],
          otherText: '',
        })),
        conversationId: streamContext.channelId,
        createdAt: Date.now(),
      }

      // Create a promise that will be resolved when user responds
      const answersPromise = new Promise<Record<string, string[]>>((resolve, reject) => {
        pendingClarifications.set(requestId, {
          resolve,
          reject,
          channelId: streamContext.channelId,
        })

        // Timeout after 5 minutes
        setTimeout(() => {
          if (pendingClarifications.has(requestId)) {
            pendingClarifications.delete(requestId)
            reject(new Error('Clarification request timed out'))
          }
        }, 300000)
      })

      // Send request to UI via IPC
      const { BrowserWindow } = await import('electron')
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        win.webContents.send('clarification:request', clarificationRequest)
      }

      // Keep the stream alive while waiting for response
      const keepAliveInterval = setInterval(() => {
        streamContext.resetActivityTimeout?.()
      }, 10000)

      try {
        // Wait for user response
        const answers = await answersPromise

        return {
          success: true,
          answers,
          message: 'User provided clarification. Proceed with their preferences.',
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to get user clarification',
        }
      } finally {
        clearInterval(keepAliveInterval)
        pendingClarifications.delete(requestId)
      }
    },
  })

  // Write file tool - only if canWrite
  if (canWrite) {
    tools.write_file = tool({
      description: 'Write content to a file at the specified path. You MUST provide both path and content parameters.',
      parameters: z.object({
        path: z.string().describe('The file path to write to'),
        content: z.string().describe('The content to write'),
      }),
      execute: async ({ path, content }) => {
        // CRITICAL: Validate required parameters
        if (!path || content === undefined || content === null) {
          const missing = []
          if (!path) missing.push('path')
          if (content === undefined || content === null) missing.push('content')
          console.error('[AI] write_file called with missing required parameters:', missing)
          return {
            success: false,
            error: `Missing required parameters: ${missing.join(', ')}. You MUST provide path and content when calling write_file.`,
          }
        }
        try {
          // Check permission before writing
          const permCheck = await checkPermission('write_file', { path, content }, streamContext.workspacePath)
          if (!permCheck.allowed && permCheck.reason === 'needs_approval') {
            // Request permission from user
            const result = await requestPermission({
              toolName: 'write_file',
              action: `Write to: ${path}`,
              description: `The AI wants to write ${content.length} characters to this file.`,
              preview: content.length > 500 ? content.slice(0, 500) + '\n...(truncated)' : content,
              workspaceId: streamContext.workspacePath,
            })
            if (result.permission === 'deny') {
              return { success: false, error: 'Permission denied by user' }
            }
          } else if (!permCheck.allowed) {
            return { success: false, error: `Permission denied: ${permCheck.reason}` }
          }

          const fs = await import('fs/promises')
          const pathModule = await import('path')
          // Ensure directory exists
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
      description: 'Execute a shell command. You MUST provide the command parameter.',
      parameters: z.object({
        command: z.string().describe('The command to execute'),
        cwd: z.string().optional().describe('Working directory for the command'),
      }),
      execute: async ({ command, cwd }) => {
        // CRITICAL: Validate required parameters
        if (!command) {
          console.error('[AI] execute_command called without command')
          return {
            success: false,
            error: 'Missing required parameter: command. You MUST provide a command to execute.',
          }
        }
        try {
          // Check permission - classifies command as safe/destructive/unknown
          const permCheck = await checkPermission('execute_command', { command }, streamContext.workspacePath)

          if (!permCheck.allowed && permCheck.reason === 'needs_approval') {
            // Request permission from user for non-safe commands
            const cmdClassification = classifyCommand(command)
            const result = await requestPermission({
              toolName: 'execute_command',
              action: `Run command`,
              description: cmdClassification === 'destructive'
                ? '⚠️ This command may make destructive changes to your system.'
                : 'The AI wants to run this command.',
              preview: command,
              workspaceId: streamContext.workspacePath,
            })
            if (result.permission === 'deny') {
              return { success: false, error: 'Permission denied by user' }
            }
          } else if (!permCheck.allowed) {
            return { success: false, error: `Permission denied: ${permCheck.reason}` }
          }

          const { exec } = await import('child_process')
          const { promisify } = await import('util')
          const execAsync = promisify(exec)

          // Use workspace path or fallback to home directory (not process.cwd() which may be app directory)
          const workingDir = cwd || streamContext.workspacePath || process.env.HOME || process.cwd()

          console.log('[Tool:execute_command] Running:', command)
          console.log('[Tool:execute_command] CWD:', workingDir)

          const result = await execAsync(command, {
            cwd: workingDir,
            timeout: 60000, // 1 minute timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
            env: { ...process.env }, // Pass through environment
          })

          console.log('[Tool:execute_command] Success, stdout length:', result.stdout?.length || 0)

          return {
            success: true,
            stdout: result.stdout,
            stderr: result.stderr,
          }
        } catch (error: any) {
          // Capture detailed error info
          console.error('[Tool:execute_command] Error:', {
            message: error.message,
            code: error.code,
            signal: error.signal,
            killed: error.killed,
            stdout: error.stdout?.slice(0, 200),
            stderr: error.stderr?.slice(0, 200),
          })

          return {
            success: false,
            error: error.message,
            code: error.code,
            signal: error.signal,
            stdout: error.stdout || '',
            stderr: error.stderr || '',
          }
        }
      },
    })
  }

  return tools
}

// Build context from tool executions for summary
function buildToolContext(toolTracker: Map<string, ToolExecution>): string {
  if (toolTracker.size === 0) return ''

  const lines: string[] = ['## Tool Execution Summary\n']

  for (const [id, exec] of toolTracker) {
    lines.push(`### ${exec.name}`)
    lines.push(`**Arguments:** ${JSON.stringify(exec.args, null, 2)}`)

    if (exec.error) {
      lines.push(`**Error:** ${exec.error}`)
    } else if (exec.result !== undefined) {
      const resultStr = typeof exec.result === 'object'
        ? JSON.stringify(exec.result, null, 2)
        : String(exec.result)
      // Truncate long results
      const truncated = resultStr.length > 500
        ? resultStr.slice(0, 500) + '...[truncated]'
        : resultStr
      lines.push(`**Result:** ${truncated}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function registerAIHandlers() {
  // Stream AI response with tool support
  ipcMain.on('ai:stream', async (event, channelId: string, params: any) => {
    const abortController = new AbortController()
    activeStreams.set(channelId, abortController)

    // Register this stream as active (for sub-agent orphan detection)
    registerParentStream(channelId)

    // Track timeout reason for better error messaging
    let timeoutReason: 'inactivity' | 'max' | null = null

    // Set up activity-based timeout (resets on any stream activity)
    let activityTimeoutId: NodeJS.Timeout
    const resetActivityTimeout = () => {
      clearTimeout(activityTimeoutId)
      activityTimeoutId = setTimeout(() => {
        console.warn('[AI] Stream inactivity timeout - no activity for', ACTIVITY_TIMEOUT_MS, 'ms')
        timeoutReason = 'inactivity'
        abortController.abort()
      }, ACTIVITY_TIMEOUT_MS)
    }
    resetActivityTimeout()

    // Also set a hard maximum timeout
    const maxTimeoutId = setTimeout(() => {
      console.warn('[AI] Stream max timeout - aborting after', STREAM_TIMEOUT_MS, 'ms')
      timeoutReason = 'max'
      abortController.abort()
    }, STREAM_TIMEOUT_MS)

    // Set up progress callback to forward agent updates to frontend
    setGlobalProgressCallback((agentId, agent) => {
      // Only forward if this agent belongs to this stream
      if (agent.parentStreamId === channelId) {
        console.log(`[AI] Forwarding agent progress: ${agent.name} status=${agent.status}`)
        event.sender.send(`ai:agentProgress:${channelId}`, {
          agentId,
          status: agent.status,
          progress: agent.progress, // Full progress text for sub-agent display
          result: agent.result, // Full result for sub-agent display
          error: agent.error,
          toolCalls: agent.toolCalls, // Sub-agent's tool calls for display
        })
      }
    })

    // Track tool executions with results
    const toolTracker = new Map<string, ToolExecution>()

    try {
      // Get provider config
      const providerConfig = providerDb.get(params.providerId)
      if (!providerConfig) {
        event.sender.send(`ai:error:${channelId}`, 'Provider not found')
        return
      }

      // Get API key
      const apiKey = await keychainService.getApiKey(params.providerId)
      if (!apiKey && providerConfig.type !== 'ollama' && providerConfig.type !== 'local') {
        event.sender.send(`ai:error:${channelId}`, 'API key not found')
        return
      }

      // Create provider instance
      const provider = getProviderInstance(providerConfig, apiKey || '')
      const modelId = params.model || providerConfig.default_model
      const mode: AgentMode = params.mode || 'auto'

      // Get mode system prompt
      let systemPrompt = getModeSystemPrompt(mode)

      // Add OS/environment context for terminal commands
      const osType = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'
      const shellInfo = process.platform === 'win32'
        ? 'Use Windows commands (cmd/PowerShell). Examples: dir instead of ls, type instead of cat, del instead of rm, copy instead of cp.'
        : 'Use Unix/bash commands.'

      systemPrompt += `\n\n## System Environment
- **Operating System**: ${osType}
- **Shell**: ${shellInfo}
- When executing terminal commands, use commands appropriate for ${osType}.`

      // Add workspace context if provided
      if (params.workspacePath) {
        systemPrompt += `\n\n## Workspace Context
You are working in the workspace located at: ${params.workspacePath}
Use this as the base path for file operations. When reading, writing, or searching files, use paths relative to this workspace unless the user specifies an absolute path.`
      }

      // Add artifact context if there are existing artifacts
      if (params.artifacts && params.artifacts.length > 0) {
        const artifactList = params.artifacts.map((a: any) =>
          `- **${a.title}** (ID: ${a.id}, type: ${a.type}${a.language ? `, ${a.language}` : ''})\n  Preview: ${a.preview}`
        ).join('\n')

        systemPrompt += `\n\n## Existing Artifacts
The following artifacts exist in this conversation. You can reference them by title or update them using their ID:

${artifactList}

When the user asks to modify, update, fix, or improve an existing artifact, use the \`update_artifact\` tool with the artifact's ID instead of creating a new one.`
      }

      // Artifact sender function
      const sendArtifact = (artifact: any) => {
        event.sender.send(`ai:artifact:${channelId}`, artifact)
      }

      // Update artifact function
      const sendUpdateArtifact = (update: { id: string; updates: any }) => {
        event.sender.send(`ai:updateArtifact:${channelId}`, update)
      }

      // Spawn agent function
      const sendSpawnAgent = (agent: any) => {
        event.sender.send(`ai:spawnAgent:${channelId}`, agent)
      }

      // Mode switch function - for Auto mode transitions
      const sendModeSwitch = (fromMode: AgentMode, toMode: AgentMode, reason: string) => {
        event.sender.send(`ai:modeSwitch:${channelId}`, { fromMode, toMode, reason })
      }

      // Todo state management - tracks tasks for this stream
      let currentTodos: TodoTask[] = []

      // Send todos to UI
      const sendTodos = (todos: TodoTask[]) => {
        currentTodos = todos
        event.sender.send(`ai:todos:${channelId}`, todos)
      }

      // Get current todos (for todo_read and todo_check)
      const getTodos = () => currentTodos

      // Get tools based on mode
      const streamContext = {
        channelId,
        providerId: params.providerId,
        model: modelId,
        workspacePath: params.workspacePath,
        resetActivityTimeout, // Allow blocking tools like wait_for_agent to keep stream alive
      }
      const tools = getBuiltInTools(mode, streamContext, toolTracker, sendArtifact, sendSpawnAgent, sendUpdateArtifact, sendModeSwitch, sendTodos, getTodos)

      // Build messages (without system prompt - we pass it separately to streamText)
      const messages = params.messages.map((m: any) => {
          // Handle messages with attachments (multimodal)
          if (m.attachments && m.attachments.length > 0) {
            const contentParts: any[] = []

            // Add text content if present
            if (m.content) {
              contentParts.push({ type: 'text', text: m.content })
            }

            // Add attachments
            for (const att of m.attachments) {
              if (att.type === 'image') {
                // Image attachment - add as image part
                contentParts.push({
                  type: 'image',
                  image: att.data, // base64 data
                  mimeType: att.mimeType,
                })
              } else if (att.type === 'text') {
                // Text file content - add as text
                contentParts.push({
                  type: 'text',
                  text: `\n\n--- Attached: ${att.name} ---\n${att.data}\n--- End of ${att.name} ---\n`,
                })
              } else if (att.type === 'document') {
                // Document files - mention they're attached (content extraction would need more work)
                contentParts.push({
                  type: 'text',
                  text: `\n\n[Attached document: ${att.name} (${att.mimeType})]`,
                })
              }
            }

            return {
              role: m.role as 'user' | 'assistant' | 'system',
              content: contentParts,
            }
          }

          // Regular text message
          return {
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          }
        })

      if (DEBUG_API_REQUESTS) {
        console.log('\n[AI] ========== STREAM START ==========')
        console.log('[AI] Model:', modelId)
        console.log('[AI] Mode:', mode)
        console.log('[AI] Provider type:', providerConfig.type)
        console.log('[AI] Tool count:', Object.keys(tools).length)
        console.log('[AI] Tool names:', Object.keys(tools))
        console.log('[AI] System prompt length:', systemPrompt.length)
        console.log('[AI] Message count:', messages.length)
      }

      // Retry loop for transient errors
      let lastError: any = null
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          console.log(`[AI] Retry attempt ${attempt}/${MAX_RETRIES}`)
          await sleep(RETRY_DELAY_MS * attempt) // Exponential backoff
        }

        try {
          // Stream the response with tools
          const result = await streamText({
            model: provider.chat(modelId),
            system: systemPrompt,
            messages,
            tools,
            toolChoice: 'auto',
            stopWhen: stepCountIs(10), // Allow up to 10 tool call steps
            abortSignal: abortController.signal,
            onStepFinish: ({ toolCalls, toolResults, text, finishReason }) => {
              if (DEBUG_API_REQUESTS) {
                console.log('[AI] Step finished:', {
                  finishReason,
                  toolCallCount: toolCalls?.length || 0,
                  toolResultCount: toolResults?.length || 0,
                  textLength: text?.length || 0,
                })
              }
            },
          })

          // Track text generated after last tool result
          let textAfterLastToolResult = ''
          let totalStreamedTextLength = 0  // Track total text sent to prevent duplicate sending
          let hadAnyToolCalls = false

          // Track tool completion for potential future todo/status integration
          let lastCompletedToolName: string | null = null
          let textSentSinceLastResult = true // Track if AI provided feedback

          // Track current tool receiving input (for progress display AND accumulation)
          let currentToolInputId: string | null = null
          let currentToolInputName: string | null = null
          let toolInputCharCount = 0
          let lastToolInputUpdate = 0
          let accumulatedToolInput = '' // Accumulate the actual tool input JSON

          for await (const part of result.fullStream) {
            if (abortController.signal.aborted) break

            // Reset activity timeout on any stream event
            resetActivityTimeout()

            // Debug: log all event types (throttle tool-input-delta to avoid spam)
            if (DEBUG_API_REQUESTS) {
              const textContent = (part as any).text || (part as any).textDelta
              if (part.type !== 'tool-input-delta') {
                console.log('[AI] Stream event:', part.type, part.type === 'text-delta' && textContent ? `"${textContent.slice(0, 50)}..."` : '')
              }
            }

            switch (part.type) {
              case 'text-delta':
                // AI SDK provides text as 'text' property, not 'textDelta'
                // Some providers may use 'content' or 'chunk'
                const textChunk = (part as any).text || (part as any).textDelta || (part as any).content || (part as any).chunk
                if (textChunk) {
                  event.sender.send(`ai:chunk:${channelId}`, textChunk)
                  textAfterLastToolResult += textChunk
                  totalStreamedTextLength += textChunk.length  // Track total to prevent duplicate sending
                  // Mark that AI provided text since last tool result (harness tracking)
                  textSentSinceLastResult = true
                }
                break

              // Handle reasoning/thinking blocks from thinking models (Kimi K2.5, o1, o3, etc.)
              case 'reasoning':
              case 'reasoning-delta':
              case 'thinking':
              case 'thinking-delta': {
                const reasoningContent = (part as any).text || (part as any).content || (part as any).thinking || (part as any).reasoning || ''
                if (reasoningContent) {
                  // Send reasoning to UI - it can decide whether to show it
                  event.sender.send(`ai:reasoning:${channelId}`, {
                    content: reasoningContent,
                    type: part.type,
                  })
                }
                break
              }

              // Handle reasoning start/end events
              case 'reasoning-start':
              case 'thinking-start':
                event.sender.send(`ai:reasoningStart:${channelId}`, {})
                break

              case 'reasoning-end':
              case 'thinking-end':
              case 'reasoning-finish':
              case 'thinking-finish':
                event.sender.send(`ai:reasoningEnd:${channelId}`, {})
                break

              case 'tool-input-start': {
                // Reset accumulator when a new tool input starts
                accumulatedToolInput = ''
                toolInputCharCount = 0

                // IMPORTANT: Capture tool name and ID from this event - some providers
                // don't send tool-call-streaming-start, only tool-input-start
                const startToolName = (part as any).toolName || (part as any).name
                const startToolId = (part as any).id || (part as any).toolCallId
                if (startToolName) {
                  currentToolInputName = startToolName
                }
                if (startToolId) {
                  currentToolInputId = startToolId
                }

                console.log('[AI] tool-input-start - captured:', { toolName: startToolName, toolId: startToolId })
                console.log('[AI]   Full event JSON:', JSON.stringify(part, null, 2))
                break
              }

              case 'tool-input-end': {
                // ALWAYS log to debug cross-provider issues
                console.log('[AI] tool-input-end - ALL PROPERTIES:')
                console.log('[AI]   Full event JSON:', JSON.stringify(part, null, 2))
                console.log('[AI]   Accumulated input length:', accumulatedToolInput.length)
                console.log('[AI]   Accumulated input preview:', accumulatedToolInput.slice(0, 500))

                // Check if the tool-input-end event includes the full input
                const anyPart = part as any
                const endInput = anyPart.input || anyPart.args || anyPart.arguments || anyPart.toolInput || anyPart.function?.arguments
                console.log('[AI]   Extracted endInput:', endInput)

                // If we got input in the end event, use it (some providers send all at once)
                if (endInput && typeof endInput === 'string' && endInput.trim()) {
                  accumulatedToolInput = endInput
                  console.log('[AI]   Used string endInput')
                } else if (endInput && typeof endInput === 'object' && Object.keys(endInput).length > 0) {
                  // If it's already an object, stringify it for consistency
                  accumulatedToolInput = JSON.stringify(endInput)
                  console.log('[AI]   Used object endInput, stringified')
                }
                break
              }

              case 'tool-input-delta': {
                // Track and accumulate tool input for providers that stream args separately
                const anyPart = part as any
                const inputDelta = anyPart.inputTextDelta || anyPart.delta || anyPart.argsTextDelta || ''

                // Log first delta and every 10th to track what we're receiving
                if (toolInputCharCount === 0 || toolInputCharCount % 1000 < inputDelta.length) {
                  console.log('[AI] tool-input-delta received:')
                  console.log('[AI]   inputTextDelta:', anyPart.inputTextDelta)
                  console.log('[AI]   delta:', anyPart.delta)
                  console.log('[AI]   argsTextDelta:', anyPart.argsTextDelta)
                  console.log('[AI]   Full event:', JSON.stringify(part, null, 2))
                }

                accumulatedToolInput += inputDelta
                toolInputCharCount += inputDelta.length

                // Send progress update every 500ms or 1000 chars to avoid flooding
                const now = Date.now()
                if (now - lastToolInputUpdate > 500 || toolInputCharCount % 1000 < inputDelta.length) {
                  lastToolInputUpdate = now
                  // Find the tool name from tracker if we have it
                  const toolName = currentToolInputName ||
                    (currentToolInputId ? toolTracker.get(currentToolInputId)?.name : null) ||
                    'artifact'
                  event.sender.send(`ai:toolInputProgress:${channelId}`, {
                    toolName,
                    charCount: toolInputCharCount,
                  })

                  // Stream artifact content preview for create_artifact tool
                  if (toolName === 'create_artifact' && accumulatedToolInput.length > 50) {
                    const preview = extractPartialArtifactContent(accumulatedToolInput)
                    if (preview) {
                      console.log('[AI] Sending artifact preview:', {
                        type: preview.type,
                        title: preview.title,
                        contentLength: preview.content.length,
                      })
                      event.sender.send(`ai:artifactPreview:${channelId}`, preview)
                    }
                  }
                }
                break
              }

              case 'tool-call-streaming-start': {
                // Validate required properties
                const toolCallId = part.toolCallId || (part as any).id
                const toolName = part.toolName || (part as any).name || 'unknown_tool'

                if (!toolCallId) {
                  console.warn('[AI] tool-call-streaming-start missing toolCallId:', part)
                  break
                }

                console.log('[AI] Tool call starting:', toolName)
                // Track this as the current tool receiving input
                currentToolInputId = toolCallId
                currentToolInputName = toolName
                toolInputCharCount = 0

                toolTracker.set(toolCallId, {
                  id: toolCallId,
                  name: toolName,
                  args: {},
                  startTime: Date.now(),
                })
                event.sender.send(`ai:toolCalls:${channelId}`, [{
                  id: toolCallId,
                  name: toolName,
                  args: {},
                  status: 'starting',
                }])
                hadAnyToolCalls = true
                break
              }

              case 'tool-call': {
                hadAnyToolCalls = true

                // ALWAYS log full event to diagnose argument issues across providers
                console.log('[AI] tool-call event - ALL PROPERTIES:')
                console.log('[AI]   type:', part.type)
                console.log('[AI]   toolCallId:', part.toolCallId)
                console.log('[AI]   toolName:', part.toolName)
                console.log('[AI]   args:', part.args)
                console.log('[AI]   args type:', typeof part.args)
                console.log('[AI]   args keys:', part.args ? Object.keys(part.args) : 'N/A')
                // Check all possible property names
                const anyPart = part as any
                console.log('[AI]   (any).input:', anyPart.input)
                console.log('[AI]   (any).arguments:', anyPart.arguments)
                console.log('[AI]   (any).parameters:', anyPart.parameters)
                console.log('[AI]   (any).function:', anyPart.function)
                console.log('[AI]   (any).function?.arguments:', anyPart.function?.arguments)
                console.log('[AI]   Full part JSON:', JSON.stringify(part, null, 2))

                // Validate and extract properties with fallbacks
                const tcToolCallId = part.toolCallId || (part as any).id
                const tcToolName = part.toolName || (part as any).name || 'unknown_tool'

                if (!tcToolCallId) {
                  console.warn('[AI] tool-call missing toolCallId:', part)
                  break
                }

                // Get args from multiple sources - different providers put them in different places
                // Also check function.arguments which is OpenAI's format
                let toolArgs = part.args || (part as any).input || (part as any).arguments || (part as any).parameters || (part as any).function?.arguments

                // Also check if args is a string that needs parsing
                if (typeof toolArgs === 'string' && toolArgs.trim()) {
                  try {
                    toolArgs = JSON.parse(toolArgs)
                    console.log('[AI] Parsed string tool args:', tcToolName, toolArgs)
                  } catch (e) {
                    console.warn('[AI] Failed to parse string tool args:', e)
                    toolArgs = {}
                  }
                }

                // If args are empty/undefined but we accumulated input, parse it
                if ((!toolArgs || Object.keys(toolArgs).length === 0) && accumulatedToolInput.trim()) {
                  try {
                    toolArgs = JSON.parse(accumulatedToolInput)
                    console.log('[AI] Parsed tool args from accumulated input:', tcToolName, toolArgs)
                  } catch (e) {
                    console.warn('[AI] Failed to parse accumulated tool input:', e)
                    console.warn('[AI] Accumulated input was:', accumulatedToolInput.slice(0, 500))
                    toolArgs = {}
                  }
                }

                // Also check accumulatedToolInputByCallId map
                const storedInput = accumulatedToolInputByCallId.get(tcToolCallId)
                if ((!toolArgs || Object.keys(toolArgs).length === 0) && storedInput?.trim()) {
                  try {
                    toolArgs = JSON.parse(storedInput)
                    console.log('[AI] Parsed tool args from stored input:', tcToolName, toolArgs)
                  } catch (e) {
                    console.warn('[AI] Failed to parse stored tool input:', e)
                  }
                }

                toolArgs = toolArgs || {}

                // Clear tool input tracking - the tool is now complete
                currentToolInputId = null
                currentToolInputName = null
                toolInputCharCount = 0
                accumulatedToolInput = ''
                accumulatedToolInputByCallId.delete(tcToolCallId)

                console.log('[AI] Tool call ready:', tcToolName, toolArgs)

                const existingExec = toolTracker.get(tcToolCallId)
                if (existingExec) {
                  existingExec.args = toolArgs
                } else {
                  toolTracker.set(tcToolCallId, {
                    id: tcToolCallId,
                    name: tcToolName,
                    args: toolArgs,
                    startTime: Date.now(),
                  })
                }

                if (existingExec) {
                  event.sender.send(`ai:toolCallUpdate:${channelId}`, {
                    id: tcToolCallId,
                    name: tcToolName,
                    args: toolArgs,
                    status: 'executing',
                  })
                } else {
                  console.log('[AI] Tool call without streaming-start, sending as new')
                  event.sender.send(`ai:toolCalls:${channelId}`, [{
                    id: tcToolCallId,
                    name: tcToolName,
                    args: toolArgs,
                    status: 'executing',
                  }])
                }
                break
              }

              case 'tool-result': {
                const trToolCallId = part.toolCallId || (part as any).id
                const toolResult = (part as any).output || (part as any).result || (part as any).content

                if (!trToolCallId) {
                  console.warn('[AI] tool-result missing toolCallId:', part)
                  break
                }

                console.log('[AI] Tool result:', trToolCallId,
                  typeof toolResult === 'object' ? JSON.stringify(toolResult).slice(0, 100) : toolResult)

                // Update tracker with result
                const exec = toolTracker.get(trToolCallId)
                if (exec) {
                  exec.result = toolResult
                  exec.endTime = Date.now()
                }

                event.sender.send(`ai:toolResults:${channelId}`, [{
                  toolCallId: trToolCallId,
                  result: toolResult,
                }])

                // Reset text tracker - we want to know if text comes AFTER tool results
                textAfterLastToolResult = ''
                hadAnyToolCalls = true

                // HARNESS ENFORCEMENT: Track this tool completion for mandatory feedback
                // Store the tool name so we can inject feedback if AI doesn't provide any
                lastCompletedToolName = exec?.name || 'tool'
                textSentSinceLastResult = false
                break
              }

              case 'step-start':
                if (DEBUG_API_REQUESTS) console.log('[AI] Step starting')
                break

              case 'step-finish':
                if (DEBUG_API_REQUESTS) {
                  console.log('[AI] Step finished:', part.finishReason, 'isContinued:', (part as any).isContinued)
                }
                break

              case 'tool-error': {
                // Tool execution failed - log the error details
                const teToolCallId = part.toolCallId || (part as any).id
                const toolError = (part as any).error || (part as any).message
                const errorMessage = typeof toolError === 'object'
                  ? (toolError?.message || JSON.stringify(toolError))
                  : (toolError || 'Tool execution failed')

                console.error('[AI] Tool error:', teToolCallId || 'unknown', errorMessage)
                if (toolError && typeof toolError === 'object') {
                  console.error('[AI] Full tool error:', JSON.stringify(toolError, null, 2))
                }

                if (!teToolCallId) {
                  console.warn('[AI] tool-error missing toolCallId:', part)
                  break
                }

                // Update tracker with error
                const errorExec = toolTracker.get(teToolCallId)
                if (errorExec) {
                  errorExec.result = { error: errorMessage }
                  errorExec.endTime = Date.now()
                }

                // Send error result to UI so tool shows as complete (with error)
                event.sender.send(`ai:toolResults:${channelId}`, [{
                  toolCallId: teToolCallId,
                  result: { error: errorMessage },
                }])
                hadAnyToolCalls = true
                break
              }

              case 'error':
                console.error('[AI] Stream error:', part.error)
                break
            }
          }

          // Get final text from result (fallback if streaming didn't capture it)
          const finalText = await result.text
          // Only send if NO text was streamed at all (prevents duplicate sending on timeout)
          if (finalText && totalStreamedTextLength === 0) {
            console.log('[AI] Text not streamed, using final result:', finalText.slice(0, 100) + '...')
            event.sender.send(`ai:chunk:${channelId}`, finalText)
            textAfterLastToolResult = finalText
          }

          // Get usage stats
          const usage = await result.usage
          const finishReason = await result.finishReason

          // Parse usage if it's a string
          let usageObj: any = usage
          if (typeof usage === 'string') {
            try {
              usageObj = JSON.parse(usage)
            } catch (e) {
              console.warn('[AI] Failed to parse usage string:', e)
              usageObj = {}
            }
          }

          // Extract token counts with comprehensive field name support
          // Different providers use different naming conventions
          let promptTokens =
            usageObj?.promptTokens ||      // Vercel AI SDK standard
            usageObj?.prompt_tokens ||     // OpenAI/snake_case
            usageObj?.inputTokens ||       // Alternative
            usageObj?.input_tokens ||      // Snake_case alternative
            usageObj?.promptTokenCount ||  // Google AI
            usageObj?.prompt ||            // Custom providers
            0

          let completionTokens =
            usageObj?.completionTokens ||  // Vercel AI SDK standard
            usageObj?.completion_tokens || // OpenAI/snake_case
            usageObj?.outputTokens ||      // Alternative
            usageObj?.output_tokens ||     // Snake_case alternative
            usageObj?.candidatesTokenCount || // Google AI
            usageObj?.completion ||        // Custom providers
            0

          // Log if we couldn't parse tokens but had usage data
          if (promptTokens === 0 && completionTokens === 0 && usage && Object.keys(usageObj || {}).length > 0) {
            console.warn('[AI] Could not extract token counts from usage:', usageObj)
          }

          // Check for running sub-agents that weren't waited for
          const activeAgents = getSubAgentsForStream(channelId)
          console.log(`[AI] Sub-agents for this stream: ${activeAgents.length}`, activeAgents.map(a => `${a.name}:${a.status}`))
          const runningAgents = activeAgents.filter(a => a.status === 'running' || a.status === 'pending')

          // If there are running agents, wait for them
          if (runningAgents.length > 0 && !abortController.signal.aborted) {
            console.log('[AI] Waiting for', runningAgents.length, 'running sub-agent(s)...')

            for (const agent of runningAgents) {
              try {
                const agentResult = await waitForSubAgent(agent.id, 30000) // 30 sec timeout per agent
                console.log(`[AI] Agent ${agent.name} completed:`, agentResult.success ? 'success' : 'failed')
              } catch (e) {
                console.warn(`[AI] Failed to wait for agent ${agent.name}:`, e)
              }
            }
          }

          // Check if we need to generate a summary
          const hasTextAfterTools = textAfterLastToolResult.trim().length > 50

          console.log('[AI] Summary detection:', {
            hadAnyToolCalls,
            textAfterLastToolResult: textAfterLastToolResult.length,
            hasTextAfterTools,
            finishReason,
          })

          if (hadAnyToolCalls && !hasTextAfterTools && !abortController.signal.aborted) {
            console.log('[AI] Generating summary for tool results...')

            // Build proper context with actual tool results
            const toolContext = buildToolContext(toolTracker)

            try {
              const summaryResult = await streamText({
                model: provider.chat(modelId),
                system: `You just executed tools to help the user. Now provide a clear, helpful summary:
1. What you did (briefly)
2. Key results or findings
3. Any issues encountered
4. Next steps if applicable

Be concise but informative. The user needs to understand what happened.`,
                messages: [
                  ...messages,
                  { role: 'assistant', content: `I executed the following tools:\n\n${toolContext}` },
                  { role: 'user', content: 'Please summarize what you did and the results.' },
                ],
                abortSignal: abortController.signal,
              })

              // Stream the summary
              for await (const chunk of summaryResult.textStream) {
                if (abortController.signal.aborted) break
                event.sender.send(`ai:chunk:${channelId}`, chunk)
              }

              // Add summary usage to totals
              const summaryUsage = await summaryResult.usage
              if (summaryUsage) {
                const sUsage = typeof summaryUsage === 'string' ? JSON.parse(summaryUsage) : summaryUsage
                promptTokens += sUsage?.promptTokens || sUsage?.inputTokens || 0
                completionTokens += sUsage?.completionTokens || sUsage?.outputTokens || 0
              }
            } catch (summaryError: any) {
              console.warn('[AI] Failed to generate summary:', summaryError.message)
              // Send a fallback message with tool results
              const fallbackSummary = `\n\n---\n**Tool Execution Complete**\n${buildToolContext(toolTracker)}`
              event.sender.send(`ai:chunk:${channelId}`, fallbackSummary)
            }
          }

          const totalTokens = promptTokens + completionTokens

          console.log('[AI] Stream completed:', {
            finishReason,
            promptTokens,
            completionTokens,
            totalTokens,
            toolsExecuted: toolTracker.size,
          })

          // Signal completion with stats
          if (!abortController.signal.aborted) {
            event.sender.send(`ai:end:${channelId}`, {
              usage: {
                promptTokens,
                completionTokens,
                totalTokens,
              },
              finishReason,
            })
          }

          // Success - exit retry loop
          break

        } catch (error: any) {
          lastError = error

          if (error.name === 'AbortError') {
            // Check if this was a timeout-triggered abort
            if (timeoutReason === 'inactivity') {
              console.warn('[AI] Stream aborted due to inactivity timeout')
              event.sender.send(`ai:error:${channelId}`, 'Model stopped responding. The AI may be overloaded or the request was too complex. Please try again.')
            } else if (timeoutReason === 'max') {
              console.warn('[AI] Stream aborted due to max timeout')
              event.sender.send(`ai:error:${channelId}`, 'Request timed out after 5 minutes. Please try a simpler request.')
            }
            // User cancelled or timeout - don't retry
            break
          }

          if (isRetryableError(error) && attempt < MAX_RETRIES) {
            console.warn(`[AI] Retryable error on attempt ${attempt + 1}:`, error.message)
            continue
          }

          // Non-retryable error or max retries reached
          throw error
        }
      }

      // If we exhausted retries, throw the last error
      if (lastError && !abortController.signal.aborted) {
        throw lastError
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[AI] Streaming error:', error)
        console.error('[AI] Error details:', {
          message: error.message,
          cause: error.cause,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        })
        event.sender.send(`ai:error:${channelId}`, error.message || 'Unknown error')
      }
    } finally {
      clearTimeout(activityTimeoutId)
      clearTimeout(maxTimeoutId)
      activeStreams.delete(channelId)

      // Clear global progress callback
      setGlobalProgressCallback(null)

      // Unregister parent stream - sub-agents get grace period before cleanup
      unregisterParentStream(channelId)

      // Dismiss completed sub-agents for this stream
      const dismissed = dismissAgentsForStream(channelId)
      if (dismissed > 0) {
        console.log(`[AI] Dismissed ${dismissed} completed sub-agent(s) for ended stream`)
      }
    }
  })

  // Stop streaming
  ipcMain.on('ai:stop', (_, channelId: string) => {
    console.log(`[AI] Stop requested for stream ${channelId}`)

    const controller = activeStreams.get(channelId)
    if (controller) {
      controller.abort()
      activeStreams.delete(channelId)
    }

    // Cancel running sub-agents immediately when user stops
    const cancelled = cancelAgentsForStream(channelId)
    if (cancelled > 0) {
      console.log(`[AI] Cancelled ${cancelled} running sub-agent(s) for stopped stream`)
    }

    // Unregister parent stream
    unregisterParentStream(channelId)

    // Dismiss completed sub-agents
    const dismissed = dismissAgentsForStream(channelId)
    if (dismissed > 0) {
      console.log(`[AI] Dismissed ${dismissed} sub-agent(s) for stopped stream`)
    }
  })

  // Generate conversation title from first exchange
  ipcMain.handle('ai:generateTitle', async (_, params: {
    providerId: string
    model: string
    userMessage: string
    assistantMessage: string
  }) => {
    try {
      const providerConfig = providerDb.get(params.providerId)
      if (!providerConfig) {
        return { success: false, error: 'Provider not found' }
      }

      const apiKey = await keychainService.getApiKey(params.providerId)
      if (!apiKey && providerConfig.type !== 'ollama' && providerConfig.type !== 'local') {
        return { success: false, error: 'API key not found' }
      }

      const provider = getProviderInstance(providerConfig, apiKey || '')

      // Use a quick non-streaming call for title generation
      const { generateText } = await import('ai')

      const result = await generateText({
        model: provider.chat(params.model),
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, no quotes or explanation.',
          },
          {
            role: 'user',
            content: `User: ${params.userMessage.slice(0, 500)}\n\nAssistant: ${params.assistantMessage.slice(0, 500)}`,
          },
        ],
        maxTokens: 20,
      })

      const title = result.text.trim().replace(/^["']|["']$/g, '') // Remove quotes if present
      return { success: true, title }
    } catch (error: any) {
      console.error('[AI] Title generation error:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Get agent limit status for a conversation
  ipcMain.handle('ai:getAgentLimit', async (_, conversationId: string) => {
    return getAgentLimit(conversationId)
  })

  // Increase agent limit (user granted permission)
  ipcMain.handle('ai:increaseAgentLimit', async (_, params: {
    conversationId: string
    additionalAgents?: number
  }) => {
    const result = increaseAgentLimit(params.conversationId, params.additionalAgents || 10)
    return { success: true, ...result }
  })

  // Handle clarification responses from UI
  ipcMain.handle('clarification:respond', async (_, requestId: string, answers: Record<string, string[]>) => {
    const pending = pendingClarifications.get(requestId)
    if (!pending) {
      console.warn('[AI] Clarification response for unknown request:', requestId)
      return { success: false, error: 'Request not found or already expired' }
    }

    // Resolve the pending promise with the answers
    pending.resolve(answers)
    pendingClarifications.delete(requestId)

    console.log('[AI] Clarification received for request:', requestId, answers)
    return { success: true }
  })
}
