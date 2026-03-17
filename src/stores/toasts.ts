import { create } from 'zustand'

export type ToastTone = 'info' | 'success'

export interface AppToast {
  id: string
  title: string
  message: string
  tone: ToastTone
}

const toastTimers = new Map<string, number>()
const TOAST_DURATION_MS = 4200

interface ToastStore {
  toasts: AppToast[]
  addToast: (toast: Omit<AppToast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    if (toastTimers.has(id)) {
      window.clearTimeout(toastTimers.get(id))
    }

    set((state) => ({
      toasts: [...state.toasts, { id, ...toast }],
    }))

    const timer = window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((entry) => entry.id !== id),
      }))
      toastTimers.delete(id)
    }, TOAST_DURATION_MS)

    toastTimers.set(id, timer)
  },

  removeToast: (id) => {
    const timer = toastTimers.get(id)
    if (timer) {
      window.clearTimeout(timer)
      toastTimers.delete(id)
    }

    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },

  clearToasts: () => {
    for (const timer of toastTimers.values()) {
      window.clearTimeout(timer)
    }
    toastTimers.clear()
    set({ toasts: [] })
  },
}))
