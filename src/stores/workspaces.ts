import { create } from 'zustand'

export interface Workspace {
  id: string
  name: string
  path: string
  isGit: boolean
  gitBranch?: string
  createdAt: number
  updatedAt: number
}

interface WorkspaceStore {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  loadWorkspaces: () => Promise<void>
  selectFolder: () => Promise<Workspace | null>
  setActiveWorkspace: (id: string | null) => void
  updateWorkspace: (id: string, updates: { name?: string }) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  refreshGit: (id: string) => Promise<void>
  clearError: () => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ isLoading: true })
    try {
      const workspaces = await window.jelico.workspaces.list()
      set({ workspaces, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectFolder: async () => {
    try {
      const workspace = await window.jelico.workspaces.selectFolder()
      if (workspace) {
        // Reload workspaces and set as active
        const workspaces = await window.jelico.workspaces.list()
        set({
          workspaces,
          activeWorkspaceId: workspace.id,
        })
        return workspace
      }
      return null
    } catch (error: any) {
      set({ error: error.message })
      return null
    }
  },

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id })
    // Store in localStorage for persistence
    if (id) {
      localStorage.setItem('jelico:activeWorkspace', id)
    } else {
      localStorage.removeItem('jelico:activeWorkspace')
    }
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
      set({
        workspaces,
        activeWorkspaceId: activeWorkspaceId === id ? null : activeWorkspaceId,
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
  const stored = localStorage.getItem('jelico:activeWorkspace')
  if (stored) {
    useWorkspaceStore.getState().setActiveWorkspace(stored)
  }
}
