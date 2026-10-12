/**
 * Soft-stage context elision helpers (arXiv 2609.20804, tier T4 mechanism M1).
 *
 * Pure functions over AI SDK ModelMessage-shaped arrays; kept Electron-free so
 * they are unit-testable. Applied to outgoing prompts only — stored history is
 * never mutated.
 */

export function estimateTokensLoose(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateMessagesTokensLoose(messages: Array<{ content: unknown }>): number {
  let total = 0
  for (const message of messages) {
    if (typeof message.content === 'string') {
      total += estimateTokensLoose(message.content)
    } else {
      total += estimateTokensLoose(JSON.stringify(message.content ?? ''))
    }
  }
  return total
}

export const ELIDED_TOOL_OUTPUT_STUB = '[Output elided for context efficiency]'
const MIN_ELIDE_CHARS = 1000

/**
 * Replace bulky tool outputs with short stubs, keeping the most recent tool
 * messages verbatim. Returns the original array reference when nothing changed.
 */
export function elideBulkyToolOutputs<T extends { role: string; content: unknown }>(
  messages: T[],
  keepRecentToolMessages = 2
): T[] {
  const toolMessageIndices: number[] = []
  messages.forEach((message, index) => {
    if (message.role === 'tool') toolMessageIndices.push(index)
  })
  const protectedIndices = new Set(toolMessageIndices.slice(-keepRecentToolMessages))

  let changed = false
  const next = messages.map((message, index) => {
    if (message.role !== 'tool' || protectedIndices.has(index)) return message
    if (!Array.isArray(message.content)) return message

    let contentChanged = false
    const content = (message.content as any[]).map((part) => {
      if (!part || part.type !== 'tool-result') return part
      const serialized = JSON.stringify(part.output ?? part.result ?? '')
      if (serialized.length < MIN_ELIDE_CHARS) return part
      const alreadyStubbed =
        serialized.includes(ELIDED_TOOL_OUTPUT_STUB) && serialized.length < MIN_ELIDE_CHARS * 2
      if (alreadyStubbed) return part

      contentChanged = true
      const replacement: any = { ...part }
      if ('output' in replacement) {
        replacement.output = { type: 'text', value: ELIDED_TOOL_OUTPUT_STUB }
      } else {
        replacement.result = ELIDED_TOOL_OUTPUT_STUB
      }
      return replacement
    })

    if (!contentChanged) return message
    changed = true
    return { ...message, content } as T
  })

  return changed ? next : messages
}
