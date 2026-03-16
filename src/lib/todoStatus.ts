export type TodoStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'cancelled' | 'blocked'

const TODO_STATUS_ALIAS: Record<string, TodoStatus> = {
  done: 'done',
  complete: 'done',
  completed: 'done',
  finished: 'done',
  pending: 'pending',
  todo: 'pending',
  notstarted: 'pending',
  inprogress: 'in_progress',
  working: 'in_progress',
  running: 'in_progress',
  started: 'in_progress',
  failed: 'failed',
  failure: 'failed',
  errored: 'failed',
  blocked: 'blocked',
  waiting: 'blocked',
  blockedbydependency: 'blocked',
  blockedondependency: 'blocked',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  aborted: 'cancelled',
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/**
 * Normalize incoming todo-status strings and fall back to `pending` when unknown.
 */
export function normalizeTodoStatus(value?: string): TodoStatus {
  if (!value) return 'pending'
  const key = normalizeKey(value)
  return TODO_STATUS_ALIAS[key] ?? 'pending'
}

export interface TodoHistoryEntry {
  status: TodoStatus
  at: number
  actor?: string
  note?: string
}

export function normalizeHistoryEntries(history?: TodoHistoryEntry[]): TodoHistoryEntry[] {
  if (!history || history.length === 0) return []
  return history.map((entry) => ({
    ...entry,
    status: normalizeTodoStatus(entry?.status),
  }))
}
