import { generateText, type ToolCallRepairFunction } from 'ai'

type AnyMessage = { role?: string; content?: unknown }

const MAX_CONTEXT_CHARS = 2000
const MAX_REPAIR_INPUT_CHARS = 8000

type ArtifactType = 'code' | 'document' | 'html' | 'svg' | 'mermaid'

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

function truncateForPrompt(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`
}

function parseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function decodeJsonStringLoose(input: string): string | null {
  const candidates = [
    input,
    input.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'),
  ]
  for (const candidate of candidates) {
    try {
      return JSON.parse(`"${candidate}"`)
    } catch {
      // Try next candidate
    }
  }
  try {
    return input
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  } catch {
    return null
  }
}

function extractJsonLikeStringField(input: string, field: string): string | null {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const completePattern = new RegExp(`"${escapedField}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 's')
  const complete = completePattern.exec(input)
  if (complete?.[1]) {
    return decodeJsonStringLoose(complete[1])
  }

  const startPattern = new RegExp(`"${escapedField}"\\s*:\\s*"`, 's')
  const start = startPattern.exec(input)
  if (!start?.index) {
    if (start?.index !== 0) return null
  }
  const startIndex = (start?.index || 0) + (start?.[0]?.length || 0)
  let fragment = input.slice(startIndex)
  fragment = fragment.replace(/"\s*}\s*$/s, '')
  fragment = fragment.replace(/"\s*,\s*"[^"]+"\s*:/s, '')
  fragment = fragment.replace(/\s*}$/s, '')
  if (!fragment.trim()) return null
  return decodeJsonStringLoose(fragment)
}

function inferArtifactType(content: string): ArtifactType {
  const trimmed = content.trim()
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('<!doctype html') || lower.startsWith('<html') || lower.includes('<body')) {
    return 'html'
  }
  if (lower.startsWith('<svg') || lower.includes('<svg')) {
    return 'svg'
  }
  if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\b/m.test(trimmed)) {
    return 'mermaid'
  }
  if (/^\s{0,3}(#|\* |- |\d+\.)\s+/m.test(trimmed)) {
    return 'document'
  }
  return 'code'
}

function inferArtifactTitle(lastUserText: string, type: ArtifactType): string {
  const cleaned = lastUserText.replace(/\s+/g, ' ').trim()
  if (cleaned) {
    return cleaned.slice(0, 80)
  }
  switch (type) {
    case 'html':
      return 'Interactive HTML Artifact'
    case 'svg':
      return 'SVG Artifact'
    case 'mermaid':
      return 'Mermaid Diagram'
    case 'document':
      return 'Document Artifact'
    case 'code':
    default:
      return 'Code Artifact'
  }
}

function isArtifactType(value: unknown): value is ArtifactType {
  return value === 'code' || value === 'document' || value === 'html' || value === 'svg' || value === 'mermaid'
}

function tryLocalRepairToolCall(
  toolName: string,
  input: unknown,
  lastUserText: string
): Record<string, unknown> | null {
  const raw = typeof input === 'string'
    ? input
    : (input && typeof input === 'object' ? JSON.stringify(input) : '')
  if (!raw) return null

  const parsed = parseObject(raw)

  if (toolName === 'create_artifact') {
    const parsedContent = typeof parsed?.content === 'string' ? parsed.content : null
    const content = parsedContent || extractJsonLikeStringField(raw, 'content')
    if (!content || !content.trim()) return null

    const parsedType = parsed?.type
    const type: ArtifactType = isArtifactType(parsedType) ? parsedType : inferArtifactType(content)
    const parsedTitle = typeof parsed?.title === 'string' ? parsed.title.trim() : ''
    const title = parsedTitle || inferArtifactTitle(lastUserText, type)
    const repaired: Record<string, unknown> = {
      type,
      title,
      content,
    }
    const parsedLanguage = typeof parsed?.language === 'string' ? parsed.language.trim() : ''
    if (parsedLanguage) repaired.language = parsedLanguage
    return repaired
  }

  if (toolName === 'update_artifact') {
    const id =
      (typeof parsed?.id === 'string' ? parsed.id : null) ||
      extractJsonLikeStringField(raw, 'id')
    const content =
      (typeof parsed?.content === 'string' ? parsed.content : null) ||
      extractJsonLikeStringField(raw, 'content')
    if (!id || !content || !content.trim()) return null

    const parsedType = parsed?.type
    const type: ArtifactType = isArtifactType(parsedType) ? parsedType : inferArtifactType(content)
    const repaired: Record<string, unknown> = {
      id,
      type,
      content,
    }
    const title =
      (typeof parsed?.title === 'string' ? parsed.title.trim() : '') ||
      extractJsonLikeStringField(raw, 'title') ||
      ''
    if (title) repaired.title = title
    const language =
      (typeof parsed?.language === 'string' ? parsed.language.trim() : '') ||
      extractJsonLikeStringField(raw, 'language') ||
      ''
    if (language) repaired.language = language
    return repaired
  }

  if (toolName === 'write_file') {
    const path =
      (typeof parsed?.path === 'string' ? parsed.path : null) ||
      extractJsonLikeStringField(raw, 'path')
    const content =
      (typeof parsed?.content === 'string' ? parsed.content : null) ||
      extractJsonLikeStringField(raw, 'content')

    if (!path || !content || !content.trim()) return null

    const repaired: Record<string, unknown> = {
      path,
      content,
    }

    const mode =
      (typeof parsed?.mode === 'string' ? parsed.mode : null) ||
      extractJsonLikeStringField(raw, 'mode')
    if (mode) {
      repaired.mode = mode
    }

    return repaired
  }

  return null
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
      const lastUserText = getLastUserText(messages as AnyMessage[])
      const localRepair = tryLocalRepairToolCall(toolCall.toolName, toolCall.input, lastUserText)
      if (localRepair) {
        return {
          ...toolCall,
          input: JSON.stringify(localRepair),
        }
      }

      const schema = await inputSchema({ toolName: toolCall.toolName })
      const originalInput = typeof toolCall.input === 'string'
        ? toolCall.input
        : JSON.stringify(toolCall.input || '')
      const repairPrompt = [
        `Tool name: ${toolCall.toolName}`,
        `Error: ${truncateForPrompt(error?.message || 'Unknown error', 1000)}`,
        `Original input: ${truncateForPrompt(originalInput || '<empty>', MAX_REPAIR_INPUT_CHARS)}`,
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
