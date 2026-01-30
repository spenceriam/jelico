import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
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
  // Sub-agents - spawn_agent handled specially below
  spawn_agent: 'Sub-agent',
  get_agent_status: 'Check Agent',
  wait_for_agent: 'Wait for Agent',
  continue_agent: 'Continue Agent',
  dismiss_agent: 'Dismiss Agent',
  get_agents_summary: 'Agents Summary',
}

// Tools that are "plumbing" and shouldn't be shown in the UI
// These are internal operations that happen automatically
const HIDDEN_TOOLS = new Set([
  'wait_for_agent',      // Waiting is implicit - sub-agent panel shows status
  'get_agent_status',    // Internal polling
  'get_agents_summary',  // Internal status check
])

function formatToolArgs(args: Record<string, unknown> | undefined | null): string {
  // Handle undefined/null args
  if (!args || typeof args !== 'object') return '(no arguments)'

  // Show the primary argument nicely based on tool type
  if (args.path) return String(args.path)
  if (args.command) return String(args.command)
  if (args.query) return String(args.query)
  if (args.url) return String(args.url)
  if (args.title) return String(args.title)
  // Agent-related: show name and task preview
  if (args.name && args.task) return `${args.name}: ${String(args.task).slice(0, 40)}${String(args.task).length > 40 ? '...' : ''}`
  if (args.name) return String(args.name)
  // Agent ID for status/wait/continue/dismiss
  if (args.agent_id) return `Agent: ${String(args.agent_id).slice(0, 8)}...`
  // Task description
  if (args.task) return String(args.task).slice(0, 50) + (String(args.task).length > 50 ? '...' : '')
  // Response for continue_agent
  if (args.response) return `"${String(args.response).slice(0, 40)}${String(args.response).length > 40 ? '...' : ''}"`
  // File patterns
  if (args.pattern) return `${args.directory || '.'}/${args.pattern}`
  // Content preview
  if (args.content) return `${String(args.content).slice(0, 30)}...`
  // Artifact type
  if (args.type) return String(args.type)

  // Fallback to JSON
  const jsonStr = JSON.stringify(args, null, 2)
  return jsonStr === '{}' ? '(no arguments)' : jsonStr
}

