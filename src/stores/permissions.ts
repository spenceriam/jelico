import { create } from 'zustand'

export type PermissionAction = 'allow_always' | 'allow_once' | 'deny'

export interface Permission {
  id: string
  toolName: string
  actionPattern: string
  permission: PermissionAction
  workspaceId: string | null
  createdAt: number
  updatedAt: number
}

// Convert database row to store format
function rowToPermission(row: PermissionRecord): Permission {
  return {
    id: row.id,
    toolName: row.tool_name,
    actionPattern: row.action_pattern,
    permission: row.permission,
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Permission request from main process (tool execution)
export interface MainProcessRequest {
  requestId: string
  toolName: string
  action: string
  description: string
  preview?: string
  workspaceId?: string
}

interface PendingRequest {
  id: string
  toolName: string
  action: string
  description: string
  preview?: string
  workspaceId?: string
  resolve: (result: { permission: PermissionAction; remembered: boolean }) => void
}

interface PermissionStore {
  permissions: Permission[]
  pendingRequest: PendingRequest | null
  mainProcessRequest: MainProcessRequest | null
  allowAllSession: boolean
  sessionPermissions: Array<{ key: string; permission: PermissionAction }>
  isLoading: boolean

  // Actions
  loadPermissions: (workspaceId?: string) => Promise<void>
  checkPermission: (toolName: string, action: string, workspaceId?: string) => Promise<PermissionAction | null>
  requestPermission: (toolName: string, action: string, description: string, workspaceId?: string) => Promise<{ permission: PermissionAction; remembered: boolean }>
  grantPermission: (permission: PermissionAction, remember: boolean) => void
  createPermission: (permission: {
    toolName: string
    actionPattern: string
    permission: PermissionAction
    workspaceId?: string
  }) => Promise<Permission>
  deletePermission: (id: string) => Promise<void>
  clearOncePermissions: () => Promise<void>
  // Main process permission handling
  setMainProcessRequest: (request: MainProcessRequest | null) => void
  respondToMainProcess: (permission: PermissionAction, remember: boolean) => Promise<void>
  // Session settings
  loadAllowAllSession: () => Promise<void>
  setAllowAllSession: (allow: boolean) => Promise<void>
  loadSessionPermissions: () => Promise<void>
  clearSessionPermissions: () => Promise<void>
  // Listener setup
  setupMainProcessListener: () => () => void
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  permissions: [],
  pendingRequest: null,
  mainProcessRequest: null,
  allowAllSession: false,
  sessionPermissions: [],
  isLoading: false,

  loadPermissions: async (workspaceId) => {
    set({ isLoading: true })
    try {
      const rows = await window.jelico.permissions.list(workspaceId)
      set({ permissions: rows.map(rowToPermission), isLoading: false })
    } catch (error) {
      console.error('Failed to load permissions:', error)
      set({ isLoading: false })
    }
  },

  checkPermission: async (toolName, action, workspaceId) => {
    try {
      return await window.jelico.permissions.check(toolName, action, workspaceId)
    } catch (error) {
      console.error('Failed to check permission:', error)
      return null
    }
  },

  requestPermission: (toolName, action, description, workspaceId) => {
    return new Promise((resolve) => {
      const id = crypto.randomUUID()
      set({
        pendingRequest: {
          id,
          toolName,
          action,
          description,
          workspaceId,
          resolve,
        },
      })
    })
  },

  grantPermission: async (permission, remember) => {
    const { pendingRequest } = get()
    if (!pendingRequest) return

    // If remembering, save the permission
    if (remember && permission !== 'allow_once') {
      await get().createPermission({
        toolName: pendingRequest.toolName,
        actionPattern: pendingRequest.action,
        permission,
        workspaceId: pendingRequest.workspaceId,
      })
    }

    // Resolve the pending request
    pendingRequest.resolve({ permission, remembered: remember })
    set({ pendingRequest: null })
  },

  createPermission: async (permissionInput) => {
    try {
      const row = await window.jelico.permissions.create(permissionInput)
      const newPermission = rowToPermission(row)
      set((state) => ({
        permissions: [...state.permissions.filter(p => p.id !== newPermission.id), newPermission],
      }))
      return newPermission
    } catch (error) {
      console.error('Failed to create permission:', error)
      throw error
    }
  },

  deletePermission: async (id) => {
    try {
      await window.jelico.permissions.delete(id)
      set((state) => ({
        permissions: state.permissions.filter(p => p.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete permission:', error)
      throw error
    }
  },

  clearOncePermissions: async () => {
    try {
      await window.jelico.permissions.clearOnce()
      set((state) => ({
        permissions: state.permissions.filter(p => p.permission !== 'allow_once'),
      }))
    } catch (error) {
      console.error('Failed to clear once permissions:', error)
      throw error
    }
  },

  // Handle permission request from main process (during tool execution)
  setMainProcessRequest: (request) => {
    set({ mainProcessRequest: request })
  },

  respondToMainProcess: async (permission, remember) => {
    const { mainProcessRequest } = get()
    if (!mainProcessRequest) return

    try {
      await window.jelico.permissions.respond({
        requestId: mainProcessRequest.requestId,
        permission,
        remember,
        toolName: mainProcessRequest.toolName,
        action: mainProcessRequest.action,
        workspaceId: mainProcessRequest.workspaceId,
      })

      // If remembering, also create local permission
      if (remember && permission !== 'allow_once') {
        await get().createPermission({
          toolName: mainProcessRequest.toolName,
          actionPattern: mainProcessRequest.action,
          permission,
          workspaceId: mainProcessRequest.workspaceId,
        })
      }
    } catch (error) {
      console.error('Failed to respond to main process:', error)
    }

    set({ mainProcessRequest: null })
  },

  // Session settings
  loadAllowAllSession: async () => {
    try {
      const allow = await window.jelico.permissions.getAllowAll()
      set({ allowAllSession: allow })
    } catch (error) {
      console.error('Failed to load allow all session:', error)
    }
  },

  setAllowAllSession: async (allow) => {
    try {
      await window.jelico.permissions.setAllowAll(allow)
      set({ allowAllSession: allow })
    } catch (error) {
      console.error('Failed to set allow all session:', error)
      throw error
    }
  },

  loadSessionPermissions: async () => {
    try {
      const perms = await window.jelico.permissions.getSessionPermissions()
      set({ sessionPermissions: perms })
    } catch (error) {
      console.error('Failed to load session permissions:', error)
    }
  },

  clearSessionPermissions: async () => {
    try {
      await window.jelico.permissions.clearSessionPermissions()
      set({ sessionPermissions: [] })
    } catch (error) {
      console.error('Failed to clear session permissions:', error)
      throw error
    }
  },

  // Set up listener for permission requests from main process
  setupMainProcessListener: () => {
    const cleanup = window.jelico.permissions.onPermissionRequest((request) => {
      get().setMainProcessRequest(request)
    })
    return cleanup
  },
}))

// Tool descriptions for user-friendly display
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  'file:read': 'Read files from your computer',
  'file:write': 'Write or modify files on your computer',
  'file:delete': 'Delete files from your computer',
  'shell:execute': 'Run shell commands',
  'web:fetch': 'Access websites and APIs',
  'browser:open': 'Open URLs in your browser',
}

export function getToolDescription(toolName: string, action: string): string {
  const key = `${toolName}:${action.split(':')[0]}`
  return TOOL_DESCRIPTIONS[key] || `${toolName}: ${action}`
}
