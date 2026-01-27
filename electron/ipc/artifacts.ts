import { ipcMain } from 'electron'
import { artifactDb } from '../services/database.js'

export function registerArtifactHandlers() {
  // List all artifacts
  ipcMain.handle('artifacts:list', async () => {
    return artifactDb.list()
  })

  // Get a single artifact
  ipcMain.handle('artifacts:get', async (_, id: string) => {
    return artifactDb.get(id)
  })

  // Get artifacts for a conversation
  ipcMain.handle('artifacts:getByConversation', async (_, conversationId: string) => {
    return artifactDb.getByConversation(conversationId)
  })

  // Create an artifact
  ipcMain.handle('artifacts:create', async (_, artifact: {
    conversationId?: string
    type: string
    title: string
    content: string
    language?: string
    filePath?: string
  }) => {
    return artifactDb.create(artifact)
  })

  // Update an artifact
  ipcMain.handle('artifacts:update', async (_, id: string, updates: {
    conversationId?: string
    type?: string
    title?: string
    content?: string
    language?: string
    filePath?: string
  }) => {
    return artifactDb.update(id, updates)
  })

  // Delete an artifact
  ipcMain.handle('artifacts:delete', async (_, id: string) => {
    artifactDb.delete(id)
    return { success: true }
  })

  // Delete all artifacts for a conversation
  ipcMain.handle('artifacts:deleteByConversation', async (_, conversationId: string) => {
    artifactDb.deleteByConversation(conversationId)
    return { success: true }
  })
}
