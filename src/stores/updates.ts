import { create } from 'zustand'

const AVAILABLE_DISMISS_KEY = 'jelico:update:dismissed-available-version'
const APPLY_DISMISS_KEY = 'jelico:update:dismissed-apply-version'
const DOWNLOADED_VERSION_KEY = 'jelico:update:downloaded-version'
const DOWNLOADED_PATH_KEY = 'jelico:update:downloaded-path'

function shouldClearDownloadedStateOnApplyError(errorMessage: string | null | undefined): boolean {
  const normalized = (errorMessage || '').toLowerCase()
  return (
    normalized.includes('no downloaded update file') ||
    normalized.includes('no longer exists') ||
    normalized.includes('not a file')
  )
}

function readStoredValue(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    return value && value.trim().length > 0 ? value : null
  } catch {
    return null
  }
}

function writeStoredValue(key: string, value: string | null) {
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignore persistence failures.
  }
}

interface UpdatesState {
  info: UpdateInfo | null
  currentVersion: string | null
  isChecking: boolean
  isDownloading: boolean
  downloadProgress: UpdateDownloadProgress | null
  lastChecked: number | null
  lastDownloadedTo: string | null
  downloadedVersion: string | null
  dismissedAvailableVersion: string | null
  dismissedApplyVersion: string | null
  error: string | null
  loadCurrentVersion: () => Promise<string | null>
  checkForUpdates: (options?: { force?: boolean; silent?: boolean }) => Promise<UpdateInfo | null>
  downloadUpdate: () => Promise<UpdateDownloadResult | null>
  applyDownloadedUpdate: () => Promise<UpdateApplyResult | null>
  dismissAvailablePrompt: (version?: string | null) => void
  dismissApplyPrompt: (version?: string | null) => void
  startListening: () => () => void
}

export const useUpdateStore = create<UpdatesState>((set, get) => ({
  info: null,
  currentVersion: null,
  isChecking: false,
  isDownloading: false,
  downloadProgress: null,
  lastChecked: null,
  lastDownloadedTo: readStoredValue(DOWNLOADED_PATH_KEY),
  downloadedVersion: readStoredValue(DOWNLOADED_VERSION_KEY),
  dismissedAvailableVersion: readStoredValue(AVAILABLE_DISMISS_KEY),
  dismissedApplyVersion: readStoredValue(APPLY_DISMISS_KEY),
  error: null,

  loadCurrentVersion: async () => {
    try {
      const version = await window.jelico.updates.getCurrentVersion()
      set({ currentVersion: version })
      return version
    } catch {
      return null
    }
  },

  checkForUpdates: async (options) => {
    const { isChecking, lastChecked, info } = get()
    const force = options?.force === true
    const silent = options?.silent === true

    if (isChecking) return info

    if (!force && lastChecked && Date.now() - lastChecked < 60 * 1000) {
      return info
    }

    set({
      isChecking: true,
      ...(silent ? {} : { error: null }),
    })
    try {
      const info = await window.jelico.updates.check()
      set({
        info,
        currentVersion: info.currentVersion,
        isChecking: false,
        lastChecked: Date.now(),
        error: null,
      })
      return info
    } catch (error) {
      const resolvedError = error instanceof Error ? error.message : 'Update check failed.'
      set({
        isChecking: false,
        ...(silent ? {} : { error: resolvedError }),
        lastChecked: Date.now(),
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
        const latestVersion = get().info?.latestVersion || null
        writeStoredValue(APPLY_DISMISS_KEY, null)
        writeStoredValue(DOWNLOADED_PATH_KEY, result.savedTo)
        writeStoredValue(DOWNLOADED_VERSION_KEY, latestVersion)
        writeStoredValue(AVAILABLE_DISMISS_KEY, latestVersion)
        set({
          lastDownloadedTo: result.savedTo,
          downloadedVersion: latestVersion,
          dismissedApplyVersion: null,
          dismissedAvailableVersion: latestVersion,
        })
      }
      set({ isDownloading: false, downloadProgress: null })
      return result
    } catch (error) {
      set({
        isDownloading: false,
        error: error instanceof Error ? error.message : 'Download failed.',
      })
      return null
    }
  },

  applyDownloadedUpdate: async () => {
    const { lastDownloadedTo } = get()
    if (!lastDownloadedTo) {
      set({ error: 'No downloaded update file is available yet.' })
      return null
    }

    set({ error: null })
    try {
      const result = await window.jelico.updates.applyDownloaded()
      if (!result.success) {
        const resolvedError = result.error || 'Failed to launch the downloaded update.'
        const shouldClearDownloadedState = shouldClearDownloadedStateOnApplyError(resolvedError)

        set({
          error: resolvedError,
          ...(shouldClearDownloadedState
            ? { lastDownloadedTo: null, downloadedVersion: null }
            : {}),
        })
        if (shouldClearDownloadedState) {
          writeStoredValue(DOWNLOADED_PATH_KEY, null)
          writeStoredValue(DOWNLOADED_VERSION_KEY, null)
        }

        return result
      }

      const dismissedVersion = get().downloadedVersion || get().info?.latestVersion || null
      set({
        dismissedApplyVersion: dismissedVersion,
        lastDownloadedTo: null,
        downloadedVersion: null,
      })
      writeStoredValue(APPLY_DISMISS_KEY, dismissedVersion)
      writeStoredValue(DOWNLOADED_PATH_KEY, null)
      writeStoredValue(DOWNLOADED_VERSION_KEY, null)
      return result
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to launch the downloaded update.',
      })
      return null
    }
  },

  dismissAvailablePrompt: (version) => {
    const resolvedVersion = version ?? get().info?.latestVersion ?? null
    set({ dismissedAvailableVersion: resolvedVersion })
    writeStoredValue(AVAILABLE_DISMISS_KEY, resolvedVersion)
  },

  dismissApplyPrompt: (version) => {
    const resolvedVersion = version ?? get().downloadedVersion ?? get().info?.latestVersion ?? null
    set({ dismissedApplyVersion: resolvedVersion })
    writeStoredValue(APPLY_DISMISS_KEY, resolvedVersion)
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
