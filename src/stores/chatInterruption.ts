interface ToolResultLike {
  result: unknown
}

interface MessageLike {
  role: string
  toolResults?: ToolResultLike[]
}

const INCOMPLETE_TOOL_CANCELLATION_REASONS = new Set([
  'stream_end_incomplete',
  'provider_abort',
  'provider_stream_interrupted',
])

export function hasIncompleteToolEvidence(messages: MessageLike[]): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    const toolResults = message.toolResults || []
    return toolResults.some((toolResult) => {
      if (!toolResult?.result || typeof toolResult.result !== 'object') return false
      const payload = toolResult.result as Record<string, unknown>
      const cancellationReason = typeof payload.cancellationReason === 'string'
        ? payload.cancellationReason
        : null
      if (cancellationReason && INCOMPLETE_TOOL_CANCELLATION_REASONS.has(cancellationReason)) {
        return true
      }
      const error = String(payload.error || '').toLowerCase()
      return (
        error.includes('before returning a final result') ||
        error.includes('provider interrupted tool execution') ||
        error.includes('provider ended the stream before finalizing this tool call')
      )
    })
  }
  return false
}
