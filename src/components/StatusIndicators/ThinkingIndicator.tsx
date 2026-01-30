import { Bot } from 'lucide-react'
import { ShimmerText } from './ShimmerText'
import { BrailleLoader } from './BrailleLoader'

interface ThinkingIndicatorProps {
  message?: string
  className?: string
}

/**
 * Thinking indicator with braille spinner and shimmer text
 */
export function ThinkingIndicator({ message = 'Thinking', className = '' }: ThinkingIndicatorProps) {
  return (
    <div className={`flex gap-4 ${className}`}>
      {/* Avatar - matches assistant message style */}
      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-accent" />
      </div>

      {/* Content area */}
      <div className="flex items-center gap-2 py-2">
        {/* Braille spinner */}
        <BrailleLoader className="text-accent" />

        {/* Shimmer text */}
        <ShimmerText className="text-sm text-text-muted">
          {message}
        </ShimmerText>
      </div>
    </div>
  )
}

/**
 * Compact indicator for inline use (e.g., in tool calls)
 */
interface CompactIndicatorProps {
  message?: string
  className?: string
}

export function CompactThinkingIndicator({ message, className = '' }: CompactIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BrailleLoader className="text-accent text-sm" />
      {message && (
        <ShimmerText className="text-xs text-text-muted">
          {message}
        </ShimmerText>
      )}
    </div>
  )
}

/**
 * Tool progress indicator - shows when AI is calling/executing tools
 */
interface ToolProgressIndicatorProps {
  toolName?: string
  status?: 'calling' | 'executing' | 'complete'
  className?: string
}

export function ToolProgressIndicator({
  toolName,
  status = 'calling',
  className = ''
}: ToolProgressIndicatorProps) {
  const statusMessages = {
    calling: 'Calling',
    executing: 'Running',
    complete: 'Done',
  }

  if (status === 'complete') {
    return (
      <span className={`text-xs text-success ${className}`}>
        {statusMessages[status]}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BrailleLoader className="text-accent text-sm" />
      <ShimmerText className="text-xs">
        {statusMessages[status]}{toolName && `: ${toolName}`}
      </ShimmerText>
    </div>
  )
}