function formatToolResult(result: unknown): { content: string; isError: boolean } {
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>

    // Handle errors
    if (obj.success === false) {
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

  // Custom label for spawn_agent to show task inline
  const label: string = (toolCall.name === 'spawn_agent' && !!toolCall.args?.task)
    ? `Sub-agent: ${String(toolCall.args.task).slice(0, 60)}${String(toolCall.args.task).length > 60 ? '...' : ''}`
    : (TOOL_LABELS[toolCall.name] || toolCall.name)
  const argDisplay = toolCall.name === 'spawn_agent' ? '' : formatToolArgs(toolCall.args)

  const hasResult = toolResult !== undefined
  const formattedResult = hasResult ? formatToolResult(toolResult.result) : null

  // Use explicit status if available, otherwise infer from result presence
  const status = toolCall.status || (hasResult ? 'complete' : (isStreaming ? 'executing' : 'complete'))
  const isInProgress = status === 'starting' || status === 'executing'

  // Status text for display
  const statusText = status === 'starting' ? 'Starting...' :
                     status === 'executing' ? 'Running...' :
                     status === 'error' ? 'Error' : ''

  // Get sub-agent info if this is a spawn_agent call
  const agentId = toolCall.name === 'spawn_agent' && toolResult?.result
    ? (toolResult.result as any)?.agent_id
    : null
  const subAgent = agentId ? agents.find(a => a.id === agentId) : null

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
          {argDisplay || statusText}
        </span>

        {/* Status indicator */}
        {isInProgress && (
          <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
        )}
        {hasResult && !formattedResult?.isError && (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}
        {(hasResult && formattedResult?.isError) || status === 'error' ? (
          <XCircle className="w-4 h-4 text-error flex-shrink-0" />
        ) : null}
      </button>

      {/* Artifact content streaming - show raw content while creating */}
      {toolCall.name === 'create_artifact' && !hasResult && !!toolCall.args?.content && (
        <div className="border-t border-border bg-bg-surface">
          {/* Title and type header */}
          <div className="px-3 py-2 flex items-center gap-2 border-b border-border/50">
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
            <span className="text-xs font-medium text-text-primary">
              {String(toolCall.args.title || 'Creating artifact...')}
            </span>
            {!!toolCall.args.language && (
              <span className="text-xs text-text-muted">
                {String(toolCall.args.language)}
              </span>
            )}
          </div>
          {/* Streaming content preview */}
          <div className="max-h-64 overflow-y-auto">
            <pre className="text-xs font-mono text-text-secondary p-3 whitespace-pre-wrap break-words">
              {String(toolCall.args.content)}
            </pre>
          </div>
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

      {/* Sub-agent activity panel - shown under spawn_agent calls */}
      {toolCall.name === 'spawn_agent' && subAgent && (
        <div className="border-t border-border bg-bg-surface">
          {/* Agent header - first level */}
          <div className="py-2">
            <div className="flex items-start">
              <div className="w-6 flex-shrink-0 flex justify-center">
                <Bot className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 pl-2 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary text-sm">{subAgent.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    subAgent.status === 'running' ? 'bg-accent/20 text-accent animate-pulse' :
                    subAgent.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                    subAgent.status === 'failed' ? 'bg-error/20 text-error' :
                    'bg-bg-elevated text-text-muted'
                  }`}>
                    {subAgent.status === 'running' ? 'Working...' : subAgent.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Task - indented under agent */}
          <div className="py-2 border-t border-border/50">
            <div className="flex items-start">
              <div className="w-6 flex-shrink-0 flex justify-center pt-0.5">
                <div className="w-px h-full bg-border" />
              </div>
              <div className="flex-1 pl-2 pr-3">
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Task</div>
                <div className="text-xs text-text-secondary">{subAgent.task}</div>
              </div>
            </div>
          </div>

          {/* Sub-agent's tool calls - indented under agent */}
          {subAgent.toolCalls && subAgent.toolCalls.length > 0 && (
            <div className="py-2 border-t border-border/50">
              <div className="flex items-start">
                <div className="w-6 flex-shrink-0 flex justify-center pt-0.5">
                  <div className="w-px h-full bg-border" />
                </div>
                <div className="flex-1 pl-2 pr-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Actions</div>
                  <div className="space-y-2">
                    {subAgent.toolCalls.map((tc, idx) => (
                      <div key={tc.id || idx} className="flex items-start">
                        {/* Nested indent line */}
                        <div className="w-4 flex-shrink-0 flex justify-center pt-0.5">
                          <div className="w-px h-full bg-border/50" />
                        </div>
                        <div className="flex-1 pl-2">
                          <div className="flex items-center gap-2 text-xs">
                            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                            <span className="text-accent font-medium">{TOOL_LABELS[tc.name] || tc.name}</span>
                          </div>
                          {!!(tc.args?.path || tc.args?.command || tc.args?.query) && (
                            <div className="text-xs text-text-muted mt-0.5 ml-5 truncate font-mono">
                              {String(tc.args?.path || tc.args?.command || tc.args?.query || '')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live progress while running - indented */}
          {subAgent.status === 'running' && subAgent.progress && (
            <div className="py-2 border-t border-border/50">
              <div className="flex items-start">
                <div className="w-6 flex-shrink-0 flex justify-center">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                </div>
                <div className="flex-1 pl-2 pr-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Output</div>
                  <div className="text-xs text-text-secondary font-mono bg-bg-deep rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {subAgent.progress}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Final result - indented */}
          {subAgent.status === 'completed' && subAgent.result && (
            <div className="py-2 border-t border-border/50">
              <div className="flex items-start">
                <div className="w-6 flex-shrink-0 flex justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                </div>
                <div className="flex-1 pl-2 pr-3">
                  <div className="text-[10px] uppercase tracking-wider text-green-500 mb-1">Result</div>
                  <div className="text-sm text-text-primary bg-bg-deep rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {subAgent.result}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error message - indented */}
          {subAgent.status === 'failed' && subAgent.error && (
            <div className="py-2 border-t border-border/50">
              <div className="flex items-start">
                <div className="w-6 flex-shrink-0 flex justify-center">
                  <XCircle className="w-3.5 h-3.5 text-error" />
                </div>
                <div className="flex-1 pl-2 pr-3">
                  <div className="text-[10px] uppercase tracking-wider text-error mb-1">Error</div>
                  <div className="text-xs text-error bg-error/10 rounded p-2">
                    {subAgent.error}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded content - indented hierarchy */}
      {expanded && (
        <div className="border-t border-border bg-bg-surface">
          {/* Parameters section - indented */}
          <div className="py-2">
            <div className="flex items-start">
              <div className="w-6 flex-shrink-0 flex justify-center pt-0.5">
                <div className="w-px h-full bg-border" />
              </div>
              <div className="flex-1 pl-2 pr-3">
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Parameters</div>
                <pre className="text-xs font-mono text-text-secondary overflow-x-auto bg-bg-deep rounded p-2">
                  {toolCall.args ? JSON.stringify(toolCall.args, null, 2) : '(no arguments)'}
                </pre>
              </div>
            </div>
          </div>

          {/* Result section - indented */}
          {formattedResult && (
            <div className="py-2 border-t border-border/50">
              <div className="flex items-start">
                <div className="w-6 flex-shrink-0 flex justify-center pt-0.5">
                  <div className="w-px h-full bg-border" />
                </div>
                <div className="flex-1 pl-2 pr-3">
                  <div className={`text-[10px] uppercase tracking-wider mb-1 ${formattedResult.isError ? 'text-error' : 'text-text-muted'}`}>
                    {formattedResult.isError ? 'Error' : 'Result'}
                  </div>
                  <pre className={`text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto rounded p-2 ${
                    formattedResult.isError ? 'text-error bg-error/10' : 'text-text-secondary bg-bg-deep'
                  }`}>
                    {formattedResult.content}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* In progress indicator - indented */}
          {isInProgress && (
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
  const [collapsed, setCollapsed] = useState(true) // Auto-collapse when complete

  // Filter out "plumbing" tools that users don't need to see
  const visibleToolCalls = toolCalls.filter(tc => !HIDDEN_TOOLS.has(tc.name))

  if (visibleToolCalls.length === 0) return null

  // Map results by toolCallId for easy lookup
  const resultsMap = new Map(toolResults.map(r => [r.toolCallId, r]))

  // Check if all tools are complete (for collapsing at end of turn)
  const allComplete = visibleToolCalls.every(tc => resultsMap.has(tc.id))

  // If streaming is done and all complete, show collapsed view
  if (!isStreaming && allComplete && visibleToolCalls.length > 0) {
    return (
      <div className="my-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span>Executed {visibleToolCalls.length} action{visibleToolCalls.length !== 1 ? 's' : ''}</span>
          <CheckCircle className="w-3 h-3 text-success" />
        </button>

        {!collapsed && (
          <div className="space-y-2 mt-2">
            {visibleToolCalls.map((toolCall, index) => (
              <SingleToolCallDisplay
                key={toolCall.id || `tool-${index}`}
                toolCall={toolCall}
                toolResult={resultsMap.get(toolCall.id)}
                isStreaming={false}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // While streaming or incomplete, show tool calls directly (no header)
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
