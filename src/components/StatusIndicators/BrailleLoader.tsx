interface BrailleLoaderProps {
  className?: string
  type?: 'circle' | 'fill' | 'bounce' | 'scroll'
}

/**
 * CSS-based braille loading animation
 * Uses Unicode braille patterns with CSS keyframe animations
 * Default "fill" animates: fill up → reverse fill down → loop
 */
export function BrailleLoader({ className = '', type = 'fill' }: BrailleLoaderProps) {
  return (
    <span className={`braille-loader braille-loader--${type} ${className}`} />
  )
}
