import { clipboard, dialog, ipcMain } from 'electron'
import fs from 'fs'

export function registerLogHandlers() {
  ipcMain.handle('logs:copyConversationLog', async (_, markdown: string) => {
    clipboard.writeText(markdown || '')
    return { success: true }
  })

  ipcMain.handle('logs:saveConversationLog', async (_, defaultFileName: string, markdown: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Conversation Log',
      defaultPath: defaultFileName || 'jelico-conversation-log.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    fs.writeFileSync(result.filePath, markdown || '', 'utf8')
    return { success: true, filePath: result.filePath }
  })
}
