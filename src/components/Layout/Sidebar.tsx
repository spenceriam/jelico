import { useState, useEffect } from 'react'
import { Plus, Settings, Trash2, FileCode, FileText, Presentation, Image, ChevronDown, ChevronRight, File, FolderOpen, FolderUp } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useUIStore } from '../../stores/ui'
import { useArtifactStore, type ArtifactType } from '../../stores/artifacts'
import { useSandboxStore } from '../../stores/sandbox'
import { TransferDialog } from '../Conversations/TransferDialog'
import { BrailleLoader } from '../StatusIndicators'

const ARTIFACT_ICONS: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  code: FileCode,
  document: FileText,
  html: Presentation,
  svg: Image,
  mermaid: Image,
}

// Fallback icon for unknown artifact types
const DEFAULT_ARTIFACT_ICON = File

// Get icon for file extension
function getFileIcon(ext?: string): React.ComponentType<{ className?: string }> {
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
      return FileCode
    case 'md':
    case 'txt':
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return FileText
    case 'html':
    case 'htm':
    case 'css':
    case 'scss':
      return Presentation
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return Image
    default:
      return File
  }
}

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
  const { loadFiles: loadSandboxFiles } = useSandboxStore()
  // Track which conversations have their artifact trees expanded
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())
  // Track sandbox file counts per conversation (flat list for sidebar display)
  const [sandboxFileCounts, setSandboxFileCounts] = useState<Record<string, string[]>>({})
  // Transfer dialog state
  const [transferDialogConv, setTransferDialogConv] = useState<{ id: string; title: string; workspaceId: string | null } | null>(null)

  // Load sandbox files for all conversations on mount
  useEffect(() => {
    const loadAllSandboxFiles = async () => {
      const fileCounts: Record<string, string[]> = {}
      for (const conv of conversations) {
        try {
          const convFiles = await window.jelico.sandbox.listFiles(conv.id)
          if (convFiles.length > 0) {
            fileCounts[conv.id] = convFiles
          }
        } catch {
          // Ignore errors
        }
      }
      setSandboxFileCounts(fileCounts)
    }
    loadAllSandboxFiles()
  }, [conversations])

  // Reload sandbox files for active conversation when it changes
  useEffect(() => {
    if (!activeConversationId) return
    const refreshSandbox = async () => {
      try {
        const files = await window.jelico.sandbox.listFiles(activeConversationId)
        setSandboxFileCounts(prev => ({
          ...prev,
          [activeConversationId]: files,
        }))
        // Also load structured data for potential future use
        loadSandboxFiles(activeConversationId)
      } catch {
        // Ignore errors
      }
    }
    refreshSandbox()
  }, [activeConversationId, loadSandboxFiles])

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

  const handleOpenTransferDialog = (e: React.MouseEvent, conv: { id: string; title: string; workspaceId?: string | null }) => {
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
              const convSandboxFileList = sandboxFileCounts[conv.id] || []
              const hasArtifacts = convArtifacts.length > 0
              const hasSandboxFiles = convSandboxFileList.length > 0
              const hasExpandableContent = hasArtifacts || hasSandboxFiles
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
                    {/* Expand/collapse toggle for artifacts/sandbox */}
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

                  {/* Expandable sub-tree (artifacts with sandbox files indented beneath) */}
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
                            {isSandboxConversation ? (
                              <button
                                onClick={(e) => handleOpenTransferDialog(e, conv)}
                                title="Move to workspace..."
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-accent flex-shrink-0"
                              >
                                <FolderUp className="w-3 h-3" />
                              </button>
                            ) : (
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
                            )}
                          </div>
                        )
                      })}

                      {/* Sandbox files - indented under artifacts */}
                      {hasSandboxFiles && (
                        <div className="ml-3 mt-1">
                          {convSandboxFileList.slice(0, 10).map((filePath) => {
                            const fileName = filePath.split('/').pop() || filePath
                            const ext = fileName.split('.').pop()?.toLowerCase()
                            const Icon = getFileIcon(ext)
                            return (
                              <button
                                key={filePath}
                                onClick={async () => {
                                  setActiveConversation(conv.id)
                                  // Open sandbox file in a viewer (could integrate with Canvas or external editor)
                                  const sandboxPath = await window.jelico.sandbox.getConversationPath(conv.id)
                                  console.log(`Opening sandbox file: ${sandboxPath}/${filePath}`)
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1 text-xs text-text-faint hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                                title={filePath}
                              >
                                <Icon className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{fileName}</span>
                              </button>
                            )
                          })}
                          {convSandboxFileList.length > 10 && (
                            <div className="text-[10px] text-text-faint px-2 py-1">
                              +{convSandboxFileList.length - 10} more files
                            </div>
                          )}
                        </div>
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
            // Refresh conversations to get updated workspace assignment
            // The chat store should handle this automatically via its list method
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
