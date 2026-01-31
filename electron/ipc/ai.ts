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
  registerParentStream,
  unregisterParentStream,
  startOrphanCleanup,
  heartbeatAgent,
  setGlobalProgressCallback,
  getAgentLimit,
  increaseAgentLimit,
} from '../services/subagents'

// Start orphan cleanup on module load
startOrphanCleanup()

// Store active streams for cancellation
const activeStreams = new Map<string, AbortController>()

// Debug flag - controlled by environment
const DEBUG_API_REQUESTS = process.env.DEBUG_AI === 'true' || process.env.NODE_ENV === 'development'

// Streaming timeout in ms (2 minutes)
const STREAM_TIMEOUT_MS = 120000

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

  // Mode switch tool - only available in Auto mode for dynamic mode transitions
  if (mode === 'auto' && sendModeSwitch) {
    tools.switch_mode = tool({
      description: `Switch to a different operating mode. Use this in Auto mode to signal what type of work you're doing.

WHEN TO SWITCH:
- "plan" → When outlining your approach at the start (brief, 1-2 sentences)
- "explore" → When reading files, searching, gathering information
- "execute" → When writing files, running commands, creating artifacts
- "review" → When summarizing results, providing final output

WORKFLOW EXAMPLE:
1. User asks multi-step task
2. switch_mode("plan") → Brief acknowledgment of approach
3. switch_mode("explore") → Read files, gather info
4. switch_mode("execute") → Make changes, run commands
5. switch_mode("review") → Summarize what was done

Keep mode switches natural - don't switch for every tiny action.`,
      parameters: z.object({
        mode: z.enum(['plan', 'explore', 'execute', 'review']).describe('The mode to switch to'),
        reason: z.string().describe('Brief reason for the switch (shown to user)'),
      }),
      execute: async ({ mode: targetMode, reason }) => {
        sendModeSwitch(mode, targetMode as AgentMode, reason)
        return { success: true, switched_to: targetMode }
      },
    })
  }

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
      description: `Spawn a background sub-agent to work on a task in parallel.
Use this to delegate work and keep your context clean. Sub-agents run independently and return summarized results.

PREFER sub-agents for: reading multiple files, research tasks, any work that would bulk up your context.

The sub-agent can ask you questions via [QUESTION] or request capabilities via [REQUEST].
Returns an agent_id that you can use to track the agent.

CRITICAL: After spawning, you MUST call wait_for_agent before finishing your response.`,
      parameters: z.object({
        name: z.string().optional().describe('A short name for the agent (e.g., "Test Runner", "Code Reviewer"). Auto-generated if not provided.'),
        task: z.string().describe('The detailed task description for the agent'),
        mode: z.enum(['auto', 'explore', 'execute', 'plan', 'review'])
          .optional()
          .describe('The mode for the agent (defaults to auto)'),
        siblingContext: z.string().optional().describe('Info about other agents working in parallel (e.g., "Agent B is researching API docs"). Helps agents understand the bigger picture.'),
      }),
      execute: async ({ name, task, mode: agentMode, siblingContext }) => {
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
      description: `Check the status of a spawned sub-agent.
Use this to see if the agent has completed, is waiting for input, or retrieve its result/progress.
This is non-blocking - it returns immediately with the current state.
If has_question is true, the agent is paused and waiting for you to respond using continue_agent.`,
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
        }
      },
    })

    // Wait for sub-agent completion or question - blocking wait
    tools.wait_for_agent = tool({
      description: `Wait for a spawned sub-agent to complete OR pause with a question.
This blocks until the agent finishes (completes, fails) OR needs clarification.
If has_question is true, respond using continue_agent to keep the agent working.

IMPORTANT: Always call this after spawn_agent to get results.`,
      parameters: z.object({
        agent_id: z.string().describe('The ID of the agent to wait for (from spawn_agent result)'),
        timeout_seconds: z.number().optional().describe('Maximum seconds to wait (default: 60)'),
      }),
      execute: async ({ agent_id, timeout_seconds }) => {
        const timeoutMs = (timeout_seconds || 60) * 1000
        const result = await waitForSubAgent(agent_id, timeoutMs)

        if (result.timedOut) {
          return {
            success: false,
            timed_out: true,
            error: `Agent did not respond within ${timeout_seconds || 60} seconds`,
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
        }
      },
    })

    // Continue a sub-agent with feedback or answer to question
    tools.continue_agent = tool({
      description: `Continue a sub-agent that is waiting for input OR provide feedback to improve results.
Use this when:
1. An agent asked a question (has_question=true) - provide your answer
2. Results were unsatisfactory - provide feedback for the agent to continue working
The agent will continue with its preserved memory context.`,
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
      description: `Get a summary of all sub-agents spawned in this conversation.
Shows the status and results of all your sub-agents at once.
Useful for reviewing what work has been done by sub-agents.`,
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
- mermaid: Mermaid diagram syntax`,
    parameters: z.object({
      type: z.enum(['code', 'document', 'html', 'svg', 'mermaid']).describe('The type of artifact'),
      title: z.string().describe('A short, descriptive title'),
      content: z.string().describe('The artifact content'),
      language: z.string().optional().describe('For code artifacts: the programming language (e.g., javascript, python)'),
    }),
    execute: async ({ type, title, content, language }) => {
      if (sendArtifact) {
        sendArtifact({ type, title, content, language })
      }
      return { success: true, message: `Artifact "${title}" created successfully` }
    },
  })

  // Update artifact tool - always available
  // Allows AI to modify existing artifacts
  tools.update_artifact = tool({
    description: `Update an existing artifact in the Canvas panel.
Use this to modify, improve, or fix content in an artifact that already exists.
You must know the artifact ID from the existing artifacts context.`,
    parameters: z.object({
      id: z.string().describe('The ID of the artifact to update'),
      title: z.string().optional().describe('New title (if changing)'),
      content: z.string().describe('The updated content'),
      language: z.string().optional().describe('For code artifacts: the programming language (if changing)'),
    }),
    execute: async ({ id, title, content, language }) => {
      if (sendUpdateArtifact) {
        sendUpdateArtifact({ id, updates: { title, content, language } })
      }
      return { success: true, message: `Artifact "${id}" updated successfully` }
    },
  })

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

  // Web search tool - using DuckDuckGo HTML search for better results
  tools.web_search = tool({
    description: `Search the web for information.
Returns search results with titles, snippets, and URLs.
Use this to find current information, documentation, or answers to questions.`,
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
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
      description: 'Execute a shell command',
      parameters: z.object({
        command: z.string().describe('The command to execute'),
        cwd: z.string().optional().describe('Working directory for the command'),
      }),
      execute: async ({ command, cwd }) => {
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

    // Set up timeout
    const timeoutId = setTimeout(() => {
      console.warn('[AI] Stream timeout - aborting after', STREAM_TIMEOUT_MS, 'ms')
      abortController.abort()
    }, STREAM_TIMEOUT_MS)

    // Set up progress callback to forward agent updates to frontend
    setGlobalProgressCallback((agentId, agent) => {
      // Only forward if this agent belongs to this stream
      if (agent.parentStreamId === channelId) {
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
          let hadAnyToolCalls = false

          // Track tool completion for potential future todo/status integration
          let lastCompletedToolName: string | null = null
          let textSentSinceLastResult = true // Track if AI provided feedback

          for await (const part of result.fullStream) {
            if (abortController.signal.aborted) break

            // Debug: log all event types
            if (DEBUG_API_REQUESTS) {
              const textContent = (part as any).text || (part as any).textDelta
              console.log('[AI] Stream event:', part.type, part.type === 'text-delta' && textContent ? `"${textContent.slice(0, 50)}..."` : '')
            }

            switch (part.type) {
              case 'text-delta':
                // AI SDK provides text as 'text' property, not 'textDelta'
                const textChunk = (part as any).text || (part as any).textDelta
                if (textChunk) {
                  event.sender.send(`ai:chunk:${channelId}`, textChunk)
                  textAfterLastToolResult += textChunk
                  // Mark that AI provided text since last tool result (harness tracking)
                  textSentSinceLastResult = true
                }
                break

              case 'tool-call-streaming-start':
                console.log('[AI] Tool call starting:', part.toolName)
                toolTracker.set(part.toolCallId, {
                  id: part.toolCallId,
                  name: part.toolName,
                  args: {},
                  startTime: Date.now(),
                })
                event.sender.send(`ai:toolCalls:${channelId}`, [{
                  id: part.toolCallId,
                  name: part.toolName,
                  args: {},
                  status: 'starting',
                }])
                hadAnyToolCalls = true
                break

              case 'tool-call':
                hadAnyToolCalls = true

                const toolArgs = (part as any).input || (part as any).args || {}
                console.log('[AI] Tool call ready:', part.toolName, toolArgs)

                const existingExec = toolTracker.get(part.toolCallId)
                if (existingExec) {
                  existingExec.args = toolArgs
                } else {
                  toolTracker.set(part.toolCallId, {
                    id: part.toolCallId,
                    name: part.toolName,
                    args: toolArgs,
                    startTime: Date.now(),
                  })
                }

                if (existingExec) {
                  event.sender.send(`ai:toolCallUpdate:${channelId}`, {
                    id: part.toolCallId,
                    name: part.toolName,
                    args: toolArgs,
                    status: 'executing',
                  })
                } else {
                  console.log('[AI] Tool call without streaming-start, sending as new')
                  event.sender.send(`ai:toolCalls:${channelId}`, [{
                    id: part.toolCallId,
                    name: part.toolName,
                    args: toolArgs,
                    status: 'executing',
                  }])
                }
                break

              case 'tool-result':
                const toolResult = (part as any).output || (part as any).result
                console.log('[AI] Tool result:', part.toolCallId,
                  typeof toolResult === 'object' ? JSON.stringify(toolResult).slice(0, 100) : toolResult)

                // Update tracker with result
                const exec = toolTracker.get(part.toolCallId)
                if (exec) {
                  exec.result = toolResult
                  exec.endTime = Date.now()
                }

                event.sender.send(`ai:toolResults:${channelId}`, [{
                  toolCallId: part.toolCallId,
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

              case 'step-start':
                if (DEBUG_API_REQUESTS) console.log('[AI] Step starting')
                break

              case 'step-finish':
                if (DEBUG_API_REQUESTS) {
                  console.log('[AI] Step finished:', part.finishReason, 'isContinued:', (part as any).isContinued)
                }
                break

              case 'error':
                console.error('[AI] Stream error:', part.error)
                break
            }
          }

          // Get final text from result (fallback if streaming didn't capture it)
          const finalText = await result.text
          if (finalText && textAfterLastToolResult.length === 0) {
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
            } catch {
              usageObj = {}
            }
          }

          let promptTokens = usageObj?.promptTokens || usageObj?.inputTokens || 0
          let completionTokens = usageObj?.completionTokens || usageObj?.outputTokens || 0

          // Check for running sub-agents that weren't waited for
          const activeAgents = getSubAgentsForStream(channelId)
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
            // User cancelled - don't retry
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
      clearTimeout(timeoutId)
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
    const controller = activeStreams.get(channelId)
    if (controller) {
      controller.abort()
      activeStreams.delete(channelId)
    }

    // Unregister parent stream
    unregisterParentStream(channelId)

    // Dismiss completed sub-agents - running ones get grace period
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
}
