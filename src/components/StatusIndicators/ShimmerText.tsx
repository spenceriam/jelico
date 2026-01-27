import { ReactNode } from 'react'

interface ShimmerTextProps {
  children: ReactNode
  className?: string
  active?: boolean
}

export function ShimmerText({ children, className = '', active = true }: ShimmerTextProps) {
  if (!active) {
    return <span className={className}>{children}</span>
  }

  return (
    <span
      className={`
        inline-block bg-gradient-to-r from-text-muted via-text-secondary to-text-muted
        bg-[length:200%_100%] bg-clip-text text-transparent
        animate-shimmer
        ${className}
      `}
    >
      {children}
    </span>
  )
}

// Simpler variant for status messages
interface ProcessingIndicatorProps {
  message: string
  subMessage?: string
  className?: string
}

export function ProcessingIndicator({ message, subMessage, className = '' }: ProcessingIndicatorProps) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <ShimmerText className="text-sm font-medium">
        {message}
      </ShimmerText>
      {subMessage && (
        <span className="text-xs text-text-muted">{subMessage}</span>
      )}
    </div>
  )
}
