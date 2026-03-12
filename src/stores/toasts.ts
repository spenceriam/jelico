import { create } from 'zustand'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  durationMs: number
  createdAt: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (input: {
    title: string
    description?: string
    variant?: ToastVariant
    durationMs?: number
  }) => string
  dismissToast: (id: string) => void
  clearToasts: () => void
}

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearToastTimer(id: string) {
  const timer = toastTimers.get(id)
  if (!timer) return
  clearTimeout(timer)
  toastTimers.delete(id)
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: ({ title, description, variant = 'info', durationMs = 3800 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const toast: Toast = {
      id,
      title,
      description,
      variant,
      durationMs,
      createdAt: Date.now(),
    }

    set((state) => ({
      toasts: [...state.toasts, toast],
    }))

    const timer = setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((entry) => entry.id !== id),
      }))
      toastTimers.delete(id)
    }, durationMs)

    toastTimers.set(id, timer)
    return id
  },

  dismissToast: (id) => {
    clearToastTimer(id)
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },

  clearToasts: () => {
    for (const id of toastTimers.keys()) {
      clearToastTimer(id)
    }
    set({ toasts: [] })
  },
}))
