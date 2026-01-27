import { create } from 'zustand'

// Default context window sizes for common models
const MODEL_CONTEXT_SIZES: Record<string, number> = {
  // Anthropic
  'claude-sonnet-4-20250514': 200000,
  'claude-opus-4-20250514': 200000,
  'claude-3-5-haiku-20241022': 200000,
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,
  // Google
  'gemini-1.5-pro': 2000000,
  'gemini-1.5-flash': 1000000,
  // Default
  default: 100000,
}

interface ContextState {
  // Per-conversation context tracking
  conversationContexts: Record<string, {
    modelContextSize: number
    currentTokenCount: number
    lastCompactionAt: number | null
    compactionSummary: string | null
  }>

  // Compaction settings
  compactionThreshold: number // Default 0.75 (75%)
  autoCompact: boolean

  // Actions
  setConversationContext: (
    conversationId: string,
    tokenCount: number,
    modelId?: string
  ) => void
  getContextUsage: (conversationId: string) => {
    percentage: number
    tokenCount: number
    maxTokens: number
    shouldCompact: boolean
  }
  setCompactionSummary: (conversationId: string, summary: string) => void
  clearConversationContext: (conversationId: string) => void
  getModelContextSize: (modelId: string) => number
  setAutoCompact: (enabled: boolean) => void
  setCompactionThreshold: (threshold: number) => void
}

export const useContextStore = create<ContextState>((set, get) => ({
  conversationContexts: {},
  compactionThreshold: 0.75,
  autoCompact: true,

  setConversationContext: (conversationId, tokenCount, modelId) => {
    const modelContextSize = modelId
      ? MODEL_CONTEXT_SIZES[modelId] || MODEL_CONTEXT_SIZES.default
      : MODEL_CONTEXT_SIZES.default

    set((state) => ({
      conversationContexts: {
        ...state.conversationContexts,
        [conversationId]: {
          ...state.conversationContexts[conversationId],
          modelContextSize,
          currentTokenCount: tokenCount,
          lastCompactionAt: state.conversationContexts[conversationId]?.lastCompactionAt || null,
          compactionSummary: state.conversationContexts[conversationId]?.compactionSummary || null,
        },
      },
    }))
  },

  getContextUsage: (conversationId) => {
    const context = get().conversationContexts[conversationId]
    if (!context) {
      return {
        percentage: 0,
        tokenCount: 0,
        maxTokens: MODEL_CONTEXT_SIZES.default,
        shouldCompact: false,
      }
    }

    const percentage = context.currentTokenCount / context.modelContextSize
    return {
      percentage,
      tokenCount: context.currentTokenCount,
      maxTokens: context.modelContextSize,
      shouldCompact: percentage >= get().compactionThreshold,
    }
  },

  setCompactionSummary: (conversationId, summary) => {
    set((state) => ({
      conversationContexts: {
        ...state.conversationContexts,
        [conversationId]: {
          ...state.conversationContexts[conversationId],
          lastCompactionAt: Date.now(),
          compactionSummary: summary,
          // Reset token count after compaction (summary is smaller)
          currentTokenCount: Math.floor(
            (state.conversationContexts[conversationId]?.currentTokenCount || 0) * 0.25
          ),
        },
      },
    }))
  },

  clearConversationContext: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.conversationContexts
      return { conversationContexts: rest }
    })
  },

  getModelContextSize: (modelId) => {
    return MODEL_CONTEXT_SIZES[modelId] || MODEL_CONTEXT_SIZES.default
  },

  setAutoCompact: (enabled) => set({ autoCompact: enabled }),

  setCompactionThreshold: (threshold) => set({ compactionThreshold: threshold }),
}))

// Utility function to estimate tokens (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
