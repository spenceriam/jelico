import { useEffect, useCallback, useState, useRef } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useProviderStore } from './stores/providers'
import { useChatStore } from './stores/chat'
import { useUIStore } from './stores/ui'
import { useArtifactStore } from './stores/artifacts'
import { useWorkspaceStore, initWorkspaceStore } from './stores/workspaces'
import { usePermissionStore } from './stores/permissions'
import { useThemeStore } from './stores/theme'
import { useUpdateStore } from './stores/updates'
import { Sidebar } from './components/Layout/Sidebar'
import { Header } from './components/Layout/Header'
import { ChatArea } from './components/Chat/ChatArea'
import { CanvasPanel } from './components/Canvas'
// AgentPanel removed - sub-agent status now shown inline with tool calls
import { CommandPalette, useCommandPalette } from './components/CommandPalette/CommandPalette'
import { ProviderSetup } from './components/Setup/ProviderSetup'
import { Settings } from './components/Settings/Settings'
import { PermissionDialog } from './components/Permissions/PermissionDialog'
import { WelcomeScreen, type OnboardingProfile } from './components/Onboarding/WelcomeScreen'

// Default and constraints for canvas panel width
const DEFAULT_CANVAS_WIDTH = 500
const MIN_CANVAS_WIDTH = 300
const MAX_CANVAS_WIDTH = 800
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

export default function App() {
  const { providers, loadProviders, isLoading } = useProviderStore()
  const { loadConversations, activeConversationId, messages, isStreaming } = useChatStore()
  const { settingsOpen, closeSettings, providerSetupOpen, closeProviderSetup, sidebarCollapsed, toggleSidebar, onboardingComplete, completeOnboarding } = useUIStore()
  const { canvasOpen } = useArtifactStore()
  const { loadWorkspaces } = useWorkspaceStore()
  const { clearOncePermissions, loadPermissions } = usePermissionStore()
  const { loadFromStorage: loadTheme } = useThemeStore()
  const { checkForUpdates, startListening } = useUpdateStore()
  const commandPalette = useCommandPalette()

  // Resizable canvas panel state
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const windowDragRef = useRef<WindowDragSession | null>(null)
  const isInteractiveTarget = useCallback((target: HTMLElement | null) => {
    if (!target) return false
    if (target.closest('[data-resize-handle]')) return true
    if (target.closest('[data-window-toggle="ignore"]')) return true
    return Boolean(target.closest(INTERACTIVE_DOUBLE_CLICK_SELECTOR))
  }, [])

  useEffect(() => {
    loadProviders()
    loadConversations()
    loadWorkspaces()
    initWorkspaceStore() // Restore active workspace from localStorage

    // Clear "allow once" permissions from previous session
    clearOncePermissions()
    loadPermissions()

    // Load and apply saved theme
    loadTheme()

    // Load saved canvas width from localStorage
    const savedWidth = localStorage.getItem('jelico-canvas-width')
    if (savedWidth) {
      const width = parseInt(savedWidth, 10)
      if (width >= MIN_CANVAS_WIDTH && width <= MAX_CANVAS_WIDTH) {
        setCanvasWidth(width)
      }
    }
  }, [])

  useEffect(() => {
    const stopListening = startListening()
    checkForUpdates()
    return () => stopListening()
  }, [])

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
    if (isResizing) return

    const target = event.target as HTMLElement | null
    if (isInteractiveTarget(target)) return

    stopWindowDrag()

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

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = { startX: e.clientX, startWidth: canvasWidth }
  }, [canvasWidth])

  useEffect(() => {
    if (!isResizing) return

    let currentWidth = canvasWidth

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return

      // Moving left increases width, moving right decreases
      const delta = resizeRef.current.startX - e.clientX
      const newWidth = Math.min(MAX_CANVAS_WIDTH, Math.max(MIN_CANVAS_WIDTH, resizeRef.current.startWidth + delta))
      currentWidth = newWidth
      setCanvasWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
      // Save to localStorage using tracked width
      localStorage.setItem('jelico-canvas-width', String(currentWidth))
    }

    // Add listeners to document so they fire even if mouse leaves the handle
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing]) // Only depend on isResizing - don't re-add listeners on width change

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

    return (
    <div
      className="h-screen flex bg-bg-void text-text-primary overflow-hidden relative select-none"
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
        className="flex-1 flex flex-col min-w-0"
        style={{ paddingTop: 'var(--titlebar-padding)' }}
      >
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
                className={`flex-shrink-0 ${isResizing ? 'pointer-events-none' : ''}`}
              >
                <CanvasPanel />
              </div>
            </>
          )}
        </div>
      </main>

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

      {/* Permission dialog */}
      <PermissionDialog />
    </div>
  )
}
