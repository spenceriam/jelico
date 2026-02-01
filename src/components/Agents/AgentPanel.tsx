import { Bot, X, Pause, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAgentStore, type SubAgent, type AgentStatus } from '../../stores/agents'

const STATUS_ICONS: Record<AgentStatus, React.ComponentType<{ className?: string }>> = {
  pending: Pause,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: X,
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  pending: 'text-text-muted',
  running: 'text-accent',
  completed: 'text-green-500',
  failed: 'text-error',
  cancelled: 'text-text-muted',
}

export function AgentPanel() {
  const { agents, activeAgentId, setActiveAgent, cancelAgent, removeAgent, clearCompletedAgents } =
    useAgentStore()

  if (agents.length === 0) return null

  const runningCount = agents.filter((a) => a.status === 'running').length
  const completedCount = agents.filter(
    (a) => a.status === 'completed' || a.status === 'failed' || a.status === 'cancelled'
  ).length

  return (
    <div className="border-t border-border bg-bg-surface">
      {/* Orchestrator Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3 text-sm">
          {/* Orchestrator (main AI) */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="font-medium text-text-primary">Jelico</span>
            {runningCount > 0 && (
              <span className="text-xs text-accent">
                Orchestrating...
              </span>
            )}
          </div>
          {/* Sub-agent count */}
          <div className="flex items-center gap-1 text-text-muted">
            <Bot className="w-3 h-3" />
            <span className="text-xs">{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
            {runningCount > 0 && (
              <span className="text-xs text-accent">({runningCount} active)</span>
            )}
          </div>
        </div>
        {completedCount > 0 && (
          <button
            onClick={clearCompletedAgents}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Clear completed
          </button>
        )}
      </div>

      {/* Agent list */}
      <div className="max-h-48 overflow-y-auto">
        {agents.map((agent) => (
          <AgentItem
            key={agent.id}
            agent={agent}
            isActive={agent.id === activeAgentId}
            onClick={() => setActiveAgent(agent.id === activeAgentId ? null : agent.id)}
            onCancel={() => cancelAgent(agent.id)}
            onRemove={() => removeAgent(agent.id)}
          />
        ))}
      </div>
    </div>
  )
}

function AgentItem({
  agent,
  isActive,
  onClick,
  onCancel,
  onRemove,
}: {
  agent: SubAgent
  isActive: boolean
  onClick: () => void
  onCancel: () => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const StatusIcon = STATUS_ICONS[agent.status]
  const statusColor = STATUS_COLORS[agent.status]

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <div
      className={`border-b border-border last:border-b-0 ${isActive ? 'bg-bg-elevated' : ''}`}
    >
      <button
        onClick={onClick}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-bg-hover transition-colors text-left"
      >
        {/* Expand toggle */}
        <button
          onClick={handleExpand}
          className="p-0.5 text-text-muted hover:text-text-primary"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        {/* Status icon */}
        <StatusIcon
          className={`w-4 h-4 flex-shrink-0 ${statusColor} ${
            agent.status === 'running' ? 'animate-spin' : ''
          }`}
        />

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{agent.name}</div>
          <div className="text-xs truncate">
            {agent.status === 'running' ? (
              <span className="text-text-secondary">
                {agent.progress?.slice(-50) || 'Working...'}
              </span>
            ) : (
              <span className="text-text-muted">{agent.task.slice(0, 50)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {agent.status === 'running' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel()
              }}
              className="p-1 text-text-muted hover:text-error rounded"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {agent.status !== 'running' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="p-1 text-text-muted hover:text-error rounded"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-bg-deep">
          <div className="text-xs text-text-muted mb-2">Task:</div>
          <div className="text-xs text-text-secondary mb-3 whitespace-pre-wrap">
            {agent.task}
          </div>

          {agent.toolCalls.length > 0 && (
            <>
              <div className="text-xs text-text-muted mb-2">
                Tool calls ({agent.toolCalls.length}):
              </div>
              <div className="space-y-1">
                {agent.toolCalls.slice(-5).map((tc) => (
                  <div
                    key={tc.id}
                    className="text-xs font-mono text-text-secondary flex items-center gap-2"
                  >
                    <span className="text-accent">{tc.name}</span>
                    {tc.result !== undefined && (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                ))}
                {agent.toolCalls.length > 5 && (
                  <div className="text-xs text-text-faint">
                    ...and {agent.toolCalls.length - 5} more
                  </div>
                )}
              </div>
            </>
          )}

          {agent.result && (
            <>
              <div className="text-xs text-text-muted mt-3 mb-2">Result:</div>
              <div className="text-xs text-text-secondary max-h-24 overflow-y-auto whitespace-pre-wrap">
                {agent.result.slice(-500)}
              </div>
            </>
          )}

          {agent.error && (
            <>
              <div className="text-xs text-error mt-3 mb-2">Error:</div>
              <div className="text-xs text-error">{agent.error}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
