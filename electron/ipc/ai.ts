import { ipcMain } from 'electron'
import { streamText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { providerDb } from '../services/database'
import { keychainService } from '../services/keychain'
import { getModeSystemPrompt, type AgentMode } from '../lib/modes'

// Store active streams for cancellation
const activeStreams = new Map<string, AbortController>()

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
    default:
      throw new Error(`Unknown provider type: ${providerConfig.type}`)
  }
}

// Define built-in tools
function getBuiltInTools(
  mode: AgentMode,
  sendArtifact?: (artifact: any) => void,
  sendSpawnAgent?: (agent: any) => void
) {
  const canWrite = mode !== 'explore'
  const canExecute = mode === 'auto' || mode === 'execute' || mode === 'review'
  const canSpawnAgents = mode === 'auto' || mode === 'execute' || mode === 'plan'

  const tools: Record<string, any> = {}

  // Spawn sub-agent tool - for parallel task execution
  if (canSpawnAgents) {
    tools.spawn_agent = tool({
      description: `Spawn a background sub-agent to work on a task in parallel.
Use this when you need to perform multiple independent tasks simultaneously, or when a task can be delegated while you continue with other work.
The sub-agent will have access to the same tools and workspace context.`,
      parameters: z.object({
        name: z.string().describe('A short name for the agent (e.g., "Test Runner", "Code Reviewer")'),
        task: z.string().describe('The detailed task description for the agent'),
        mode: z.enum(['auto', 'explore', 'execute', 'plan', 'review'])
          .optional()
          .describe('The mode for the agent (defaults to auto)'),
      }),
      execute: async ({ name, task, mode: agentMode }) => {
        if (sendSpawnAgent) {
          sendSpawnAgent({ name, task, mode: agentMode || 'auto' })
        }
        return { success: true, message: `Agent "${name}" spawned to work on: ${task}` }
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
          const result = await execAsync(command, {
            cwd: cwd || process.cwd(),
            timeout: 60000, // 1 minute timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
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

  return tools
}

export function registerAIHandlers() {
  // Stream AI response with tool support
  ipcMain.on('ai:stream', async (event, channelId: string, params: any) => {
    const abortController = new AbortController()
    activeStreams.set(channelId, abortController)

    try {
      // Get provider config
      const providerConfig = providerDb.get(params.providerId)
      if (!providerConfig) {
        event.sender.send(`ai:error:${channelId}`, 'Provider not found')
        return
      }

      // Get API key
      const apiKey = await keychainService.getApiKey(params.providerId)
      if (!apiKey && providerConfig.type !== 'ollama') {
        event.sender.send(`ai:error:${channelId}`, 'API key not found')
        return
      }

      // Create provider instance
      const provider = getProviderInstance(providerConfig, apiKey || '')
      const modelId = params.model || providerConfig.default_model
      const mode: AgentMode = params.mode || 'auto'

      // Get mode system prompt
      let systemPrompt = getModeSystemPrompt(mode)

      // Add workspace context if provided
      if (params.workspacePath) {
        systemPrompt += `\n\n## Workspace Context
You are working in the workspace located at: ${params.workspacePath}
Use this as the base path for file operations. When reading, writing, or searching files, use paths relative to this workspace unless the user specifies an absolute path.`
      }

      // Artifact sender function
      const sendArtifact = (artifact: any) => {
        event.sender.send(`ai:artifact:${channelId}`, artifact)
      }

      // Spawn agent function
      const sendSpawnAgent = (agent: any) => {
        event.sender.send(`ai:spawnAgent:${channelId}`, agent)
      }

      // Get tools based on mode
      const tools = getBuiltInTools(mode, sendArtifact, sendSpawnAgent)

      // Build messages with system prompt
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...params.messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ]

      // Stream the response with tools
      const result = await streamText({
        model: provider(modelId),
        messages,
        tools,
        maxSteps: 10, // Allow up to 10 tool calls
        abortSignal: abortController.signal,
        onStepFinish: ({ toolCalls, toolResults }) => {
          // Send tool call updates to renderer
          if (toolCalls && toolCalls.length > 0) {
            event.sender.send(`ai:toolCalls:${channelId}`, toolCalls)
          }
          if (toolResults && toolResults.length > 0) {
            event.sender.send(`ai:toolResults:${channelId}`, toolResults)
          }
        },
      })

      // Send chunks as they arrive
      for await (const chunk of result.textStream) {
        if (abortController.signal.aborted) break
        event.sender.send(`ai:chunk:${channelId}`, chunk)
      }

      // Signal completion
      if (!abortController.signal.aborted) {
        event.sender.send(`ai:end:${channelId}`)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('AI streaming error:', error)
        event.sender.send(`ai:error:${channelId}`, error.message || 'Unknown error')
      }
    } finally {
      activeStreams.delete(channelId)
    }
  })

  // Stop streaming
  ipcMain.on('ai:stop', (_, channelId: string) => {
    const controller = activeStreams.get(channelId)
    if (controller) {
      controller.abort()
      activeStreams.delete(channelId)
    }
  })
}
