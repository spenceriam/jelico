import { useState, useEffect } from 'react'

// Braille spinner frames - creates a "sand" animation effect
const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

interface BrailleLoaderProps {
  className?: string
  interval?: number // ms between frames
}

/**
 * ASCII-style braille loading animation
 * Creates a spinning "sand" effect using braille characters
 */
export function BrailleLoader({ className = '', interval = 80 }: BrailleLoaderProps) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % BRAILLE_FRAMES.length)
    }, interval)

    return () => clearInterval(timer)
  }, [interval])

  return (
    <span className={`font-mono ${className}`}>
      {BRAILLE_FRAMES[frameIndex]}
    </span>
  )
}
