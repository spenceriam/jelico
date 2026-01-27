import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export function registerBackupHandlers() {
  // Export all data to a JSON file
  ipcMain.handle('backup:export', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    // Gather all data
    const dataPath = app.getPath('userData')
    const dbPath = path.join(dataPath, 'jelico-data.json')
    const soulPath = path.join(dataPath, 'soul.json')

    const backup: Record<string, unknown> = {
      version: 1,
      exportedAt: Date.now(),
      appVersion: app.getVersion(),
    }

    // Read database
    if (fs.existsSync(dbPath)) {
      try {
        backup.database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
      } catch (e) {
        console.error('Failed to read database:', e)
      }
    }

    // Read soul
    if (fs.existsSync(soulPath)) {
      try {
        backup.soul = JSON.parse(fs.readFileSync(soulPath, 'utf-8'))
      } catch (e) {
        console.error('Failed to read soul:', e)
      }
    }

    // Show save dialog
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Jelico Data',
      defaultPath: `jelico-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true }
    }

    // Write backup file
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2))
      return { success: true, filePath: result.filePath }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Import data from a JSON backup file
  ipcMain.handle('backup:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    // Show open dialog
    const result = await dialog.showOpenDialog(win, {
      title: 'Import Jelico Data',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true }
    }

    const filePath = result.filePaths[0]

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const backup = JSON.parse(content)

      // Validate backup format
      if (!backup.version || !backup.exportedAt) {
        return { success: false, error: 'Invalid backup format' }
      }

      const dataPath = app.getPath('userData')

      // Import database
      if (backup.database) {
        const dbPath = path.join(dataPath, 'jelico-data.json')
        // Create backup of existing data
        if (fs.existsSync(dbPath)) {
          const backupPath = path.join(dataPath, `jelico-data.backup-${Date.now()}.json`)
          fs.copyFileSync(dbPath, backupPath)
        }
        fs.writeFileSync(dbPath, JSON.stringify(backup.database, null, 2))
      }

      // Import soul
      if (backup.soul) {
        const soulPath = path.join(dataPath, 'soul.json')
        // Create backup of existing soul
        if (fs.existsSync(soulPath)) {
          const backupPath = path.join(dataPath, `soul.backup-${Date.now()}.json`)
          fs.copyFileSync(soulPath, backupPath)
        }
        fs.writeFileSync(soulPath, JSON.stringify(backup.soul, null, 2))
      }

      return {
        success: true,
        imported: {
          database: !!backup.database,
          soul: !!backup.soul,
        },
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get data statistics
  ipcMain.handle('backup:getStats', async () => {
    const dataPath = app.getPath('userData')
    const dbPath = path.join(dataPath, 'jelico-data.json')
    const soulPath = path.join(dataPath, 'soul.json')

    const stats: Record<string, unknown> = {
      dataPath,
    }

    if (fs.existsSync(dbPath)) {
      try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
        stats.database = {
          providers: db.providers?.length || 0,
          conversations: db.conversations?.length || 0,
          messages: db.messages?.length || 0,
          workspaces: db.workspaces?.length || 0,
          artifacts: db.artifacts?.length || 0,
          memories: db.memories?.length || 0,
          permissions: db.permissions?.length || 0,
        }
        stats.databaseSize = fs.statSync(dbPath).size
      } catch (e) {
        console.error('Failed to read database stats:', e)
      }
    }

    if (fs.existsSync(soulPath)) {
      try {
        const soul = JSON.parse(fs.readFileSync(soulPath, 'utf-8'))
        stats.soul = {
          patterns: soul.patterns?.length || 0,
          corrections: soul.corrections?.length || 0,
          preferences: Object.keys(soul.preferences || {}).length,
        }
        stats.soulSize = fs.statSync(soulPath).size
      } catch (e) {
        console.error('Failed to read soul stats:', e)
      }
    }

    return stats
  })

  // Clear all data
  ipcMain.handle('backup:clearAll', async () => {
    const dataPath = app.getPath('userData')
    const dbPath = path.join(dataPath, 'jelico-data.json')
    const soulPath = path.join(dataPath, 'soul.json')

    try {
      // Create backups before clearing
      const timestamp = Date.now()

      if (fs.existsSync(dbPath)) {
        const backupPath = path.join(dataPath, `jelico-data.backup-${timestamp}.json`)
        fs.copyFileSync(dbPath, backupPath)
        fs.writeFileSync(dbPath, JSON.stringify({
          providers: [],
          conversations: [],
          messages: [],
          workspaces: [],
          artifacts: [],
          memories: [],
          permissions: [],
        }, null, 2))
      }

      if (fs.existsSync(soulPath)) {
        const backupPath = path.join(dataPath, `soul.backup-${timestamp}.json`)
        fs.copyFileSync(soulPath, backupPath)
        fs.writeFileSync(soulPath, JSON.stringify({
          patterns: [],
          corrections: [],
          preferences: {},
          lastAnalyzedAt: 0,
          version: 1,
        }, null, 2))
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
