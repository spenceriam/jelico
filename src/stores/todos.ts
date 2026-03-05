/**
 * Todo Store - Manages AI task tracking
 *
 * The AI uses this to show its work plan and progress.
 * Three tools interact with this store:
 * - todo_write: Create/update task list
 * - todo_read: Get current task state
 * - todo_check: Validate working on right task
 * 
 * Issue #48 Fix: Moved from localStorage to database for proper sync
 */

import { create } from 'zustand'

export type TodoStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'cancelled' | 'blocked'

export interface TodoHistoryEntry {
  status: TodoStatus
  at: number
  actor?: string
  note?: string
}

export interface TodoItem {
  id: string
  text: string
  status: TodoStatus
  owner?: string | null
  dependencies?: string[]
  blockedReason?: string | null
  history?: TodoHistoryEntry[]
  createdAt: number
  updatedAt: number
}

interface TodoState {
  // State
  todos: TodoItem[]
  isVisible: boolean
  conversationId: string | null
  isLoading: boolean

  // Actions
  setTodos: (conversationId: string, todos: Omit<TodoItem, 'createdAt' | 'updatedAt'>[]) => Promise<void>
  updateTodo: (
    id: string,
    updates: Partial<Pick<TodoItem, 'text' | 'status' | 'owner' | 'dependencies' | 'blockedReason' | 'history'>>,
    conversationId?: string
  ) => Promise<void>
  getTodo: (id: string) => TodoItem | undefined
  clearTodos: (conversationId?: string) => Promise<void>
  setConversationId: (id: string | null) => Promise<void>
  setVisible: (visible: boolean) => void
  deleteConversationTodos: (conversationId: string) => Promise<void>
  hydrateConversationFromMessages: (
    conversationId: string,
    messages: Array<{
      toolCalls?: Array<{
        name?: string
        args?: Record<string, unknown>
      }>
    }>
  ) => Promise<void>
  loadTodos: (conversationId: string) => Promise<void>

  // Computed
  getProgress: () => { completed: number; failed: number; cancelled: number; total: number }
  getCurrentTask: () => TodoItem | undefined
  getActiveTasks: () => TodoItem[]
}

