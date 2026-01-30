import { useEffect, useCallback, useState, useRef } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useProviderStore } from './stores/providers'
import { useChatStore } from './stores/chat'
import { useUIStore } from './stores/ui'
import { useArtifactStore } from './stores/artifacts'
import { useWorkspaceStore, initWorkspaceStore } from './stores/workspaces'
import { usePermissionStore } from './stores/permissions'
import { useThemeStore } from './stores/theme'
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

export default function App() {
  const { providers, loadProviders, isLoading } = useProviderStore()
  const { loadConversations, activeConversationId, messages, isStreaming } = useChatStore()
  const { settingsOpen, closeSettings, providerSetupOpen, closeProviderSetup, sidebarCollapsed, toggleSidebar, onboardingComplete, completeOnboarding } = useUIStore()
  const { canvasOpen } = useArtifactStore()
  const { loadWorkspaces } = useWorkspaceStore()
  const { clearOncePermissions, loadPermissions } = usePermissionStore()
  const { loadFromStorage: loadTheme } = useThemeStore()
  const commandPalette = useCommandPalette()

  // Resizable canvas panel state
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

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
    <div className="h-screen flex bg-bg-void text-text-primary overflow-hidden relative">
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

      <main className="flex-1 flex flex-col min-w-0">
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
                onMouseDown={handleResizeStart}
                title="Drag to resize"
              />
              {/* Canvas panel with dynamic width */}
              <div style={{ width: canvasWidth }} className="flex-shrink-0">
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
