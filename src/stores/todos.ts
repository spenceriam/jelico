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

export type TodoStatus = 'pending' | 'in_progress' | 'done'

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
  isVisible: boolean
  conversationId: string | null

  // Actions
  setTodos: (todos: Omit<TodoItem, 'createdAt' | 'updatedAt'>[]) => void
  updateTodo: (id: string, updates: Partial<Pick<TodoItem, 'text' | 'status'>>) => void
  getTodo: (id: string) => TodoItem | undefined
  clearTodos: () => void
  setConversationId: (id: string | null) => void
  setVisible: (visible: boolean) => void

  // Computed
  getProgress: () => { completed: number; total: number }
  getCurrentTask: () => TodoItem | undefined
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  isVisible: false,
  conversationId: null,

  setTodos: (todos) => {
    const now = Date.now()
    const existingTodos = get().todos

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

    set({
      todos: updatedTodos,
      isVisible: updatedTodos.length > 0,
    })
  },

  updateTodo: (id, updates) => {
    const now = Date.now()
    set(state => ({
      todos: state.todos.map(todo =>
        todo.id === id
          ? { ...todo, ...updates, updatedAt: now }
          : todo
      ),
    }))
  },

  getTodo: (id) => {
    return get().todos.find(t => t.id === id)
  },

  clearTodos: () => {
    set({ todos: [], isVisible: false })
  },

  setConversationId: (id) => {
    // Clear todos when conversation changes
    if (id !== get().conversationId) {
      set({ conversationId: id, todos: [], isVisible: false })
    }
  },

  setVisible: (visible) => {
    set({ isVisible: visible })
  },

  getProgress: () => {
    const todos = get().todos
    const completed = todos.filter(t => t.status === 'done').length
    return { completed, total: todos.length }
  },

  getCurrentTask: () => {
    return get().todos.find(t => t.status === 'in_progress')
  },
}))
