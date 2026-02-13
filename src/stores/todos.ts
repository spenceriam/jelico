/**
 * Todo Store - Manages AI task tracking
 *
 * The AI uses this to show its work plan and progress.
 * Three tools interact with this store:
 * - todo_write: Create/update task list
 * - todo_read: Get current task state
 * - todo_check: Validate working on right task
 */

import { create } from 'zustand'

export type TodoStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'cancelled'

export interface TodoItem {
  id: string
  text: string
  status: TodoStatus
  createdAt: number
  updatedAt: number
}

interface TodoState {
  // State
  todos: TodoItem[]
  todosByConversation: Record<string, TodoItem[]>
  isVisible: boolean
  conversationId: string | null

  // Actions
  setTodos: (conversationId: string, todos: Omit<TodoItem, 'createdAt' | 'updatedAt'>[]) => void
  updateTodo: (
    id: string,
    updates: Partial<Pick<TodoItem, 'text' | 'status'>>,
    conversationId?: string
  ) => void
  getTodo: (id: string) => TodoItem | undefined
  clearTodos: (conversationId?: string) => void
  setConversationId: (id: string | null) => void
  setVisible: (visible: boolean) => void
  deleteConversationTodos: (conversationId: string) => void

  // Computed
  getProgress: () => { completed: number; failed: number; cancelled: number; total: number }
  getCurrentTask: () => TodoItem | undefined
  getActiveTasks: () => TodoItem[]
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  todosByConversation: {},
  isVisible: false,
  conversationId: null,

  setTodos: (conversationId, todos) => {
    if (!conversationId) return

    const now = Date.now()
    const existingTodos = get().todosByConversation[conversationId] || []

    // Preserve timestamps for existing todos, add new ones
    const updatedTodos = todos.map(todo => {
      const existing = existingTodos.find(t => t.id === todo.id)
      if (existing) {
        // Update existing: keep createdAt, update updatedAt if changed
        const hasChanged = existing.text !== todo.text || existing.status !== todo.status
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

    set((state) => {
      const nextTodosByConversation = {
        ...state.todosByConversation,
        [conversationId]: updatedTodos,
      }

      if (state.conversationId !== conversationId) {
        return {
          todosByConversation: nextTodosByConversation,
        }
      }

      return {
        todosByConversation: nextTodosByConversation,
        todos: updatedTodos,
        isVisible: updatedTodos.length > 0,
      }
    })
  },

  updateTodo: (id, updates, conversationId) => {
    const targetConversationId = conversationId ?? get().conversationId
    if (!targetConversationId) return

    const now = Date.now()
    set((state) => {
      const currentTodos = state.todosByConversation[targetConversationId] || []
      const updatedTodos = currentTodos.map(todo =>
        todo.id === id
          ? { ...todo, ...updates, updatedAt: now }
          : todo
      )

      const nextTodosByConversation = {
        ...state.todosByConversation,
        [targetConversationId]: updatedTodos,
      }

      if (state.conversationId !== targetConversationId) {
        return {
          todosByConversation: nextTodosByConversation,
        }
      }

      return {
        todosByConversation: nextTodosByConversation,
        todos: updatedTodos,
      }
    })
  },

  getTodo: (id) => {
    return get().todos.find(t => t.id === id)
  },

  clearTodos: (conversationId) => {
    const targetConversationId = conversationId ?? get().conversationId
    if (!targetConversationId) {
      set({ todos: [], isVisible: false })
      return
    }

    set((state) => {
      const nextTodosByConversation = { ...state.todosByConversation }
      delete nextTodosByConversation[targetConversationId]

      if (state.conversationId !== targetConversationId) {
        return {
          todosByConversation: nextTodosByConversation,
        }
      }

      return {
        todosByConversation: nextTodosByConversation,
        todos: [],
        isVisible: false,
      }
    })
  },

  setConversationId: (id) => {
    if (id === get().conversationId) return

    const nextTodos = id ? (get().todosByConversation[id] || []) : []
    set({
      conversationId: id,
      todos: nextTodos,
      isVisible: nextTodos.length > 0,
    })
  },

  setVisible: (visible) => {
    set({ isVisible: visible })
  },

  deleteConversationTodos: (conversationId) => {
    set((state) => {
      if (!state.todosByConversation[conversationId]) return {}

      const nextTodosByConversation = { ...state.todosByConversation }
      delete nextTodosByConversation[conversationId]

      if (state.conversationId !== conversationId) {
        return { todosByConversation: nextTodosByConversation }
      }

      return {
        todosByConversation: nextTodosByConversation,
        todos: [],
        isVisible: false,
      }
    })
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
    return get().todos.filter(t => t.status === 'pending' || t.status === 'in_progress')
  },
}))
