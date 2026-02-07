import { useState, useEffect } from 'react'
import { FolderOpen, FolderX, AlertTriangle, Check } from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore } from '../../stores/workspaces'

interface Workspace {
  id: string
  name: string
  path: string
}

interface TransferDialogProps {
  conversationId: string
  conversationTitle: string
  currentWorkspaceId: string | null
  onClose: () => void
  onTransferComplete: () => void
}

export function TransferDialog({
  conversationId,
  conversationTitle,
  currentWorkspaceId,
  onClose,
  onTransferComplete,
}: TransferDialogProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [artifactCount, setArtifactCount] = useState(0)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [isPickingWorkspace, setIsPickingWorkspace] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ transferred: number; failed: number } | null>(null)
  const { loadConversations, activeConversationId, setConversationWorkspaceId } = useChatStore()
  const { setActiveWorkspace, loadWorkspaces } = useWorkspaceStore()

  // Load workspaces and artifact count
  useEffect(() => {
    const load = async () => {
      const [ws, count] = await Promise.all([
        window.jelico.workspaces.list(),
        window.jelico.conversations.getArtifactCount(conversationId),
      ])
      setWorkspaces(ws)
      setArtifactCount(count)
    }
    load()
  }, [conversationId])

  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId)
  const isInSandbox = !currentWorkspaceId

  const handlePickFolder = async () => {
    setIsPickingWorkspace(true)
    setError(null)

    try {
      const workspace = await window.jelico.workspaces.selectFolder()
      if (!workspace) return

      // Ensure we always transfer to explicitly picked folder, not implicit last selection.
      setSelectedWorkspaceId(workspace.id)
      setSelectedWorkspace(workspace)

      // Keep local workspace metadata fresh in case this was a newly created workspace record.
      const refreshed = await window.jelico.workspaces.list()
      setWorkspaces(refreshed)
      await loadWorkspaces()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick folder')
    } finally {
      setIsPickingWorkspace(false)
    }
  }

  const handleTransfer = async () => {
    setIsTransferring(true)
    setError(null)

    try {
      const response = await window.jelico.conversations.transferToWorkspace(
        conversationId,
        selectedWorkspaceId
      )

      if (response.success) {
        const nextWorkspaceId = response.conversation?.workspaceId ?? selectedWorkspaceId ?? null

        // Refresh conversations so the workspace change is reflected in the sidebar
        await loadConversations()
        await loadWorkspaces()

        // Update the local conversation record immediately
        setConversationWorkspaceId(conversationId, nextWorkspaceId)

        // If we're viewing this conversation, update the active workspace in UI
        if (activeConversationId === conversationId) {
          setActiveWorkspace(nextWorkspaceId, true)
        }

        setResult({ transferred: response.transferred, failed: response.failed })
        // Auto-close after success
        setTimeout(() => {
          onTransferComplete()
          onClose()
        }, 1500)
      } else {
        setError(response.errors?.join(', ') || 'Transfer failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setIsTransferring(false)
    }
  }

  const targetLabel = selectedWorkspaceId
    ? selectedWorkspace?.name || workspaces.find(w => w.id === selectedWorkspaceId)?.name || 'Unknown'
    : 'Sandbox'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-void/80 backdrop-blur-sm">
      <div className="bg-bg-surface border border-border rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Move Conversation</h3>
            <p className="text-sm text-text-muted truncate max-w-[280px]">{conversationTitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {result ? (
            // Success state
            <div className="flex items-center gap-3 text-success">
              <Check className="w-5 h-5" />
              <span>Transferred {result.transferred} artifact{result.transferred !== 1 ? 's' : ''}</span>
            </div>
          ) : (
            <>
              {/* Current location */}
              <div className="mb-4">
                <div className="text-sm text-text-muted mb-1">Current location:</div>
                <div className="text-sm text-text-primary font-medium">
                  {isInSandbox ? 'Sandbox (no workspace)' : currentWorkspace?.name || 'Unknown workspace'}
                </div>
                {!isInSandbox && currentWorkspace && (
                  <div className="text-xs text-text-faint truncate">{currentWorkspace.path}</div>
                )}
              </div>

              {/* Artifact count warning */}
              {artifactCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg mb-4">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <span className="text-warning font-medium">{artifactCount} artifact{artifactCount !== 1 ? 's' : ''}</span>
                    <span className="text-text-muted"> will be moved to the new location.</span>
                  </div>
                </div>
              )}

              {/* Destination picker */}
              <div className="mb-4">
                <div className="text-sm text-text-muted mb-2">Move to:</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {/* Sandbox option */}
                  {!isInSandbox && (
                    <button
                      onClick={() => {
                        setSelectedWorkspaceId(null)
                        setSelectedWorkspace(null)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                        selectedWorkspaceId === null
                          ? 'bg-accent/10 text-accent border border-accent/30'
                          : 'text-text-secondary hover:bg-bg-hover border border-transparent'
                      }`}
                    >
                      <FolderX className="w-4 h-4" />
                      <span>Sandbox (no workspace)</span>
                    </button>
                  )}

                  {/* Explicit folder picker - mirrors workspace selector behavior */}
                  <button
                    onClick={handlePickFolder}
                    disabled={isPickingWorkspace || isTransferring}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                      selectedWorkspaceId
                        ? 'bg-accent/10 text-accent border border-accent/30'
                        : 'text-text-secondary hover:bg-bg-hover border border-transparent'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>{isPickingWorkspace ? 'Opening folder picker...' : 'Pick folder...'}</span>
                  </button>

                  {selectedWorkspaceId && (
                    <div className="px-3 py-2 rounded-lg border border-border bg-bg-deep">
                      <div className="text-sm text-text-primary truncate">
                        {selectedWorkspace?.name || workspaces.find(w => w.id === selectedWorkspaceId)?.name || 'Selected workspace'}
                      </div>
                      <div className="text-xs text-text-faint truncate">
                        {selectedWorkspace?.path || workspaces.find(w => w.id === selectedWorkspaceId)?.path || ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="text-sm text-error mb-4">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isTransferring}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={
                isTransferring ||
                isPickingWorkspace ||
                (selectedWorkspaceId === null && isInSandbox) ||
                (selectedWorkspaceId === currentWorkspaceId)
              }
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isTransferring ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Moving...
                </>
              ) : (
                <>Move to {targetLabel}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
