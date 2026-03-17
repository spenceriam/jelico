import {
  type BackupPayload,
  validateBackupPayload,
} from './backupPayloadSchema'

export interface GithubChunkedBackupManifest {
  manifestVersion: 1
  format: 'chunked'
  payloadEncoding: 'base64'
  payloadVersion: number
  exportedAt: number
  appVersion: string
  chunkCount: number
  chunks: string[]
}

export interface GithubBackupChunkFile {
  path: string
  content: string
}

export const GITHUB_BACKUP_CHUNK_CHARS = 250_000

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createGithubChunkedBackupFiles(
  payload: BackupPayload,
  chunkBasePath: string,
  options?: { chunkChars?: number }
): {
  manifest: GithubChunkedBackupManifest
  chunkFiles: GithubBackupChunkFile[]
} {
  const chunkChars = Math.max(1, Math.floor(options?.chunkChars ?? GITHUB_BACKUP_CHUNK_CHARS))
  const encodedPayload = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8').toString('base64')
  const chunkFiles: GithubBackupChunkFile[] = []
  const chunks: string[] = []

  for (let start = 0, index = 0; start < encodedPayload.length; start += chunkChars, index += 1) {
    const chunkPath = `${chunkBasePath}/part-${String(index + 1).padStart(4, '0')}.txt`
    chunkFiles.push({
      path: chunkPath,
      content: encodedPayload.slice(start, start + chunkChars),
    })
    chunks.push(chunkPath)
  }

  return {
    manifest: {
      manifestVersion: 1,
      format: 'chunked',
      payloadEncoding: 'base64',
      payloadVersion: payload.version,
      exportedAt: payload.exportedAt,
      appVersion: payload.appVersion,
      chunkCount: chunkFiles.length,
      chunks,
    },
    chunkFiles,
  }
}

export function parseGithubChunkedBackupManifest(input: unknown): GithubChunkedBackupManifest {
  if (!isPlainObject(input)) {
    throw new Error('Invalid GitHub backup manifest')
  }

  if (input.manifestVersion !== 1 || input.format !== 'chunked' || input.payloadEncoding !== 'base64') {
    throw new Error('Invalid GitHub backup manifest')
  }

  if (typeof input.payloadVersion !== 'number' || !Number.isFinite(input.payloadVersion) || input.payloadVersion <= 0) {
    throw new Error('Invalid GitHub backup manifest')
  }

  if (typeof input.exportedAt !== 'number' || !Number.isFinite(input.exportedAt) || input.exportedAt <= 0) {
    throw new Error('Invalid GitHub backup manifest')
  }

  if (typeof input.appVersion !== 'string') {
    throw new Error('Invalid GitHub backup manifest')
  }

  if (typeof input.chunkCount !== 'number' || !Number.isInteger(input.chunkCount) || input.chunkCount <= 0) {
    throw new Error('Invalid GitHub backup manifest')
  }

  if (!Array.isArray(input.chunks) || input.chunks.length !== input.chunkCount) {
    throw new Error('Invalid GitHub backup manifest')
  }

  const chunks = input.chunks.map((chunkPath) => {
    if (typeof chunkPath !== 'string' || !chunkPath.trim()) {
      throw new Error('Invalid GitHub backup manifest')
    }
    return chunkPath
  })

  return {
    manifestVersion: 1,
    format: 'chunked',
    payloadEncoding: 'base64',
    payloadVersion: input.payloadVersion,
    exportedAt: input.exportedAt,
    appVersion: input.appVersion,
    chunkCount: input.chunkCount,
    chunks,
  }
}

export function assembleGithubChunkedBackupPayload(
  manifest: GithubChunkedBackupManifest,
  chunkContents: string[]
): BackupPayload {
  if (chunkContents.length !== manifest.chunkCount) {
    throw new Error('Incomplete GitHub backup payload')
  }

  const encodedPayload = chunkContents.join('')
  const serializedPayload = Buffer.from(encodedPayload, 'base64').toString('utf-8')
  return validateBackupPayload(JSON.parse(serializedPayload))
}
