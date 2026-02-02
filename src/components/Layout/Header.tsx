import { Settings, Presentation } from 'lucide-react'
import { useUIStore } from '../../stores/ui'
import { useArtifactStore } from '../../stores/artifacts'
import { useChatStore } from '../../stores/chat'
import { WorkspaceSelector } from '../Workspace/WorkspaceSelector'
import { ModelSelector } from '../Model/ModelSelector'
import { ContextIndicator } from './ContextIndicator'

export function Header() {
  const { openSettings, sidebarCollapsed } = useUIStore()
  const { artifacts, canvasOpen, toggleCanvas } = useArtifactStore()
  const activeConversationId = useChatStore((state) => state.activeConversationId)

  // Only count artifacts for the CURRENT conversation
  const currentConversationArtifacts = activeConversationId
    ? artifacts.filter((a) => a.conversationId === activeConversationId)
    : []

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg-deep">
      {/* Left - Workspace selector, Model, Context */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <WorkspaceSelector />
        <ModelSelector />
        <ContextIndicator />
      </div>

      {/* Right - Canvas & Settings */}
      <div className="flex items-center gap-2">
        {/* Canvas toggle button */}
        <button
          onClick={toggleCanvas}
          className={`
            p-2 rounded-md transition-colors relative
            ${canvasOpen
              ? 'text-accent bg-bg-surface'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-surface'}
          `}
          title={canvasOpen ? 'Hide Canvas' : 'Show Canvas'}
        >
          <Presentation className="w-5 h-5" />
          {currentConversationArtifacts.length > 0 && !canvasOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
          )}
        </button>

        {/* Settings button - only show when sidebar is collapsed (sidebar has its own settings) */}
        {sidebarCollapsed && (
          <button
            onClick={() => openSettings()}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-surface rounded-md transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}
