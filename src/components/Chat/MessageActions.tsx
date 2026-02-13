import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import type { MessageUsage, ToolCall, ToolResult } from '../../stores/chat'
import { formatElapsedTime } from '../../utils/format'

interface MessageActionsProps {
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  usage?: MessageUsage
  onRegenerate?: () => void
  isRegenerating?: boolean
}

/**
 * Format tool calls and results for copying
 */
function formatToolCallsForCopy(toolCalls?: ToolCall[], toolResults?: ToolResult[]): string {
  if (!toolCalls || toolCalls.length === 0) return ''

  const resultsMap = new Map(toolResults?.map(r => [r.toolCallId, r]) || [])

  let output = '\n\n---\nTool Calls:\n'

  for (const tc of toolCalls) {
    output += `\n[${tc.name}]\n`
    output += `Arguments: ${JSON.stringify(tc.args, null, 2)}\n`

    const result = resultsMap.get(tc.id)
    if (result) {
      const resultStr = typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2)
        : String(result.result)
      output += `Result: ${resultStr}\n`
    }
  }

  return output
}

export function MessageActions({ content, toolCalls, toolResults, usage, onRegenerate, isRegenerating }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      // Include tool calls in the copy if present
      const toolCallsText = formatToolCallsForCopy(toolCalls, toolResults)
      const fullContent = content + toolCallsText
      await navigator.clipboard.writeText(fullContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border-subtle">
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
          <span>Completed in</span>
          <span className="text-accent font-medium">{formatElapsedTime(usage.durationMs)}</span>
        </div>
      )}
    </div>
  )
}
