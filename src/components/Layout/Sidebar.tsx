import { useState } from 'react'
import { Plus, Settings, Trash2, FileCode, FileText, Presentation, Image, ChevronDown, ChevronRight } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useUIStore } from '../../stores/ui'
import { useArtifactStore, type ArtifactType } from '../../stores/artifacts'

const ARTIFACT_ICONS: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  code: FileCode,
  document: FileText,
  html: Presentation,
  svg: Image,
  mermaid: Image,
}

export function Sidebar() {
  const { conversations, activeConversationId, setActiveConversation, deleteConversation } = useChatStore()
  const { sidebarCollapsed, openSettings } = useUIStore()
  const { artifacts, selectArtifact, openCanvas } = useArtifactStore()
  const [artifactsExpanded, setArtifactsExpanded] = useState(true)

  // Filter artifacts to current conversation
  const conversationArtifacts = activeConversationId
    ? artifacts.filter((a) => a.conversationId === activeConversationId)
    : []

  const handleNewChat = () => {
    setActiveConversation(null)
  }

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Delete this conversation?')) {
      deleteConversation(id)
    }
  }

  // Group conversations by date
  const groupedConversations = groupByDate(conversations)

  // When collapsed, render nothing - the floating toggle in App.tsx handles expand
  if (sidebarCollapsed) {
    return null
  }

  return (
    <div className="w-64 bg-bg-deep border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="text-lg font-semibold text-text-primary">Jelico</div>
      </div>

      {/* New chat button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3">
        {Object.entries(groupedConversations).map(([group, convs]) => (
          <div key={group} className="mb-4">
            <div className="text-xs text-text-muted uppercase tracking-wider px-2 mb-2">
              {group}
            </div>
            {convs.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`
                  w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors group cursor-pointer
                  ${activeConversationId === conv.id
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}
                `}
              >
                <span className="truncate">{conv.title}</span>
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-error"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Artifacts section */}
      {conversationArtifacts.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setArtifactsExpanded(!artifactsExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-muted uppercase tracking-wider hover:bg-bg-hover transition-colors"
          >
            {artifactsExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Artifacts ({conversationArtifacts.length})
          </button>
          {artifactsExpanded && (
            <div className="px-3 pb-2 max-h-48 overflow-y-auto">
              {conversationArtifacts.map((artifact) => {
                const Icon = ARTIFACT_ICONS[artifact.type]
                return (
                  <button
                    key={artifact.id}
                    onClick={() => {
                      selectArtifact(artifact.id)
                      openCanvas()
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="truncate">{artifact.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => openSettings()}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  )
}

// Helper to group conversations by date
function groupByDate(conversations: any[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 24 * 60 * 60 * 1000

  const groups: Record<string, any[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  }

  for (const conv of conversations) {
    const convDate = conv.updatedAt
    if (convDate >= today) {
      groups.Today.push(conv)
    } else if (convDate >= yesterday) {
      groups.Yesterday.push(conv)
    } else if (convDate >= today - 7 * 24 * 60 * 60 * 1000) {
      groups['Previous 7 days'].push(conv)
    } else {
      groups.Older.push(conv)
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([_, convs]) => convs.length > 0)
  )
}
