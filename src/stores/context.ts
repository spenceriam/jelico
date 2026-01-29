import { create } from 'zustand'

// Compaction thresholds (must match electron/services/compaction.ts)
export const COMPACTION_THRESHOLDS = {
  WARNING: 0.70,    // Show warning icon at 70%
  COMPACT: 0.75,    // Auto-compact at 75%
  CRITICAL: 0.90,   // Force compact at 90%
}

export type CompactionStatus = 'normal' | 'warning' | 'compact' | 'critical'

// Fallback context size only used when API query fails
const FALLBACK_CONTEXT_SIZE = 100000

interface ContextState {
  // Per-conversation context tracking
  conversationContexts: Record<string, {
    providerId: string
    modelId: string
    modelContextSize: number
    currentTokenCount: number
    lastCompactionAt: number | null
    compactionSummary: string | null
  }>

  // Compaction settings
  compactionThreshold: number // Default 0.75 (75%)
  warningThreshold: number   // Default 0.70 (70%)
  autoCompact: boolean

  // Compaction state
  isCompacting: boolean

  // Actions
  initConversationContext: (
    conversationId: string,
    providerId: string,
    modelId: string
  ) => Promise<void>
  updateTokenCount: (
    conversationId: string,
    tokenCount: number
  ) => void
  getContextUsage: (conversationId: string) => {
    percentage: number
    tokenCount: number
    maxTokens: number
    status: CompactionStatus
    shouldCompact: boolean
    shouldWarn: boolean
  }
  setCompactionSummary: (conversationId: string, summary: string, newTokenCount: number) => void
  clearConversationContext: (conversationId: string) => void
  setAutoCompact: (enabled: boolean) => void
  setCompactionThreshold: (threshold: number) => void
  setIsCompacting: (isCompacting: boolean) => void
}

export const useContextStore = create<ContextState>((set, get) => ({
  conversationContexts: {},
  compactionThreshold: COMPACTION_THRESHOLDS.COMPACT,
  warningThreshold: COMPACTION_THRESHOLDS.WARNING,
  autoCompact: true,
  isCompacting: false,

  initConversationContext: async (conversationId, providerId, modelId) => {
    // Fetch context size from the provider's API
    let modelContextSize = FALLBACK_CONTEXT_SIZE

    try {
      const size = await window.jelico.providers.getModelContextSize(providerId, modelId)
      if (size) {
        modelContextSize = size
        console.log(`[Context] Fetched context size for ${modelId}: ${size}`)
      } else {
        console.warn(`[Context] Could not fetch context size for ${modelId}, using fallback: ${FALLBACK_CONTEXT_SIZE}`)
      }
    } catch (err) {
      console.error('[Context] Error fetching context size:', err)
    }

    set((state) => ({
      conversationContexts: {
        ...state.conversationContexts,
        [conversationId]: {
          providerId,
          modelId,
          modelContextSize,
          currentTokenCount: 0,
          lastCompactionAt: null,
          compactionSummary: null,
        },
      },
    }))
  },

  updateTokenCount: (conversationId, tokenCount) => {
    set((state) => {
      const existing = state.conversationContexts[conversationId]
      if (!existing) return state

      return {
        conversationContexts: {
          ...state.conversationContexts,
          [conversationId]: {
            ...existing,
            currentTokenCount: tokenCount,
          },
        },
      }
    })
  },

  getContextUsage: (conversationId) => {
    const context = get().conversationContexts[conversationId]
    if (!context) {
      return {
        percentage: 0,
        tokenCount: 0,
        maxTokens: FALLBACK_CONTEXT_SIZE,
        status: 'normal' as CompactionStatus,
        shouldCompact: false,
        shouldWarn: false,
      }
    }

    const percentage = context.modelContextSize > 0
      ? context.currentTokenCount / context.modelContextSize
      : 0

    // Determine status
    let status: CompactionStatus = 'normal'
    if (percentage >= COMPACTION_THRESHOLDS.CRITICAL) {
      status = 'critical'
    } else if (percentage >= COMPACTION_THRESHOLDS.COMPACT) {
      status = 'compact'
    } else if (percentage >= COMPACTION_THRESHOLDS.WARNING) {
      status = 'warning'
    }

    return {
      percentage,
      tokenCount: context.currentTokenCount,
      maxTokens: context.modelContextSize,
      status,
      shouldCompact: percentage >= get().compactionThreshold,
      shouldWarn: percentage >= get().warningThreshold,
    }
  },

  setCompactionSummary: (conversationId, summary, newTokenCount) => {
    set((state) => {
      const existing = state.conversationContexts[conversationId]
      if (!existing) return state

      return {
        conversationContexts: {
          ...state.conversationContexts,
          [conversationId]: {
            ...existing,
            lastCompactionAt: Date.now(),
            compactionSummary: summary,
            currentTokenCount: newTokenCount,
          },
        },
      }
    })
  },

  clearConversationContext: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.conversationContexts
      return { conversationContexts: rest }
    })
  },

  setAutoCompact: (enabled) => set({ autoCompact: enabled }),

  setCompactionThreshold: (threshold) => set({ compactionThreshold: threshold }),

  setIsCompacting: (isCompacting) => set({ isCompacting }),
}))

// Utility function to estimate tokens (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
