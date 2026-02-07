import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, GitBranch, Folder, X, RefreshCw, GitFork, Box, Download } from 'lucide-react'
import { useWorkspaceStore, type Workspace } from '../../stores/workspaces'
import { useSandboxStore } from '../../stores/sandbox'
import { useChatStore } from '../../stores/chat'

interface GitBranchInfo {
  name: string
  isRemote: boolean
  isCurrent: boolean
}

export function WorkspaceSelector() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    selectFolder,
    deleteWorkspace,
    refreshGit,
    loadWorkspaces,
  } = useWorkspaceStore()
  const { files, loadFiles, exportSandbox } = useSandboxStore()
  const { activeConversationId } = useChatStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [branchPickerOpen, setBranchPickerOpen] = useState<string | null>(null)
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId)
  const sandboxFiles = activeConversationId ? files[activeConversationId] : []
  const hasSandboxFiles = sandboxFiles && sandboxFiles.length > 0

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [])

  // If we have an active workspace id but no matching metadata, refresh list.
  useEffect(() => {
    if (!activeWorkspaceId) return
    const hasActiveWorkspace = workspaces.some((workspace) => workspace.id === activeWorkspaceId)
    if (!hasActiveWorkspace) {
      loadWorkspaces()
    }
  }, [activeWorkspaceId, workspaces, loadWorkspaces])

  // Load sandbox files when dropdown opens and no workspace is selected
  useEffect(() => {
    if (dropdownOpen && !activeWorkspaceId && activeConversationId) {
      loadFiles(activeConversationId)
    }
  }, [dropdownOpen, activeWorkspaceId, activeConversationId])

  const handleSelectFolder = async () => {
    await selectFolder()
    setDropdownOpen(false)
  }

  const handleSelectWorkspace = (id: string | null) => {
    setActiveWorkspace(id)
    setDropdownOpen(false)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteWorkspace(id)
  }

  const handleRefreshGit = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await refreshGit(id)
  }

  const handleOpenBranchPicker = async (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation()
    if (branchPickerOpen === workspaceId) {
      setBranchPickerOpen(null)
      return
    }

    setIsLoadingBranches(true)
    setBranchPickerOpen(workspaceId)

    try {
      const branchList = await window.jelico.workspaces.listBranches(workspaceId)
      setBranches(branchList)
    } catch (error) {
      console.error('Failed to load branches:', error)
      setBranches([])
    } finally {
      setIsLoadingBranches(false)
    }
  }

  const handleCreateWorktree = async (workspaceId: string, branch: string) => {
    try {
      const newWorkspace = await window.jelico.workspaces.createWorktree(workspaceId, branch)
      await loadWorkspaces()
      setActiveWorkspace(newWorkspace.id)
      setDropdownOpen(false)
      setBranchPickerOpen(null)
    } catch (error) {
      console.error('Failed to create worktree:', error)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-bg-surface rounded-lg transition-colors"
      >
        {activeWorkspace ? (
          <>
            {activeWorkspace.isGit ? (
              <GitBranch className="w-4 h-4 text-accent flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-accent flex-shrink-0" />
            )}
            <div className="flex flex-col items-start leading-tight">
              <span className="text-text-primary">{activeWorkspace.name}</span>
              {activeWorkspace.gitBranch && (
                <span className="text-xs text-text-muted">
                  {activeWorkspace.gitBranch}
                </span>
              )}
            </div>
          </>
        ) : activeWorkspaceId ? (
          <>
            <Folder className="w-4 h-4 text-accent flex-shrink-0" />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-text-primary">Workspace</span>
              <span className="text-xs text-text-muted">Loading...</span>
            </div>
          </>
        ) : (
          <>
            <Box className="w-4 h-4 text-accent flex-shrink-0" />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-text-primary">Sandbox</span>
              {hasSandboxFiles && (
                <span className="text-xs text-text-muted">
                  {sandboxFiles.length} file{sandboxFiles.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </>
        )}
        <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
      </button>

      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {/* Sandbox option (when no workspace) */}
          <button
            onClick={() => handleSelectWorkspace(null)}
            className={`
              w-full px-3 py-2 text-sm text-left hover:bg-bg-hover transition-colors flex items-center gap-2
              ${!activeWorkspaceId ? 'text-accent' : 'text-text-primary'}
            `}
          >
            <Box className="w-4 h-4 text-accent" />
            <div className="flex-1">
              <span>Sandbox</span>
              {hasSandboxFiles && (
                <span className="ml-2 text-xs text-text-muted">
                  ({sandboxFiles.length} file{sandboxFiles.length !== 1 ? 's' : ''})
                </span>
              )}
            </div>
            {!activeWorkspaceId && <span className="ml-auto">✓</span>}
            {hasSandboxFiles && !activeWorkspaceId && (
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  if (activeConversationId) {
                    await exportSandbox(activeConversationId)
                  }
                }}
                className="p-1 text-text-muted hover:text-accent rounded"
                title="Export sandbox files"
              >
                <Download className="w-3 h-3" />
              </button>
            )}
          </button>

          {/* Workspace list */}
          {workspaces.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="px-3 py-2 text-xs text-text-muted uppercase tracking-wider bg-bg-surface">
                Recent Workspaces
              </div>
              {workspaces.map((workspace) => (
                <div key={workspace.id}>
                  <WorkspaceItem
                    workspace={workspace}
                    isActive={workspace.id === activeWorkspaceId}
                    onSelect={() => handleSelectWorkspace(workspace.id)}
                    onDelete={(e) => handleDelete(e, workspace.id)}
                    onRefreshGit={(e) => handleRefreshGit(e, workspace.id)}
                    onOpenBranchPicker={(e) => handleOpenBranchPicker(e, workspace.id)}
                    showBranchPicker={branchPickerOpen === workspace.id}
                  />
                  {branchPickerOpen === workspace.id && (
                    <BranchPicker
                      branches={branches}
                      isLoading={isLoadingBranches}
                      onSelect={(branch) => handleCreateWorktree(workspace.id, branch)}
                      onClose={() => setBranchPickerOpen(null)}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {/* Add new workspace */}
          <div className="border-t border-border">
            <button
              onClick={handleSelectFolder}
              className="w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover text-left transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Open folder...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkspaceItem({
  workspace,
  isActive,
  onSelect,
  onDelete,
  onRefreshGit,
  onOpenBranchPicker,
  showBranchPicker,
}: {
  workspace: Workspace
  isActive: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onRefreshGit: (e: React.MouseEvent) => void
  onOpenBranchPicker: (e: React.MouseEvent) => void
  showBranchPicker: boolean
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full px-3 py-2 text-sm text-left hover:bg-bg-hover transition-colors
        flex items-center gap-2 group
        ${isActive ? 'text-accent' : 'text-text-primary'}
      `}
    >
      {workspace.isGit ? (
        <GitBranch className="w-4 h-4 text-accent flex-shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-text-muted flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="truncate">{workspace.name}</div>
        <div className="text-xs text-text-faint truncate">{workspace.path}</div>
      </div>

      {workspace.gitBranch && (
        <span className="text-xs text-text-muted">{workspace.gitBranch}</span>
      )}

      {isActive && <span className="ml-1">✓</span>}

      {/* Action buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {workspace.isGit && (
          <>
            <button
              onClick={onOpenBranchPicker}
              className={`p-1 rounded ${showBranchPicker ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
              title="Create worktree from branch"
            >
              <GitFork className="w-3 h-3" />
            </button>
            <button
              onClick={onRefreshGit}
              className="p-1 text-text-muted hover:text-text-primary rounded"
              title="Refresh git info"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </>
        )}
        <button
          onClick={onDelete}
          className="p-1 text-text-muted hover:text-error rounded"
          title="Remove workspace"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </button>
  )
}

function BranchPicker({
  branches,
  isLoading,
  onSelect,
}: {
  branches: GitBranchInfo[]
  isLoading: boolean
  onSelect: (branch: string) => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState('')

  const filteredBranches = branches.filter(
    b => b.name.toLowerCase().includes(filter.toLowerCase()) && !b.isCurrent
  )

  const localBranches = filteredBranches.filter(b => !b.isRemote)
  const remoteBranches = filteredBranches.filter(b => b.isRemote)

  return (
    <div className="bg-bg-surface border-t border-border">
      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Filter or create branch..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-bg-deep border border-border rounded focus:outline-none focus:border-accent"
          autoFocus
        />
      </div>

      {isLoading ? (
        <div className="px-3 py-2 text-xs text-text-muted">Loading branches...</div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {/* Create new branch option */}
          {filter && !branches.some(b => b.name === filter) && (
            <button
              onClick={() => onSelect(filter)}
              className="w-full px-3 py-1.5 text-xs text-left text-accent hover:bg-bg-hover flex items-center gap-2"
            >
              <Plus className="w-3 h-3" />
              Create "{filter}"
            </button>
          )}

          {/* Local branches */}
          {localBranches.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] text-text-faint uppercase">Local</div>
              {localBranches.map((branch) => (
                <button
                  key={branch.name}
                  onClick={() => onSelect(branch.name)}
                  className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                >
                  {branch.name}
                </button>
              ))}
            </>
          )}

          {/* Remote branches */}
          {remoteBranches.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] text-text-faint uppercase">Remote</div>
              {remoteBranches.map((branch) => (
                <button
                  key={branch.name}
                  onClick={() => onSelect(branch.name.replace('origin/', ''))}
                  className="w-full px-3 py-1.5 text-xs text-left text-text-muted hover:bg-bg-hover hover:text-text-secondary"
                >
                  {branch.name}
                </button>
              ))}
            </>
          )}

          {filteredBranches.length === 0 && !filter && (
            <div className="px-3 py-2 text-xs text-text-muted">No other branches</div>
          )}
        </div>
      )}
    </div>
  )
}
