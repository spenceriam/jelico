import { useState } from 'react'
import { Plus, Settings, Trash2, FileCode, FileText, Presentation, Image, ChevronDown, ChevronRight, File } from 'lucide-react'
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

// Fallback icon for unknown artifact types
const DEFAULT_ARTIFACT_ICON = File

export function Sidebar() {
  const { conversations, activeConversationId, setActiveConversation, deleteConversation } = useChatStore()
  const { sidebarCollapsed, openSettings } = useUIStore()
  const { artifacts, selectArtifact, openCanvas } = useArtifactStore()
  // Track which conversations have their artifact trees expanded
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())

  // Get artifacts grouped by conversation
  const getArtifactsForConversation = (convId: string) =>
    artifacts.filter((a) => a.conversationId === convId)

  // Toggle artifact tree for a conversation
  const toggleConversationArtifacts = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation()
    setExpandedConversations(prev => {
      const next = new Set(prev)
      if (next.has(convId)) {
        next.delete(convId)
      } else {
        next.add(convId)
      }
      return next
    })
  }

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
      <div className="p-4">
        <div className="font-display text-xl font-normal text-text-primary tracking-tight">Jelico</div>
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
        {Object.entries(groupedConversations).map(([group, convs], index) => (
          <div key={group} className="mb-4">
            {/* Divider between date groups (not before the first one) */}
            {index > 0 && (
              <div className="mx-4 mb-3 border-t border-border/50" />
            )}
            <div className="text-xs text-text-muted uppercase tracking-wider px-2 mb-2">
              {group}
            </div>
            {convs.map((conv) => {
              const convArtifacts = getArtifactsForConversation(conv.id)
              const hasArtifacts = convArtifacts.length > 0
              const isExpanded = expandedConversations.has(conv.id)
              const isActive = activeConversationId === conv.id

              return (
                <div key={conv.id}>
                  {/* Conversation entry */}
                  <div
                    onClick={() => setActiveConversation(conv.id)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors group cursor-pointer
                      ${isActive
                        ? 'bg-bg-elevated text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}
                    `}
                  >
                    {/* Expand/collapse toggle for artifacts */}
                    {hasArtifacts ? (
                      <button
                        onClick={(e) => toggleConversationArtifacts(e, conv.id)}
                        className="p-0.5 -ml-1 hover:bg-bg-hover rounded transition-colors flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-text-muted" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-text-muted" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4 flex-shrink-0" /> /* Spacer for alignment */
                    )}
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-error flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Artifact sub-tree (collapsed by default) */}
                  {hasArtifacts && isExpanded && (
                    <div className="ml-6 pl-2 border-l border-border/50 mt-1 mb-2">
                      {convArtifacts.map((artifact) => {
                        const Icon = ARTIFACT_ICONS[artifact.type] || DEFAULT_ARTIFACT_ICON
                        return (
                          <button
                            key={artifact.id}
                            onClick={() => {
                              setActiveConversation(conv.id)
                              selectArtifact(artifact.id)
                              openCanvas()
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                          >
                            <Icon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{artifact.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="p-3">
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
