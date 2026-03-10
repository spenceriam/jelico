import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import type { MessageUsage, ToolCall, ToolResult, StreamingSegment } from '../../stores/chat'
import { modes } from '../../lib/modes'
import { formatElapsedTime } from '../../utils/format'
import { isHiddenToolCall } from './ToolCallDisplay'

interface MessageActionsProps {
  content: string
  segments?: StreamingSegment[]
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  usage?: MessageUsage
  onRegenerate?: () => void
  isRegenerating?: boolean
}

/**
 * Format a tool call and result for copy/export output
 */
function formatToolCallEntryForCopy(toolCall: ToolCall, toolResult?: ToolResult): string {
  let output = `---\n[${toolCall.name}]\n`
  output += `Arguments: ${JSON.stringify(toolCall.args, null, 2)}\n`

  if (toolResult) {
    const resultStr = typeof toolResult.result === 'object'
      ? JSON.stringify(toolResult.result, null, 2)
      : String(toolResult.result)
    output += `Result: ${resultStr}\n`
  }

  return output
}

/**
 * Build copy output preserving interleaved segment order when available.
 * Falls back to legacy "content + Tool Calls section" format for older messages.
 */
function buildCopyOutput(
  content: string,
  segments?: StreamingSegment[],
  toolCalls?: ToolCall[],
  toolResults?: ToolResult[]
): string {
  const resultsMap = new Map(toolResults?.map(r => [r.toolCallId, r]) || [])
  const toolCallsById = new Map(toolCalls?.map(tc => [tc.id, tc]) || [])

  if (segments && segments.length > 0) {
    const blocks: string[] = []

    for (const segment of segments) {
      if (segment.type === 'text') {
        if (segment.content) {
          blocks.push(segment.content)
        }
        continue
      }

      const toolCall = toolCallsById.get(segment.toolCallId)
      const toolResult = resultsMap.get(segment.toolCallId)
      if (!toolCall || isHiddenToolCall(toolCall, toolResult)) {
        continue
      }
      blocks.push(formatToolCallEntryForCopy(toolCall, toolResult))
    }

    const interleavedOutput = blocks.join('\n\n').trim()
    if (interleavedOutput) return interleavedOutput
  }

  // Legacy fallback for messages without saved segments
  if (!toolCalls || toolCalls.length === 0) return content

  let output = `${content}\n\n---\nTool Calls:\n`

  for (const toolCall of toolCalls) {
    output += `\n[${toolCall.name}]\n`
    output += `Arguments: ${JSON.stringify(toolCall.args, null, 2)}\n`

    const result = resultsMap.get(toolCall.id)
    if (result) {
      const resultStr = typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2)
        : String(result.result)
      output += `Result: ${resultStr}\n`
    }
  }

  return output
}

export function MessageActions({ content, segments, toolCalls, toolResults, usage, onRegenerate, isRegenerating }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const modeLabel = usage?.mode ? modes[usage.mode]?.name ?? usage.mode : null
  const modelLabel = usage?.model || null

  const handleCopy = async () => {
    try {
      const output = buildCopyOutput(content, segments, toolCalls, toolResults)
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        title="Copy to clipboard"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-success" />
            <span className="text-success">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>

      {/* Regenerate button */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
          title="Regenerate response"
        >
          {isRegenerating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
        </button>
      )}

      {/* Completion time - show only elapsed time, hide token stats */}
      {usage && usage.durationMs !== undefined && usage.durationMs > 0 && (
        <div className="flex items-center gap-1 ml-auto text-xs text-text-muted" title={`${usage.totalTokens.toLocaleString()} tokens | ${usage.tokensPerSecond || 0} tok/s`}>
          {modeLabel && (
            <span className="text-accent">{modeLabel}</span>
          )}
          {modeLabel && modelLabel && (
            <span className="text-text-faint">•</span>
          )}
          {modelLabel && (
            <span className="text-text-secondary">{modelLabel}</span>
          )}
          {(modeLabel || modelLabel) && (
            <span className="text-text-faint">•</span>
          )}
          <span>Completed in</span>
          <span className="text-accent font-medium">{formatElapsedTime(usage.durationMs)}</span>
        </div>
      )}
    </div>
  )
}
