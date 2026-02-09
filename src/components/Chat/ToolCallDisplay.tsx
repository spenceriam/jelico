import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink
} from 'lucide-react'
import type { ToolCall, ToolResult } from '../../stores/chat'
import { useAgentStore } from '../../stores/agents'
import { useArtifactStore } from '../../stores/artifacts'

interface ToolCallDisplayProps {
  toolCalls: ToolCall[]
  toolResults?: ToolResult[]
  isStreaming?: boolean
}

const TOOL_LABELS: Record<string, string> = {
  // File operations
  read_file: 'Read File',
  write_file: 'Write File',
  list_directory: 'List Directory',
  search_files: 'Search Files',
  // Execution
  execute_command: 'Execute Command',
  // Web
  web_search: 'Web Search',
  web_fetch: 'Fetch URL',
  // Artifacts
  create_artifact: 'Create Artifact',
  update_artifact: 'Update Artifact',
  artifact_test: 'Test Artifact',
  // Sub-agents - spawn_agent handled specially below
  spawn_agent: 'Sub-agent',
  get_agent_status: 'Check Agent',
  wait_for_agent: 'Wait for Agent',
  continue_agent: 'Continue Agent',
  dismiss_agent: 'Dismiss Agent',
  get_agents_summary: 'Agents Summary',
}

// Tools that are "plumbing" and shouldn't be shown in the UI
// These are internal operations that happen automatically or have dedicated UI
export const HIDDEN_TOOLS = new Set([
  'wait_for_agent',      // Waiting is implicit - sub-agent panel shows status
  'get_agent_status',    // Internal polling
  'get_agents_summary',  // Internal status check
  'ask_user_question',   // Has dedicated ClarificationPanel UI
  'todo_write',          // Has dedicated TodoPanel UI
  'todo_read',           // Internal status check
  'todo_check',          // Internal status check
])

