import { create } from 'zustand'

export type PatternCategory =
  | 'coding_style'
  | 'communication'
  | 'mistake'
  | 'preference'
  | 'workflow'
  | 'personality'

export interface Pattern {
  id: string
  category: PatternCategory
  pattern: string
  evidence: string[]
  confidence: number
  frequency: number
  lastObserved: number
  decay: number
  source: 'explicit' | 'inferred'
}

export interface Correction {
  id: string
  original: string
  corrected: string
  context: string
  category: string
  timestamp: number
}

export interface Preference {
  key: string
  value: unknown
  confidence: number
}

interface SoulStore {
  patterns: Pattern[]
  corrections: Correction[]
  preferences: Preference[]
  soulContext: string
  isLoading: boolean

  // Actions
  loadSoul: () => Promise<void>
  loadContext: () => Promise<string>
  addPattern: (pattern: Omit<Pattern, 'id'>) => Promise<Pattern>
  updatePattern: (id: string, updates: Partial<Pattern>) => Promise<void>
  removePattern: (id: string) => Promise<void>
  addCorrection: (correction: Omit<Correction, 'id' | 'timestamp'>) => Promise<Correction>
  setPreference: (key: string, value: unknown, confidence?: number) => Promise<void>
  analyzeConversation: (messages: Array<{ role: string; content: string }>, metadata?: {
    wasSuccessful?: boolean
    userFeedback?: string
  }) => Promise<{ newPatterns: Pattern[]; updates: string[] }>
  decayConfidence: () => Promise<void>

  // Helpers
  getHighConfidencePatterns: () => Pattern[]
  getPatternsByCategory: (category: PatternCategory) => Pattern[]
}

export const useSoulStore = create<SoulStore>((set, get) => ({
  patterns: [],
  corrections: [],
  preferences: [],
  soulContext: '',
  isLoading: false,

  loadSoul: async () => {
    set({ isLoading: true })
    try {
      const soul = await window.jelico.soul.get()
      const preferences = Object.entries(soul.preferences).map(([key, pref]) => ({
        key,
        value: pref.value,
        confidence: pref.confidence,
      }))

      set({
        patterns: soul.patterns,
        corrections: soul.corrections,
        preferences,
        isLoading: false,
      })

      // Also load the formatted context
      const context = await window.jelico.soul.getContext()
      set({ soulContext: context })
    } catch (error) {
      console.error('Failed to load soul:', error)
      set({ isLoading: false })
    }
  },

  loadContext: async () => {
    try {
      const context = await window.jelico.soul.getContext()
      set({ soulContext: context })
      return context
    } catch (error) {
      console.error('Failed to load soul context:', error)
      return ''
    }
  },

  addPattern: async (pattern) => {
    try {
      const newPattern = await window.jelico.soul.addPattern(pattern)
      set((state) => ({
        patterns: [...state.patterns.filter(p => p.id !== newPattern.id), newPattern],
      }))

      // Refresh context
      get().loadContext()

      return newPattern
    } catch (error) {
      console.error('Failed to add pattern:', error)
      throw error
    }
  },

  updatePattern: async (id, updates) => {
    try {
      const updated = await window.jelico.soul.updatePattern(id, updates)
      if (updated) {
        set((state) => ({
          patterns: state.patterns.map(p => p.id === id ? updated : p),
        }))
        get().loadContext()
      }
    } catch (error) {
      console.error('Failed to update pattern:', error)
      throw error
    }
  },

  removePattern: async (id) => {
    try {
      await window.jelico.soul.removePattern(id)
      set((state) => ({
        patterns: state.patterns.filter(p => p.id !== id),
      }))
      get().loadContext()
    } catch (error) {
      console.error('Failed to remove pattern:', error)
      throw error
    }
  },

  addCorrection: async (correction) => {
    try {
      const newCorrection = await window.jelico.soul.addCorrection(correction)
      set((state) => ({
        corrections: [newCorrection, ...state.corrections].slice(0, 100),
      }))
      get().loadContext()
      return newCorrection
    } catch (error) {
      console.error('Failed to add correction:', error)
      throw error
    }
  },

  setPreference: async (key, value, confidence = 0.8) => {
    try {
      await window.jelico.soul.setPreference(key, value, confidence)
      set((state) => {
        const existing = state.preferences.findIndex(p => p.key === key)
        const newPref = { key, value, confidence }
        if (existing >= 0) {
          const newPrefs = [...state.preferences]
          newPrefs[existing] = newPref
          return { preferences: newPrefs }
        }
        return { preferences: [...state.preferences, newPref] }
      })
      get().loadContext()
    } catch (error) {
      console.error('Failed to set preference:', error)
      throw error
    }
  },

  analyzeConversation: async (messages, metadata) => {
    try {
      const result = await window.jelico.soul.analyzeConversation(messages, metadata)

      // Reload soul to get updated state
      await get().loadSoul()

      return result
    } catch (error) {
      console.error('Failed to analyze conversation:', error)
      return { newPatterns: [], updates: [] }
    }
  },

  decayConfidence: async () => {
    try {
      await window.jelico.soul.decayConfidence()
      await get().loadSoul()
    } catch (error) {
      console.error('Failed to decay confidence:', error)
    }
  },

  // Helpers
  getHighConfidencePatterns: () => {
    return get().patterns.filter(p => p.confidence >= 0.6)
  },

  getPatternsByCategory: (category) => {
    return get().patterns.filter(p => p.category === category)
  },
}))
