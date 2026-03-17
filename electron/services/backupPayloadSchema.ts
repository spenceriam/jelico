import path from 'path'

export interface BackupPayload {
  version: number
  exportedAt: number
  appVersion: string
  database?: Record<string, unknown>
  soul?: Record<string, unknown>
  files?: Record<string, string>
}

export const BACKUP_DIRECTORIES = ['artifacts', 'sandbox'] as const
export const BACKUP_ROOT_FILES = ['skills.json'] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeBackupRelativePath(relativePath: string): string {
  const normalizedInput = relativePath.replace(/\\/g, '/').trim()

  if (!normalizedInput) {
    throw new Error('Backup contains an empty file path.')
  }

  if (normalizedInput.startsWith('/') || /^[A-Za-z]:\//.test(normalizedInput)) {
    throw new Error(`Backup contains an absolute file path: ${relativePath}`)
  }

  const normalizedPath = path.posix.normalize(normalizedInput)
  if (
    normalizedPath === '.' ||
    normalizedPath === '..' ||
    normalizedPath.startsWith('../') ||
    normalizedPath.includes('/../')
  ) {
    throw new Error(`Backup contains a path outside Jelico storage: ${relativePath}`)
  }

  if (BACKUP_ROOT_FILES.includes(normalizedPath as typeof BACKUP_ROOT_FILES[number])) {
    return normalizedPath
  }

  const allowedDirectory = BACKUP_DIRECTORIES.find((directory) =>
    normalizedPath.startsWith(`${directory}/`)
  )
  if (allowedDirectory) {
    return normalizedPath
  }

  throw new Error(`Backup contains an unsupported file path: ${relativePath}`)
}

export function resolveBackupDestination(userDataPath: string, relativePath: string): string {
  const normalizedPath = normalizeBackupRelativePath(relativePath)
  const destination = path.resolve(userDataPath, normalizedPath)
  const relativeToUserData = path.relative(userDataPath, destination)

  if (!relativeToUserData || relativeToUserData.startsWith('..') || path.isAbsolute(relativeToUserData)) {
    throw new Error(`Backup restore attempted to escape Jelico storage: ${relativePath}`)
  }

  return destination
}

export function validateBackupPayload(payload: unknown): BackupPayload {
  if (!isPlainObject(payload)) {
    throw new Error('Invalid backup format')
  }

  if (typeof payload.version !== 'number' || !Number.isFinite(payload.version) || payload.version <= 0) {
    throw new Error('Invalid backup format')
  }

  if (typeof payload.exportedAt !== 'number' || !Number.isFinite(payload.exportedAt) || payload.exportedAt <= 0) {
    throw new Error('Invalid backup format')
  }

  if (payload.database !== undefined && !isPlainObject(payload.database)) {
    throw new Error('Invalid backup database payload')
  }

  if (payload.soul !== undefined && !isPlainObject(payload.soul)) {
    throw new Error('Invalid backup soul payload')
  }

  const files = payload.files
  const hasFilesSection = files !== undefined
  const normalizedFiles: Record<string, string> = {}
  if (files !== undefined) {
    if (!isPlainObject(files)) {
      throw new Error('Invalid backup file payload')
    }

    for (const [relativePath, base64Content] of Object.entries(files)) {
      if (typeof base64Content !== 'string') {
        throw new Error(`Invalid backup file content for ${relativePath}`)
      }
      normalizedFiles[normalizeBackupRelativePath(relativePath)] = base64Content
    }
  }

  const hasRestorableSection = payload.database !== undefined ||
    payload.soul !== undefined ||
    hasFilesSection

  if (!hasRestorableSection) {
    throw new Error('Backup payload does not contain any restorable data')
  }

  return {
    version: payload.version,
    exportedAt: payload.exportedAt,
    appVersion: typeof payload.appVersion === 'string' ? payload.appVersion : 'unknown',
    database: payload.database,
    soul: payload.soul,
    ...(hasFilesSection ? { files: normalizedFiles } : {}),
  }
}
