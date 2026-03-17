import { app, ipcMain, shell } from 'electron'
import { applyDownloadedUpdate, checkForUpdates, clearDownloadedUpdateState, downloadLatestUpdate } from '../services/updates'

export function registerUpdateHandlers() {
  ipcMain.handle('updates:currentVersion', async () => {
    return app.getVersion()
  })

  ipcMain.handle('updates:check', async () => {
    return checkForUpdates()
  })

  ipcMain.handle('updates:download', async (event) => {
    return downloadLatestUpdate((progress) => {
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

  ipcMain.handle('updates:clearDownloadedState', async () => {
    await clearDownloadedUpdateState()
    return true
  })
}
