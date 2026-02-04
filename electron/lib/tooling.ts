import { generateText, type ToolCallRepairFunction } from 'ai'

type AnyMessage = { role?: string; content?: unknown }

const MAX_CONTEXT_CHARS = 2000

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && (part as any).type === 'text') {
          return String((part as any).text || '')
        }
        return ''
      })
      .filter(Boolean)
      .join('')
  }
  return ''
}

function getLastUserText(messages: AnyMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      const text = extractText(messages[i]?.content)
      if (text) return text.slice(0, MAX_CONTEXT_CHARS)
    }
  }
  return ''
}

function extractJson(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : trimmed).trim()
}

export function normalizeToolSchemas<T extends Record<string, any>>(tools: T): T {
  for (const tool of Object.values(tools)) {
    if (!tool) continue
    if (!tool.inputSchema && tool.parameters) {
      tool.inputSchema = tool.parameters
    }
  }
  return tools
}

export function createToolCallRepair(model: any): ToolCallRepairFunction<any> {
  return async ({ toolCall, inputSchema, messages, error }) => {
    try {
      const schema = await inputSchema({ toolName: toolCall.toolName })
      const lastUserText = getLastUserText(messages as AnyMessage[])
      const repairPrompt = [
        `Tool name: ${toolCall.toolName}`,
        `Error: ${error.message}`,
        `Original input: ${toolCall.input || '<empty>'}`,
        lastUserText ? `User request: ${lastUserText}` : null,
        `JSON Schema: ${JSON.stringify(schema)}`,
        'Return ONLY a JSON object that matches the schema. No markdown or extra text.',
      ]
        .filter(Boolean)
        .join('\n')

      const repairResult = await generateText({
        model,
        system: 'You repair invalid tool calls by returning valid JSON only.',
        messages: [{ role: 'user', content: repairPrompt }],
        temperature: 0,
        maxRetries: 0,
      })

      const jsonText = extractJson(repairResult.text || '')
      if (!jsonText) return null
      const parsed = JSON.parse(jsonText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

      return {
        ...toolCall,
        input: JSON.stringify(parsed),
      }
    } catch (err) {
      console.warn('[AI] Tool call repair failed:', err)
      return null
    }
  }
}
