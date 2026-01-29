/**
 * Context Compaction Service
 *
 * Handles conversation compaction when context window approaches capacity.
 * Uses a two-phase approach:
 * 1. Prune old tool outputs (they're verbose)
 * 2. Summarize remaining conversation into structured format
 */

import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { providerDb } from './database'
import { keychainService } from './keychain'

// Compaction thresholds
export const COMPACTION_THRESHOLDS = {
  WARNING: 0.70,    // Show warning icon at 70%
  COMPACT: 0.75,    // Auto-compact at 75%
  CRITICAL: 0.90,   // Force compact at 90%
}

// How many recent messages to keep intact
const RETENTION_COUNT = 6

// How many recent tool calls to preserve outputs for
const TOOL_OUTPUT_RETENTION = 3

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  createdAt: number
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>
  toolResults?: Array<{ toolCallId: string; result: unknown }>
}

interface CompactionResult {
  success: boolean
  summary?: string
  prunedMessages?: Message[]
  retainedMessages?: Message[]
  tokensBefore?: number
  tokensAfter?: number
  error?: string
}

// Estimate tokens (rough: ~4 chars per token for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Estimate tokens for a message including tool data
function estimateMessageTokens(message: Message): number {
  let tokens = estimateTokens(message.content)

  if (message.toolCalls) {
    for (const tc of message.toolCalls) {
      tokens += estimateTokens(tc.name)
      tokens += estimateTokens(JSON.stringify(tc.args))
    }
  }

  if (message.toolResults) {
    for (const tr of message.toolResults) {
      tokens += estimateTokens(JSON.stringify(tr.result))
    }
  }

  return tokens
}

/**
 * Phase 1: Prune old tool outputs
 * Replace verbose tool results with "[Output pruned]" for older tool calls
 */
function pruneToolOutputs(messages: Message[]): Message[] {
  // Find all tool calls in order
  const toolCallIndices: number[] = []
  messages.forEach((msg, idx) => {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      toolCallIndices.push(idx)
    }
  })

  // Keep outputs for the last N tool calls
  const protectedIndices = new Set(toolCallIndices.slice(-TOOL_OUTPUT_RETENTION))

  return messages.map((msg, idx) => {
    // Don't prune recent tool results
    if (protectedIndices.has(idx)) {
      return msg
    }

    // Prune tool results from older messages
    if (msg.toolResults && msg.toolResults.length > 0) {
      return {
        ...msg,
        toolResults: msg.toolResults.map(tr => ({
          ...tr,
          result: '[Output pruned for context efficiency]',
        })),
      }
    }

    return msg
  })
}

/**
 * Generate the compaction prompt
 */
function getCompactionPrompt(messages: Message[]): string {
  const conversationText = messages.map(msg => {
    let text = `[${msg.role.toUpperCase()}]: ${msg.content}`

    if (msg.toolCalls?.length) {
      text += `\n  Tools called: ${msg.toolCalls.map(tc => tc.name).join(', ')}`
    }

    return text
  }).join('\n\n')

  return `You are a context compaction assistant. Your job is to create a comprehensive summary of the following conversation that will serve as a "handoff" to continue the work.

The summary should be detailed enough that another AI (or you in a fresh context) can continue the conversation without losing critical information.

## Conversation to Summarize:
${conversationText}

## Create a summary with these sections:

### Completed Work
- Bullet list of what tasks were completed
- Include specific files modified, functions created, bugs fixed

### Current State
- What is the current state of the work?
- What files exist or were modified?
- What's working vs. not working?

### In Progress
- What task is currently being worked on?
- What was the last thing discussed?

### Next Steps
- What needs to be done next?
- Any pending tasks or follow-ups?

### User Preferences & Constraints
- Any preferences the user stated (coding style, tools, approaches)
- Project-specific constraints or requirements
- Decisions that were made and why

### Critical Context
- Any information that would be essential for continuing
- Key technical details, API keys mentioned, URLs, etc.
- Anything that would be confusing without context

Be comprehensive but concise. This summary replaces the entire conversation history, so nothing should be lost that matters for continuing the work.`
}

/**
 * Phase 2: Generate summary using AI
 */
