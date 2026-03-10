import { useEffect, useRef } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useDecisionPromptStore, type DecisionPromptOption } from '../../stores/decisionPrompt'

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

function getButtonClasses(option: DecisionPromptOption, isDefault: boolean): string {
  if (option.variant === 'danger') {
    return 'px-3 py-2 rounded-lg border border-error/40 text-error hover:bg-error/10 transition-colors'
  }

  if (option.variant === 'primary' || isDefault) {
    return 'px-3 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent-bright transition-colors'
  }

  return 'px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors'
}

export function DecisionPromptDialog() {
  const { activeRequest, choose, cancel } = useDecisionPromptStore()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const defaultActionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!activeRequest) return

    const defaultValue = activeRequest.defaultValue || activeRequest.options[0]?.value

    const focusDefaultAction = () => {
      const dialog = dialogRef.current
      const fallbackFocusTarget = defaultActionRef.current || getFocusableElements(dialog)[0] || dialog
      fallbackFocusTarget?.focus()
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const rafId = window.requestAnimationFrame(() => {
      focusDefaultAction()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        cancel()
        return
      }

      const focusable = getFocusableElements(dialog)
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const focusInsideDialog = Boolean(activeElement && dialog.contains(activeElement))

      if (event.key === 'Tab') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        if (focusable.length === 0) {
          dialog.focus()
          return
        }

        const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1
        const direction = event.shiftKey ? -1 : 1
        const nextIndex = currentIndex < 0
          ? 0
          : (currentIndex + direction + focusable.length) % focusable.length

        focusable[nextIndex]?.focus()
        return
      }

      if (!focusInsideDialog && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        if (event.key === 'Enter' && defaultValue) {
          choose(defaultValue)
          return
        }

        focusDefaultAction()
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current
      const target = event.target
      if (!dialog || !(target instanceof Node)) return
      if (!dialog.contains(target)) {
        focusDefaultAction()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', handleFocusIn, true)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('focusin', handleFocusIn, true)
      previouslyFocused?.focus()
    }
  }, [activeRequest, cancel, choose])

  if (!activeRequest) return null

  const defaultValue = activeRequest.defaultValue || activeRequest.options[0]?.value

  return (
    <div
      data-window-toggle="ignore"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg-void/80 backdrop-blur-sm"
      onClick={cancel}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-prompt-title"
        className="bg-bg-surface border border-border rounded-xl shadow-xl max-w-xl w-full mx-4 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mt-0.5">
              <AlertCircle className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 id="decision-prompt-title" className="text-lg font-semibold text-text-primary">
                {activeRequest.title}
              </h3>
              <p className="text-sm text-text-secondary mt-1">{activeRequest.message}</p>
            </div>
          </div>
          <button
            onClick={cancel}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeRequest.detail && (
          <div className="px-6 py-4 border-b border-border">
            <div className="text-sm text-text-muted whitespace-pre-line">{activeRequest.detail}</div>
          </div>
        )}

        <div className="px-6 py-4 flex flex-wrap gap-2 justify-end">
          {activeRequest.options.map((option) => (
            <button
              key={option.value}
              ref={option.value === defaultValue ? defaultActionRef : null}
              onClick={() => choose(option.value)}
              className={getButtonClasses(option, option.value === defaultValue)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
