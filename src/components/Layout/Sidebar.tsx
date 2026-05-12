import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  Settings,
  Archive,
  AlertTriangle,
  HelpCircle,
  Check,
  X,
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
} from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useAgentStore } from '../../stores/agents'
import { useClarificationStore } from '../../stores/clarification'
import { useUIStore } from '../../stores/ui'
import { useWorkspaceStore, type Workspace } from '../../stores/workspaces'
import { useArtifactStore, type ArtifactType } from '../../stores/artifacts'
import { useToastStore } from '../../stores/toasts'
import { useUpdateStore } from '../../stores/updates'
import { TransferDialog } from '../Conversations/TransferDialog'
import { ContextMenu, type ContextMenuItem } from '../Common/ContextMenu'
import { buildConversationLog } from '../../lib/conversationLog'
import {
  CONVERSATION_SIDEBAR_STATUS_ORDER,
  getConversationSidebarStatus,
  getConversationSidebarStatusMeta,
  type ConversationSidebarStatus,
} from '../../lib/conversationSidebarStatus'
import sidebarBrandUrl from '../../assets/branding/jelico-icon-v2-transparent.png'

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
  isOrphan: boolean
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
  const orphanConversations: ChatConversation[] = []

  for (const conversation of allConversations) {
    if (!conversation.workspaceId) continue
    const workspace = workspaceById.get(conversation.workspaceId)
    if (!workspace) {
      orphanConversations.push(conversation)
      continue
    }

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
        isOrphan: false,
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

  const groupedConversations: ProjectGroup[] = [...workspaceGroups]

  const sandboxConversations = allConversations.filter((conversation) => !conversation.workspaceId)
  if (sandboxConversations.length > 0) {
    groupedConversations.push({
      id: 'sandbox',
      label: 'Sandbox',
      workspaceIds: [],
      preferredWorkspaceId: null,
      isSandbox: true,
      isOrphan: false,
      isGit: false,
      isWorktree: false,
      conversations: sandboxConversations,
    })
  }

  if (orphanConversations.length > 0) {
    groupedConversations.push({
      id: 'orphaned',
      label: 'Orphaned',
      workspaceIds: [],
      preferredWorkspaceId: null,
      isSandbox: false,
      isOrphan: true,
      isGit: false,
      isWorktree: false,
      conversations: orphanConversations.sort((a, b) => b.updatedAt - a.updatedAt),
    })
  }

  groupedConversations.sort((a, b) => getProjectLatestUpdate(b) - getProjectLatestUpdate(a))
  return groupedConversations
}

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    archiveConversation,
    conversationStreams,
    interruptedConversations,
    conversationErrors,
  } = useChatStore()
  const agents = useAgentStore((state) => state.agents)
  const clarificationRequestsByConversation = useClarificationStore((state) => state.requestsByConversation)
  const { sidebarCollapsed, openSettings } = useUIStore()
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore()
  const { artifacts, selectArtifact, openCanvas } = useArtifactStore()
  const addToast = useToastStore((state) => state.addToast)
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
  const [archiveConfirmConversationId, setArchiveConfirmConversationId] = useState<string | null>(null)
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
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

  const agentStateByConversation = useMemo(() => {
    const next = new Map<string, { hasRunning: boolean; hasPending: boolean; hasWaiting: boolean; hasFailed: boolean }>()

    for (const agent of agents) {
      if (!agent.conversationId) continue

      const current = next.get(agent.conversationId) || {
        hasRunning: false,
        hasPending: false,
        hasWaiting: false,
        hasFailed: false,
      }

      if (agent.status === 'running') current.hasRunning = true
      if (agent.status === 'pending') current.hasPending = true
      if (agent.status === 'waiting_for_input') current.hasWaiting = true
      if (
        agent.status === 'failed' &&
        (interruptedConversations[agent.conversationId] || conversationErrors[agent.conversationId])
      ) {
        current.hasFailed = true
      }

      next.set(agent.conversationId, current)
    }

    return next
  }, [agents, conversationErrors, interruptedConversations])

  const conversationStatusById = useMemo(() => {
    const next = new Map<string, ConversationSidebarStatus>()

    for (const conversation of conversations) {
      const agentState = agentStateByConversation.get(conversation.id)
      next.set(
        conversation.id,
        getConversationSidebarStatus({
          isStreaming: conversationStreams[conversation.id]?.isStreaming === true,
          hasRunningAgent: agentState?.hasRunning === true,
          hasPendingAgent: agentState?.hasPending === true,
          hasWaitingAgent: agentState?.hasWaiting === true,
          hasClarificationRequest: Boolean(clarificationRequestsByConversation[conversation.id]),
          hasInterruptedStream: Boolean(interruptedConversations[conversation.id]),
          hasFailedAgent: agentState?.hasFailed === true,
          hasConversationError: Boolean(conversationErrors[conversation.id]),
        })
      )
    }

    return next
  }, [
    agentStateByConversation,
    clarificationRequestsByConversation,
    conversationErrors,
    conversationStreams,
    conversations,
    interruptedConversations,
  ])

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
    setArchiveConfirmConversationId(null)
    setActiveConversation(null)
  }

  const handleNewChatInProject = (group: ProjectGroup) => {
    setArchiveConfirmConversationId(null)
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
    setArchiveConfirmConversationId((current) => current === id ? null : id)
  }

  const handleConfirmArchiveConversation = async (
    e: React.MouseEvent,
    conv: { id: string; title: string }
  ) => {
    e.stopPropagation()
    setArchiveConfirmConversationId(null)

    try {
      await archiveConversation(conv.id)
      addToast({
        title: 'Chat archived',
        description: conv.title,
        variant: 'success',
        durationMs: 3600,
      })
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : 'Failed to archive chat.'
      addToast({
        title: 'Archive failed',
        description: message,
        variant: 'error',
        durationMs: 4200,
      })
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

  const collectLogs = async (conv: ChatConversation, action: 'copy' | 'save') => {
    try {
      const conversation = await window.jelico.conversations.get(conv.id)
      if (!conversation) throw new Error('Conversation not found')
      const rows = await window.jelico.artifacts.getByConversation(conv.id)
      const log = buildConversationLog({
        conversation,
        artifacts: rows.map((row: any) => ({
          id: row.id,
          conversationId: row.conversation_id || undefined,
          type: row.type,
          title: row.title,
          content: row.content,
          language: row.language || undefined,
          filePath: row.file_path || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          baseArtifactId: row.base_artifact_id || undefined,
          revision: row.revision || 1,
        })),
      })

      if (action === 'copy') {
        await window.jelico.logs.copyConversationLog(log)
        addToast({ title: 'Log copied', description: conv.title, variant: 'success', durationMs: 3200 })
      } else {
        const fileName = `${conv.title || 'jelico-conversation'}`
          .replace(/[<>:"/\\|?*]+/g, '-')
          .slice(0, 80) + '.md'
        const result = await window.jelico.logs.saveConversationLog(fileName, log)
        if (!result.canceled) {
          addToast({ title: 'Log saved', description: result.filePath || conv.title, variant: 'success', durationMs: 3200 })
        }
      }
    } catch (error) {
      addToast({
        title: 'Collect logs failed',
        description: error instanceof Error ? error.message : 'Unable to collect logs.',
        variant: 'error',
        durationMs: 4200,
      })
    }
  }

  const submitRename = async (convId: string, value: string) => {
    const next = value.trim()
    setRenamingConvId(null)
    if (!next) return
    await window.jelico.conversations.updateTitle(convId, next)
    await useChatStore.getState().loadConversations()
  }

  const openConversationContextMenu = (event: React.MouseEvent, conv: ChatConversation) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: 'Open Chat', onClick: () => setActiveConversation(conv.id) },
        {
          label: 'Rename',
          onClick: () => {
            setRenameValue(conv.title)
            setRenamingConvId(conv.id)
            requestAnimationFrame(() => {
              renameInputRef.current?.select()
            })
          },
        },
        { label: 'Copy Logs', onClick: () => void collectLogs(conv, 'copy') },
        { label: 'Save Logs...', onClick: () => void collectLogs(conv, 'save') },
        {
          label: 'Transfer to Workspace',
          disabled: Boolean(conv.workspaceId),
          onClick: () => setTransferDialogConv({ id: conv.id, title: conv.title, workspaceId: conv.workspaceId || null }),
        },
        { label: 'Archive', danger: true, onClick: () => setArchiveConfirmConversationId(conv.id) },
      ],
    })
  }

  const openArtifactContextMenu = (event: React.MouseEvent, conv: ChatConversation, artifact: ReturnType<typeof getArtifactsForConversation>[number]) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          label: 'Open in Canvas',
          onClick: async () => {
            await setActiveConversation(conv.id)
            selectArtifact(artifact.id)
            openCanvas()
          },
        },
        {
          label: 'Reference in Prompt',
          onClick: () => window.dispatchEvent(new CustomEvent('jelico:reference-artifact', {
            detail: { id: artifact.id, title: artifact.title, type: artifact.type },
          })),
        },
        { label: 'Reveal in Folder', onClick: () => void window.jelico.artifacts.reveal(artifact.id) },
        {
          label: 'Delete',
          danger: true,
          onClick: () => {
            if (!window.confirm(`Delete artifact "${artifact.title}"?`)) return
            void useArtifactStore.getState().removeArtifact(artifact.id)
          },
        },
      ],
    })
  }

  useEffect(() => {
    if (!archiveConfirmConversationId) return
    if (conversations.some((conversation) => conversation.id === archiveConfirmConversationId)) return
    setArchiveConfirmConversationId(null)
  }, [archiveConfirmConversationId, conversations])

  // When collapsed, render nothing - the floating toggle in App.tsx handles expand
  if (sidebarCollapsed) {
    return null
  }

  return (
    <div className="pane-surface relative w-64 border-r border-border flex flex-col">

      {/* Header */}
      <div className="p-4">
        <img
          src={sidebarBrandUrl}
          alt="Jelico"
          draggable={false}
          className="h-[3.9rem] w-auto max-w-[332px] object-contain"
        />
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
          const GroupIcon = group.isOrphan
            ? AlertTriangle
            : group.isSandbox
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
                      {group.isSandbox || group.isOrphan ? group.label : `/${group.label}`}
                    </div>
                  </div>
                </button>

                {!group.isOrphan && (
                  <button
                    onClick={() => handleNewChatInProject(group)}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                    title={`New chat in ${group.label}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="ml-5 mt-1 border-l border-border-strong pl-2">
                  {CONVERSATION_SIDEBAR_STATUS_ORDER.map((status) => {
                    const sectionConversations = group.conversations.filter(
                      (conversation) => conversationStatusById.get(conversation.id) === status
                    )

                    if (sectionConversations.length === 0) return null

                    const statusMeta = getConversationSidebarStatusMeta(status)

                    return (
                      <div key={status} className="mb-2 last:mb-0">
                        <div className="mb-1 flex items-center justify-between px-2 text-[10px] uppercase tracking-[0.18em] text-text-faint">
                          <span>{statusMeta.sectionLabel}</span>
                          <span>{sectionConversations.length}</span>
                        </div>

                        {sectionConversations.map((conv) => {
                          const convArtifacts = getArtifactsForConversation(conv.id)
                          const hasArtifacts = convArtifacts.length > 0
                          const hasExpandableContent = hasArtifacts
                          const isConversationExpanded = expandedConversations.has(conv.id)
                          const isActiveConversation = activeConversationId === conv.id
                          const isSandboxConversation = !conv.workspaceId
                          const conversationWorkspace = conv.workspaceId ? workspaceById.get(conv.workspaceId) : undefined
                          const isWorktreeConversation = conversationWorkspace?.isWorktree === true
                          const daysOld = getDaysOld(conv.createdAt)
                          const isArchiveConfirming = archiveConfirmConversationId === conv.id
                          const conversationStatus = conversationStatusById.get(conv.id) || 'done'
                          const conversationStatusMeta = getConversationSidebarStatusMeta(conversationStatus)
                          const isConversationProcessing = conversationStatus === 'in_progress'

                          return (
                            <div key={conv.id} className="mb-1 last:mb-0">
                              <div
                                onClick={() => {
                                  if (isArchiveConfirming) return
                                  setArchiveConfirmConversationId(null)
                                  setActiveConversation(conv.id)
                                }}
                                onContextMenu={(event) => openConversationContextMenu(event, conv)}
                                title={formatCreatedDate(conv.createdAt)}
                                style={{
                                  width: 'calc(100% + 0.75rem)',
                                  marginRight: '-0.75rem',
                                }}
                                className={`
                                  flex items-center gap-2 pl-2 pr-3 py-1.5 text-sm rounded-l-none rounded-r-none transition-colors group sidebar-conversation-row
                                  ${isArchiveConfirming ? 'sidebar-conversation-archive-confirm cursor-default text-text-primary border-l-2 border-warning/60' : ''}
                                  ${!isArchiveConfirming && isActiveConversation
                                    ? 'text-text-primary border-l-2 border-accent cursor-pointer'
                                    : ''}
                                  ${!isArchiveConfirming && !isActiveConversation
                                    ? 'text-text-secondary hover:text-text-primary border-l-2 border-transparent cursor-pointer'
                                    : ''}
                                  ${!isArchiveConfirming ? `sidebar-conversation-status-${conversationStatus}` : ''}
                                  ${!isArchiveConfirming && isConversationProcessing ? 'sidebar-conversation-processing' : ''}
                                `}
                              >
                                {hasExpandableContent ? (
                                  <button
                                    onClick={(e) => toggleConversationArtifacts(e, conv.id)}
                                    className="p-0.5 -ml-1 rounded transition-colors flex-shrink-0 hover:bg-bg-hover"
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
                                  {isArchiveConfirming ? (
                                    <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 text-warning" />
                                  ) : (
                                    <span
                                      className={`sidebar-conversation-status-dot sidebar-conversation-status-dot-${conversationStatus}`}
                                      title={conversationStatusMeta.label}
                                      aria-hidden="true"
                                    />
                                  )}
                                  {renamingConvId === conv.id ? (
                                    <input
                                      ref={renameInputRef}
                                      value={renameValue}
                                      onChange={(e) => setRenameValue(e.target.value)}
                                      onBlur={() => void submitRename(conv.id, renameValue)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); void submitRename(conv.id, renameValue) }
                                        if (e.key === 'Escape') { e.preventDefault(); setRenamingConvId(null) }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full bg-bg-elevated border border-accent/60 rounded px-1 py-0 text-sm text-text-primary focus:outline-none focus:border-accent"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={`break-words ${isArchiveConfirming ? 'font-medium' : ''}`}>
                                      {isArchiveConfirming ? `Archive "${conv.title}"?` : conv.title}
                                    </span>
                                  )}
                                </div>

                                {!isArchiveConfirming && isWorktreeConversation && (
                                  <GitFork className="w-3 h-3 text-accent flex-shrink-0" />
                                )}

                                {!isArchiveConfirming && daysOld >= 2 && (
                                  <span className="text-[10px] text-text-faint tabular-nums mr-1">
                                    {daysOld}d
                                  </span>
                                )}

                                {isArchiveConfirming ? (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setArchiveConfirmConversationId(null)
                                      }}
                                      title="Cancel archive"
                                      className="rounded px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-black/10 hover:text-text-primary"
                                    >
                                      <span className="sr-only">Cancel archive</span>
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => handleConfirmArchiveConversation(e, conv)}
                                      title="Confirm archive"
                                      className="rounded bg-warning/20 px-2 py-1 text-[11px] font-medium text-text-primary transition-colors hover:bg-warning/30"
                                    >
                                      <span className="sr-only">Confirm archive</span>
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                                    title="Archive conversation"
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-hover rounded text-text-muted hover:text-accent flex-shrink-0"
                                  >
                                    <Archive className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {hasExpandableContent && isConversationExpanded && (
                                <div className="ml-6 pl-2 border-l border-border-strong mt-1 mb-2">
                                  {hasArtifacts && (
                                    <div className="text-[10px] text-text-faint uppercase tracking-wider mb-1">Artifacts</div>
                                  )}
                                  {convArtifacts.map((artifact) => {
                                    const Icon = ARTIFACT_ICONS[artifact.type] || DEFAULT_ARTIFACT_ICON
                                    return (
                                      <div
                                        key={artifact.id}
                                        onContextMenu={(event) => openArtifactContextMenu(event, conv, artifact)}
                                        className="group flex items-center gap-2 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                                      >
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            try {
                                              await setActiveConversation(conv.id)
                                              selectArtifact(artifact.id)
                                              openCanvas()
                                            } catch (artifactError) {
                                              console.error('Failed to open artifact from sidebar:', artifactError)
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
                                            } catch (artifactError) {
                                              console.error('Failed to reveal artifact:', artifactError)
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
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
