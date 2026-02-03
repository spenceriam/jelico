import { create } from 'zustand'

interface UpdatesState {
  info: UpdateInfo | null
  isChecking: boolean
  isDownloading: boolean
  downloadProgress: UpdateDownloadProgress | null
  lastChecked: number | null
  lastDownloadedTo: string | null
  error: string | null
  checkForUpdates: (options?: { force?: boolean }) => Promise<UpdateInfo | null>
  downloadUpdate: () => Promise<UpdateDownloadResult | null>
  startListening: () => () => void
}

export const useUpdateStore = create<UpdatesState>((set, get) => ({
  info: null,
  isChecking: false,
  isDownloading: false,
  downloadProgress: null,
  lastChecked: null,
  lastDownloadedTo: null,
  error: null,

  checkForUpdates: async (options) => {
    const { isChecking, lastChecked, info } = get()
    const force = options?.force === true

    if (isChecking) return info

    if (!force && lastChecked && Date.now() - lastChecked < 60 * 1000) {
      return info
    }

    set({ isChecking: true, error: null })
    try {
      const info = await window.jelico.updates.check()
      set({
        info,
        isChecking: false,
        lastChecked: Date.now(),
      })
      return info
    } catch (error) {
      set({
        isChecking: false,
        error: error instanceof Error ? error.message : 'Update check failed.',
      })
      return null
    }
  },

  downloadUpdate: async () => {
    set({ isDownloading: true, downloadProgress: null, error: null })
    try {
      const result = await window.jelico.updates.download()
      if (result?.error) {
        set({ error: result.error })
      } else if (result?.savedTo) {
        set({ lastDownloadedTo: result.savedTo })
      }
      set({ isDownloading: false })
      return result
    } catch (error) {
      set({
        isDownloading: false,
        error: error instanceof Error ? error.message : 'Download failed.',
      })
      return null
    }
  },

  startListening: () => {
    const unsubscribe = window.jelico.updates.onDownloadProgress((progress) => {
      set({
        isDownloading: true,
        downloadProgress: progress,
      })
    })

    return () => {
      unsubscribe()
      const { isDownloading } = get()
      if (isDownloading) {
        set({ isDownloading: false })
      }
    }
  },
}))
