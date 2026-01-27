import { useEffect, useCallback } from 'react'
import { modes, cycleMode, type AgentMode } from '../../lib/modes'
import { useChatStore } from '../../stores/chat'

export function ModeSelector() {
  const { mode, setMode } = useChatStore()

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
          '2': 'explore',
          '3': 'execute',
          '4': 'plan',
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
    <div className="flex items-center">
      <div className="flex bg-bg-surface rounded-lg p-1 gap-0.5">
        {Object.values(modes).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`
              relative px-3 py-1.5 text-sm font-medium rounded-md
              transition-all duration-150
              ${m.id === mode
                ? 'bg-bg-elevated text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
              }
            `}
            title={`${m.description} (${m.shortcut})`}
          >
            <span className="relative z-10">{m.name}</span>
            <span className="ml-1 text-[10px] text-text-faint">
              {m.shortcut}
            </span>
          </button>
        ))}
      </div>

      {/* Current mode description */}
      <span className="ml-3 text-xs text-text-muted hidden lg:inline">
        {modes[mode].description}
      </span>
    </div>
  )
}
