import { useEffect, useMemo, useState } from 'react'
import { Archive, Undo2, Trash2, AlertTriangle, Folder, Box, GitBranch, GitFork, Clock3 } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore, type Workspace } from '../../stores/workspaces'
import { useArtifactStore } from '../../stores/artifacts'

type ChatConversation = ReturnType<typeof useChatStore.getState>['conversations'][number]

interface ArchiveGroup {
  id: string
  label: string
  workingDirectory: string | null
  isSandbox: boolean
  isOrphan: boolean
  conversations: ChatConversation[]
}

function getConversationDisplayTitle(conversation: ChatConversation): string {
  const rawTitle = conversation.title?.trim() || 'Untitled chat'
  if (!rawTitle.endsWith('...')) return rawTitle

  const firstUserMessage = conversation.messages?.find((message) =>
    message.role === 'user' && Boolean(message.content?.trim())
  )
  if (!firstUserMessage?.content) {
    return rawTitle.replace(/\.\.\.$/, '')
  }

  return firstUserMessage.content
    .replace(/\s+/g, ' ')
    .trim()
}

function getPathBasename(value: string): string {
  const parts = value.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || value
}

function getLatestUpdate(group: ArchiveGroup): number {
  let latest = 0
  for (const conversation of group.conversations) {
    if (conversation.updatedAt > latest) {
      latest = conversation.updatedAt
    }
  }
  return latest
}

