import { Brain, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupportedReasoningEfforts, REASONING_EFFORT_LABELS, type ReasoningEffort } from '../../lib/reasoning'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'

interface ReasoningSelectorProps {
  compact?: boolean
  menuDirection?: 'up' | 'down'
  menuAlign?: 'left' | 'center' | 'right'
  variant?: 'default' | 'composer'
}

export function ReasoningSelector({
  compact = false,
  menuDirection = 'down',
  menuAlign = 'center',
  variant = 'default',
}: ReasoningSelectorProps) {
  const {
    providers,
    activeProviderId,
    activeModel,
    activeReasoningEffort,
    setActiveReasoningEffort,
  } = useProviderStore()
  const { activeConversationId, isStreaming, setConversationReasoningEffort } = useChatStore((state) => ({
    activeConversationId: state.activeConversationId,
    isStreaming: state.isStreaming,
    setConversationReasoningEffort: state.setConversationReasoningEffort,
  }))

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === activeProviderId) || null,
    [providers, activeProviderId]
  )

  const reasoningEfforts = useMemo(
    () => getSupportedReasoningEfforts(activeProvider?.type || '', activeModel),
    [activeProvider?.type, activeModel]
  )

  useEffect(() => {
    if (reasoningEfforts.length === 0) {
      setDropdownOpen(false)
      setError(null)
    }
  }, [reasoningEfforts.length])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!activeProvider || !activeModel || reasoningEfforts.length === 0) {
    return null
  }

  const isSwitchLocked = Boolean(isStreaming && activeConversationId)

  const options: Array<{ value: ReasoningEffort | null; label: string }> = [
    { value: null, label: 'Default' },
    ...reasoningEfforts.map((effort) => ({
      value: effort,
      label: REASONING_EFFORT_LABELS[effort],
    })),
  ]

  const displayLabel = activeReasoningEffort
    ? REASONING_EFFORT_LABELS[activeReasoningEffort]
    : 'Default'
  const dropdownPositionClass = menuDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
  const dropdownAlignClass = menuAlign === 'right'
    ? 'right-0'
    : menuAlign === 'left'
      ? 'left-0'
      : 'left-1/2 -translate-x-1/2'
  const buttonClass = variant === 'composer'
    ? `flex h-[2.2em] items-center justify-center gap-[0.42em] rounded-lg border border-accent bg-bg-elevated px-[0.72em] py-[0.42em] text-sm leading-tight text-text-secondary hover:text-text-primary ${
        dropdownOpen ? 'text-text-primary' : ''
      }`
    : `flex items-center gap-[0.4em] ${
        compact ? 'px-[0.85em] py-[0.45em] text-sm' : 'px-[0.9em] py-[0.45em] text-sm'
      } leading-tight text-text-secondary hover:text-text-primary bg-bg-elevated rounded-lg transition-colors`

  const handleSelect = async (effort: ReasoningEffort | null) => {
    if (isSwitchLocked) return

    setError(null)
    setActiveReasoningEffort(effort)

    if (!activeConversationId) {
      setDropdownOpen(false)
      return
    }

    try {
      await window.jelico.conversations.updateReasoningEffort(activeConversationId, effort)
      setConversationReasoningEffort(activeConversationId, effort)
      setDropdownOpen(false)
    } catch (selectionError: any) {
      setError(selectionError?.message || 'Failed to switch reasoning level')
    }
  }

  return (
    <div className={`relative w-fit ${dropdownOpen ? 'z-[110]' : ''}`} ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((open) => !open)}
        className={buttonClass}
        title="Adjust reasoning level"
      >
        <Brain className={`flex-shrink-0 ${variant === 'composer' ? 'h-[0.95em] w-[0.95em]' : 'h-[0.9em] w-[0.9em]'} text-accent`} />
        <span className={`flex-1 min-w-0 truncate whitespace-nowrap leading-tight ${variant === 'composer' ? 'text-center' : 'text-left'}`}>
          {displayLabel}
        </span>
        <ChevronDown className="w-[0.8em] h-[0.8em] flex-shrink-0 text-text-muted" />
      </button>

      {dropdownOpen && (
        <div
          className={`absolute ${dropdownPositionClass} ${dropdownAlignClass} ${variant === 'composer' ? 'w-full min-w-0' : 'min-w-[12rem]'} bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden z-[115]`}
        >
          {isSwitchLocked && (
            <div className="px-3 py-2 text-center text-xs text-text-muted border-b border-border-subtle">
              Reasoning changes are available after the current response completes.
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-center text-xs text-error border-b border-border-subtle">
              {error}
            </div>
          )}

          {options.map((option) => {
            const isActive = activeReasoningEffort === option.value
            return (
              <button
                key={option.value ?? 'auto'}
                onClick={() => {
                  void handleSelect(option.value)
                }}
                disabled={isSwitchLocked}
                className={`relative w-full px-3 py-2 text-center hover:bg-bg-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${
                  isActive ? 'text-accent' : 'text-text-primary'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>{option.label}</span>
                  <span className="absolute right-3 text-sm">{isActive ? '✓' : null}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
