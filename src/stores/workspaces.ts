import { create } from 'zustand'
import { useChatStore } from './chat'

export interface Workspace {
  id: string
  name: string
  path: string
  isGit: boolean
  isWorktree?: boolean
  projectPath?: string
  gitBranch?: string
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  rootPath: string
  createdAt: number
  updatedAt: number
}

interface WorkspaceStore {
  workspaces: Workspace[]
  projects: Project[]
  activeWorkspaceId: string | null
  createWorktreeOnNewChat: boolean
  isLoading: boolean
  error: string | null

  // Actions
  loadWorkspaces: () => Promise<void>
  loadProjects: () => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  selectFolder: () => Promise<Workspace | null>
  setActiveWorkspace: (id: string | null, skipDbUpdate?: boolean) => void
  setCreateWorktreeOnNewChat: (enabled: boolean) => void
  updateWorkspace: (id: string, updates: { name?: string }) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  refreshGit: (id: string) => Promise<void>
  clearError: () => void
}

const ACTIVE_WORKSPACE_KEY = 'jelico:activeWorkspace'
const WORKTREE_PREFERENCE_KEY = 'jelico:worktrunk:autoWorktreeNewChat'

function persistActiveWorkspaceId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    }
  } catch {
    // Ignore localStorage persistence failures.
  }
}

function readStoredBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    if (value === 'true') return true
    if (value === 'false') return false
  } catch {
    // Ignore localStorage access errors and use fallback.
  }
  return fallback
}

function persistBooleanPreference(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Ignore localStorage persistence failures.
  }
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  projects: [],
  activeWorkspaceId: null,
  createWorktreeOnNewChat: readStoredBooleanPreference(WORKTREE_PREFERENCE_KEY, false),
  isLoading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ isLoading: true })
    try {
      const [workspaces, projects] = await Promise.all([
        window.jelico.workspaces.list(),
        window.jelico.projects.list(),
      ])
      const { activeWorkspaceId } = get()
      const hasActiveWorkspace = activeWorkspaceId
        ? workspaces.some((workspace) => workspace.id === activeWorkspaceId)
        : true

      if (!hasActiveWorkspace) {
        persistActiveWorkspaceId(null)
      }

      set({
        workspaces,
        projects,
        isLoading: false,
        activeWorkspaceId: hasActiveWorkspace ? activeWorkspaceId : null,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  loadProjects: async () => {
    try {
      const projects = await window.jelico.projects.list()
      set({ projects })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  renameProject: async (id, name) => {
    try {
      await window.jelico.projects.update(id, { name })
      await get().loadProjects()
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  selectFolder: async () => {
    try {
      const workspace = await window.jelico.workspaces.selectFolder()
      if (workspace) {
        // Reload workspaces and set as active
        const workspaces = await window.jelico.workspaces.list()
        set({ workspaces })
        get().setActiveWorkspace(workspace.id)
        return workspace
      }
      return null
    } catch (error: any) {
      set({ error: error.message })
      return null
    }
  },

  setActiveWorkspace: (id, skipDbUpdate = false) => {
    // Skip if already set to this value (prevents unnecessary re-renders)
    if (id === get().activeWorkspaceId) return

    set({ activeWorkspaceId: id })
    // Store in localStorage for persistence
    persistActiveWorkspaceId(id)
    // Update the active conversation's workspace in the database
    // (skip when restoring from conversation, as the value is already correct)
    if (!skipDbUpdate) {
      const activeConversationId = useChatStore.getState().activeConversationId
      if (activeConversationId) {
        window.jelico.conversations
          .updateWorkspaceId(activeConversationId, id)
          .then((conversation) => {
            const nextId = conversation?.workspaceId ?? id ?? null
            useChatStore.getState().setConversationWorkspaceId(activeConversationId, nextId)
          })
          .catch((err) => {
            console.error('Failed to update conversation workspace:', err)
          })
      }
    }
  },

  setCreateWorktreeOnNewChat: (enabled) => {
    persistBooleanPreference(WORKTREE_PREFERENCE_KEY, enabled)
    set({ createWorktreeOnNewChat: enabled })
  },

  updateWorkspace: async (id, updates) => {
    try {
      await window.jelico.workspaces.update(id, updates)
      const workspaces = await window.jelico.workspaces.list()
      set({ workspaces })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  deleteWorkspace: async (id) => {
    try {
      await window.jelico.workspaces.delete(id)
      const workspaces = await window.jelico.workspaces.list()
      const { activeWorkspaceId } = get()
      const isActiveWorkspaceDeleted = activeWorkspaceId === id
      const hasActiveWorkspace = activeWorkspaceId
        ? workspaces.some((workspace) => workspace.id === activeWorkspaceId)
        : true
      const nextActiveWorkspaceId = isActiveWorkspaceDeleted || !hasActiveWorkspace
        ? null
        : activeWorkspaceId

      if (!nextActiveWorkspaceId) {
        persistActiveWorkspaceId(null)
      }

      set({
        workspaces,
        activeWorkspaceId: nextActiveWorkspaceId,
      })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  refreshGit: async (id) => {
    try {
      await window.jelico.workspaces.refreshGit(id)
      const workspaces = await window.jelico.workspaces.list()
      set({ workspaces })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  clearError: () => set({ error: null }),
}))

// Helper to restore active workspace from localStorage
export function initWorkspaceStore() {
  const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  if (stored) {
    useWorkspaceStore.setState({ activeWorkspaceId: stored })
  }
}
