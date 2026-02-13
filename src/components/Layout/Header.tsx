import { Settings, Presentation, GitBranch } from 'lucide-react'
import { useUIStore } from '../../stores/ui'
import { useArtifactStore } from '../../stores/artifacts'
import { useChatStore } from '../../stores/chat'
import { useUpdateStore } from '../../stores/updates'
import { useWorkspaceStore } from '../../stores/workspaces'
import { WorkspaceSelector } from '../Workspace/WorkspaceSelector'
import { ModelSelector } from '../Model/ModelSelector'
import { ContextIndicator } from './ContextIndicator'

export function Header() {
  const { openSettings, sidebarCollapsed } = useUIStore()
  const { artifacts, canvasOpen, toggleCanvas } = useArtifactStore()
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const updateAvailable = useUpdateStore((state) => state.info?.isUpdateAvailable)
  const { workspaces, activeWorkspaceId } = useWorkspaceStore()
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)
  const activeBranch = activeWorkspace?.gitBranch?.trim()

  // Only count artifacts for the CURRENT conversation
  const currentConversationArtifacts = activeConversationId
    ? artifacts.filter((a) => a.conversationId === activeConversationId)
    : []

  return (
    <header
      className="flex items-center justify-between px-4 border-b border-border bg-bg-elevated"
      style={{ height: 'clamp(2.9rem, calc(3.5rem * var(--app-font-scale, 1)), 4.4rem)' }}
    >
      {/* Left - Workspace selector, Model, Context */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <WorkspaceSelector />
        <ModelSelector />
        <ContextIndicator />
        {activeBranch && (
          <div
            className="flex items-center gap-1.5 text-xs text-text-muted max-w-[220px]"
            title={`Branch: ${activeBranch}`}
          >
            <GitBranch className="w-[0.95em] h-[0.95em] flex-shrink-0" />
            <span className="truncate">{activeBranch}</span>
          </div>
        )}
      </div>

      {/* Right - Canvas & Settings */}
      <div className="flex items-center gap-2">
        {/* Canvas toggle button */}
        <button
          onClick={toggleCanvas}
          className={`
            p-[0.55em] text-sm rounded-md transition-colors relative
            ${canvasOpen
              ? 'text-accent bg-bg-surface'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-surface'}
          `}
          title={canvasOpen ? 'Hide Canvas' : 'Show Canvas'}
        >
          <Presentation className="w-[1.15em] h-[1.15em]" />
          {currentConversationArtifacts.length > 0 && !canvasOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
          )}
        </button>

        {/* Settings button - only show when sidebar is collapsed (sidebar has its own settings) */}
        {sidebarCollapsed && (
          <button
            onClick={() => openSettings()}
            className="p-[0.55em] text-sm text-text-muted hover:text-text-primary hover:bg-bg-surface rounded-md transition-colors relative"
            title="Settings"
          >
            <Settings className="w-[1.15em] h-[1.15em]" />
            {updateAvailable && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
            )}
          </button>
        )}
      </div>
    </header>
  )
}
