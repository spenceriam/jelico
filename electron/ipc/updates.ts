import { app, ipcMain, BrowserWindow, shell } from 'electron'
import { applyDownloadedUpdate, checkForUpdates, downloadLatestUpdate } from '../services/updates'

export function registerUpdateHandlers() {
  ipcMain.handle('updates:currentVersion', async () => {
    return app.getVersion()
  })

  ipcMain.handle('updates:check', async () => {
    return checkForUpdates()
  })

  ipcMain.handle('updates:download', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return downloadLatestUpdate(window ?? null, (progress) => {
      event.sender.send('updates:download-progress', progress)
    })
  })

  ipcMain.handle('updates:openRelease', async (_event, url: string) => {
    if (url) {
      await shell.openExternal(url)
    }
    return true
  })

  ipcMain.handle('updates:applyDownloaded', async () => {
    return applyDownloadedUpdate()
  })
}
