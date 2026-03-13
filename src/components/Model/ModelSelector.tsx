import { ChevronDown, Loader2, Settings } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useChatStore } from '../../stores/chat'
import { useContextStore } from '../../stores/context'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'

interface ModelSelectorProps {
  compact?: boolean
}

const MODEL_SELECTOR_MENU_WIDTH_PX = 352
const MODEL_SELECTOR_MENU_MARGIN_PX = 12

function getProviderEndpointHint(baseUrl?: string): string {
  if (!baseUrl) return ''
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

export function ModelSelector({ compact = false }: ModelSelectorProps) {
  const { providers, activeProviderId, activeModel, setActiveSelection } = useProviderStore()
  const { openSettings } = useUIStore()
  const { activeConversationId, isStreaming, addSystemNotification } = useChatStore((state) => ({
    activeConversationId: state.activeConversationId,
    isStreaming: state.isStreaming,
    addSystemNotification: state.addSystemNotification,
  }))
  const switchConversationModel = useContextStore((state) => state.switchConversationModel)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [updatingSelection, setUpdatingSelection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  const isSwitchLocked = Boolean(isStreaming && activeConversationId)

  const displayLabel = useMemo(() => {
    const activeVisibleProvider = providers.find(
      (provider) =>
        provider.id === activeProviderId &&
        !provider.hiddenFromSelector &&
        !!provider.defaultModel?.trim()
    )

    if (activeModel && activeVisibleProvider) return activeModel
    if (providers.some((provider) => !provider.hiddenFromSelector && !!provider.defaultModel?.trim())) {
      return 'Select model'
    }
    return 'No models available'
  }, [providers, activeProviderId, activeModel])

  const visibleProviders = useMemo(
    () => providers.filter((provider) => !provider.hiddenFromSelector && !!provider.defaultModel?.trim()),
    [providers]
  )

  const options = useMemo(() => {
    return visibleProviders.map((provider) => {
      const model = provider.defaultModel
      return {
        id: provider.id,
        providerName: provider.name,
        providerType: provider.type,
        providerEndpoint: getProviderEndpointHint(provider.baseUrl),
        model,
        label: `${provider.name} / ${model}`,
        isActive: activeProviderId === provider.id && activeModel === model,
      }
    })
  }, [visibleProviders, activeProviderId, activeModel])

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current || typeof window === 'undefined') return

    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = menuRef.current?.offsetWidth || MODEL_SELECTOR_MENU_WIDTH_PX
    const unclampedLeft = rect.left + (rect.width / 2) - (menuWidth / 2)
    const left = Math.min(
      Math.max(unclampedLeft, MODEL_SELECTOR_MENU_MARGIN_PX),
      window.innerWidth - menuWidth - MODEL_SELECTOR_MENU_MARGIN_PX
    )

    setMenuPosition({
      top: rect.bottom + 4,
      left,
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (dropdownRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setDropdownOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useLayoutEffect(() => {
    if (!dropdownOpen) return

    updateMenuPosition()

    const handleViewportChange = () => updateMenuPosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [dropdownOpen, updateMenuPosition])

  // Keep active selector in sync with the currently open conversation.
  useEffect(() => {
    let cancelled = false
    if (!activeConversationId) return

    ;(async () => {
      try {
        const conversation = await window.jelico.conversations.get(activeConversationId)
        if (cancelled || !conversation?.providerId || !conversation?.model) return
        setActiveSelection(
          conversation.providerId,
          conversation.model,
          conversation.reasoningEffort ?? null
        )
      } catch (syncError) {
        console.warn('[ModelSelector] Failed to sync conversation provider/model:', syncError)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeConversationId, setActiveSelection])

  const handleSelect = async (providerId: string, providerName: string, model: string) => {
    if (isSwitchLocked) return
    if (activeProviderId === providerId && activeModel === model) {
      setDropdownOpen(false)
      return
    }

    const selectionKey = `${providerId}:${model}`
    setError(null)
    setUpdatingSelection(selectionKey)

    try {
      const provider = providers.find((entry) => entry.id === providerId) || null
      const reasoningEffort = provider?.defaultReasoningEffort || null
      setActiveSelection(providerId, model, reasoningEffort)

      if (activeConversationId) {
        await window.jelico.conversations.updateModelProvider(activeConversationId, providerId, model)
        await window.jelico.conversations.updateReasoningEffort(activeConversationId, reasoningEffort)
        await switchConversationModel(activeConversationId, providerId, model)
        addSystemNotification({
          type: 'model_changed',
          conversationId: activeConversationId,
          modelName: `${providerName} / ${model}`,
        })
      }

      setDropdownOpen(false)
    } catch (selectionError: any) {
      setError(selectionError?.message || 'Failed to switch provider/model')
    } finally {
      setUpdatingSelection(null)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setDropdownOpen((open) => !open)}
        className={`flex items-center gap-[0.4em] ${
          compact ? 'px-[0.85em] py-[0.45em] text-sm' : 'px-[0.9em] py-[0.45em] text-sm'
        } leading-tight text-text-secondary hover:text-text-primary bg-bg-elevated rounded-lg transition-colors`}
      >
        <span className="flex-1 min-w-0 whitespace-normal break-all text-left leading-tight">
          {displayLabel}
        </span>
        <ChevronDown className="w-[0.8em] h-[0.8em] text-text-muted" />
      </button>

      {dropdownOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed w-[22rem] bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden z-[130] max-h-[70vh] overflow-y-auto"
          style={menuPosition ? { top: menuPosition.top, left: menuPosition.left } : { top: -9999, left: -9999 }}
        >
          <div className="px-3 py-2 border-b border-border bg-bg-surface flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-text-muted">Provider / Model</div>
            <button
              onClick={() => {
                setDropdownOpen(false)
                openSettings('providers')
              }}
              className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
              title="Provider settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {isSwitchLocked && (
            <div className="px-3 py-2 text-xs text-text-muted border-b border-border-subtle">
              Model switching is available after the current response completes.
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-xs text-error border-b border-border-subtle">
              {error}
            </div>
          )}

          {options.length === 0 ? (
            <div className="px-3 py-3 text-sm text-text-muted">No visible providers configured</div>
          ) : (
            options.map((option) => {
              const selectionKey = `${option.id}:${option.model}`
              const isPending = updatingSelection === selectionKey
              const subtitle = option.providerEndpoint
                ? `${option.providerType} • ${option.providerEndpoint}`
                : option.providerType

              return (
                <button
                  key={selectionKey}
                  onClick={() => {
                    void handleSelect(option.id, option.providerName, option.model)
                  }}
                  disabled={isSwitchLocked || isPending}
                  className={`w-full px-3 py-2 text-left hover:bg-bg-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${
                    option.isActive ? 'text-accent' : 'text-text-primary'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 whitespace-normal break-all text-left leading-tight">
                      {option.label}
                    </span>
                    <span className="mt-0.5 ml-2 flex-shrink-0">
                      {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : option.isActive ? (
                        '✓'
                      ) : null}
                    </span>
                  </div>
                  <div className="text-xs text-text-faint whitespace-normal break-all text-left leading-tight mt-0.5">
                    {subtitle}
                  </div>
                </button>
              )
            })
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
