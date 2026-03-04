import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Settings,
  Trash2,
  FileCode,
  FileText,
  Presentation,
  Image,
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FolderUp,
  GitFork,
  Box,
  RotateCcw,
} from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useUIStore } from '../../stores/ui'
import { useWorkspaceStore, type Workspace } from '../../stores/workspaces'
import { useArtifactStore, type ArtifactType } from '../../stores/artifacts'
import { useUpdateStore } from '../../stores/updates'
import { TransferDialog } from '../Conversations/TransferDialog'
import { JelicoLogo } from '../Brand/JelicoLogo'

type ChatConversation = ReturnType<typeof useChatStore.getState>['conversations'][number]

const ARTIFACT_ICONS: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  code: FileCode,
  document: FileText,
  html: Presentation,
  svg: Image,
  mermaid: Image,
}

// Fallback icon for unknown artifact types
const DEFAULT_ARTIFACT_ICON = File

interface ProjectGroup {
  id: string
  label: string
  path?: string
  workspaceIds: string[]
  preferredWorkspaceId: string | null
  isSandbox: boolean
  isGit: boolean
  isWorktree: boolean
  conversations: ChatConversation[]
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

function getProjectLatestUpdate(group: ProjectGroup): number {
  let latest = 0
  for (const conversation of group.conversations) {
    if (conversation.updatedAt > latest) {
      latest = conversation.updatedAt
    }
  }
  return latest
}

function getPathBasename(value: string): string {
  const parts = value.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || value
}

function buildProjectGroups(
  allConversations: ChatConversation[],
  workspaceById: Map<string, Workspace>
): ProjectGroup[] {
  const workspaceGroupsByProject = new Map<string, ProjectGroup>()

  for (const conversation of allConversations) {
    if (!conversation.workspaceId) continue
    const workspace = workspaceById.get(conversation.workspaceId)
    if (!workspace) continue

    const projectPath = workspace.projectPath || workspace.path
    const projectKey = projectPath || `workspace-${workspace.id}`
    const existingGroup = workspaceGroupsByProject.get(projectKey)

    if (!existingGroup) {
      workspaceGroupsByProject.set(projectKey, {
        id: `project-${projectKey}`,
        label: projectPath ? getPathBasename(projectPath) : workspace.name,
        path: projectPath || workspace.path,
        workspaceIds: [workspace.id],
        preferredWorkspaceId: workspace.isWorktree ? null : workspace.id,
        isSandbox: false,
        isGit: workspace.isGit,
        isWorktree: workspace.isWorktree === true,
        conversations: [conversation],
      })
      continue
    }

    if (!existingGroup.workspaceIds.includes(workspace.id)) {
      existingGroup.workspaceIds.push(workspace.id)
    }
    if (!existingGroup.preferredWorkspaceId && !workspace.isWorktree) {
      existingGroup.preferredWorkspaceId = workspace.id
    }

    existingGroup.isGit = existingGroup.isGit || workspace.isGit
    existingGroup.isWorktree = existingGroup.isWorktree || workspace.isWorktree === true
    existingGroup.conversations.push(conversation)
  }

  const workspaceGroups = Array.from(workspaceGroupsByProject.values()).map((group) => ({
    ...group,
    conversations: [...group.conversations].sort((a, b) => b.updatedAt - a.updatedAt),
  }))

  workspaceGroups.sort((a, b) => getProjectLatestUpdate(b) - getProjectLatestUpdate(a))

  const sandboxConversations = allConversations.filter((conversation) => !conversation.workspaceId)
  if (sandboxConversations.length === 0) {
    return workspaceGroups
  }

  return [
    ...workspaceGroups,
    {
      id: 'sandbox',
      label: 'Sandbox',
      workspaceIds: [],
      preferredWorkspaceId: null,
      isSandbox: true,
      isGit: false,
      isWorktree: false,
      conversations: sandboxConversations,
    },
  ]
}

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    loadConversations,
    conversationStreams,
  } = useChatStore()
  const { sidebarCollapsed, openSettings } = useUIStore()
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore()
  const { artifacts, selectArtifact, openCanvas } = useArtifactStore()
  const updateAvailable = useUpdateStore((state) => state.info?.isUpdateAvailable)
  // Track which project groups are expanded (persisted to localStorage)
  const SIDEBAR_COLLAPSED_KEY = 'jelico:sidebar:collapsed-groups'
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    // On mount, we don't know which groups exist yet — start empty.
    // The auto-expand effect will populate from persisted state.
    return new Set<string>()
  })
  // IDs of groups the user has explicitly collapsed (persisted)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })
  // Track which conversations have their artifact trees expanded
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())
  const [archivedConversations, setArchivedConversations] = useState<ChatConversation[]>([])
  const [expandedArchivedProjects, setExpandedArchivedProjects] = useState<Set<string>>(new Set())
  // Transfer dialog state
  const [transferDialogConv, setTransferDialogConv] = useState<{ id: string; title: string; workspaceId: string | null } | null>(null)

  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  )

  const projectGroups = useMemo<ProjectGroup[]>(
    () => buildProjectGroups(conversations, workspaceById),
    [conversations, workspaceById]
  )

  const archivedProjectGroups = useMemo<ProjectGroup[]>(
    () => buildProjectGroups(archivedConversations, workspaceById),
    [archivedConversations, workspaceById]
  )

  const refreshArchivedConversations = async () => {
    try {
      const archived = await window.jelico.conversations.listArchived()
      setArchivedConversations(archived)
    } catch (error) {
      console.error('Failed to load archived conversations:', error)
    }
  }

  useEffect(() => {
    void refreshArchivedConversations()
  }, [])

  useEffect(() => {
    void refreshArchivedConversations()
  }, [conversations.length])

  // Auto-expand project groups the first time they appear, respecting persisted collapsed state
  useEffect(() => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      let changed = false

      for (const group of projectGroups) {
        if (!next.has(group.id) && !collapsedGroups.has(group.id)) {
          next.add(group.id)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [projectGroups, collapsedGroups])

  useEffect(() => {
    setExpandedArchivedProjects((prev) => {
      const next = new Set(prev)
      let changed = false

      for (const group of archivedProjectGroups) {
        if (!next.has(group.id)) {
          next.add(group.id)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [archivedProjectGroups])

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

  // Toggle project group expansion (persists collapsed state to localStorage)
  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
    // Persist collapsed state
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId) // expanding → remove from collapsed
      } else {
        next.add(projectId) // collapsing → add to collapsed
      }
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify([...next]))
      } catch { /* localStorage full or unavailable */ }
      return next
    })
  }

  const toggleArchivedProject = (projectId: string) => {
    setExpandedArchivedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

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

  const handleNewChatInProject = (group: ProjectGroup) => {
    if (group.isSandbox || group.workspaceIds.length === 0) {
      setActiveWorkspace(null, true)
      setActiveConversation(null)
      return
    }

    const selectedWorkspaceId = (
      (activeWorkspaceId && group.workspaceIds.includes(activeWorkspaceId)) ? activeWorkspaceId :
        group.preferredWorkspaceId || group.workspaceIds[0]
    ) ?? null

    setActiveWorkspace(selectedWorkspaceId, true)
    setActiveConversation(null)
  }

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Archive this conversation? You can restore it later from Archived.')) {
      await deleteConversation(id)
      await refreshArchivedConversations()
    }
  }

  const handleRestoreConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await window.jelico.conversations.restore(id)
      await loadConversations()
      await refreshArchivedConversations()
    } catch (error) {
      console.error('Failed to restore conversation:', error)
    }
  }

  const handlePermanentDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Permanently delete this archived conversation? This cannot be undone.')) {
      return
    }

    try {
      await useArtifactStore.getState().clearConversationArtifacts(id)
      try {
        await window.jelico.sandbox.clear(id)
      } catch {
        // Conversation may not have sandbox files.
      }
      try {
        await window.jelico.todos.deleteByConversation(id)
      } catch {
        // Ignore missing todo persistence edge-cases.
      }
      await window.jelico.conversations.delete(id)
      await loadConversations()
      await refreshArchivedConversations()
    } catch (error) {
      console.error('Failed to permanently delete archived conversation:', error)
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

  // When collapsed, render nothing - the floating toggle in App.tsx handles expand
  if (sidebarCollapsed) {
    return null
  }

  return (
    <div
      className="w-64 bg-bg-surface border-r border-border flex flex-col"
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

      {/* Conversation list by project/workspace */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="text-xs text-text-muted uppercase tracking-wider px-2 mb-2">
          Projects
        </div>

        {projectGroups.length === 0 && (
          <div className="px-2 py-4 text-xs text-text-muted">No chats yet.</div>
        )}

        {projectGroups.map((group) => {
          const isExpanded = expandedProjects.has(group.id)
          const isActiveProject = Boolean(
            activeWorkspaceId && group.workspaceIds.includes(activeWorkspaceId)
          )
          const GroupIcon = group.isSandbox
            ? Box
            : Folder

          return (
            <div key={group.id} className="mb-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleProject(group.id)}
                  style={{ marginLeft: '-0.75rem' }}
                  className={`
                    flex-1 min-w-0 flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-l-none rounded-r-md text-left transition-colors
                    ${isActiveProject
                      ? 'bg-bg-elevated text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}
                  `}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-3 h-3 flex-shrink-0 text-text-muted" />
                  )}
                  <GroupIcon className="w-4 h-4 flex-shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">
                      {group.isSandbox ? group.label : `/${group.label}`}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleNewChatInProject(group)}
                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                  title={`New chat in ${group.label}`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {isExpanded && (
                <div className="ml-5 mt-1 border-l border-border/50 pl-2">
                  {group.conversations.map((conv) => {
                    const convArtifacts = getArtifactsForConversation(conv.id)
                    const hasArtifacts = convArtifacts.length > 0
                    const hasExpandableContent = hasArtifacts
                    const isConversationExpanded = expandedConversations.has(conv.id)
                    const isActiveConversation = activeConversationId === conv.id
                    const isSandboxConversation = !conv.workspaceId
                    const isProcessing = conversationStreams[conv.id]?.isStreaming === true
                    const conversationWorkspace = conv.workspaceId ? workspaceById.get(conv.workspaceId) : undefined
                    const isWorktreeConversation = conversationWorkspace?.isWorktree === true
                    const daysOld = getDaysOld(conv.createdAt)

                    return (
                      <div key={conv.id} className="mb-1 last:mb-0">
                        <div
                          onClick={() => setActiveConversation(conv.id)}
                          title={formatCreatedDate(conv.createdAt)}
                          style={{
                            width: 'calc(100% + 0.75rem)',
                            marginRight: '-0.75rem',
                          }}
                          className={`
                            flex items-center gap-2 pl-2 pr-5 py-1.5 text-sm rounded-l-md rounded-r-none transition-colors group cursor-pointer sidebar-conversation-row
                            ${isActiveConversation
                              ? 'bg-bg-elevated text-text-primary border-l-2 border-accent'
                              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border-l-2 border-transparent'}
                            ${isProcessing && !isActiveConversation ? 'bg-bg-elevated/70 text-text-primary' : ''}
                            ${isProcessing ? 'sidebar-conversation-processing' : ''}
                          `}
                        >
                          {hasExpandableContent ? (
                            <button
                              onClick={(e) => toggleConversationArtifacts(e, conv.id)}
                              className="p-0.5 -ml-1 hover:bg-bg-hover rounded transition-colors flex-shrink-0"
                            >
                              {isConversationExpanded ? (
                                <ChevronDown className="w-3 h-3 text-text-muted" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-text-muted" />
                              )}
                            </button>
                          ) : (
                            <div className="w-4 flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="break-words">{conv.title}</span>
                          </div>

                          {isWorktreeConversation && (
                            <GitFork className="w-3 h-3 text-accent flex-shrink-0" />
                          )}

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

                        {hasExpandableContent && isConversationExpanded && (
                          <div className="ml-6 pl-2 border-l border-border/40 mt-1 mb-2">
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
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        await setActiveConversation(conv.id)
                                        selectArtifact(artifact.id)
                                        openCanvas()
                                      } catch (error) {
                                        console.error('Failed to open artifact from sidebar:', error)
                                      }
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
              )}
            </div>
          )
        })}

        {archivedProjectGroups.length > 0 && (
          <div className="mt-5 pt-3 border-t border-border/60">
            <div className="text-xs text-text-muted uppercase tracking-wider px-2 mb-2">
              Archived
            </div>

            {archivedProjectGroups.map((group) => {
              const isExpanded = expandedArchivedProjects.has(group.id)
              const GroupIcon = group.isSandbox ? Box : Folder

              return (
                <div key={`archived-${group.id}`} className="mb-2">
                  <button
                    onClick={() => toggleArchivedProject(group.id)}
                    style={{ marginLeft: '-0.75rem' }}
                    className="w-full flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-l-none rounded-r-md text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 flex-shrink-0 text-text-muted" />
                    ) : (
                      <ChevronRight className="w-3 h-3 flex-shrink-0 text-text-muted" />
                    )}
                    <GroupIcon className="w-4 h-4 flex-shrink-0 text-text-muted" />
                    <span className="text-sm truncate">
                      {group.isSandbox ? group.label : `/${group.label}`}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="ml-5 mt-1 border-l border-border/50 pl-2">
                      {group.conversations.map((conv) => (
                        <div
                          key={`archived-conv-${conv.id}`}
                          title={formatCreatedDate(conv.createdAt)}
                          style={{
                            width: 'calc(100% + 0.75rem)',
                            marginRight: '-0.75rem',
                          }}
                          className="group flex items-center gap-2 pl-2 pr-5 py-1.5 text-sm rounded-l-md rounded-r-none text-text-muted hover:text-text-primary hover:bg-bg-hover"
                        >
                          <div className="w-4 flex-shrink-0" />
                          <span className="flex-1 min-w-0 break-words">{conv.title}</span>
                          <button
                            onClick={(e) => handleRestoreConversation(e, conv.id)}
                            title="Restore conversation"
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-accent flex-shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handlePermanentDeleteConversation(e, conv.id)}
                            title="Permanently delete"
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-error flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
