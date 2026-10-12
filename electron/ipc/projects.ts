import { ipcMain } from 'electron'
import { projectDb } from '../services/database'

function toProjectApi(row: { id: string; name: string; root_path: string; created_at: number; updated_at: number }) {
  return {
    id: row.id,
    name: row.name,
    rootPath: row.root_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerProjectHandlers() {
  ipcMain.handle('projects:list', async () => {
    return projectDb.list().map(toProjectApi)
  })

  ipcMain.handle('projects:create', async (_, input: { name: string; rootPath: string }) => {
    return toProjectApi(projectDb.create(input))
  })

  ipcMain.handle('projects:update', async (_, id: string, updates: { name?: string }) => {
    const row = projectDb.update(id, updates)
    return row ? toProjectApi(row) : null
  })

  ipcMain.handle('projects:delete', async (_, id: string) => {
    projectDb.delete(id)
    return { success: true }
  })
}
