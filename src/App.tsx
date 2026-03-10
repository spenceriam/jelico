import { useEffect, useCallback, useState, useRef } from 'react'
import { ArrowUpRight, Download, PanelLeftClose, PanelLeftOpen, RefreshCw, X } from 'lucide-react'
import { useProviderStore } from './stores/providers'
import { useChatStore } from './stores/chat'
import { useUIStore } from './stores/ui'
import { useArtifactStore } from './stores/artifacts'
import { useWorkspaceStore, initWorkspaceStore } from './stores/workspaces'
import { usePermissionStore } from './stores/permissions'
import { useThemeStore } from './stores/theme'
import { getUpdateBannerVisibility, useUpdateStore } from './stores/updates'
import { Sidebar } from './components/Layout/Sidebar'
import { Header } from './components/Layout/Header'
import { ChatArea } from './components/Chat/ChatArea'
import { DecisionPromptDialog } from './components/Chat/DecisionPromptDialog'
import { CanvasPanel } from './components/Canvas'
// AgentPanel removed - sub-agent status now shown inline with tool calls
import { CommandPalette, useCommandPalette } from './components/CommandPalette/CommandPalette'
import { ProviderSetup } from './components/Setup/ProviderSetup'
import { Settings } from './components/Settings/Settings'
import { PermissionDialog } from './components/Permissions/PermissionDialog'
import { ClarificationPanel } from './components/Clarification/ClarificationPanel'
import { WelcomeScreen, type OnboardingProfile } from './components/Onboarding/WelcomeScreen'

// Default and constraints for canvas panel width
const DEFAULT_CANVAS_WIDTH = 500
const MIN_CANVAS_WIDTH = 300
const MIN_CHAT_WIDTH = 400
const WINDOW_DRAG_START_THRESHOLD = 2
const INTERACTIVE_DOUBLE_CLICK_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  '[role="button"]',
  '[role="link"]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[contenteditable=""]',
  'iframe',
  '.monaco-editor',
  '.monaco-editor *',
].join(',')

interface WindowDragSession {
  originScreenX: number
  originScreenY: number
  starting: boolean
  started: boolean
  onMouseMove: (event: MouseEvent) => void
  onMouseUp: (event: MouseEvent) => void
}

interface FontShortcutState {
  direction: 'in' | 'out' | null
  count: number
  lastAt: number
}

