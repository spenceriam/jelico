/**
 * ContextIndicator - Shows context window usage in header
 *
 * Displays a circle indicator and toggles percentage text when clicked.
 * Only visible when there's an active conversation with messages.
 */

import { AlertTriangle } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useContextStore } from '../../stores/context'
import { useProviderStore } from '../../stores/providers'
import { useThemeStore } from '../../stores/theme'
import { useUIStore } from '../../stores/ui'
import { BrailleLoader } from '../StatusIndicators'

export function ContextIndicator() {
  const { activeConversationId, messages, isStreaming } = useChatStore()
  const { getContextUsage, isConversationCompacting } = useContextStore()
  const { activeModel } = useProviderStore()
  const { effectiveMode } = useThemeStore()
  const { showContextText, toggleContextText, appFontPt } = useUIStore()

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
  const appFontScale = appFontPt / 10.5
  const circleSize = Math.max(14, Math.round(18 * appFontScale))
  const progressStrokeWidth = Math.max(1.4, 2 * appFontScale)
  const trackStrokeWidth = Math.max(0.85, 1.05 * appFontScale)
  const radius = (circleSize - progressStrokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(Math.max(contextUsage.percentage, 0), 1)
  const dashOffset = circumference * (1 - progress)
  const trackDashPattern = '0.22 1.7'
  const trackToneClass = effectiveMode === 'light' ? 'text-accent-dim' : 'text-accent-bright'
  const trackOpacity = effectiveMode === 'light' ? 0.42 : 0.34
  const compactCount = contextUsage.totalCompactions
  const hasCompactionHistory = compactCount > 0
  const lastCompactionBeforePercent =
    contextUsage.lastCompactionBeforeTokens !== null && contextUsage.maxTokens > 0
      ? Math.round((contextUsage.lastCompactionBeforeTokens / contextUsage.maxTokens) * 100)
      : null
  const lastCompactionAfterPercent =
    contextUsage.lastCompactionAfterTokens !== null && contextUsage.maxTokens > 0
      ? Math.round((contextUsage.lastCompactionAfterTokens / contextUsage.maxTokens) * 100)
      : null

  const baseTitle = `Context window of ${activeModel || 'model'} (${percentage}% | ${contextUsage.tokenCount.toLocaleString()}/${contextUsage.maxTokens.toLocaleString()} tokens)`
  const compactionTitle = hasCompactionHistory
    ? (lastCompactionBeforePercent !== null && lastCompactionAfterPercent !== null
        ? `\nCompactions: ${compactCount}\nLast compact: ${lastCompactionBeforePercent}% → ${lastCompactionAfterPercent}%`
        : `\nCompactions: ${compactCount}`)
    : ''
  const buttonTitle = `${baseTitle}${compactionTitle}, click to ${showContextText ? 'hide' : 'show'} percentage`

  const compactText = hasCompactionHistory
    ? (lastCompactionBeforePercent !== null && lastCompactionAfterPercent !== null
        ? ` • last ${lastCompactionBeforePercent}%→${lastCompactionAfterPercent}%`
        : ` • ${compactCount} compacts`)
    : ''

  return (
    <div className="flex items-center gap-2">
      {/* Circle indicator button */}
      <button
        onClick={toggleContextText}
        className={`
          flex items-center gap-[0.45em] px-[0.65em] py-[0.4em] rounded text-xs transition-colors
          ${contextUsage.shouldWarn
            ? 'text-warning hover:bg-warning/10'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'}
        `}
        title={buttonTitle}
      >
        {/* Spinner during compaction */}
        {isCompacting && (
          <BrailleLoader className="text-accent text-sm" />
        )}
        {/* Warning icon when approaching limit */}
        {!isCompacting && contextUsage.shouldWarn && (
          <AlertTriangle className="w-[0.9em] h-[0.9em]" />
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
            className={trackToneClass}
            style={{ opacity: trackOpacity }}
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
        <span className="text-sm text-text-primary">
          Context: {percentage}%{compactText}
        </span>
      )}
    </div>
  )
}
