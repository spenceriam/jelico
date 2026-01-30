/**
 * TodoPanel - Displays AI's task progress
 *
 * Shows a collapsible panel with accent-colored border
 * displaying the AI's current task list and progress.
 */

import { useState } from 'react'
import { ChevronDown, ListTodo } from 'lucide-react'
import { useTodoStore, TodoItem, TodoStatus } from '../../stores/todos'

// Status indicator component
function StatusIcon({ status }: { status: TodoStatus }) {
  switch (status) {
    case 'pending':
      return <span className="text-[var(--text-muted)]">☐</span>
    case 'in_progress':
      return (
        <span
          className="text-[var(--accent)]"
          style={{
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          ◉
        </span>
      )
    case 'done':
      return <span className="text-[var(--success)]">☑</span>
  }
}

// Status label text
function getStatusLabel(status: TodoStatus): string {
  switch (status) {
    case 'pending':
      return '○ pending'
    case 'in_progress':
      return '⟳ in progress'
    case 'done':
      return '✓ done'
  }
}

// Individual todo item
function TodoItemRow({ item }: { item: TodoItem }) {
  const isCompleted = item.status === 'done'
  const isInProgress = item.status === 'in_progress'

  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-b-0"
    >
      <div className="text-lg leading-tight flex-shrink-0 w-5 text-center">
        <StatusIcon status={item.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm leading-relaxed ${
            isCompleted
              ? 'line-through text-[var(--text-muted)]'
              : isInProgress
              ? 'text-[var(--accent-bright)]'
              : 'text-[var(--text-primary)]'
          }`}
        >
          {item.text}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
          {getStatusLabel(item.status)}
        </div>
      </div>
    </div>
  )
}

export function TodoPanel() {
  const { todos, isVisible } = useTodoStore()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Don't render if no todos or not visible
  if (!isVisible || todos.length === 0) {
    return null
  }

  const completed = todos.filter(t => t.status === 'done').length
  const total = todos.length

  return (
    <div
      className={`
        rounded-[var(--radius-md)] overflow-hidden mb-4
        border-2 border-[var(--accent)]
        bg-[var(--bg-surface)]
      `}
      style={{
        boxShadow: '0 0 20px var(--accent-glow), inset 0 0 30px var(--accent-glow)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[var(--accent-dim)]"
        style={{
          background: 'linear-gradient(135deg, var(--accent-glow) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-2 font-semibold text-[var(--accent-bright)]">
          <ListTodo size={16} />
          <span>Task Progress</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-secondary)] font-mono">
            {completed}/{total} completed
          </span>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-transform duration-200"
            style={{
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Todo list */}
      {!isCollapsed && (
        <div className="px-4 py-2">
          {todos.map(item => (
            <TodoItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// Add the pulse animation to globals via a style tag (injected once)
if (typeof document !== 'undefined') {
  const styleId = 'todo-panel-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 0.6; transform: scale(0.95); }
        50% { opacity: 1; transform: scale(1.05); }
      }
    `
    document.head.appendChild(style)
  }
}
