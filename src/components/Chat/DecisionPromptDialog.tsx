import { useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useDecisionPromptStore, type DecisionPromptOption } from '../../stores/decisionPrompt'

function getButtonClasses(option: DecisionPromptOption, isDefault: boolean): string {
  if (option.variant === 'danger') {
    return 'px-3 py-2 rounded-lg border border-error/40 text-error hover:bg-error/10 transition-colors'
  }

  if (option.variant === 'primary' || isDefault) {
    return 'px-3 py-2 rounded-lg bg-accent text-black hover:bg-accent-bright transition-colors'
  }

  return 'px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors'
}

export function DecisionPromptDialog() {
  const { activeRequest, choose, cancel } = useDecisionPromptStore()

  useEffect(() => {
    if (!activeRequest) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeRequest, cancel])

  if (!activeRequest) return null

  const defaultValue = activeRequest.defaultValue || activeRequest.options[0]?.value

  return (
    <div
      data-window-toggle="ignore"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg-void/80 backdrop-blur-sm"
      onClick={cancel}
    >
      <div
        className="bg-bg-surface border border-border rounded-xl shadow-xl max-w-xl w-full mx-4 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mt-0.5">
              <AlertCircle className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{activeRequest.title}</h3>
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

