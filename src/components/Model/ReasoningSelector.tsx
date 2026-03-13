import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupportedReasoningEfforts, REASONING_EFFORT_LABELS, type ReasoningEffort } from '../../lib/reasoning'
import { useChatStore } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'

interface ReasoningSelectorProps {
  compact?: boolean
}

export function ReasoningSelector({ compact = false }: ReasoningSelectorProps) {
  const {
    providers,
    activeProviderId,
    activeModel,
    activeReasoningEffort,
    setActiveReasoningEffort,
  } = useProviderStore()
  const { activeConversationId, isStreaming } = useChatStore((state) => ({
    activeConversationId: state.activeConversationId,
    isStreaming: state.isStreaming,
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
    { value: null, label: 'Auto' },
    ...reasoningEfforts.map((effort) => ({
      value: effort,
      label: REASONING_EFFORT_LABELS[effort],
    })),
  ]

  const displayLabel = activeReasoningEffort
    ? `Reasoning: ${REASONING_EFFORT_LABELS[activeReasoningEffort]}`
    : 'Reasoning: Auto'

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
      setDropdownOpen(false)
    } catch (selectionError: any) {
      setError(selectionError?.message || 'Failed to switch reasoning level')
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((open) => !open)}
        className={`flex items-center gap-[0.4em] ${
          compact ? 'px-[0.85em] py-[0.45em] text-sm' : 'px-[0.9em] py-[0.45em] text-sm'
        } leading-tight text-text-secondary hover:text-text-primary bg-bg-elevated rounded-lg transition-colors`}
        title="Adjust reasoning effort"
      >
        <span className="flex-1 min-w-0 whitespace-normal break-all text-left leading-tight">
          {displayLabel}
        </span>
        <ChevronDown className="w-[0.8em] h-[0.8em] text-text-muted" />
      </button>

      {dropdownOpen && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 min-w-[12rem] bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-border bg-bg-surface text-xs uppercase tracking-wider text-text-muted">
            Reasoning Effort
          </div>

          {isSwitchLocked && (
            <div className="px-3 py-2 text-xs text-text-muted border-b border-border-subtle">
              Reasoning changes are available after the current response completes.
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-xs text-error border-b border-border-subtle">
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
                className={`w-full px-3 py-2 text-left hover:bg-bg-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${
                  isActive ? 'text-accent' : 'text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{option.label}</span>
                  <span className="text-sm">{isActive ? '✓' : null}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
