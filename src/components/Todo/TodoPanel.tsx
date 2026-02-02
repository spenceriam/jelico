/**
 * TodoPanel - Claude Code style task list
 *
 * Sticky to bottom of chat view, collapsible.
 * Shows: ✓ completed, ✗ failed, strikethrough cancelled, ◉ in_progress, ○ pending
 */

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTodoStore, TodoItem, TodoStatus } from '../../stores/todos'
import { useClarificationStore } from '../../stores/clarification'

// Status indicator and styling
function getStatusDisplay(status: TodoStatus): { icon: string; className: string } {
  switch (status) {
    case 'pending':
      return { icon: '○', className: 'text-text-muted' }
    case 'in_progress':
      return { icon: '◉', className: 'text-accent animate-pulse' }
    case 'done':
      return { icon: '✓', className: 'text-success' }
    case 'failed':
      return { icon: '✗', className: 'text-error' }
    case 'cancelled':
      return { icon: '—', className: 'text-text-muted' }
  }
}

// Individual todo item row
function TodoRow({ item, compact = false }: { item: TodoItem; compact?: boolean }) {
  const { icon, className } = getStatusDisplay(item.status)
  const isCancelled = item.status === 'cancelled'
  const isDone = item.status === 'done'
  const isFailed = item.status === 'failed'
  const isInProgress = item.status === 'in_progress'

  return (
    <div className={`flex items-center gap-2 ${compact ? 'py-0.5' : 'py-1'}`}>
      <span className={`font-mono text-sm w-4 text-center flex-shrink-0 ${className}`}>
        {icon}
      </span>
      <span
        className={`text-sm flex-1 ${
          isCancelled
            ? 'line-through text-text-muted'
            : isDone
            ? 'text-text-secondary'
            : isFailed
            ? 'text-error/80'
            : isInProgress
            ? 'text-text-primary font-medium'
            : 'text-text-secondary'
        }`}
      >
        {item.text}
      </span>
    </div>
  )
}

export function TodoPanel() {
  const { todos, isVisible } = useTodoStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const activeRequest = useClarificationStore((state) => state.activeRequest)

  // Auto-collapse when clarification questions appear (focus user on answering)
  useEffect(() => {
    if (activeRequest) {
      setIsExpanded(false)
    }
  }, [activeRequest])

  // Don't render if no todos, not visible, or all tasks completed
  const allDone = todos.every(t => t.status === 'done' || t.status === 'cancelled' || t.status === 'failed')
  if (!isVisible || todos.length === 0 || allDone) {
    return null
  }

  // Find current in-progress task, or next pending task
  const inProgressTask = todos.find(t => t.status === 'in_progress')
  const nextPendingTask = todos.find(t => t.status === 'pending')
  const displayTask = inProgressTask || nextPendingTask
  const completedCount = todos.filter(t => t.status === 'done').length
  const failedCount = todos.filter(t => t.status === 'failed').length

  // Progress summary
  const progressText = failedCount > 0
    ? `${completedCount}/${todos.length} done, ${failedCount} failed`
    : `${completedCount}/${todos.length}`

  return (
    <div className="border border-border rounded-lg bg-bg-surface mb-4 overflow-hidden">
      {/* Header - always visible, clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover/50 transition-colors text-left"
      >
        <span className="text-text-muted">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        {/* Show current/next task when collapsed, or "Tasks" header when expanded */}
        {isExpanded ? (
          <span className="text-xs text-text-muted font-medium uppercase tracking-wide">
            Tasks
          </span>
        ) : displayTask ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className={inProgressTask ? 'text-accent animate-pulse' : 'text-text-muted'}>
              {inProgressTask ? '◉' : '○'}
            </span>
            <span className="text-sm text-text-primary truncate">{displayTask.text}</span>
          </div>
        ) : (
          <span className="text-xs text-text-muted">Tasks</span>
        )}

        {/* Progress counter */}
        <span className="text-xs text-text-muted font-mono ml-auto">
          {progressText}
        </span>
      </button>

      {/* Expanded task list */}
      {isExpanded && (
        <div className="px-3 pb-2 border-t border-border/50">
          {todos.map(item => (
            <TodoRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
