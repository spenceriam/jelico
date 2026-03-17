import type { ComponentType, CSSProperties } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type ToastVariant } from '../../stores/toasts'

const TOAST_ICON: Record<ToastVariant, ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
}

const TOAST_VARIANT_STYLE: Record<ToastVariant, CSSProperties> = {
  success: {
    borderColor: 'color-mix(in srgb, var(--success) 35%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--success) 16%, var(--bg-elevated) 84%)',
  },
  info: {
    borderColor: 'color-mix(in srgb, var(--info) 35%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--info) 14%, var(--bg-elevated) 86%)',
  },
  warning: {
    borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--warning) 18%, var(--bg-elevated) 82%)',
  },
  error: {
    borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--error) 16%, var(--bg-elevated) 84%)',
  },
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed left-4 bottom-4 z-[70] flex max-w-sm flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = TOAST_ICON[toast.variant]
        return (
          <div
            key={toast.id}
            className="pointer-events-auto animate-fade-in rounded-xl border text-text-primary shadow-lg backdrop-blur-sm"
            style={TOAST_VARIANT_STYLE[toast.variant]}
          >
            <div className="flex items-start gap-3 px-3 py-2.5">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{toast.title}</div>
                {toast.description && (
                  <div className="mt-0.5 text-xs text-text-secondary">{toast.description}</div>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="rounded p-1 text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary"
                title="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
