import { useState, useEffect } from 'react'
import { Plus, Settings, Trash2, FileCode, FileText, Presentation, Image, ChevronDown, ChevronRight, File, FolderOpen, FolderUp } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useUIStore } from '../../stores/ui'
import { useArtifactStore, type ArtifactType } from '../../stores/artifacts'
import { useUpdateStore } from '../../stores/updates'
import { TransferDialog } from '../Conversations/TransferDialog'
import { BrailleLoader } from '../StatusIndicators'
import { JelicoLogo } from '../Brand/JelicoLogo'

const ARTIFACT_ICONS: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  code: FileCode,
  document: FileText,
  html: Presentation,
  svg: Image,
  mermaid: Image,
}

// Fallback icon for unknown artifact types
const DEFAULT_ARTIFACT_ICON = File

// Format date for tooltip
function formatCreatedDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isToday) {
    return `Created today at ${timeStr}`
  } else if (isYesterday) {
    return `Created yesterday at ${timeStr}`
  } else {
    return `Created ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`
  }
}

// Calculate days old for a timestamp
function getDaysOld(timestamp: number): number {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

export function Sidebar() {
  const { conversations, activeConversationId, setActiveConversation, deleteConversation, conversationStreams } = useChatStore()
  const { sidebarCollapsed, openSettings } = useUIStore()
  const { artifacts, selectArtifact, openCanvas } = useArtifactStore()
  const updateAvailable = useUpdateStore((state) => state.info?.isUpdateAvailable)
  // Track which conversations have their artifact trees expanded
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())
  // Transfer dialog state
  const [transferDialogConv, setTransferDialogConv] = useState<{ id: string; title: string; workspaceId: string | null } | null>(null)

  // Auto-expand artifact tree for active conversation
  useEffect(() => {
    if (activeConversationId) {
      setExpandedConversations(prev => {
        if (prev.has(activeConversationId)) return prev
        const next = new Set(prev)
        next.add(activeConversationId)
        return next
      })
    }
  }, [activeConversationId])

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

  const handleOpenTransferDialog = (
    e: React.MouseEvent,
    conv: { id: string; title: string; workspaceId?: string | null }
  ) => {
    e.stopPropagation()
    setTransferDialogConv({
      id: conv.id,
      title: conv.title,
      workspaceId: conv.workspaceId || null,
    })
  }

  // Group conversations by date
  const groupedConversations = groupByDate(conversations)

  // When collapsed, render nothing - the floating toggle in App.tsx handles expand
  if (sidebarCollapsed) {
    return null
  }

  return (
    <div
      className="w-64 bg-bg-deep border-r border-border flex flex-col"
      style={{ paddingTop: 'var(--titlebar-padding)' }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <JelicoLogo size={22} className="w-[22px] h-[22px] flex-shrink-0" />
          <div className="font-display text-xl font-normal text-text-primary tracking-tight">Jelico</div>
        </div>
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
              const hasExpandableContent = hasArtifacts
              const isExpanded = expandedConversations.has(conv.id)
              const isActive = activeConversationId === conv.id
              const isSandboxConversation = !conv.workspaceId
              const isProcessing = conversationStreams[conv.id]?.isStreaming === true

              const daysOld = getDaysOld(conv.createdAt)

              return (
                <div key={conv.id}>
                  {/* Conversation entry */}
                  <div
                    onClick={() => setActiveConversation(conv.id)}
                    title={formatCreatedDate(conv.createdAt)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors group cursor-pointer
                      ${isActive
                        ? 'bg-bg-elevated text-text-primary border-l-2 border-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border-l-2 border-transparent'}
                    `}
                  >
                    {/* Expand/collapse toggle for artifacts */}
                    {hasExpandableContent ? (
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
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      {isProcessing && (
                        <BrailleLoader className="text-xs text-accent flex-shrink-0" />
                      )}
                      <span className="break-words">{conv.title}</span>
                    </div>
                    {/* Days old badge (only for chats 2+ days old) */}
                    {daysOld >= 2 && (
                      <span className="text-[10px] text-text-faint tabular-nums mr-1">
                        {daysOld}d
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-error flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Expandable sub-tree (artifacts) */}
                  {hasExpandableContent && isExpanded && (
                    <div className="ml-6 pl-2 border-l border-border/50 mt-1 mb-2">
                      {/* Artifacts section */}
                      {hasArtifacts && (
                        <div className="text-[10px] text-text-faint uppercase tracking-wider mb-1">Artifacts</div>
                      )}
                      {convArtifacts.map((artifact) => {
                        const Icon = ARTIFACT_ICONS[artifact.type] || DEFAULT_ARTIFACT_ICON
                        return (
                          <div
                            key={artifact.id}
                            className="group flex items-center gap-2 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                          >
                            <button
                              onClick={() => {
                                setActiveConversation(conv.id)
                                selectArtifact(artifact.id)
                                openCanvas()
                              }}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            >
                              <Icon className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{artifact.title}</span>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await window.jelico.artifacts.reveal(artifact.id)
                                } catch (error) {
                                  console.error('Failed to reveal artifact:', error)
                                }
                              }}
                              title="Reveal in folder"
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-accent flex-shrink-0"
                            >
                              <FolderOpen className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}

                      {isSandboxConversation && (
                        <button
                          onClick={(e) => handleOpenTransferDialog(e, conv)}
                          className="mt-2 w-full flex items-center gap-2 py-1.5 text-xs text-accent hover:text-accent hover:bg-bg-hover rounded transition-colors"
                        >
                          <FolderUp className="w-3 h-3 flex-shrink-0" />
                          <span>Transfer to Workspace</span>
                        </button>
                      )}
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
          {updateAvailable && (
            <span className="ml-auto w-2 h-2 bg-accent rounded-full" />
          )}
        </button>
      </div>

      {/* Transfer Dialog */}
      {transferDialogConv && (
        <TransferDialog
          conversationId={transferDialogConv.id}
          conversationTitle={transferDialogConv.title}
          currentWorkspaceId={transferDialogConv.workspaceId}
          onClose={() => setTransferDialogConv(null)}
          onTransferComplete={() => {
            // Chat/workspace state is refreshed by the dialog after transfer
          }}
        />
      )}
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
    Earlier: [], // Combined group - individual chats show Xd badge
  }

  for (const conv of conversations) {
    const convDate = conv.updatedAt
    if (convDate >= today) {
      groups.Today.push(conv)
    } else if (convDate >= yesterday) {
      groups.Yesterday.push(conv)
    } else {
      // All older chats go into "Earlier" - badge shows specific age
      groups.Earlier.push(conv)
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([_, convs]) => convs.length > 0)
  )
}
