import { ipcMain } from 'electron'
import { memoryDb } from '../services/database.js'

export function registerMemoryHandlers() {
  // List memories with optional scope filter
  ipcMain.handle('memory:list', async (_, scope?: string, scopeId?: string) => {
    return memoryDb.list(scope as any, scopeId)
  })

  // Get a single memory
  ipcMain.handle('memory:get', async (_, id: string) => {
    return memoryDb.get(id)
  })

  // Get all memories for a context (global + workspace + conversation)
  ipcMain.handle('memory:getForContext', async (_, workspaceId?: string, conversationId?: string) => {
    return memoryDb.getForContext(workspaceId, conversationId)
  })

  // Get global memories
  ipcMain.handle('memory:getGlobal', async () => {
    return memoryDb.getGlobal()
  })

  // Get workspace memories
  ipcMain.handle('memory:getByWorkspace', async (_, workspaceId: string) => {
    return memoryDb.getByWorkspace(workspaceId)
  })

  // Get conversation memories
  ipcMain.handle('memory:getByConversation', async (_, conversationId: string) => {
    return memoryDb.getByConversation(conversationId)
  })

  // Create a memory
  ipcMain.handle('memory:create', async (_, memory: {
    scope: 'global' | 'workspace' | 'conversation'
    scopeId?: string
    category: string
    key: string
    value: unknown
    confidence?: number
    source?: 'explicit' | 'inferred'
    privacy?: 'private' | 'shared'
  }) => {
    return memoryDb.create(memory as any)
  })

  // Update a memory
  ipcMain.handle('memory:update', async (_, id: string, updates: {
    scope?: 'global' | 'workspace' | 'conversation'
    scopeId?: string
    category?: string
    key?: string
    value?: unknown
    confidence?: number
    source?: 'explicit' | 'inferred'
    privacy?: 'private' | 'shared'
  }) => {
    return memoryDb.update(id, updates as any)
  })

  // Delete a memory
  ipcMain.handle('memory:delete', async (_, id: string) => {
    memoryDb.delete(id)
    return { success: true }
  })

  // Delete all memories in a scope
  ipcMain.handle('memory:deleteByScope', async (_, scope: string, scopeId?: string) => {
    memoryDb.deleteByScope(scope as any, scopeId)
    return { success: true }
  })

  // Decay confidence over time
  ipcMain.handle('memory:decayConfidence', async (_, decayRate?: number) => {
    memoryDb.decayConfidence(decayRate)
    return { success: true }
  })
}