function formatRelativeAge(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null

  const diffMs = Math.max(0, Date.now() - timestamp)
  const totalMinutes = Math.floor(diffMs / (60 * 1000))

  if (totalMinutes < 1) return '0m'

  if (totalMinutes < 60) {
    return `${totalMinutes}m`
  }

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const remainingMinutes = totalMinutes % 60
    return `${totalHours}h${String(remainingMinutes).padStart(2, '0')}m`
  }

  const totalDays = Math.floor(totalHours / 24)
  if (totalDays < 365) {
    return `${totalDays}d`
  }

  const years = Math.floor(totalDays / 365)
  const remainingDays = totalDays % 365
  return `${years}y${remainingDays}d`
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  const dateText = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  const timeText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${dateText} at ${timeText}`
}

function buildArchiveGroups(
  archivedConversations: ChatConversation[],
  workspaceById: Map<string, Workspace>
): ArchiveGroup[] {
  const workspaceGroupsByDirectory = new Map<string, ArchiveGroup>()
  const sandboxConversations: ChatConversation[] = []
  const orphanConversations: ChatConversation[] = []

  for (const conversation of archivedConversations) {
    if (!conversation.workspaceId) {
      sandboxConversations.push(conversation)
      continue
    }

    const workspace = workspaceById.get(conversation.workspaceId)
    if (!workspace) {
      orphanConversations.push(conversation)
      continue
    }

    const workingDirectory = workspace.projectPath || workspace.path
    const key = workingDirectory || `workspace-${workspace.id}`
    const existingGroup = workspaceGroupsByDirectory.get(key)

    if (!existingGroup) {
      workspaceGroupsByDirectory.set(key, {
        id: `project-${key}`,
        label: workingDirectory ? getPathBasename(workingDirectory) : workspace.name,
        workingDirectory: workingDirectory || null,
        isSandbox: false,
        isOrphan: false,
        conversations: [conversation],
      })
      continue
    }

    existingGroup.conversations.push(conversation)
  }

  const groups: ArchiveGroup[] = Array.from(workspaceGroupsByDirectory.values()).map((group) => ({
    ...group,
    conversations: [...group.conversations].sort((a, b) => b.updatedAt - a.updatedAt),
  }))

  if (sandboxConversations.length > 0) {
    groups.push({
      id: 'sandbox',
      label: 'Sandbox',
      workingDirectory: null,
      isSandbox: true,
      isOrphan: false,
      conversations: sandboxConversations.sort((a, b) => b.updatedAt - a.updatedAt),
    })
  }

  if (orphanConversations.length > 0) {
    groups.push({
      id: 'orphaned',
      label: 'Orphaned',
      workingDirectory: null,
      isSandbox: false,
      isOrphan: true,
      conversations: orphanConversations.sort((a, b) => b.updatedAt - a.updatedAt),
    })
  }

  return groups.sort((a, b) => getLatestUpdate(b) - getLatestUpdate(a))
}

export function ArchiveSettings() {
  const loadConversations = useChatStore((state) => state.loadConversations)
  const clearConversationArtifacts = useArtifactStore((state) => state.clearConversationArtifacts)
  const { workspaces } = useWorkspaceStore()

  const [archivedConversations, setArchivedConversations] = useState<ChatConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [workingConversationId, setWorkingConversationId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  )

  const archiveGroups = useMemo(
    () => buildArchiveGroups(archivedConversations, workspaceById),
    [archivedConversations, workspaceById]
  )

  const loadArchivedConversations = async () => {
    setLoading(true)
    try {
      const archived = await window.jelico.conversations.listArchived()
      const withResolvedTitles = await Promise.all(
        archived.map(async (conversation) => {
          if (!conversation.title?.trim().endsWith('...')) return conversation
          try {
            const detailedConversation = await window.jelico.conversations.get(conversation.id)
            if (!detailedConversation?.messages?.length) return conversation
            return {
              ...conversation,
              messages: detailedConversation.messages,
            }
          } catch {
            return conversation
          }
        })
      )
      setArchivedConversations(withResolvedTitles)
    } catch (error) {
      console.error('Failed to load archived conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadArchivedConversations()
  }, [])

  useEffect(() => {
    if (!selectedConversationId) return
    const exists = archivedConversations.some((conversation) => conversation.id === selectedConversationId)
    if (!exists) {
      setSelectedConversationId(null)
    }
  }, [archivedConversations, selectedConversationId])

  const handleRestoreConversation = async (id: string) => {
    setWorkingConversationId(id)
    try {
      await window.jelico.conversations.restore(id)
      await loadConversations()
      await loadArchivedConversations()
    } catch (error) {
      console.error('Failed to restore conversation:', error)
    } finally {
      setWorkingConversationId(null)
    }
  }

  const handlePermanentDeleteConversation = async (id: string) => {
    if (!confirm('Permanently delete this archived conversation? This cannot be undone.')) {
      return
    }

    setWorkingConversationId(id)
    try {
      await clearConversationArtifacts(id)
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
      await loadArchivedConversations()
    } catch (error) {
      console.error('Failed to permanently delete archived conversation:', error)
    } finally {
      setWorkingConversationId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Archive className="w-5 h-5" />
          Archive
        </h3>

        <div className="p-4 bg-bg-elevated rounded-lg border border-border space-y-3">
          <p className="text-sm text-accent">
            Archive chat conversations without deleting history, artifacts, or outcomes.
          </p>
          <p className="text-sm text-accent/90">
            Restore sends your chat back to the left chat pane, and deleting will permanently remove it and all related data.
          </p>

          <div className="pt-2 border-t border-border/70 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-accent">
              Icon legend:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-accent/90">
              <div className="flex items-center gap-2">
                <Undo2 className="w-3.5 h-3.5 text-accent" />
                <span>Restore chat to active sidebar</span>
              </div>
              <div className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-accent" />
                <span>Permanently delete archived chat</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-accent" />
                <span>Orphan means workspace is missing and restore is unavailable</span>
              </div>
              <div className="flex items-center gap-2">
                <GitFork className="w-3.5 h-3.5 text-accent" />
                <span>Shows worktree status per archived chat</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium text-text-primary mb-3">Archived Chats</h3>

        {loading ? (
          <div className="text-sm text-text-muted">Loading archived chats...</div>
        ) : archiveGroups.length === 0 ? (
          <div className="p-4 bg-bg-elevated rounded-lg border border-border text-sm text-text-muted">
            No archived chats yet.
          </div>
        ) : (
          <div className="space-y-4">
            {archiveGroups.map((group) => {
              const GroupIcon = group.isOrphan
                ? AlertTriangle
                : group.isSandbox
                  ? Box
                  : Folder

              return (
                <div key={group.id} className="p-3 bg-bg-elevated rounded-lg border border-border">
                  <div className="flex items-start gap-2 text-sm text-text-secondary mb-2">
                    <GroupIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">
                        {group.isSandbox || group.isOrphan ? group.label : `/${group.label}`}
                      </div>
                      {!group.isSandbox && !group.isOrphan && group.workingDirectory && (
                        <div className="text-xs text-text-faint font-mono break-all">
                          {group.workingDirectory}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.conversations.map((conversation) => {
                      const isWorking = workingConversationId === conversation.id
                      const isSelected = selectedConversationId === conversation.id
                      const workspace = conversation.workspaceId ? workspaceById.get(conversation.workspaceId) : null
                      const createdAge = formatRelativeAge(conversation.createdAt)
                      const archivedAge = formatRelativeAge(conversation.archivedAt ?? null)

                      return (
                        <div
                          key={conversation.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedConversationId(conversation.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedConversationId(conversation.id)
                            }
                          }}
                          className={`flex items-start gap-2 px-2 py-2 rounded border transition-colors ${
                            isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong'
                          } ${group.isOrphan ? 'opacity-80' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm whitespace-normal break-words ${group.isOrphan ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                              {getConversationDisplayTitle(conversation)}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                              {!group.isSandbox && !group.isOrphan ? (
                                <>
                                  <span className="inline-flex items-center gap-1">
                                    <GitBranch className="w-3.5 h-3.5" />
                                    {workspace?.gitBranch || 'No branch'}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <GitFork className="w-3.5 h-3.5" />
                                    {workspace?.isWorktree ? 'Worktree' : 'No worktree'}
                                  </span>
                                </>
                              ) : group.isSandbox ? (
                                <span>Sandbox chat</span>
                              ) : (
                                <span>Workspace missing</span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint">
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="w-3.5 h-3.5" />
                                Created {formatTimestamp(conversation.createdAt)}{createdAge ? ` (${createdAge} old)` : ''}
                              </span>
                              <span>
                                Archived {formatTimestamp(conversation.archivedAt ?? null)}{archivedAge ? ` (${archivedAge})` : ''}
                              </span>
                            </div>
                          </div>

                          {group.isOrphan ? (
                            <button
                              disabled
                              title="Orphan chat, cannot restore (workspace missing)"
                              className="p-1.5 text-text-faint rounded cursor-not-allowed"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                void handleRestoreConversation(conversation.id)
                              }}
                              disabled={isWorking}
                              title="Restore conversation"
                              className="p-1.5 text-text-muted hover:text-accent hover:bg-bg-hover rounded transition-colors disabled:opacity-50"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              void handlePermanentDeleteConversation(conversation.id)
                            }}
                            disabled={isWorking}
                            title="Permanently delete"
                            className="p-1.5 text-text-muted hover:text-error hover:bg-bg-hover rounded transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
