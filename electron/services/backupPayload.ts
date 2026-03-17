import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import {
  BACKUP_DIRECTORIES,
  BACKUP_ROOT_FILES,
  type BackupPayload,
  resolveBackupDestination,
  validateBackupPayload,
} from './backupPayloadSchema.js'

function getUserDataPath(): string {
  return app.getPath('userData')
}

function getDatabasePath(): string {
  return path.join(getUserDataPath(), 'jelico-data.json')
}

function getSoulPath(): string {
  return path.join(getUserDataPath(), 'soul.json')
}

function createSafetyBackupSnapshot(timestamp: number): void {
  const backupPath = path.join(getUserDataPath(), `jelico-restore.backup-${timestamp}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(collectBackupPayload(), null, 2))
}

function readJsonIfPresent(filePath: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(filePath)) return undefined
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  return undefined
}

function collectFilesRecursively(basePath: string, relativeBase: string, output: Record<string, string>) {
  if (!fs.existsSync(basePath)) return

  const entries = fs.readdirSync(basePath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(basePath, entry.name)
    const relativePath = path.posix.join(relativeBase, entry.name)

    if (entry.isSymbolicLink()) {
      continue
    }

    if (entry.isDirectory()) {
      collectFilesRecursively(fullPath, relativePath, output)
      continue
    }

    output[relativePath] = fs.readFileSync(fullPath).toString('base64')
  }
}

function restoreFiles(files: Record<string, string>) {
  const userDataPath = getUserDataPath()
  const validatedFiles = Object.entries(files).map(([relativePath, base64Content]) => ({
    destination: resolveBackupDestination(userDataPath, relativePath),
    base64Content,
  }))

  for (const directory of BACKUP_DIRECTORIES) {
    fs.rmSync(path.join(userDataPath, directory), { recursive: true, force: true })
  }
  for (const fileName of BACKUP_ROOT_FILES) {
    fs.rmSync(path.join(userDataPath, fileName), { force: true })
  }

  for (const { destination, base64Content } of validatedFiles) {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, Buffer.from(base64Content, 'base64'))
  }
}

export function collectBackupPayload(): BackupPayload {
  const files: Record<string, string> = {}
  const userDataPath = getUserDataPath()

  for (const directory of BACKUP_DIRECTORIES) {
    collectFilesRecursively(path.join(userDataPath, directory), directory, files)
  }
  for (const fileName of BACKUP_ROOT_FILES) {
    const filePath = path.join(userDataPath, fileName)
    if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isSymbolicLink()) {
      files[fileName] = fs.readFileSync(filePath).toString('base64')
    }
  }

  const payload: BackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    appVersion: app.getVersion(),
    database: readJsonIfPresent(getDatabasePath()),
    soul: readJsonIfPresent(getSoulPath()),
  }

  if (Object.keys(files).length > 0) {
    payload.files = files
  }

  return payload
}

export function applyBackupPayload(payloadInput: BackupPayload | unknown): {
  database: boolean
  soul: boolean
  filesRestored: number
} {
  const payload = validateBackupPayload(payloadInput)
  const userDataPath = getUserDataPath()
  const timestamp = Date.now()
  const databasePath = getDatabasePath()
  const soulPath = getSoulPath()

  createSafetyBackupSnapshot(timestamp)

  if (payload.database) {
    if (fs.existsSync(databasePath)) {
      fs.copyFileSync(databasePath, path.join(userDataPath, `jelico-data.backup-${timestamp}.json`))
    }
    fs.writeFileSync(databasePath, JSON.stringify(payload.database, null, 2))
  }

  if (payload.soul) {
    if (fs.existsSync(soulPath)) {
      fs.copyFileSync(soulPath, path.join(userDataPath, `soul.backup-${timestamp}.json`))
    }
    fs.writeFileSync(soulPath, JSON.stringify(payload.soul, null, 2))
  }

  if (payload.files) {
    restoreFiles(payload.files)
  }

  return {
    database: Boolean(payload.database),
    soul: Boolean(payload.soul),
    filesRestored: payload.files ? Object.keys(payload.files).length : 0,
  }
}

export function getBackupStats() {
  const dataPath = getUserDataPath()
  const dbPath = getDatabasePath()
  const soulPath = getSoulPath()

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
        queuedMessages: db.queued_messages?.length || 0,
        workspaces: db.workspaces?.length || 0,
        artifacts: db.artifacts?.length || 0,
        memories: db.memories?.length || 0,
        permissions: db.permissions?.length || 0,
        todos: db.todos?.length || 0,
      }
      stats.databaseSize = fs.statSync(dbPath).size
    } catch (error) {
      console.error('Failed to read database stats:', error)
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
    } catch (error) {
      console.error('Failed to read soul stats:', error)
    }
  }

  return stats
}

export function clearAllLocalData(): void {
  const userDataPath = getUserDataPath()
  const databasePath = getDatabasePath()
  const soulPath = getSoulPath()
  const timestamp = Date.now()

  if (fs.existsSync(databasePath)) {
    fs.copyFileSync(databasePath, path.join(userDataPath, `jelico-data.backup-${timestamp}.json`))
    fs.writeFileSync(databasePath, JSON.stringify({
      providers: [],
      conversations: [],
      messages: [],
      queued_messages: [],
      workspaces: [],
      artifacts: [],
      memories: [],
      permissions: [],
      todos: [],
    }, null, 2))
  }

  if (fs.existsSync(soulPath)) {
    fs.copyFileSync(soulPath, path.join(userDataPath, `soul.backup-${timestamp}.json`))
    fs.writeFileSync(soulPath, JSON.stringify({
      patterns: [],
      corrections: [],
      preferences: {},
      lastAnalyzedAt: 0,
      version: 1,
    }, null, 2))
  }

  for (const directory of BACKUP_DIRECTORIES) {
    fs.rmSync(path.join(userDataPath, directory), { recursive: true, force: true })
  }
  for (const fileName of BACKUP_ROOT_FILES) {
    fs.rmSync(path.join(userDataPath, fileName), { force: true })
  }
}