async function generateSummary(
  messages: Message[],
  providerId: string,
  model: string
): Promise<string> {
  const providerConfig = providerDb.get(providerId)
  if (!providerConfig) {
    throw new Error('Provider not found')
  }

  const apiKey = await keychainService.getApiKey(providerId)
  if (!apiKey && providerConfig.type !== 'ollama' && providerConfig.type !== 'local') {
    throw new Error('API key not found')
  }

  // Create provider instance - use a fast model if available
  let provider: any
  let summaryModel = model

  // Try to use a faster/cheaper model for summarization
  if (providerConfig.type === 'anthropic') {
    provider = createAnthropic({ apiKey: apiKey! })
    // Use Haiku for summarization if available
    summaryModel = 'claude-3-5-haiku-20241022'
  } else if (providerConfig.type === 'openrouter') {
    provider = createOpenAI({
      apiKey: apiKey!,
      baseURL: providerConfig.base_url || 'https://openrouter.ai/api/v1',
    })
    // Could use a cheaper model here
  } else {
    provider = createOpenAI({
      apiKey: apiKey || 'local',
      baseURL: providerConfig.base_url,
    })
  }

  const prompt = getCompactionPrompt(messages)

  const result = await streamText({
    model: provider.chat(summaryModel),
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4000, // Summary should be concise
  })

  let summary = ''
  for await (const chunk of result.textStream) {
    summary += chunk
  }

  return summary
}

/**
 * Main compaction function
 */
export async function compactConversation(
  messages: Message[],
  providerId: string,
  model: string,
  options?: {
    forceCompact?: boolean
    customInstructions?: string
  }
): Promise<CompactionResult> {
  try {
    // Calculate current token usage
    const tokensBefore = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)

    // Phase 1: Prune tool outputs
    const prunedMessages = pruneToolOutputs(messages)
    const tokensAfterPrune = prunedMessages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)

    console.log(`[Compaction] Pruned tool outputs: ${tokensBefore} -> ${tokensAfterPrune} tokens`)

    // Separate messages to retain vs. summarize
    const retainedMessages = prunedMessages.slice(-RETENTION_COUNT)
    const messagesToSummarize = prunedMessages.slice(0, -RETENTION_COUNT)

    // If nothing to summarize, just return pruned messages
    if (messagesToSummarize.length === 0) {
      return {
        success: true,
        prunedMessages,
        retainedMessages,
        tokensBefore,
        tokensAfter: tokensAfterPrune,
      }
    }

    // Phase 2: Generate summary
    console.log(`[Compaction] Summarizing ${messagesToSummarize.length} messages...`)
    let summary = await generateSummary(messagesToSummarize, providerId, model)

    // Add custom instructions if provided
    if (options?.customInstructions) {
      summary += `\n\n### Additional Focus\n${options.customInstructions}`
    }

    const tokensAfter = estimateTokens(summary) +
      retainedMessages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)

    console.log(`[Compaction] Complete: ${tokensBefore} -> ${tokensAfter} tokens (${Math.round((tokensAfter / tokensBefore) * 100)}%)`)

    return {
      success: true,
      summary,
      prunedMessages,
      retainedMessages,
      tokensBefore,
      tokensAfter,
    }
  } catch (error: any) {
    console.error('[Compaction] Error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error during compaction',
    }
  }
}

/**
 * Check if compaction is needed based on token count and threshold
 */
export function shouldCompact(
  currentTokens: number,
  maxTokens: number,
  threshold: number = COMPACTION_THRESHOLDS.COMPACT
): boolean {
  return (currentTokens / maxTokens) >= threshold
}

/**
 * Get the current compaction status
 */
export function getCompactionStatus(
  currentTokens: number,
  maxTokens: number
): 'normal' | 'warning' | 'compact' | 'critical' {
  const percentage = currentTokens / maxTokens

  if (percentage >= COMPACTION_THRESHOLDS.CRITICAL) return 'critical'
  if (percentage >= COMPACTION_THRESHOLDS.COMPACT) return 'compact'
  if (percentage >= COMPACTION_THRESHOLDS.WARNING) return 'warning'
  return 'normal'
}
