import { CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore } from '../../stores/toasts'

export function ToastStack() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[70] flex max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const isSuccess = toast.tone === 'success'

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${
              isSuccess
                ? 'border-success/30 bg-success/12 text-text-primary'
                : 'border-border bg-bg-surface/95 text-text-primary'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${isSuccess ? 'text-success' : 'text-accent'}`}>
                {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{toast.title}</div>
                <p className="mt-1 text-sm text-text-secondary">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="rounded p-1 text-text-muted hover:text-text-primary"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
