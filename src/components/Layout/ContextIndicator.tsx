/**
 * ContextIndicator - Shows context window usage in header
 *
 * Displays a circle indicator and toggles percentage text when clicked.
 * Only visible when there's an active conversation with messages.
 */

import { Loader2, AlertTriangle } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useContextStore } from '../../stores/context'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'

export function ContextIndicator() {
  const { activeConversationId, messages, isStreaming } = useChatStore()
  const { getContextUsage, isConversationCompacting } = useContextStore()
  const { activeModel } = useProviderStore()
  const { showContextText, toggleContextText } = useUIStore()

  // Get context usage for current conversation
  const contextUsage = activeConversationId ? getContextUsage(activeConversationId) : null
  const isCompacting = activeConversationId
    ? isConversationCompacting(activeConversationId)
    : false

  // Only show when there's context to display
  const conversationMessages = messages.filter(m => m.conversationId === activeConversationId)
  if (!contextUsage || (contextUsage.tokenCount === 0 && !isStreaming && conversationMessages.length === 0)) {
    return null
  }

  const percentage = Math.round(contextUsage.percentage * 100)
  const circleSize = 18
  const progressStrokeWidth = 2
  const trackStrokeWidth = 1.05
  const radius = (circleSize - progressStrokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(Math.max(contextUsage.percentage, 0), 1)
  const dashOffset = circumference * (1 - progress)
  const trackDashPattern = '0.22 1.7'

  return (
    <div className="flex items-center gap-2">
      {/* Circle indicator button */}
      <button
        onClick={toggleContextText}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded text-xs
          transition-colors
          ${contextUsage.shouldWarn
            ? 'text-warning hover:bg-warning/10'
            : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'}
        `}
        title={showContextText
          ? `Context window of ${activeModel || 'model'} (${percentage}%), click to hide percentage`
          : `Context window of ${activeModel || 'model'} (${percentage}%), click to show percentage`}
      >
        {/* Spinner during compaction */}
        {isCompacting && (
          <Loader2 className="w-3 h-3 animate-spin text-accent" />
        )}
        {/* Warning icon when approaching limit */}
        {!isCompacting && contextUsage.shouldWarn && (
          <AlertTriangle className="w-3 h-3" />
        )}
        <svg
          width={circleSize}
          height={circleSize}
          viewBox={`0 0 ${circleSize} ${circleSize}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={trackStrokeWidth}
            strokeDasharray={trackDashPattern}
            strokeLinecap="round"
            className="text-text-muted"
            style={{ opacity: 0.24 }}
          />
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={progressStrokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="text-accent"
          />
        </svg>
      </button>

      {/* Percentage text - toggles on circle click */}
      {showContextText && (
        <span className="text-sm text-text-secondary">
          Context: {percentage}%
        </span>
      )}
    </div>
  )
}
