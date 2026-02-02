/**
 * ContextIndicator - Shows context window usage in header
 *
 * Displays percentage, expands to show progress bar when clicked.
 * Only visible when there's an active conversation with messages.
 */

import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useContextStore } from '../../stores/context'
import { useProviderStore } from '../../stores/providers'

export function ContextIndicator() {
  const [showBar, setShowBar] = useState(false)
  const { activeConversationId, messages, isStreaming } = useChatStore()
  const { getContextUsage, isCompacting } = useContextStore()
  const { activeModel } = useProviderStore()

  // Get context usage for current conversation
  const contextUsage = activeConversationId ? getContextUsage(activeConversationId) : null

  // Only show when there's context to display
  const conversationMessages = messages.filter(m => m.conversationId === activeConversationId)
  if (!contextUsage || (contextUsage.tokenCount === 0 && !isStreaming && conversationMessages.length === 0)) {
    return null
  }

  const percentage = Math.round(contextUsage.percentage * 100)

  return (
    <div className="flex items-center gap-2">
      {/* Percentage button */}
      <button
        onClick={() => setShowBar(!showBar)}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono
          transition-colors
          ${contextUsage.shouldWarn
            ? 'text-warning hover:bg-warning/10'
            : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'}
        `}
        title={showBar
          ? `Context window of ${activeModel || 'model'}, click to hide bar`
          : `Context window of ${activeModel || 'model'}, click to see bar`}
      >
        {/* Spinner during compaction */}
        {isCompacting && (
          <Loader2 className="w-3 h-3 animate-spin text-accent" />
        )}
        {/* Warning icon when approaching limit */}
        {!isCompacting && contextUsage.shouldWarn && (
          <AlertTriangle className="w-3 h-3" />
        )}
        <span>{percentage}%</span>
      </button>

      {/* Progress bar - shows when expanded (half original size for header) */}
      {showBar && (
        <div className="w-20 h-1.5 bg-bg-deep rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              contextUsage.shouldWarn ? 'bg-warning' : 'bg-accent'
            }`}
            style={{ width: `${Math.max(Math.min(percentage, 100), 1)}%` }}
          />
        </div>
      )}
    </div>
  )
}
