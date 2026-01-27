import { create } from 'zustand'

export type MemoryScope = 'global' | 'workspace' | 'conversation'
export type MemoryCategory = 'preference' | 'fact' | 'style' | 'correction' | 'workflow' | 'custom'
export type MemorySource = 'explicit' | 'inferred'
export type MemoryPrivacy = 'private' | 'shared'

export interface Memory {
  id: string
  scope: MemoryScope
  scopeId: string | null
  category: MemoryCategory
  key: string
  value: unknown // Parsed from JSON
  confidence: number
  source: MemorySource
  privacy: MemoryPrivacy
  createdAt: number
  updatedAt: number
}

// Convert database row to store format
function rowToMemory(row: MemoryRecord): Memory {
  return {
    id: row.id,
    scope: row.scope,
    scopeId: row.scope_id,
    category: row.category,
    key: row.key,
    value: JSON.parse(row.value),
    confidence: row.confidence,
    source: row.source,
    privacy: row.privacy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

interface MemoryStore {
  memories: Memory[]
  isLoading: boolean

  // Actions
  loadMemories: (scope?: MemoryScope, scopeId?: string) => Promise<void>
  loadForContext: (workspaceId?: string, conversationId?: string) => Promise<Memory[]>
  createMemory: (memory: {
    scope: MemoryScope
    scopeId?: string
    category: MemoryCategory
    key: string
    value: unknown
    confidence?: number
    source?: MemorySource
    privacy?: MemoryPrivacy
  }) => Promise<Memory>
  updateMemory: (id: string, updates: Partial<{
    value: unknown
    confidence: number
    category: MemoryCategory
  }>) => Promise<Memory | null>
  deleteMemory: (id: string) => Promise<void>
  clearScope: (scope: MemoryScope, scopeId?: string) => Promise<void>

  // Helper functions
  getByKey: (key: string) => Memory | undefined
  getByCategory: (category: MemoryCategory) => Memory[]
  getHighConfidence: (threshold?: number) => Memory[]
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  isLoading: false,

  loadMemories: async (scope, scopeId) => {
    set({ isLoading: true })
    try {
      const rows = await window.jelico.memory.list(scope, scopeId)
      set({ memories: rows.map(rowToMemory), isLoading: false })
    } catch (error) {
      console.error('Failed to load memories:', error)
      set({ isLoading: false })
    }
  },

  loadForContext: async (workspaceId, conversationId) => {
    try {
      const rows = await window.jelico.memory.getForContext(workspaceId, conversationId)
      const memories = rows.map(rowToMemory)
      set({ memories })
      return memories
    } catch (error) {
      console.error('Failed to load context memories:', error)
      return []
    }
  },

  createMemory: async (memory) => {
    try {
      const row = await window.jelico.memory.create(memory)
      const newMemory = rowToMemory(row)
      set((state) => ({
        memories: [...state.memories.filter(m => m.id !== newMemory.id), newMemory],
      }))
      return newMemory
    } catch (error) {
      console.error('Failed to create memory:', error)
      throw error
    }
  },

  updateMemory: async (id, updates) => {
    try {
      const row = await window.jelico.memory.update(id, updates)
      if (row) {
        const updatedMemory = rowToMemory(row)
        set((state) => ({
          memories: state.memories.map(m => m.id === id ? updatedMemory : m),
        }))
        return updatedMemory
      }
      return null
    } catch (error) {
      console.error('Failed to update memory:', error)
      throw error
    }
  },

  deleteMemory: async (id) => {
    try {
      await window.jelico.memory.delete(id)
      set((state) => ({
        memories: state.memories.filter(m => m.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete memory:', error)
      throw error
    }
  },

  clearScope: async (scope, scopeId) => {
    try {
      await window.jelico.memory.deleteByScope(scope, scopeId)
      set((state) => ({
        memories: state.memories.filter(m => {
          if (m.scope !== scope) return true
          if (scopeId && m.scopeId !== scopeId) return true
          return false
        }),
      }))
    } catch (error) {
      console.error('Failed to clear scope:', error)
      throw error
    }
  },

  // Helper functions
  getByKey: (key) => {
    return get().memories.find(m => m.key === key)
  },

  getByCategory: (category) => {
    return get().memories.filter(m => m.category === category)
  },

  getHighConfidence: (threshold = 0.7) => {
    return get().memories.filter(m => m.confidence >= threshold)
  },
}))

// Helper to format memories for AI context injection
export function formatMemoriesForContext(memories: Memory[]): string {
  if (memories.length === 0) return ''

  const grouped: Record<string, Memory[]> = {}
  for (const memory of memories) {
    const category = memory.category
    if (!grouped[category]) grouped[category] = []
    grouped[category].push(memory)
  }

  const lines: string[] = ['<user_context>']

  for (const [category, items] of Object.entries(grouped)) {
    lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}s`)
    for (const item of items) {
      const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value)
      lines.push(`- ${item.key}: ${value}`)
    }
    lines.push('')
  }

  lines.push('</user_context>')
  return lines.join('\n')
}
