import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import type { ToolCall, ToolResult } from '../../stores/chat'

interface ToolCallDisplayProps {
  toolCalls: ToolCall[]
  toolResults?: ToolResult[]
  isStreaming?: boolean
}

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Read File',
  list_directory: 'List Directory',
  search_files: 'Search Files',
  write_file: 'Write File',
  execute_command: 'Execute Command',
  web_search: 'Web Search',
  web_fetch: 'Fetch URL',
  create_artifact: 'Create Artifact',
  spawn_agent: 'Spawn Agent',
}

function formatToolArgs(args: Record<string, unknown> | undefined | null): string {
  // Handle undefined/null args
  if (!args || typeof args !== 'object') return '(no arguments)'

  // Show the primary argument nicely
  if (args.path) return String(args.path)
  if (args.command) return String(args.command)
  if (args.query) return String(args.query)
  if (args.url) return String(args.url)
  if (args.title) return String(args.title)
  if (args.name) return String(args.name)
  if (args.task) return String(args.task).slice(0, 50) + (String(args.task).length > 50 ? '...' : '')
  if (args.pattern) return `${args.directory || '.'}/${args.pattern}`
  if (args.content) return `${String(args.content).slice(0, 30)}...`
  if (args.type) return String(args.type)

  // Fallback to JSON
  const jsonStr = JSON.stringify(args, null, 2)
  return jsonStr === '{}' ? '(no arguments)' : jsonStr
}

function formatToolResult(result: unknown): { content: string; isError: boolean } {
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>
    if (obj.success === false) {
      return {
        content: String(obj.error || 'Unknown error'),
        isError: true
      }
    }
    if (obj.content) {
      return { content: String(obj.content), isError: false }
    }
    if (obj.items && Array.isArray(obj.items)) {
      return {
        content: obj.items.map((i: any) => `${i.type === 'directory' ? '[dir]' : '[file]'} ${i.name}`).join('\n'),
        isError: false
      }
    }
    if (obj.files && Array.isArray(obj.files)) {
      return { content: obj.files.join('\n'), isError: false }
    }
    if (obj.stdout !== undefined || obj.stderr !== undefined) {
      const out = String(obj.stdout || '')
      const err = String(obj.stderr || '')
      return {
        content: out + (err ? `\n---\nstderr:\n${err}` : ''),
        isError: obj.success === false
      }
    }
    return { content: JSON.stringify(result, null, 2), isError: false }
  }
  return { content: String(result), isError: false }
}

function SingleToolCall({
  toolCall,
  result,
  isStreaming
}: {
  toolCall: ToolCall
  result?: ToolResult
  isStreaming?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const label = TOOL_LABELS[toolCall.name] || toolCall.name
  const argDisplay = formatToolArgs(toolCall.args)

  const hasResult = result !== undefined
  const formattedResult = hasResult ? formatToolResult(result.result) : null
  const isPending = !hasResult && isStreaming

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-deep">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}

        <span className="text-sm font-medium text-accent">{label}</span>

        <span className="text-xs text-text-muted truncate flex-1 font-mono">
          {argDisplay}
        </span>

        {/* Status indicator */}
        {isPending && (
          <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
        )}
        {hasResult && !formattedResult?.isError && (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}
        {hasResult && formattedResult?.isError && (
          <XCircle className="w-4 h-4 text-error flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Arguments */}
          <div className="px-3 py-2 bg-bg-surface">
            <div className="text-xs text-text-muted mb-1">Arguments</div>
            <pre className="text-xs font-mono text-text-secondary overflow-x-auto">
              {toolCall.args ? JSON.stringify(toolCall.args, null, 2) : '(no arguments)'}
            </pre>
          </div>

          {/* Result */}
          {formattedResult && (
            <div className="px-3 py-2 border-t border-border">
              <div className={`text-xs mb-1 ${formattedResult.isError ? 'text-error' : 'text-text-muted'}`}>
                {formattedResult.isError ? 'Error' : 'Result'}
              </div>
              <pre className={`text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto ${
                formattedResult.isError ? 'text-error' : 'text-text-secondary'
              }`}>
                {formattedResult.content}
              </pre>
            </div>
          )}

          {isPending && (
            <div className="px-3 py-2 border-t border-border">
              <div className="text-xs text-text-muted flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Executing...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ToolCallDisplay({ toolCalls, toolResults = [], isStreaming }: ToolCallDisplayProps) {
  if (toolCalls.length === 0) return null

  // Map results by toolCallId for easy lookup
  const resultsMap = new Map(toolResults.map(r => [r.toolCallId, r]))

  return (
    <div className="space-y-2 my-3">
      <div className="text-xs text-text-muted uppercase tracking-wider">
        Tool Calls ({toolCalls.length})
      </div>
      {toolCalls.map((toolCall, index) => (
        <SingleToolCall
          key={toolCall.id || `tool-${index}`}
          toolCall={toolCall}
          result={resultsMap.get(toolCall.id)}
          isStreaming={isStreaming}
        />
      ))}
    </div>
  )
}
