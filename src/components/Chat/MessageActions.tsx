import { useState } from 'react'
import { Copy, Check, RefreshCw, Zap, Hash } from 'lucide-react'
import type { MessageUsage, ToolCall, ToolResult } from '../../stores/chat'

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
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
        </button>
      )}

      {/* Usage stats */}
      {usage && (
        <div className="flex items-center gap-3 ml-auto text-xs text-text-muted">
          {/* Tokens per second */}
          {usage.tokensPerSecond !== undefined && usage.tokensPerSecond > 0 && (
            <div className="flex items-center gap-1" title="Tokens per second">
              <Zap className="w-3.5 h-3.5" />
              <span>{usage.tokensPerSecond} tok/s</span>
            </div>
          )}

          {/* Total tokens */}
          {usage.totalTokens > 0 && (
            <div className="flex items-center gap-1" title={`Prompt: ${usage.promptTokens} | Completion: ${usage.completionTokens}`}>
              <Hash className="w-3.5 h-3.5" />
              <span>{usage.totalTokens.toLocaleString()} tokens</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