// Helper to convert database row to store format
function rowToTodo(row: any): TodoItem {
  return {
    id: row.id,
    text: row.text,
    status: row.status,
    owner: row.owner ?? null,
    dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
    blockedReason: row.blocked_reason ?? null,
    history: Array.isArray(row.history) ? row.history : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  isVisible: false,
  conversationId: null,
  isLoading: false,

  loadTodos: async (conversationId: string) => {
    if (!conversationId) return
    
    set({ isLoading: true })
    try {
      const rows = await window.jelico.todos.getByConversation(conversationId)
      const todos = rows.map(rowToTodo)
      set({
        todos,
        isVisible: todos.length > 0,
        isLoading: false,
      })
    } catch (error) {
      console.error('[TodoStore] Failed to load todos:', error)
      set({ isLoading: false })
    }
  },

  setTodos: async (conversationId, todos) => {
    if (!conversationId) return

    const now = Date.now()
    const currentTodos = get().todos

    // Preserve timestamps for existing todos, add new ones
    const updatedTodos = todos.map(todo => {
      const existing = currentTodos.find(t => t.id === todo.id)
      if (existing) {
        // Update existing: keep createdAt, update updatedAt if changed
        const hasChanged =
          existing.text !== todo.text ||
          existing.status !== todo.status ||
          (existing.owner || null) !== (todo.owner || null) ||
          JSON.stringify(existing.dependencies || []) !== JSON.stringify(todo.dependencies || []) ||
          (existing.blockedReason || null) !== (todo.blockedReason || null) ||
          JSON.stringify(existing.history || []) !== JSON.stringify(todo.history || [])
        return {
          ...todo,
          createdAt: existing.createdAt,
          updatedAt: hasChanged ? now : existing.updatedAt,
        }
      }
      // New todo
      return {
        ...todo,
        createdAt: now,
        updatedAt: now,
      }
    })

    // Update local state
    set({
      todos: updatedTodos,
      isVisible: updatedTodos.length > 0,
    })

    // Persist to database
    try {
      await window.jelico.todos.replaceAll(
        conversationId,
        updatedTodos.map(t => ({
          id: t.id,
          text: t.text,
          status: t.status,
          owner: t.owner || undefined,
          dependencies: t.dependencies || [],
          blocked_reason: t.blockedReason || null,
          history: t.history || [],
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        }))
      )
    } catch (error) {
      console.error('[TodoStore] Failed to save todos:', error)
    }
  },

  updateTodo: async (id, updates, conversationId) => {
    const targetConversationId = conversationId ?? get().conversationId
    if (!targetConversationId) return

    const now = Date.now()
    const currentTodos = get().todos
    const updatedTodos = currentTodos.map(todo =>
      todo.id === id
        ? { ...todo, ...updates, updatedAt: now }
        : todo
    )

    // Update local state
    set({ todos: updatedTodos })

    // Persist to database
    try {
      await window.jelico.todos.update(targetConversationId, id, {
        text: updates.text,
        status: updates.status,
        owner: updates.owner,
        dependencies: updates.dependencies,
        blocked_reason: updates.blockedReason,
        history: updates.history,
      })
    } catch (error) {
      console.error('[TodoStore] Failed to update todo:', error)
    }
  },

  getTodo: (id) => {
    return get().todos.find(t => t.id === id)
  },

  clearTodos: async (conversationId) => {
    const targetConversationId = conversationId ?? get().conversationId
    
    // Update local state
    set({ todos: [], isVisible: false })

    // Persist to database
    if (targetConversationId) {
      try {
        await window.jelico.todos.deleteByConversation(targetConversationId)
      } catch (error) {
        console.error('[TodoStore] Failed to clear todos:', error)
      }
    }
  },

  setConversationId: async (id) => {
    if (id === get().conversationId) return

    // Load todos for the new conversation
    if (id) {
      await get().loadTodos(id)
    } else {
      set({ todos: [], isVisible: false })
    }

    set({ conversationId: id })
  },

  setVisible: (visible) => {
    set({ isVisible: visible })
  },

  deleteConversationTodos: async (conversationId) => {
    // Update local state if this is the current conversation
    if (conversationId === get().conversationId) {
      set({ todos: [], isVisible: false })
    }

    // Persist to database
    try {
      await window.jelico.todos.deleteByConversation(conversationId)
    } catch (error) {
      console.error('[TodoStore] Failed to delete conversation todos:', error)
    }
  },

  hydrateConversationFromMessages: async (conversationId, messages) => {
    if (!conversationId) return

    // Check if we already have todos for this conversation
    const existing = get().todos
    if (existing && existing.length > 0) {
      return
    }

    // Also check database
    try {
      const dbTodos = await window.jelico.todos.getByConversation(conversationId)
      if (dbTodos.length > 0) {
        set({
          todos: dbTodos.map(rowToTodo),
          isVisible: true,
        })
        return
      }
    } catch (error) {
      console.error('[TodoStore] Failed to check existing todos:', error)
    }

    const validStatuses = new Set<TodoStatus>(['pending', 'in_progress', 'done', 'failed', 'cancelled', 'blocked'])
    let recoveredTasks: Array<{
      id: string
      text: string
      status: TodoStatus
      owner: string | null
      dependencies: string[]
      blockedReason: string | null
      history: TodoHistoryEntry[]
    }> | null = null

    for (const message of messages) {
      const toolCalls = message.toolCalls || []
      for (const toolCall of toolCalls) {
        if (toolCall?.name !== 'todo_write') continue
        const args = toolCall.args || {}
        const rawTasks = args.tasks
        if (!Array.isArray(rawTasks)) continue

        const normalizedTasks = rawTasks
          .map((task, index) => {
            if (!task || typeof task !== 'object') return null
            const taskRecord = task as Record<string, unknown>
            const id = typeof taskRecord.id === 'string' && taskRecord.id.trim().length > 0
              ? taskRecord.id
              : String(index + 1)
            const text = typeof taskRecord.text === 'string' ? taskRecord.text : ''
            const rawStatus = typeof taskRecord.status === 'string' ? taskRecord.status : 'pending'
            const status = validStatuses.has(rawStatus as TodoStatus)
              ? (rawStatus as TodoStatus)
              : 'pending'
            const dependencies = Array.isArray(taskRecord.dependencies)
              ? taskRecord.dependencies.map((dep) => String(dep))
              : []

            return {
              id,
              text,
              status,
              owner: typeof taskRecord.owner === 'string' ? taskRecord.owner : null,
              dependencies,
              blockedReason: typeof taskRecord.blockedReason === 'string'
                ? taskRecord.blockedReason
                : (typeof taskRecord.blocked_reason === 'string' ? taskRecord.blocked_reason : null),
              history: Array.isArray(taskRecord.history) ? taskRecord.history as TodoHistoryEntry[] : [],
            }
          })
          .filter((task): task is {
            id: string
            text: string
            status: TodoStatus
            owner: string | null
            dependencies: string[]
            blockedReason: string | null
            history: TodoHistoryEntry[]
          } => task !== null)

        if (normalizedTasks.length > 0) {
          recoveredTasks = normalizedTasks
        }
      }
    }

    if (!recoveredTasks || recoveredTasks.length === 0) {
      return
    }

    await get().setTodos(conversationId, recoveredTasks)
  },

  getProgress: () => {
    const todos = get().todos
    const completed = todos.filter(t => t.status === 'done').length
    const failed = todos.filter(t => t.status === 'failed').length
    const cancelled = todos.filter(t => t.status === 'cancelled').length
    return { completed, failed, cancelled, total: todos.length }
  },

  getCurrentTask: () => {
    return get().todos.find(t => t.status === 'in_progress')
  },

  getActiveTasks: () => {
    // Tasks that are still actionable (not done, failed, or cancelled)
    return get().todos.filter(
      t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked'
    )
  },
}))
