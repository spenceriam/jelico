interface BrailleLoaderProps {
  className?: string
  type?: 'circle' | 'fill' | 'bounce' | 'scroll'
}

/**
 * CSS-based braille loading animation
 * Uses Unicode braille patterns with CSS keyframe animations
 */
export function BrailleLoader({ className = '', type = 'circle' }: BrailleLoaderProps) {
  return (
    <span className={`braille-loader braille-loader--${type} ${className}`} />
  )
}
