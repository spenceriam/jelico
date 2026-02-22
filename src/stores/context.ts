import { create } from 'zustand'

// Compaction thresholds (must match electron/services/compaction.ts)
export const COMPACTION_THRESHOLDS = {
  WARNING: 0.70,    // Show warning icon at 70%
  COMPACT: 0.75,    // Auto-compact at 75%
  CRITICAL: 0.90,   // Force compact at 90%
}

export type CompactionStatus = 'normal' | 'warning' | 'compact' | 'critical'

// Model context size cache (Issue #56: Cache context sizes to avoid repeated lookups)
interface ContextSizeCacheEntry {
  size: number
  fetchedAt: number
  source: 'api' | 'fallback' | 'default'
}

const contextSizeCache = new Map<string, ContextSizeCacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Known model context sizes (Issue #56: Hardcoded known sizes for common models)
const KNOWN_CONTEXT_SIZES: Record<string, number> = {
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  
  // Anthropic
  'claude-3-5-sonnet-latest': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-haiku-latest': 200000,
  'claude-3-opus-latest': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  
  // Google
  'gemini-1.5-pro': 2000000,
  'gemini-1.5-flash': 1000000,
  'gemini-1.0-pro': 32000,
  
  // OpenRouter common models
  'anthropic/claude-3.5-sonnet': 200000,
  'anthropic/claude-3-opus': 200000,
  'openai/gpt-4o': 128000,
  'openai/gpt-4o-mini': 128000,
  'google/gemini-1.5-pro': 2000000,
  'google/gemini-1.5-flash': 1000000,
  
  // Local models (common defaults)
  'llama3.1': 128000,
  'llama3.2': 128000,
  'qwen2.5': 128000,
  'qwen2.5-coder': 128000,
  'deepseek-coder': 64000,
  'codellama': 16384,
  'mistral': 32768,
  'mixtral': 32768,
  
  // Z.ai models
  'glm-4-plus': 128000,
  'glm-4-flash': 128000,
  'glm-4-long': 1000000,
}

// Fallback context size for unknown models (Issue #56: Increased from 100K to 256K)
const FALLBACK_CONTEXT_SIZE = 256000

interface ContextState {
  // Per-conversation context tracking
  conversationContexts: Record<string, {
    providerId: string
    modelId: string
    modelContextSize: number
    currentTokenCount: number
    // Highest observed token count since last compaction/reset.
    // Keeps context usage from silently dropping due provider usage inconsistencies.
    peakTokenCountSinceCompaction: number
    totalCompactions: number
    lastCompactionAt: number | null
    lastCompactionBeforeTokens: number | null
    lastCompactionAfterTokens: number | null
    compactionSummary: string | null
  }>

  // Compaction settings
  compactionThreshold: number // Default 0.75 (75%)
  warningThreshold: number   // Default 0.70 (70%)
  autoCompact: boolean

  // Per-conversation compaction state
  compactingConversations: Record<string, boolean>
  // Backward-compatible aggregate flag (true if any conversation is compacting)
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
    peakTokenCount: number
    peakPercentage: number
    totalCompactions: number
    lastCompactionAt: number | null
    lastCompactionBeforeTokens: number | null
    lastCompactionAfterTokens: number | null
    compactionSummary: string | null
    status: CompactionStatus
    shouldCompact: boolean
    shouldWarn: boolean
  }
  setCompactionSummary: (
    conversationId: string,
    summary: string,
    newTokenCount: number,
    previousTokenCount?: number
  ) => void
  clearConversationContext: (conversationId: string) => void
  setAutoCompact: (enabled: boolean) => void
  setCompactionThreshold: (threshold: number) => void
  isConversationCompacting: (conversationId: string) => boolean
  setConversationCompacting: (conversationId: string, isCompacting: boolean) => void
}

