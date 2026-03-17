import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface FloatingPathsProps {
  position: number
  reduceMotion: boolean
  opacityBoost: number
}

function FloatingPaths({ position, reduceMotion, opacityBoost }: FloatingPathsProps) {
  const paths = useMemo(
    () => Array.from({ length: 36 }, (_, index) => ({
      id: `${position}-${index}`,
      d: `M-${380 - index * 5 * position} -${189 + index * 6}C-${
        380 - index * 5 * position
      } -${189 + index * 6} -${312 - index * 5 * position} ${216 - index * 6} ${
        152 - index * 5 * position
      } ${343 - index * 6}C${616 - index * 5 * position} ${470 - index * 6} ${
        684 - index * 5 * position
      } ${875 - index * 6} ${684 - index * 5 * position} ${875 - index * 6}`,
      width: 0.32 + index * 0.022,
      opacity: Math.min(0.035 + index * 0.0085, 0.34),
      duration: 24 + (index % 10) * 1.6,
    })),
    [position]
  )

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      fill="none"
      viewBox="0 0 696 316"
      preserveAspectRatio="xMidYMid slice"
    >
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke="currentColor"
          strokeWidth={path.width}
          strokeOpacity={Math.min(path.opacity * opacityBoost, 0.52)}
          initial={reduceMotion
            ? { opacity: Math.min(path.opacity * opacityBoost * 0.88, 0.42) }
            : { pathLength: 0.3, opacity: Math.min(path.opacity * opacityBoost * 0.54, 0.34) }}
          animate={reduceMotion
            ? { opacity: Math.min(path.opacity * opacityBoost * 0.88, 0.42) }
            : {
                pathLength: [0.3, 1, 0.3],
                opacity: [
                  Math.min(path.opacity * opacityBoost * 0.46, 0.3),
                  Math.min(path.opacity * opacityBoost, 0.52),
                  Math.min(path.opacity * opacityBoost * 0.46, 0.3),
                ],
                pathOffset: [0, 1, 0],
              }}
          transition={reduceMotion
            ? { duration: 0 }
            : {
                duration: path.duration,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
        />
      ))}
    </svg>
  )
}

function useIsLightTheme() {
  const [isLightTheme, setIsLightTheme] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('light')
  })

  useEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const syncTheme = () => setIsLightTheme(root.classList.contains('light'))

    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return isLightTheme
}

export function MutedPathsBackground() {
  const reduceMotion = useReducedMotion() ?? false
  const isLightMode = useIsLightTheme()
  const opacityBoost = isLightMode ? 1.75 : 1

  const pathFieldStyle: CSSProperties = {
    color: isLightMode
      ? 'color-mix(in srgb, var(--accent) 52%, var(--text-secondary) 48%)'
      : 'color-mix(in srgb, var(--accent) 26%, var(--text-secondary) 74%)',
    opacity: isLightMode ? 0.96 : 0.68,
    maskImage: 'radial-gradient(circle at center, transparent 0%, black 18%, black 62%, transparent 92%)',
    WebkitMaskImage:
      'radial-gradient(circle at center, transparent 0%, black 18%, black 62%, transparent 92%)',
  }

  const centerGlowStyle: CSSProperties = {
    background:
      `radial-gradient(circle, ${
        isLightMode
          ? 'color-mix(in srgb, var(--accent) 24%, transparent)'
          : 'color-mix(in srgb, var(--accent) 16%, transparent)'
      } 0%, transparent 72%)`,
  }

  const vignetteStyle: CSSProperties = {
    background:
      `radial-gradient(ellipse at center, transparent 0%, transparent 56%, ${
        isLightMode
          ? 'color-mix(in srgb, var(--bg-deep) 24%, transparent)'
          : 'color-mix(in srgb, var(--bg-void) 52%, transparent)'
      } 100%)`,
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      <div className="absolute inset-[-18%]" style={pathFieldStyle}>
        <FloatingPaths position={1} reduceMotion={reduceMotion} opacityBoost={opacityBoost} />
        <FloatingPaths position={-1} reduceMotion={reduceMotion} opacityBoost={opacityBoost} />
      </div>

      <div
        className={`absolute left-1/2 top-1/2 h-[min(54vw,54vh)] w-[min(54vw,54vh)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${isLightMode ? 'opacity-30' : 'opacity-20'}`}
        style={centerGlowStyle}
      />

      <div className={`absolute inset-0 ${isLightMode ? 'opacity-55' : 'opacity-75'}`} style={vignetteStyle} />
    </div>
  )
}
