import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import {
  applyBackupPayload,
  clearAllLocalData,
  collectBackupPayload,
  getBackupStats,
} from '../services/backupPayload.js'
import { validateBackupPayload } from '../services/backupPayloadSchema.js'
import {
  getGithubBackupStatus,
  initializeGithubBackupScheduler,
  restoreLatestGithubBackup,
  runGithubBackup,
  saveGithubBackupSettings,
} from '../services/githubBackup.js'

export function registerBackupHandlers() {
  void initializeGithubBackupScheduler()

  ipcMain.handle('backup:export', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    const result = await dialog.showSaveDialog(win, {
      title: 'Export Jelico Data',
      defaultPath: `jelico-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true }
    }

    try {
      fs.writeFileSync(result.filePath, JSON.stringify(collectBackupPayload(), null, 2))
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' }
    }
  })

  ipcMain.handle('backup:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    const result = await dialog.showOpenDialog(win, {
      title: 'Import Jelico Data',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true }
    }

    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8')
      const backup = validateBackupPayload(JSON.parse(content))

      const imported = applyBackupPayload(backup)
      return {
        success: true,
        imported: {
          database: imported.database,
          soul: imported.soul,
        },
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Import failed' }
    }
  })

  ipcMain.handle('backup:getStats', async () => {
    return getBackupStats()
  })

  ipcMain.handle('backup:clearAll', async () => {
    try {
      clearAllLocalData()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Clear failed' }
    }
  })

  ipcMain.handle('backup:getGithubStatus', async () => {
    return getGithubBackupStatus()
  })

  ipcMain.handle('backup:saveGithubSettings', async (_, input: {
    repoUrl: string
    token?: string
    mode: 'manual' | 'on_change' | 'scheduled'
    scheduleHours?: number
  }) => {
    return saveGithubBackupSettings(input)
  })

  ipcMain.handle('backup:runGithubBackup', async () => {
    return runGithubBackup('manual')
  })

  ipcMain.handle('backup:restoreGithubBackup', async () => {
    return restoreLatestGithubBackup()
  })
}