export const useContextStore = create<ContextState>((set, get) => ({
  conversationContexts: {},
  compactionThreshold: COMPACTION_THRESHOLDS.COMPACT,
  warningThreshold: COMPACTION_THRESHOLDS.WARNING,
  autoCompact: true,
  compactingConversations: {},
  isCompacting: false,

  initConversationContext: async (conversationId, providerId, modelId) => {
    // Issue #56: Multi-tier context size lookup
    let modelContextSize = FALLBACK_CONTEXT_SIZE
    let source: 'api' | 'fallback' | 'default' = 'fallback'

    const cacheKey = `${providerId}:${modelId}`
    const cached = contextSizeCache.get(cacheKey)
    
    // 1. Check cache first
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      modelContextSize = cached.size
      source = cached.source
      console.log(`[Context] Using cached context size for ${modelId}: ${modelContextSize}`)
    } else {
      // 2. Check known model sizes
      const normalizedModelId = modelId.toLowerCase().replace(/[:@]/g, '-')
      
      // Try exact match first
      if (KNOWN_CONTEXT_SIZES[modelId]) {
        modelContextSize = KNOWN_CONTEXT_SIZES[modelId]
        source = 'default'
        console.log(`[Context] Using known context size for ${modelId}: ${modelContextSize}`)
      } else {
        // Try partial match
        const knownModel = Object.entries(KNOWN_CONTEXT_SIZES).find(([key]) => 
          normalizedModelId.includes(key.toLowerCase()) || 
          key.toLowerCase().includes(normalizedModelId)
        )
        
        if (knownModel) {
          modelContextSize = knownModel[1]
          source = 'default'
          console.log(`[Context] Using matched context size for ${modelId} -> ${knownModel[0]}: ${modelContextSize}`)
        } else {
          // 3. Fetch from provider API
          try {
            const size = await window.jelico.providers.getModelContextSize(providerId, modelId)
            if (size && size > 0) {
              modelContextSize = size
              source = 'api'
              console.log(`[Context] Fetched context size for ${modelId}: ${size}`)
            } else {
              console.warn(`[Context] Could not fetch context size for ${modelId}, using fallback: ${FALLBACK_CONTEXT_SIZE}`)
            }
          } catch (err) {
            console.error('[Context] Error fetching context size:', err)
          }
        }
      }
      
      // Cache the result
      contextSizeCache.set(cacheKey, { size: modelContextSize, fetchedAt: Date.now(), source })
    }

    set((state) => ({
      conversationContexts: {
        ...state.conversationContexts,
        [conversationId]: {
          providerId,
          modelId,
          modelContextSize,
          currentTokenCount: 0,
          peakTokenCountSinceCompaction: 0,
          totalCompactions: 0,
          lastCompactionAt: null,
          lastCompactionBeforeTokens: null,
          lastCompactionAfterTokens: null,
          compactionSummary: null,
        },
      },
    }))
  },

  updateTokenCount: (conversationId, tokenCount) => {
    set((state) => {
      const existing = state.conversationContexts[conversationId]
      if (!existing) return state

      const safeTokenCount = Math.max(0, tokenCount)
      const nextTokenCount = Math.max(existing.currentTokenCount, safeTokenCount)
      const nextPeakTokenCount = Math.max(existing.peakTokenCountSinceCompaction, nextTokenCount)

      return {
        conversationContexts: {
          ...state.conversationContexts,
          [conversationId]: {
            ...existing,
            currentTokenCount: nextTokenCount,
            peakTokenCountSinceCompaction: nextPeakTokenCount,
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
        peakTokenCount: 0,
        peakPercentage: 0,
        totalCompactions: 0,
        lastCompactionAt: null,
        lastCompactionBeforeTokens: null,
        lastCompactionAfterTokens: null,
        compactionSummary: null,
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

    const peakTokenCount = Math.max(context.peakTokenCountSinceCompaction, context.currentTokenCount)
    const peakPercentage = context.modelContextSize > 0
      ? peakTokenCount / context.modelContextSize
      : 0

    return {
      percentage,
      tokenCount: context.currentTokenCount,
      maxTokens: context.modelContextSize,
      peakTokenCount,
      peakPercentage,
      totalCompactions: context.totalCompactions,
      lastCompactionAt: context.lastCompactionAt,
      lastCompactionBeforeTokens: context.lastCompactionBeforeTokens,
      lastCompactionAfterTokens: context.lastCompactionAfterTokens,
      compactionSummary: context.compactionSummary,
      status,
      shouldCompact: percentage >= get().compactionThreshold,
      shouldWarn: percentage >= get().warningThreshold,
    }
  },

  setCompactionSummary: (conversationId, summary, newTokenCount, previousTokenCount) => {
    set((state) => {
      const existing = state.conversationContexts[conversationId]
      if (!existing) return state

      const safeNewTokenCount = Math.max(0, newTokenCount)
      const safePreviousTokenCount = Math.max(
        0,
        typeof previousTokenCount === 'number'
          ? previousTokenCount
          : existing.currentTokenCount
      )

      return {
        conversationContexts: {
          ...state.conversationContexts,
          [conversationId]: {
            ...existing,
            lastCompactionAt: Date.now(),
            lastCompactionBeforeTokens: safePreviousTokenCount,
            lastCompactionAfterTokens: safeNewTokenCount,
            totalCompactions: existing.totalCompactions + 1,
            compactionSummary: summary,
            currentTokenCount: safeNewTokenCount,
            peakTokenCountSinceCompaction: safeNewTokenCount,
          },
        },
      }
    })
  },

  clearConversationContext: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.conversationContexts
      const { [conversationId]: __, ...restCompacting } = state.compactingConversations
      return {
        conversationContexts: rest,
        compactingConversations: restCompacting,
        isCompacting: Object.values(restCompacting).some(Boolean),
      }
    })
  },

  setAutoCompact: (enabled) => set({ autoCompact: enabled }),

  setCompactionThreshold: (threshold) => set({ compactionThreshold: threshold }),

  isConversationCompacting: (conversationId) => !!get().compactingConversations[conversationId],

  setConversationCompacting: (conversationId, isCompacting) => {
    set((state) => {
      const nextCompacting = { ...state.compactingConversations }
      if (isCompacting) {
        nextCompacting[conversationId] = true
      } else {
        delete nextCompacting[conversationId]
      }
      return {
        compactingConversations: nextCompacting,
        isCompacting: Object.values(nextCompacting).some(Boolean),
      }
    })
  },
}))

// Utility function to estimate tokens (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
