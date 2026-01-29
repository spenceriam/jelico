import { ipcMain } from 'electron'
import { streamText, tool, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { providerDb } from '../services/database'
import { keychainService } from '../services/keychain'
import { getModeSystemPrompt, type AgentMode } from '../lib/modes'
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
} from '../services/subagents'

// Start orphan cleanup on module load
startOrphanCleanup()

// Store active streams for cancellation
const activeStreams = new Map<string, AbortController>()

// Debug flag - set to true to log API requests
const DEBUG_API_REQUESTS = true

// Wrap fetch to log requests when debugging
const originalFetch = globalThis.fetch
if (DEBUG_API_REQUESTS) {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    // Only log AI API requests
    if (url.includes('openrouter') || url.includes('openai') || url.includes('anthropic')) {
      console.log('[DEBUG FETCH] URL:', url)
      console.log('[DEBUG FETCH] Method:', init?.method || 'GET')

      if (init?.body) {
        try {
          const body = JSON.parse(init.body as string)
          console.log('[DEBUG FETCH] Has tools:', !!body.tools)
          console.log('[DEBUG FETCH] Tool count:', body.tools?.length || 0)
          if (body.tools?.length > 0) {
            console.log('[DEBUG FETCH] Tool names:', body.tools.map((t: any) => t.function?.name || t.name))
          }
          console.log('[DEBUG FETCH] Model:', body.model)
          console.log('[DEBUG FETCH] Message count:', body.messages?.length)
          console.log('[DEBUG FETCH] Tool choice:', body.tool_choice)
        } catch {
          console.log('[DEBUG FETCH] Body: (not JSON)')
        }
      }
    }

    return originalFetch(input, init)
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

// Define built-in tools
function getBuiltInTools(
  mode: AgentMode,
  streamContext: {
    channelId: string
    providerId: string
    model: string
    workspacePath?: string
  },
  sendArtifact?: (artifact: any) => void,
  sendSpawnAgent?: (agent: any) => void,
  sendUpdateArtifact?: (update: { id: string; updates: any }) => void
) {
  const canWrite = mode !== 'explore'
  const canExecute = mode === 'auto' || mode === 'execute' || mode === 'review'
  const canSpawnAgents = mode === 'auto' || mode === 'execute' || mode === 'plan'

  const tools: Record<string, any> = {}

  // Spawn sub-agent tool - for parallel task execution (bi-directional)
  if (canSpawnAgents) {
    tools.spawn_agent = tool({
      description: `Spawn a background sub-agent to work on a task in parallel.
Use this when you need to perform multiple independent tasks simultaneously, or when a task can be delegated while you continue with other work.
The sub-agent runs independently and you can check its status or wait for results using get_agent_status or wait_for_agent.
Returns an agent_id that you can use to track the agent.`,
      parameters: z.object({
        name: z.string().describe('A short name for the agent (e.g., "Test Runner", "Code Reviewer")'),
        task: z.string().describe('The detailed task description for the agent'),
        mode: z.enum(['auto', 'explore', 'execute', 'plan', 'review'])
          .optional()
          .describe('The mode for the agent (defaults to auto)'),
      }),
      execute: async ({ name, task, mode: agentMode }) => {
        // Spawn the sub-agent using the service
        const agentId = await spawnSubAgent({
          parentStreamId: streamContext.channelId,
          name,
          task,
          mode: agentMode || 'auto',
          providerId: streamContext.providerId,
          model: streamContext.model,
          workspacePath: streamContext.workspacePath,
        })

        // Notify the UI
        if (sendSpawnAgent) {
          sendSpawnAgent({ id: agentId, name, task, mode: agentMode || 'auto' })
        }

        return {
          success: true,
          agent_id: agentId,
          message: `Agent "${name}" spawned successfully. IMPORTANT: You MUST call wait_for_agent with this agent_id to get the results before finishing your response. Do not end without waiting.`,
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
If has_question is true, respond using continue_agent to keep the agent working.`,
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

  // Web search tool - always available
  tools.web_search = tool({
    description: `Search the web for information using DuckDuckGo.
Returns instant answers, related topics, and web results.
Use this to find current information, documentation, or answers to questions.`,
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      try {
        // Use DuckDuckGo's instant answer API
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
          definitionSource: data.DefinitionSource || null,
          relatedTopics: (data.RelatedTopics || []).slice(0, 5).map((topic: any) => ({
            text: topic.Text,
            url: topic.FirstURL,
          })).filter((t: any) => t.text),
        }

        // If we got good results
        if (results.abstract || results.answer || results.definition || results.relatedTopics.length > 0) {
          return { success: true, results }
        }

        // Fallback message
        return {
          success: true,
          results: {
            query,
            message: 'No instant answer found. Try using web_fetch with specific URLs for more detailed information.',
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

export function registerAIHandlers() {
  // Stream AI response with tool support
  ipcMain.on('ai:stream', async (event, channelId: string, params: any) => {
    const abortController = new AbortController()
    activeStreams.set(channelId, abortController)

    // Register this stream as active (for sub-agent orphan detection)
    registerParentStream(channelId)

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

      // Get tools based on mode
      const streamContext = {
        channelId,
        providerId: params.providerId,
        model: modelId,
        workspacePath: params.workspacePath,
      }
      const tools = getBuiltInTools(mode, streamContext, sendArtifact, sendSpawnAgent, sendUpdateArtifact)

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

      console.log('\n[AI] ========== STREAM START ==========')
      console.log('[AI] Model:', modelId)
      console.log('[AI] Mode:', mode)
      console.log('[AI] Provider type:', providerConfig.type)
      console.log('[AI] Base URL:', providerConfig.base_url || '(default)')
      console.log('[AI] Tool count:', Object.keys(tools).length)
      console.log('[AI] Tool names:', Object.keys(tools))
      console.log('[AI] System prompt length:', systemPrompt.length)
      console.log('[AI] Message count:', messages.length)

      // Log tool structure to verify they're correctly formed
      console.log('[AI] === TOOL STRUCTURE CHECK ===')
      const toolsArray = Object.entries(tools)
      if (toolsArray.length > 0) {
        const [firstName, firstTool] = toolsArray[0]
        console.log('[AI] First tool inspection:')
        console.log('  - Name:', firstName)
        console.log('  - Keys:', Object.keys(firstTool as object))
        // The tool() function should create objects with specific structure
        const t = firstTool as any
        console.log('  - Has description:', !!t.description)
        console.log('  - Has parameters:', !!t.parameters)
        console.log('  - Has execute:', typeof t.execute === 'function')
        console.log('  - Parameters type:', typeof t.parameters)
        if (t.parameters) {
          console.log('  - Parameters keys:', Object.keys(t.parameters))
        }
      }
      console.log('[AI] === END TOOL CHECK ===')

      // Log system prompt summary
      console.log('[AI] System prompt includes "tool":', systemPrompt.toLowerCase().includes('tool'))
      console.log('[AI] System prompt includes "function":', systemPrompt.toLowerCase().includes('function'))

      // Stream the response with tools
      // Using toolChoice: 'auto' (default) - model decides when to use tools
      // Can also use 'required' to force tool usage or 'none' to disable
      // IMPORTANT: Use provider.chat() not provider() to get /chat/completions endpoint
      // which properly supports tool calling. provider() uses /responses which doesn't.
      const result = await streamText({
        model: provider.chat(modelId),
        system: systemPrompt, // Pass system prompt separately (may help with tool recognition)
        messages,
        tools,
        toolChoice: 'auto', // Explicitly set to ensure tools are offered
        stopWhen: stepCountIs(10), // Allow up to 10 tool call steps (AI SDK v6 uses stopWhen instead of maxSteps)
        abortSignal: abortController.signal,
        onStepFinish: ({ toolCalls, toolResults, text, finishReason }) => {
          // Log step completion for debugging
          // Note: Tool calls/results are now sent via fullStream events for async display
          console.log('[AI] Step finished:', {
            finishReason,
            toolCallCount: toolCalls?.length || 0,
            toolResultCount: toolResults?.length || 0,
            textLength: text?.length || 0,
          })
        },
      })

      // Use fullStream to get both text AND tool call events as they happen
      // This enables async display of tool calls BEFORE they complete
      const pendingToolCalls = new Map<string, { name: string; args: Record<string, unknown> }>()

      for await (const part of result.fullStream) {
        if (abortController.signal.aborted) break

        switch (part.type) {
          case 'text-delta':
            // Regular text chunk - only send if we have actual text
            if (part.textDelta) {
              event.sender.send(`ai:chunk:${channelId}`, part.textDelta)
            }
            break

          case 'tool-call-streaming-start':
            // Tool call is STARTING - show immediately in UI
            console.log('[AI] Tool call starting:', part.toolName)
            pendingToolCalls.set(part.toolCallId, { name: part.toolName, args: {} })
            // Send initial tool call info to UI
            event.sender.send(`ai:toolCalls:${channelId}`, [{
              id: part.toolCallId,
              name: part.toolName,
              args: {}, // Args not yet known
              status: 'starting',
            }])
            break

          case 'tool-call-delta':
            // Arguments being built - could update UI with partial args
            // For now, just track it
            break

          case 'tool-call':
            // Tool call complete with full args
            // AI SDK uses 'input' for the arguments property
            const toolArgs = (part as any).input || (part as any).args || {}
            console.log('[AI] Tool call ready:', part.toolName, toolArgs)

            // Check if we already sent this tool call via streaming-start
            const existingCall = pendingToolCalls.get(part.toolCallId)
            pendingToolCalls.set(part.toolCallId, { name: part.toolName, args: toolArgs })

            if (existingCall) {
              // Update existing tool call with full args
              event.sender.send(`ai:toolCallUpdate:${channelId}`, {
                id: part.toolCallId,
                name: part.toolName,
                args: toolArgs,
                status: 'executing',
              })
            } else {
              // No streaming-start event - send as new tool call
              // This happens with some providers that don't support streaming tool calls
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
            // Tool execution complete - send result
            // AI SDK uses 'output' or 'result' depending on version
            const toolResult = (part as any).output || (part as any).result
            console.log('[AI] Tool result:', part.toolCallId, typeof toolResult === 'object' ? JSON.stringify(toolResult).slice(0, 100) : toolResult)
            event.sender.send(`ai:toolResults:${channelId}`, [{
              toolCallId: part.toolCallId,
              result: toolResult,
            }])
            break

          // Other events we might care about
          case 'step-start':
            console.log('[AI] Step starting')
            break

          case 'step-finish':
            console.log('[AI] Step finished:', part.finishReason, 'isContinued:', (part as any).isContinued)
            break

          case 'error':
            console.error('[AI] Stream error:', part.error)
            break
        }
      }

      // Get usage stats
      const usage = await result.usage
      const finishReason = await result.finishReason

      // Parse usage if it's a string (some providers return stringified JSON)
      let usageObj: any = usage
      if (typeof usage === 'string') {
        try {
          usageObj = JSON.parse(usage)
          console.log('[AI] Parsed stringified usage:', usageObj)
        } catch {
          console.warn('[AI] Failed to parse usage string:', usage)
          usageObj = {}
        }
      }

      // AI SDK v6 uses inputTokens/outputTokens, map to promptTokens/completionTokens
      // Some providers also use promptTokens/completionTokens, so check both
      const promptTokens = usageObj?.promptTokens || usageObj?.inputTokens || 0
      const completionTokens = usageObj?.completionTokens || usageObj?.outputTokens || 0
      const totalTokens = promptTokens + completionTokens

      // Check for running sub-agents that weren't waited for
      const activeAgents = getSubAgentsForStream(channelId)
      const runningAgents = activeAgents.filter(a => a.status === 'running' || a.status === 'pending')
      if (runningAgents.length > 0) {
        console.warn('[AI] WARNING: Stream ended with running sub-agents that were not waited for:',
          runningAgents.map(a => `${a.name} (${a.status})`))
      }

      // Log full usage object for debugging
      console.log('[AI] Stream completed:', {
        finishReason,
        promptTokens,
        completionTokens,
        totalTokens,
        runningSubAgents: runningAgents.length,
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
      activeStreams.delete(channelId)

      // Unregister parent stream - sub-agents get grace period before cleanup
      unregisterParentStream(channelId)

      // Dismiss completed sub-agents for this stream
      // Running/waiting agents get grace period via orphan cleanup
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
}
