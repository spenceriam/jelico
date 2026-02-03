import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { artifactDb } from '../services/database.js'
import { copyArtifactFile, getArtifactsBasePath } from '../services/artifactFiles.js'
import * as path from 'path'

export function registerArtifactHandlers() {
  // List all artifacts
  ipcMain.handle('artifacts:list', async () => {
    return artifactDb.list()
  })

  // Get a single artifact
  ipcMain.handle('artifacts:get', async (_, id: string) => {
    return artifactDb.get(id)
  })

  // Get artifacts for a conversation (returns latest revisions only)
  ipcMain.handle('artifacts:getByConversation', async (_, conversationId: string) => {
    return artifactDb.getByConversation(conversationId)
  })

  // Get all revisions of an artifact
  ipcMain.handle('artifacts:getRevisions', async (_, baseArtifactId: string) => {
    return artifactDb.getRevisions(baseArtifactId)
  })

  // Get the latest revision of an artifact
  ipcMain.handle('artifacts:getLatestRevision', async (_, baseArtifactId: string) => {
    return artifactDb.getLatestRevision(baseArtifactId)
  })

  // Create an artifact
  ipcMain.handle('artifacts:create', async (_, artifact: {
    conversationId?: string
    type: string
    title: string
    content: string
    language?: string
    filePath?: string
    baseArtifactId?: string
  }) => {
    return artifactDb.create(artifact)
  })

  // Update an artifact (creates revision if content changes)
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

  // Delete an artifact (and all its revisions)
  ipcMain.handle('artifacts:delete', async (_, id: string) => {
    artifactDb.delete(id)
    return { success: true }
  })

  // Delete all artifacts for a conversation
  ipcMain.handle('artifacts:deleteByConversation', async (_, conversationId: string) => {
    artifactDb.deleteByConversation(conversationId)
    return { success: true }
  })

  // Get artifact file path (for external access)
  ipcMain.handle('artifacts:getFilePath', async (_, id: string) => {
    const artifact = artifactDb.get(id)
    if (!artifact) return { success: false, error: 'Artifact not found' }
    if (!artifact.file_path) return { success: false, error: 'Artifact has no file path' }
    return { success: true, filePath: artifact.file_path }
  })

  // Reveal artifact in file manager
  ipcMain.handle('artifacts:reveal', async (_, id: string) => {
    const artifact = artifactDb.get(id)
    if (!artifact) return { success: false, error: 'Artifact not found' }
    if (!artifact.file_path) return { success: false, error: 'Artifact has no file path' }

    try {
      shell.showItemInFolder(artifact.file_path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Download artifact (save to user-chosen location)
  ipcMain.handle('artifacts:download', async (_, id: string) => {
    const artifact = artifactDb.get(id)
    if (!artifact) return { success: false, error: 'Artifact not found' }
    if (!artifact.file_path) return { success: false, error: 'Artifact has no file path' }

    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    // Get the filename from the existing file path
    const filename = path.basename(artifact.file_path)

    try {
      const result = await dialog.showSaveDialog(win, {
        title: 'Download Artifact',
        defaultPath: filename,
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      const copied = copyArtifactFile(artifact.file_path, result.filePath)
      if (copied) {
        return { success: true, savedTo: result.filePath }
      } else {
        return { success: false, error: 'Failed to copy file' }
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Get artifacts base directory path
  ipcMain.handle('artifacts:getBasePath', async () => {
    return { success: true, basePath: getArtifactsBasePath() }
  })
}
