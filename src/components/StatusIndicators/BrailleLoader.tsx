interface BrailleLoaderProps {
  className?: string
  type?: 'circle' | 'fill' | 'bounce' | 'scroll'
}

/**
 * CSS-based braille loading animation
 * Uses Unicode braille patterns with CSS keyframe animations
 * Default "fill" animates: fill up → reverse fill down → loop
 * Fallback character ensures visibility even if CSS animation fails
 */
export function BrailleLoader({ className = '', type = 'fill' }: BrailleLoaderProps) {
  // Braille character as fallback - CSS ::after will override with animation
  return (
    <span className={`braille-loader braille-loader--${type} ${className}`}>
      ⠿
    </span>
  )
}
