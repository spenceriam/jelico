import { ipcMain, net } from 'electron'
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

// Provider types that use OpenAI Chat Completions API (not Responses API)
// These providers don't support OpenAI's new Responses API, only Chat Completions
const OPENAI_CHAT_PROVIDERS = [
  'openrouter',
  'ollama',
  'openai-compatible',
  'anthropic-compatible',
  'local',
  'zai',
  'zai-china',
  'zai-coding',
  'zai-coding-china',
]

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

    case 'openrouter': {
      console.log('[AI] Creating OpenRouter provider with key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING')
      // Custom fetch to ensure Authorization header is always set
      const openRouterFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        // Force set Authorization header
        headers.set('Authorization', `Bearer ${apiKey}`)
        console.log('[AI] OpenRouter fetch to:', url)
        console.log('[AI] OpenRouter auth header:', headers.get('Authorization')?.substring(0, 20) + '...')
        return fetch(url, { ...init, headers })
      }
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url || 'https://openrouter.ai/api/v1',
        compatibility: 'strict', // Force OpenAI-compatible mode
        fetch: openRouterFetch,
      })
    }

    case 'ollama':
      return createOpenAI({
        apiKey: 'ollama', // Ollama doesn't need a real key
        baseURL: providerConfig.base_url || 'http://localhost:11434/v1',
      })

    // Z.ai (Global)
    case 'zai':
      return createOpenAI({
        apiKey,
        baseURL: 'https://api.z.ai/api/paas/v4',
      })

    // Z.ai (China)
    case 'zai-china':
      return createOpenAI({
        apiKey,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      })

    // Z.ai Coding Plan (Global)
    case 'zai-coding':
      return createOpenAI({
        apiKey,
        baseURL: 'https://api.z.ai/api/coding/paas/v4',
      })

    // Z.ai Coding Plan (China)
    case 'zai-coding-china':
      return createOpenAI({
        apiKey,
        baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4',
      })

    // Generic OpenAI-compatible provider (user-configured endpoint)
    case 'openai-compatible':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url,
      })

    // Generic Anthropic-compatible provider (uses OpenAI SDK with Anthropic-style endpoint)
    case 'anthropic-compatible':
      return createOpenAI({
        apiKey,
        baseURL: providerConfig.base_url,
      })

    // Local provider (OpenAI-compatible, optional API key)
    case 'local':
      return createOpenAI({
        apiKey: apiKey || 'local',
        baseURL: providerConfig.base_url || 'http://localhost:8080/v1',
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

// Get the model instance, using .chat() for OpenAI-compatible providers
function getModelInstance(provider: any, modelId: string, providerType: string) {
  // Use Chat Completions API for OpenAI-compatible providers
  if (OPENAI_CHAT_PROVIDERS.includes(providerType)) {
    return provider.chat(modelId)
  }
  // Use default API for native providers (Anthropic, Google, OpenAI)
  return provider(modelId)
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

      // Get API key (some providers like ollama and local don't require one)
      const apiKey = await keychainService.getApiKey(params.providerId)
      const noKeyRequired = ['ollama', 'local'].includes(providerConfig.type)

      // Debug logging
      console.log('[AI] Provider ID:', params.providerId)
      console.log('[AI] Provider type:', providerConfig.type)
      console.log('[AI] API key retrieved:', apiKey ? `${apiKey.substring(0, 10)}...` : 'null')

      // BYPASS SDK FOR OPENROUTER - Direct API call
      if (providerConfig.type === 'openrouter' && apiKey) {
        console.log('[AI] Using DIRECT OpenRouter API (bypassing SDK)...')
        const modelId = params.model || providerConfig.default_model
        const mode: AgentMode = params.mode || 'auto'
        let systemPrompt = getModeSystemPrompt(mode)
        if (params.workspacePath) {
          systemPrompt += `\n\nWorkspace: ${params.workspacePath}`
        }

        const messages = [
          { role: 'system', content: systemPrompt },
          ...params.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          })),
        ]

        // Log everything we're sending
        const requestBody = JSON.stringify({
          model: modelId,
          messages,
          stream: true,
        })

        console.log('[AI] OpenRouter request model:', modelId)
        console.log('[AI] OpenRouter API key length:', apiKey.length)

        // Use Electron's net module instead of fetch
        try {
          const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
            const request = net.request({
              method: 'POST',
              url: 'https://openrouter.ai/api/v1/chat/completions',
            })

            request.setHeader('Authorization', `Bearer ${apiKey}`)
            request.setHeader('Content-Type', 'application/json')

            let responseBody = ''
            let statusCode = 0

            request.on('response', (res) => {
              statusCode = res.statusCode
              console.log('[AI] net.request response status:', statusCode)
              console.log('[AI] net.request response headers:', res.headers)

              res.on('data', (chunk) => {
                responseBody += chunk.toString()
              })

              res.on('end', () => {
                resolve({ status: statusCode, body: responseBody })
              })
            })

            request.on('error', (error) => {
              reject(error)
            })

            request.write(requestBody)
            request.end()
          })

          console.log('[AI] OpenRouter net.request status:', response.status)

          if (response.status !== 200) {
            console.log('[AI] OpenRouter error response:', response.body)
            event.sender.send(`ai:error:${channelId}`, `OpenRouter error: ${response.status} - ${response.body}`)
            return
          }

          // Parse streaming response
          const lines = response.body.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content
                if (content) {
                  event.sender.send(`ai:chunk:${channelId}`, content)
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }

          event.sender.send(`ai:end:${channelId}`, {
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            finishReason: 'stop',
          })
          return
        } catch (e: any) {
          console.log('[AI] OpenRouter net.request exception:', e.message)
          event.sender.send(`ai:error:${channelId}`, `OpenRouter error: ${e.message}`)
          return
        }
      }

      if (!apiKey && !noKeyRequired) {
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
        ...params.messages.map((m: any) => {
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
        }),
      ]

      // Stream the response with tools
      const result = await streamText({
        model: getModelInstance(provider, modelId, providerConfig.type),
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

      // Get usage stats
      const usage = await result.usage
      const finishReason = await result.finishReason

      // Signal completion with stats
      if (!abortController.signal.aborted) {
        event.sender.send(`ai:end:${channelId}`, {
          usage: {
            promptTokens: usage?.promptTokens || 0,
            completionTokens: usage?.completionTokens || 0,
            totalTokens: (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
          },
          finishReason,
        })
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
