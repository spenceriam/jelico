import { useEffect, useState, useRef } from 'react'
import { modes, cycleMode, type AgentMode } from '../../lib/modes'
import { useChatStore } from '../../stores/chat'

interface ModeSelectorProps {
  flatTop?: boolean
}

export function ModeSelector({ flatTop = false }: ModeSelectorProps) {
  const { mode, setMode, modeTransitioning } = useChatStore()
  const [animatingMode, setAnimatingMode] = useState<AgentMode | null>(null)
  const prevModeRef = useRef(mode)

  // Animate when mode changes
  useEffect(() => {
    if (mode !== prevModeRef.current) {
      setAnimatingMode(mode)
      const timer = setTimeout(() => setAnimatingMode(null), 700)
      prevModeRef.current = mode
      return () => clearTimeout(timer)
    }
  }, [mode])

  // Handle Tab key to cycle modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab to cycle forward, Shift+Tab to cycle backward
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't intercept if focus is on an input element
        const activeElement = document.activeElement
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT')
        ) {
          return
        }

        e.preventDefault()
        const direction = e.shiftKey ? -1 : 1
        const newMode = cycleMode(mode, direction)
        setMode(newMode)
      }

      // Number keys 1-5 for direct mode selection
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const modeKeys: Record<string, AgentMode> = {
          '1': 'auto',
          '2': 'execute',
          '3': 'plan',
          '4': 'explore',
          '5': 'review',
        }

        const modeId = modeKeys[e.key]
        if (modeId) {
          const activeElement = document.activeElement
          if (
            activeElement &&
            (activeElement.tagName === 'INPUT' ||
              activeElement.tagName === 'TEXTAREA' ||
              activeElement.tagName === 'SELECT')
          ) {
            return
          }
          setMode(modeId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, setMode])

  return (
    <div className="flex items-center justify-center w-full">
      <div className={`
        flex bg-bg-surface ${flatTop ? 'rounded-t-none rounded-b-lg' : 'rounded-lg'} overflow-hidden p-0 gap-0 transition-all duration-300
        ${modeTransitioning ? 'ring-2 ring-accent/50 ring-offset-2 ring-offset-bg-surface' : ''}
      `}>
        {Object.values(modes).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            disabled={modeTransitioning}
            className={`
              relative overflow-hidden px-3 py-2 text-sm font-medium
              ${flatTop ? 'first:rounded-bl-lg last:rounded-br-lg' : 'first:rounded-l-lg last:rounded-r-lg'}
              transition-all duration-200
              ${m.id === mode
                ? 'bg-accent/22 text-accent shadow-sm ring-1 ring-inset ring-accent z-10'
                : 'text-text-muted border mode-chip-inactive hover:text-text-secondary'
              }
              ${modeTransitioning ? 'cursor-wait' : ''}
            `}
            title={`${m.description} (${m.shortcut})`}
          >
            {animatingMode === m.id && (
              <span className="pointer-events-none absolute inset-0 z-0 mode-selection-sweep" />
            )}
            <span className="relative z-10">{m.name}</span>
            <span className="relative z-10 ml-1 text-[0.68em] text-text-faint">
              {m.shortcut}
            </span>
          </button>
        ))}
      </div>
      {modeTransitioning && (
        <span className="ml-2 text-xs text-text-muted animate-pulse">
          Deciding mode...
        </span>
      )}
    </div>
  )
}
