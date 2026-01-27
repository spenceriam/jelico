import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  getSandboxPath,
  getConversationSandboxPath,
  listSandboxFiles,
  writeSandboxFile,
  readSandboxFile,
  deleteSandboxFile,
  clearConversationSandbox,
  exportSandbox,
  getSandboxStructure,
} from '../services/sandbox.js'

export function registerSandboxHandlers() {
  // Get the sandbox path
  ipcMain.handle('sandbox:getPath', () => {
    return getSandboxPath()
  })

  // Get sandbox path for a conversation
  ipcMain.handle('sandbox:getConversationPath', (_, conversationId: string) => {
    return getConversationSandboxPath(conversationId)
  })

  // List files in a conversation's sandbox
  ipcMain.handle('sandbox:listFiles', (_, conversationId: string) => {
    return listSandboxFiles(conversationId)
  })

  // Get sandbox directory structure
  ipcMain.handle('sandbox:getStructure', (_, conversationId: string) => {
    return getSandboxStructure(conversationId)
  })

  // Write a file to the sandbox
  ipcMain.handle(
    'sandbox:writeFile',
    (_, conversationId: string, relativePath: string, content: string) => {
      return writeSandboxFile(conversationId, relativePath, content)
    }
  )

  // Read a file from the sandbox
  ipcMain.handle('sandbox:readFile', (_, conversationId: string, relativePath: string) => {
    return readSandboxFile(conversationId, relativePath)
  })

  // Delete a file from the sandbox
  ipcMain.handle('sandbox:deleteFile', (_, conversationId: string, relativePath: string) => {
    return deleteSandboxFile(conversationId, relativePath)
  })

  // Clear all files for a conversation
  ipcMain.handle('sandbox:clear', (_, conversationId: string) => {
    clearConversationSandbox(conversationId)
    return { success: true }
  })

  // Export sandbox to a directory (with dialog)
  ipcMain.handle('sandbox:export', async (_, conversationId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Export Sandbox Files',
      buttonLabel: 'Export Here',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true }
    }

    const destinationPath = result.filePaths[0]
    return await exportSandbox(conversationId, destinationPath)
  })

  // Export sandbox to a specific path (without dialog)
  ipcMain.handle(
    'sandbox:exportToPath',
    async (_, conversationId: string, destinationPath: string) => {
      return await exportSandbox(conversationId, destinationPath)
    }
  )
}