function sanitizeSubAgentText(text?: string): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  // Suppress API/protocol leakage from provider internals
  if (/(input_schema|tool[_\s-]?call|function call|arguments schema|name`, `description`)/i.test(trimmed)) {
    return null
  }

  return trimmed
}

function getSubAgentStateLabel(status: string): string {
  switch (status) {
    case 'running':
      return 'Running'
    case 'pending':
      return 'Starting'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
    case 'canceled':
      return 'Cancelled'
    default:
      return status
  }
}

function formatSubAgentToolStatus(
  name: string,
  args: Record<string, unknown>,
  isComplete: boolean
): string {
  const getShortPath = (p: string) => {
    const parts = p.split('/')
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p
  }

  if (isComplete) {
    switch (name) {
      case 'read_file':
        return args.path ? `Read ${getShortPath(String(args.path))}` : 'File read'
      case 'write_file':
        return args.path ? `Wrote ${getShortPath(String(args.path))}` : 'File written'
      case 'list_directory':
        return args.path ? `Explored ${getShortPath(String(args.path))}` : 'Directory explored'
      case 'search_files':
        return 'Search complete'
      case 'execute_command':
        return 'Command complete'
      case 'web_search':
        return 'Search complete'
      case 'web_fetch':
        return 'Page fetched'
      case 'report_progress':
        return 'Status updated'
      default:
        return 'Tool complete'
    }
  }

  switch (name) {
    case 'read_file':
      return args.path ? `Reading ${getShortPath(String(args.path))}` : 'Reading file...'
    case 'write_file':
      return args.path ? `Writing ${getShortPath(String(args.path))}` : 'Writing file...'
    case 'list_directory':
      return args.path ? `Exploring ${getShortPath(String(args.path))}` : 'Exploring directory...'
    case 'search_files':
      return args.pattern ? `Searching for "${args.pattern}"` : 'Searching files...'
    case 'execute_command':
      return 'Running command...'
    case 'web_search':
      return args.query ? `Searching: "${String(args.query).slice(0, 32)}"` : 'Searching the web...'
    case 'web_fetch':
      return 'Fetching page...'
    case 'report_progress':
      return String(args.message || 'Updating status...').slice(0, 80)
    default:
      return 'Working...'
  }
}

function isCanceledResultPayload(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const payload = result as Record<string, unknown>
  if (payload.canceled === true || payload.cancelled === true) return true
  const error = String(payload.error || '')
  return error.toLowerCase().includes('canceled: stream stopped by user')
}

function formatToolResult(result: unknown): { content: string; isError: boolean } {
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>

    // Handle errors
    if (obj.success === false) {
      if (isCanceledResultPayload(obj)) {
        return {
          content: 'Canceled by user',
          isError: false,
        }
      }
      return {
        content: String(obj.error || 'Unknown error'),
        isError: true
      }
    }

    // File content
    if (obj.content) {
      return { content: String(obj.content), isError: false }
    }

    // Directory listing
    if (obj.items && Array.isArray(obj.items)) {
      return {
        content: obj.items.map((i: any) => `${i.type === 'directory' ? '[dir]' : '[file]'} ${i.name}`).join('\n'),
        isError: false
      }
    }

    // File search results
    if (obj.files && Array.isArray(obj.files)) {
      return { content: obj.files.join('\n'), isError: false }
    }

    // Command output
    if (obj.stdout !== undefined || obj.stderr !== undefined) {
      const out = String(obj.stdout || '')
      const err = String(obj.stderr || '')
      return {
        content: out + (err ? `\n---\nstderr:\n${err}` : ''),
        isError: obj.success === false
      }
    }

    // Agent spawn result
    if (obj.agent_id) {
      return {
        content: `Agent ID: ${obj.agent_id}\n${obj.message || ''}`,
        isError: false
      }
    }

    // Agent status result
    if (obj.status !== undefined && obj.is_complete !== undefined) {
      let statusInfo = `Status: ${obj.status}`
      if (obj.has_question) {
        statusInfo += `\n[Question] ${obj.question || 'Waiting for input'}`
        if (obj.question_context) statusInfo += `\nContext: ${obj.question_context}`
      }
      if (obj.result) statusInfo += `\n\nResult:\n${typeof obj.result === 'string' ? obj.result : JSON.stringify(obj.result, null, 2)}`
      if (obj.progress) statusInfo += `\n\nProgress:\n${obj.progress}`
      return { content: statusInfo, isError: false }
    }

    // Agents summary
    if (obj.agent_count !== undefined) {
      return {
        content: `Total: ${obj.agent_count} | Running: ${obj.running || 0} | Completed: ${obj.completed || 0} | Failed: ${obj.failed || 0}\n\n${obj.summary || ''}`,
        isError: false
      }
    }

    // Web search results
    if (obj.results && typeof obj.results === 'object') {
      const r = obj.results as any
      let searchInfo = ''
      if (r.abstract) searchInfo += `${r.abstract}\n\nSource: ${r.abstractSource || 'Unknown'}\n`
      if (r.answer) searchInfo += `Answer: ${r.answer}\n`
      if (r.relatedTopics?.length) {
        searchInfo += '\nRelated:\n' + r.relatedTopics.map((t: any) => `• ${t.text}`).join('\n')
      }
      if (r.message) searchInfo = r.message
      return { content: searchInfo || JSON.stringify(r, null, 2), isError: false }
    }

    // Artifact created/updated
    if (obj.message && String(obj.message).includes('Artifact')) {
      return { content: String(obj.message), isError: false }
    }

    // Artifact test sessions list
    if (obj.sessions && Array.isArray(obj.sessions)) {
      if (obj.sessions.length === 0) {
        return { content: 'No active artifact test sessions', isError: false }
      }
      const content = obj.sessions
        .map((session: any) => {
          const title = session.artifactTitle || session.artifactId || 'Untitled'
          return `• ${session.sessionId} (${title})`
        })
        .join('\n')
      return { content, isError: false }
    }

    // Artifact test open/screenshot summaries
    if (obj.sessionId || (obj.path && obj.width && obj.height)) {
      const lines: string[] = []
      if (obj.sessionId) lines.push(`Session: ${obj.sessionId}`)
      if (obj.artifactTitle) lines.push(`Artifact: ${obj.artifactTitle}`)
      if (obj.revision) lines.push(`Revision: v${obj.revision}`)
      if (obj.path) lines.push(`Screenshot: ${obj.path}`)
      if (obj.width && obj.height) lines.push(`Viewport: ${obj.width}x${obj.height}`)
      if (obj.value !== undefined) lines.push(`Value: ${JSON.stringify(obj.value)}`)
      return { content: lines.join('\n') || JSON.stringify(obj, null, 2), isError: false }
    }

    // Default: pretty JSON
    return { content: JSON.stringify(result, null, 2), isError: false }
  }
  return { content: String(result), isError: false }
}

// Single tool call display - exported for use in interleaved message segments
export function SingleToolCallDisplay({
  toolCall,
  toolResult,
  isStreaming
}: {
  toolCall: ToolCall
  toolResult?: ToolResult
  isStreaming?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const { agents } = useAgentStore()
  const { selectArtifact, openCanvas, artifacts } = useArtifactStore()

  // Get sub-agent info first for reference in useEffect
  const agentId = toolCall.name === 'spawn_agent' && toolResult?.result
    ? (toolResult.result as any)?.agent_id
    : null
  const subAgent = agentId ? agents.find(a => a.id === agentId) : null
  const safeLatestUpdate = sanitizeSubAgentText(subAgent?.latestUpdate?.message)
  const safeProgressPreview = sanitizeSubAgentText(subAgent?.progress)
  const progressPreview = safeProgressPreview
    ? safeProgressPreview.slice(0, 420)
    : null
  const lastAgentTool = subAgent?.toolCalls?.length
    ? subAgent.toolCalls[subAgent.toolCalls.length - 1]
    : null
  const agentToolStatus = lastAgentTool
    ? formatSubAgentToolStatus(lastAgentTool.name, lastAgentTool.args, !!lastAgentTool.result)
    : null


  // Build label with resource name included (e.g., "Write File: bunfig.toml")
  const label: string = (() => {
    if (toolCall.name === 'spawn_agent') {
      // Prefer displayName from agent store (has friendly first name)
      if (subAgent?.displayName) {
        return subAgent.displayName
      }
      // Fallback while agent is being spawned (before we have the agent_id)
      return 'Starting sub-agent...'
    }

    const baseName = TOOL_LABELS[toolCall.name] || toolCall.name
    const args = toolCall.args || {}

    // Extract resource name based on tool type
    const getShortPath = (p: string) => {
      const parts = p.split('/')
      return parts.length > 2 ? parts.slice(-2).join('/') : parts.slice(-1)[0] || p
    }

    switch (toolCall.name) {
      case 'read_file':
      case 'write_file':
        if (args.path) return `${baseName}: ${getShortPath(String(args.path))}`
        break
      case 'list_directory':
        if (args.path) return `${baseName}: ${getShortPath(String(args.path))}`
        break
      case 'search_files':
        if (args.pattern) return `${baseName}: "${args.pattern}"`
        break
      case 'execute_command': {
        const cmd = String(args.command || '')
        const shortCmd = cmd.length > 30 ? cmd.slice(0, 30) + '...' : cmd
        if (shortCmd) return `Command: ${shortCmd}`
        break
      }
      case 'web_search':
        if (args.query) return `${baseName}: "${String(args.query).slice(0, 25)}"`
        break
      case 'web_fetch': {
        const url = String(args.url || '')
        try {
          const hostname = new URL(url).hostname
          return `${baseName}: ${hostname}`
        } catch {}
        break
      }
      case 'create_artifact':
      case 'update_artifact':
        if (args.title) return `${baseName}: ${String(args.title).slice(0, 30)}`
        break
      case 'artifact_test': {
        const action = args.action ? String(args.action).replace(/_/g, ' ') : ''
        if (action === 'click' && args.selector) {
          return `${baseName}: click ${String(args.selector).slice(0, 30)}`
        }
        if (action === 'type' && args.selector) {
          return `${baseName}: type ${String(args.selector).slice(0, 30)}`
        }
        if (action === 'wait for' && (args.selector || args.text)) {
          return `${baseName}: wait for`
        }
        if (action === 'open' && args.artifact_id) {
          return `${baseName}: open ${String(args.artifact_id).slice(0, 12)}`
        }
        if (action) {
          return `${baseName}: ${action}`
        }
        break
      }
    }

    return baseName
  })()

  const hasResult = toolResult !== undefined
  const formattedResult = hasResult ? formatToolResult(toolResult.result) : null
  const isCanceled = toolCall.status === 'canceled' || toolCall.status === 'cancelled' || isCanceledResultPayload(toolResult?.result)

  const formatArtifactType = () => {
    const rawType = String(toolCall.args?.type || '').toLowerCase()
    const rawLang = String(toolCall.args?.language || '').toLowerCase()
    const rawTitle = String(toolCall.args?.title || '').toLowerCase()
    const rawContent = typeof toolCall.args?.content === 'string'
      ? toolCall.args.content.slice(0, 240).toLowerCase()
      : ''
    const capitalize = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value

    switch (rawType) {
      case 'html':
        return 'HTML page'
      case 'svg':
        return 'SVG graphic'
      case 'mermaid':
        return 'diagram'
      case 'document':
        return 'document'
      case 'code':
        return rawLang ? `${capitalize(rawLang)} code` : 'code'
      default:
        if (rawTitle.endsWith('.html') || rawTitle.endsWith('.htm') || rawContent.includes('<html')) {
          return 'HTML page'
        }
        if (rawTitle.endsWith('.svg') || rawContent.includes('<svg')) {
          return 'SVG graphic'
        }
        if (
          rawTitle.endsWith('.mmd') ||
          rawContent.includes('graph ') ||
          rawContent.includes('flowchart') ||
          rawContent.includes('sequencediagram')
        ) {
          return 'diagram'
        }
        if (rawTitle.endsWith('.md') || rawTitle.endsWith('.markdown')) {
          return 'markdown document'
        }
        if (rawTitle.endsWith('.txt')) {
          return 'text document'
        }
        if (rawLang) {
          return `${capitalize(rawLang)} code`
        }
        return rawType ? rawType : 'artifact'
    }
  }

  // Use explicit status if available, otherwise infer from result presence
  const inferredStatus = toolCall.status || (hasResult ? 'complete' : (isStreaming ? 'executing' : 'complete'))
  const status = (!isStreaming && !hasResult && (inferredStatus === 'starting' || inferredStatus === 'executing'))
    ? 'canceled'
    : inferredStatus
  const isInProgress = status === 'starting' || status === 'executing'

  const isExpandable = (() => {
    if (toolCall.name === 'create_artifact' && !hasResult && !formattedResult?.isError) {
      return false
    }
    return true
  })()

  // Get artifact info if this is a create_artifact call
  const artifactTitle = toolCall.name === 'create_artifact' && toolCall.args?.title
    ? String(toolCall.args.title)
    : null
  const createdArtifact = artifactTitle
    ? artifacts.find(a => a.title === artifactTitle)
    : null

  const handleArtifactClick = () => {
    if (createdArtifact) {
      selectArtifact(createdArtifact.id)
      openCanvas()
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-deep">
      {/* Header */}
      <button
        onClick={isExpandable ? () => setExpanded(!expanded) : undefined}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
          isExpandable ? 'hover:bg-bg-hover transition-colors' : ''
        }`}
      >
        {isExpandable ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          )
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        <span className="text-sm font-medium text-accent flex-1 truncate">{label}</span>

        {/* Status indicator - for spawn_agent, show sub-agent status instead of tool completion */}
        {toolCall.name === 'spawn_agent' && subAgent ? (
          // Show sub-agent status
          subAgent.status === 'running' || subAgent.status === 'pending' ? (
            <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
          ) : subAgent.status === 'completed' ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : subAgent.status === 'failed' ? (
            <XCircle className="w-4 h-4 text-error flex-shrink-0" />
          ) : null
        ) : (
          // Normal tool status
          <>
            {isInProgress && (
              <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
            )}
            {isCanceled && (
              <XCircle className="w-4 h-4 text-text-muted flex-shrink-0" />
            )}
            {hasResult && !formattedResult?.isError && !isCanceled && (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
            {!isCanceled && ((hasResult && formattedResult?.isError) || status === 'error') ? (
              <XCircle className="w-4 h-4 text-error flex-shrink-0" />
            ) : null}
          </>
        )}
      </button>

      {/* Artifact creation in progress - simple indicator, no streaming preview */}
      {toolCall.name === 'create_artifact' && !hasResult && (
        <div className="px-3 py-2 border-t border-border bg-bg-surface flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-accent" />
          <span className="text-xs text-text-muted">
            Creating {formatArtifactType()}...
          </span>
        </div>
      )}

      {/* Artifact link - shown inline when create_artifact completes */}
      {toolCall.name === 'create_artifact' && hasResult && !formattedResult?.isError && createdArtifact && (
        <div className="px-3 py-2 border-t border-border bg-bg-surface">
          <button
            onClick={handleArtifactClick}
            className="flex items-center gap-2 text-xs text-accent hover:text-accent-bright transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="underline">{createdArtifact.title}</span>
          </button>
        </div>
      )}

      {/* Sub-agent error - only show errors inline (not a full panel) */}
      {toolCall.name === 'spawn_agent' && subAgent?.status === 'failed' && subAgent.error && (
        <div className="px-3 py-2 border-t border-border bg-bg-surface flex items-start gap-2">
          <XCircle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" />
          <div className="text-xs text-error">{subAgent.error}</div>
        </div>
      )}

      {/* Expanded content - collapsible sections */}
      {expanded && isExpandable && (
        <div className="border-t border-border bg-bg-surface">
          {/* Sub-agent details are shown per tool card (single source of truth) */}
          {toolCall.name === 'spawn_agent' && subAgent && (
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className={`w-2 h-2 rounded-full ${
                  subAgent.status === 'running' || subAgent.status === 'pending'
                    ? 'bg-accent animate-pulse'
                    : subAgent.status === 'completed'
                      ? 'bg-green-500'
                      : 'bg-error'
                }`} />
                <span>{getSubAgentStateLabel(subAgent.status)}</span>
                {subAgent.latestUpdate?.phase && (
                  <span className="text-accent">[{subAgent.latestUpdate.phase}]</span>
                )}
              </div>

              {(safeLatestUpdate || agentToolStatus) && (
                <div className="ml-4 text-xs text-text-secondary">
                  {safeLatestUpdate || agentToolStatus}
                </div>
              )}

              {progressPreview && (
                <div className="ml-4 rounded bg-bg-deep px-2.5 py-2 text-xs text-text-secondary whitespace-pre-wrap">
                  {progressPreview}
                </div>
              )}
            </div>
          )}

          {/* Result - shown directly when expanded (not shown for spawn_agent) */}
          {formattedResult && toolCall.name !== 'spawn_agent' && (
            <div className="px-3 py-2">
              <pre className={`text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto rounded p-2 ${
                formattedResult.isError ? 'text-error bg-error/10' : 'text-text-secondary bg-bg-deep'
              }`}>
                {formattedResult.content}
              </pre>
            </div>
          )}

          {/* In progress indicator - for non-spawn_agent tools */}
          {isInProgress && toolCall.name !== 'spawn_agent' && (
            <div className="py-2 border-t border-border/50">
              <div className="flex items-start">
                <div className="w-6 flex-shrink-0 flex justify-center">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                </div>
                <div className="flex-1 pl-2 pr-3">
                  <div className="text-xs text-text-muted">
                    {status === 'starting' ? 'Starting...' : 'Running...'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ToolCallDisplay({ toolCalls, toolResults = [], isStreaming }: ToolCallDisplayProps) {
  // Filter out "plumbing" tools that users don't need to see
  const visibleToolCalls = toolCalls.filter(tc => !HIDDEN_TOOLS.has(tc.name))

  if (visibleToolCalls.length === 0) return null

  // Map results by toolCallId for easy lookup
  const resultsMap = new Map(toolResults.map(r => [r.toolCallId, r]))

  return (
    <div className="space-y-2 my-3">
      {visibleToolCalls.map((toolCall, index) => (
        <SingleToolCallDisplay
          key={toolCall.id || `tool-${index}`}
          toolCall={toolCall}
          toolResult={resultsMap.get(toolCall.id)}
          isStreaming={isStreaming}
        />
      ))}
    </div>
  )
}