export default function App() {
  const { providers, loadProviders, isLoading } = useProviderStore()
  const { loadConversations, activeConversationId, messages, isStreaming } = useChatStore()
  const {
    settingsOpen,
    closeSettings,
    providerSetupOpen,
    closeProviderSetup,
    sidebarCollapsed,
    toggleSidebar,
    onboardingComplete,
    completeOnboarding,
    appFontPt,
    setAppFontPt,
  } = useUIStore()
  const { canvasOpen } = useArtifactStore()
  const { loadWorkspaces } = useWorkspaceStore()
  const { clearOncePermissions, loadPermissions } = usePermissionStore()
  const { loadFromStorage: loadTheme } = useThemeStore()
  const {
    info: updateInfo,
    isDownloading: isUpdateDownloading,
    isApplying: isUpdateApplying,
    downloadProgress: updateDownloadProgress,
    lastDownloadedTo,
    downloadedVersion,
    dismissedAvailableVersion,
    dismissedApplyVersion,
    launchedApplyVersion,
    error: updateError,
    startListening,
    loadCurrentVersion,
    checkForUpdates,
    downloadUpdate,
    applyDownloadedUpdate,
    dismissAvailablePrompt,
    dismissApplyPrompt,
  } = useUpdateStore()
  const commandPalette = useCommandPalette()
  const getMaxCanvasWidth = useCallback(() => {
    // Account for sidebar width (w-64 = 256px) when calculating available space
    const sidebarWidth = sidebarCollapsed ? 0 : 256
    const availableWidth = Math.max(0, window.innerWidth - sidebarWidth)
    return Math.max(MIN_CANVAS_WIDTH, availableWidth - MIN_CHAT_WIDTH)
  }, [sidebarCollapsed])

  // Resizable canvas panel state
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number; currentWidth: number } | null>(null)
  const windowDragRef = useRef<WindowDragSession | null>(null)
  const fontShortcutRef = useRef<FontShortcutState>({
    direction: null,
    count: 0,
    lastAt: 0,
  })
  const appFontScale = appFontPt / 10.5
  const isInteractiveTarget = useCallback((target: HTMLElement | null) => {
    if (!target) return false
    if (target.closest('[data-resize-handle]')) return true
    if (target.closest('[data-window-toggle="ignore"]')) return true
    return Boolean(target.closest(INTERACTIVE_DOUBLE_CLICK_SELECTOR))
  }, [])

  useEffect(() => {
    loadProviders()
    loadConversations()
    initWorkspaceStore() // Restore active workspace from localStorage
    loadWorkspaces()

    // Clear "allow once" permissions from previous session
    clearOncePermissions()
    loadPermissions()

    // Load and apply saved theme
    loadTheme()

    // Load saved canvas width from localStorage
    const savedWidth = localStorage.getItem('jelico-canvas-width')
    if (savedWidth) {
      const width = parseInt(savedWidth, 10)
      const maxCanvasWidth = getMaxCanvasWidth()
      if (!Number.isNaN(width)) {
        setCanvasWidth(Math.min(maxCanvasWidth, Math.max(MIN_CANVAS_WIDTH, width)))
      }
    }
  }, [getMaxCanvasWidth])

  useEffect(() => {
    const updateCanvasBounds = () => {
      const maxCanvasWidth = getMaxCanvasWidth()
      setCanvasWidth((currentWidth) => Math.min(maxCanvasWidth, Math.max(MIN_CANVAS_WIDTH, currentWidth)))
    }

    window.addEventListener('resize', updateCanvasBounds)
    return () => window.removeEventListener('resize', updateCanvasBounds)
  }, [getMaxCanvasWidth])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-scale', appFontScale.toString())
  }, [appFontScale])

  useEffect(() => {
    const DOUBLE_PRESS_WINDOW_MS = 900
    const isMac = navigator.platform.toUpperCase().includes('MAC')

    const onKeyDown = (event: KeyboardEvent) => {
      const hasModifier = isMac ? event.metaKey : event.ctrlKey
      if (!hasModifier || event.altKey) return

      const isZoomInKey =
        event.key === '+' || event.key === '=' || event.code === 'NumpadAdd'
      const isZoomOutKey =
        event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract'

      if (!isZoomInKey && !isZoomOutKey) return

      const direction: 'in' | 'out' = isZoomInKey ? 'in' : 'out'
      event.preventDefault()

      const now = Date.now()
      const state = fontShortcutRef.current
      if (state.direction === direction && now - state.lastAt <= DOUBLE_PRESS_WINDOW_MS) {
        state.count += 1
      } else {
        state.direction = direction
        state.count = 1
      }
      state.lastAt = now

      if (state.count >= 2) {
        setAppFontPt(direction === 'in' ? appFontPt + 0.5 : appFontPt - 0.5)
        fontShortcutRef.current = { direction: null, count: 0, lastAt: 0 }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [appFontPt, setAppFontPt])

  useEffect(() => {
    const stopListening = startListening()
    loadCurrentVersion()

    const startupTimer = window.setTimeout(() => {
      checkForUpdates({ silent: true }).catch((error) => {
        console.warn('Background startup update check failed:', error)
      })
    }, 2500)

    const backgroundInterval = window.setInterval(() => {
      checkForUpdates({ silent: true }).catch((error) => {
        console.warn('Background update check failed:', error)
      })
    }, 6 * 60 * 60 * 1000)

    return () => {
      stopListening()
      window.clearTimeout(startupTimer)
      window.clearInterval(backgroundInterval)
    }
  }, [checkForUpdates, loadCurrentVersion, startListening])

  const stopWindowDrag = useCallback(() => {
    const dragSession = windowDragRef.current
    if (!dragSession) return

    document.removeEventListener('mousemove', dragSession.onMouseMove)
    document.removeEventListener('mouseup', dragSession.onMouseUp)
    windowDragRef.current = null

    document.body.style.userSelect = ''
    document.body.style.cursor = ''

    if (dragSession.started) {
      window.jelico.window.endDrag().catch((error) => {
        console.error('Failed to end window drag:', error)
      })
    }
  }, [])

  const handleAppMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (event.detail > 1) return

    // Always clear any stale drag session before deciding if this target
    // should start a new one. This prevents "stuck" interaction guards from
    // surviving clicks on interactive controls like the chat composer.
    stopWindowDrag()
    if (isResizing) return

    const target = event.target as HTMLElement | null
    if (isInteractiveTarget(target)) return

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dragSession = windowDragRef.current
      if (!dragSession) return

      if (!dragSession.started) {
        const movedX = Math.abs(moveEvent.screenX - dragSession.originScreenX)
        const movedY = Math.abs(moveEvent.screenY - dragSession.originScreenY)
        if (movedX < WINDOW_DRAG_START_THRESHOLD && movedY < WINDOW_DRAG_START_THRESHOLD) {
          return
        }
        if (dragSession.starting) return

        dragSession.starting = true
        window.jelico.window.startDrag(moveEvent.screenX, moveEvent.screenY)
          .then((result) => {
            const activeDragSession = windowDragRef.current
            if (!activeDragSession) return

            activeDragSession.starting = false
            if (!result.success) {
              stopWindowDrag()
              return
            }

            activeDragSession.started = true
            document.body.style.userSelect = 'none'
            document.body.style.cursor = 'move'

            return window.jelico.window.updateDrag(moveEvent.screenX, moveEvent.screenY)
          })
          .catch((error) => {
            console.error('Failed to start window drag:', error)
            stopWindowDrag()
          })
        return
      }

      window.jelico.window.updateDrag(moveEvent.screenX, moveEvent.screenY).catch((error) => {
        console.error('Failed to update window drag:', error)
        stopWindowDrag()
      })
    }

    const onMouseUp = () => {
      stopWindowDrag()
    }

    windowDragRef.current = {
      originScreenX: event.screenX,
      originScreenY: event.screenY,
      starting: false,
      started: false,
      onMouseMove,
      onMouseUp,
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [isInteractiveTarget, isResizing, stopWindowDrag])

  useEffect(() => {
    return () => stopWindowDrag()
  }, [stopWindowDrag])

  const handleAppDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isResizing) return
    const target = event.target as HTMLElement | null
    if (isInteractiveTarget(target)) return
    window.jelico.window.toggleMaximize().catch((error) => {
      console.error('Failed to toggle window maximize:', error)
    })
  }, [isResizing, isInteractiveTarget])

  const finishResize = useCallback(() => {
    const current = resizeRef.current
    if (!current) return
    resizeRef.current = null
    setIsResizing(false)
    localStorage.setItem('jelico-canvas-width', String(current.currentWidth))
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeRef.current = {
      startX: e.clientX,
      startWidth: canvasWidth,
      currentWidth: canvasWidth,
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [canvasWidth])

  const handleResizeMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const current = resizeRef.current
    if (!current) return

    // Mouse released outside normal flow (e.g., over iframe), force-finish resize.
    if ((e.buttons & 1) === 0) {
      finishResize()
      return
    }

    // Moving left increases width, moving right decreases.
    const delta = current.startX - e.clientX
    const maxCanvasWidth = getMaxCanvasWidth()
    const newWidth = Math.min(maxCanvasWidth, Math.max(MIN_CANVAS_WIDTH, current.startWidth + delta))
    current.currentWidth = newWidth
    setCanvasWidth(newWidth)
  }, [finishResize, getMaxCanvasWidth])

  const handleResizeEnd = useCallback(() => {
    finishResize()
  }, [finishResize])

  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [])

  // Safety net: always release interaction guards when focus/mouse state is lost.
  // This prevents stuck overlays/cursors from blocking input after edge-case flows
  // (conversation deletion, sandbox transfer, window focus changes, etc.).
  useEffect(() => {
    const releaseInteractionLocks = () => {
      finishResize()
      stopWindowDrag()
    }

    window.addEventListener('blur', releaseInteractionLocks)
    window.addEventListener('mouseup', releaseInteractionLocks, true)
    window.addEventListener('mouseleave', releaseInteractionLocks)

    return () => {
      window.removeEventListener('blur', releaseInteractionLocks)
      window.removeEventListener('mouseup', releaseInteractionLocks, true)
      window.removeEventListener('mouseleave', releaseInteractionLocks)
    }
  }, [finishResize, stopWindowDrag])

  // Handle onboarding completion - save profile to soul system
  const handleOnboardingComplete = useCallback(async (profile: OnboardingProfile) => {
    try {
      // Save all profile fields as preferences for easy retrieval and editing
      await Promise.all([
        profile.name.trim() && window.jelico.soul.setPreference('userName', profile.name.trim(), 1.0),
        profile.intentions.trim() && window.jelico.soul.setPreference('userIntentions', profile.intentions.trim(), 1.0),
        profile.preferences.trim() && window.jelico.soul.setPreference('userPreferences', profile.preferences.trim(), 1.0),
        profile.additionalInfo.trim() && window.jelico.soul.setPreference('additionalInfo', profile.additionalInfo.trim(), 1.0),
      ].filter(Boolean))
    } catch (error) {
      console.error('Failed to save onboarding profile:', error)
    }

    // Complete onboarding regardless of save success
    completeOnboarding()
  }, [completeOnboarding])

  // Show loading state
  if (isLoading && providers.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-void">
        <div className="text-text-secondary">Loading...</div>
      </div>
    )
  }

  // Show provider setup if no providers configured
  if (providers.length === 0) {
    return <ProviderSetup onComplete={loadProviders} />
  }

  // Show onboarding welcome screen if not completed
  if (!onboardingComplete) {
    return <WelcomeScreen onComplete={handleOnboardingComplete} />
  }

  // Hide header when in new chat view (no conversation or empty conversation)
  const showNewChatUI = !activeConversationId || (messages.length === 0 && !isStreaming)
  const { latestAvailableVersion, showApplyBanner, showAvailableBanner } = getUpdateBannerVisibility({
    info: updateInfo,
    lastDownloadedTo,
    downloadedVersion,
    dismissedAvailableVersion,
    dismissedApplyVersion,
    launchedApplyVersion,
  })

  const handleOpenReleaseNotes = async () => {
    if (!updateInfo?.releaseUrl) return
    try {
      await window.jelico.updates.openRelease(updateInfo.releaseUrl)
    } catch (error) {
      console.error('Failed to open release notes:', error)
    }
  }

  const handleApplyNow = async () => {
    if (isUpdateApplying) return
    await applyDownloadedUpdate()
  }

  return (
    <div
      className="h-screen flex bg-bg-void text-text-primary overflow-hidden relative select-none app-font-scale"
      onDoubleClick={handleAppDoubleClick}
      onMouseDown={handleAppMouseDown}
    >
      {/* Floating sidebar toggle button at left edge */}
      <button
        onClick={toggleSidebar}
        className={`
          fixed left-0 top-1/2 -translate-y-1/2 z-40
          p-1.5 bg-bg-elevated border border-border rounded-r-lg
          text-text-muted hover:text-text-primary hover:bg-bg-hover
          transition-all duration-200
          ${sidebarCollapsed ? 'translate-x-0' : 'translate-x-[256px]'}
        `}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="w-4 h-4" />
        ) : (
          <PanelLeftClose className="w-4 h-4" />
        )}
      </button>

      <Sidebar />

      <main
        className="relative flex-1 flex flex-col min-w-0"
        style={{ paddingTop: 'var(--titlebar-padding)' }}
      >
        {/* macOS titlebar safe-area fill for the main pane */}
        <div
          className="pane-surface absolute top-0 left-0 right-0 pointer-events-none"
          style={{ height: 'var(--titlebar-padding)' }}
          aria-hidden="true"
        />

        {!showNewChatUI && <Header />}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <ChatArea />
          </div>
          {canvasOpen && (
            <>
              {/* Resize handle */}
              <div
                className={`w-1 cursor-col-resize hover:bg-accent/50 transition-colors flex-shrink-0 ${
                  isResizing ? 'bg-accent' : 'bg-transparent hover:bg-border'
                }`}
                data-resize-handle
                onMouseDown={handleResizeStart}
                title="Drag to resize"
              />
              {/* Canvas panel with dynamic width */}
              <div
                style={{ width: canvasWidth }}
                className="flex-shrink-0"
                data-window-toggle="ignore"
              >
                <CanvasPanel />
              </div>
            </>
          )}
        </div>
      </main>

      {isResizing && (
        <div
          className="fixed inset-0 z-[60] cursor-col-resize"
          data-window-toggle="ignore"
          onMouseMove={handleResizeMove}
          onMouseUp={handleResizeEnd}
          onMouseLeave={handleResizeEnd}
        />
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <Settings onClose={closeSettings} />
      )}

      {/* Provider setup modal (for adding additional providers) */}
      {providerSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-surface rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
            <ProviderSetup
              isModal
              onComplete={() => {
                loadProviders()
                closeProviderSetup()
              }}
              onCancel={closeProviderSetup}
            />
          </div>
        </div>
      )}

      {/* Command palette */}
      <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />

      {/* Clarification questions modal */}
      <ClarificationPanel />

      {/* Permission dialog */}
      <PermissionDialog />

      {/* App-level decision prompt dialog */}
      <DecisionPromptDialog />

      {(showApplyBanner || showAvailableBanner) && (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(90vw,420px)]" data-window-toggle="ignore">
          <div className="rounded-xl border border-border bg-bg-elevated shadow-2xl p-4 space-y-3">
            {showApplyBanner ? (
              <>
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    Update {downloadedVersion || latestAvailableVersion} is ready
                  </div>
                  <div className="text-xs text-text-muted mt-1 break-all">
                    Downloaded to: {lastDownloadedTo}
                  </div>
                  {showAvailableBanner && latestAvailableVersion && downloadedVersion && downloadedVersion !== latestAvailableVersion && (
                    <div className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
                      <div>
                        <div className="text-xs font-medium text-warning">
                          Jelico {latestAvailableVersion} is also available
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          Applying this installer will install the older {downloadedVersion} build.
                        </div>
                      </div>
                      <button
                        onClick={() => dismissAvailablePrompt(latestAvailableVersion)}
                        className="p-1.5 rounded-md text-warning hover:text-text-primary hover:bg-warning/10 transition-colors"
                        title="Dismiss newer-version notice"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleApplyNow}
                    disabled={isUpdateApplying}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent-bright transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isUpdateApplying ? 'animate-spin' : ''}`} />
                    {isUpdateApplying ? 'Applying...' : 'Apply now'}
                  </button>
                  <button
                    onClick={() => dismissApplyPrompt(downloadedVersion || latestAvailableVersion || null)}
                    className="px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary hover:bg-bg-hover hover:border-border-strong transition-colors"
                  >
                    Later
                  </button>
                  {updateInfo?.releaseUrl && (
                    <button
                      onClick={handleOpenReleaseNotes}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary hover:bg-bg-hover hover:border-border-strong transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Release notes
                    </button>
                  )}
                </div>
                {updateError && (
                  <div className="text-xs text-error bg-error/10 border border-error/30 rounded px-2 py-1">
                    {updateError}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      Jelico {latestAvailableVersion} is available
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      Download and install when you&apos;re ready.
                    </div>
                  </div>
                  <button
                    onClick={() => dismissAvailablePrompt(latestAvailableVersion)}
                    className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title="Dismiss for now"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {isUpdateDownloading && (
                  <div className="space-y-1">
                    <div className="h-2 bg-bg-deep rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${updateDownloadProgress?.percent ?? 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-text-muted">
                      {updateDownloadProgress?.percent !== null && updateDownloadProgress?.percent !== undefined
                        ? `Downloading... ${updateDownloadProgress.percent}%`
                        : 'Downloading...'}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadUpdate()}
                    disabled={isUpdateDownloading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent-bright transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {isUpdateDownloading ? 'Downloading...' : 'Download update'}
                  </button>
                  {updateInfo?.releaseUrl && (
                    <button
                      onClick={handleOpenReleaseNotes}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary hover:bg-bg-hover hover:border-border-strong transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Release notes
                    </button>
                  )}
                  <button
                    onClick={() => dismissAvailablePrompt(latestAvailableVersion)}
                    className="px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary hover:bg-bg-hover hover:border-border-strong transition-colors"
                  >
                    Later
                  </button>
                </div>
                {updateError && (
                  <div className="text-xs text-error bg-error/10 border border-error/30 rounded px-2 py-1">
                    {updateError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
