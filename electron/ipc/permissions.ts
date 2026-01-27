import { ipcMain, BrowserWindow } from 'electron'
import { permissionDb } from '../services/database.js'

export function registerPermissionHandlers() {
  // List permissions
  ipcMain.handle('permissions:list', async (_, workspaceId?: string) => {
    return permissionDb.list(workspaceId)
  })

  // Get a single permission
  ipcMain.handle('permissions:get', async (_, id: string) => {
    return permissionDb.get(id)
  })

  // Check if an action is permitted
  ipcMain.handle('permissions:check', async (_, toolName: string, action: string, workspaceId?: string) => {
    return permissionDb.checkPermission(toolName, action, workspaceId)
  })

  // Create a permission
  ipcMain.handle('permissions:create', async (_, permission: {
    toolName: string
    actionPattern: string
    permission: 'allow_always' | 'allow_once' | 'deny'
    workspaceId?: string
  }) => {
    return permissionDb.create(permission)
  })

  // Update a permission
  ipcMain.handle('permissions:update', async (_, id: string, updates: {
    toolName?: string
    actionPattern?: string
    permission?: 'allow_always' | 'allow_once' | 'deny'
    workspaceId?: string
  }) => {
    return permissionDb.update(id, updates)
  })

  // Delete a permission
  ipcMain.handle('permissions:delete', async (_, id: string) => {
    permissionDb.delete(id)
    return { success: true }
  })

  // Delete all permissions for a workspace
  ipcMain.handle('permissions:deleteByWorkspace', async (_, workspaceId: string) => {
    permissionDb.deleteByWorkspace(workspaceId)
    return { success: true }
  })

  // Clear all "allow_once" permissions
  ipcMain.handle('permissions:clearOnce', async () => {
    permissionDb.clearOncePermissions()
    return { success: true }
  })

  // Request permission from user (shows dialog)
  ipcMain.handle('permissions:request', async (_, request: {
    toolName: string
    action: string
    description: string
    workspaceId?: string
  }): Promise<{ permission: 'allow_always' | 'allow_once' | 'deny'; cancelled: boolean }> => {
    // For now, return a default. In a full implementation, this would
    // show a dialog and wait for user response.
    // The UI component will handle the actual dialog.
    return {
      permission: 'allow_once',
      cancelled: false
    }
  })
}
