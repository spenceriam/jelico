import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assembleGithubChunkedBackupPayload,
  createGithubChunkedBackupFiles,
  parseGithubChunkedBackupManifest,
} from './githubBackupChunks'
import type { BackupPayload } from './backupPayloadSchema'

test('chunked GitHub backup files round-trip through the manifest', () => {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: 1234,
    appVersion: '0.39.0',
    database: {
      conversations: [{ title: 'naive unicode check: cafe and snowman ☃' }],
    },
    soul: {
      preferences: {
        tone: 'concise',
      },
    },
    files: {
      'skills.json': Buffer.from('custom skill body').toString('base64'),
      'artifacts/session/output.txt': Buffer.from('artifact output').toString('base64'),
    },
  }

  const { manifest, chunkFiles } = createGithubChunkedBackupFiles(payload, 'jelico-backups/chunks/test-run', {
    chunkChars: 24,
  })

  assert.equal(manifest.chunkCount, chunkFiles.length)
  assert.equal(chunkFiles.length > 1, true)
  assert.deepEqual(
    manifest.chunks,
    chunkFiles.map((chunkFile) => chunkFile.path)
  )

  const parsedManifest = parseGithubChunkedBackupManifest(manifest)
  const restoredPayload = assembleGithubChunkedBackupPayload(
    parsedManifest,
    chunkFiles.map((chunkFile) => chunkFile.content)
  )

  assert.deepEqual(restoredPayload, payload)
})

test('parseGithubChunkedBackupManifest rejects malformed manifests', () => {
  assert.throws(() => parseGithubChunkedBackupManifest(null), /Invalid GitHub backup manifest/)
  assert.throws(() => parseGithubChunkedBackupManifest({
    manifestVersion: 1,
    format: 'chunked',
    payloadEncoding: 'base64',
    payloadVersion: 1,
    exportedAt: 1234,
    appVersion: '0.39.0',
    chunkCount: 1,
    chunks: [],
  }), /Invalid GitHub backup manifest/)
})

test('assembleGithubChunkedBackupPayload rejects incomplete chunk sets', () => {
  const { manifest } = createGithubChunkedBackupFiles({
    version: 1,
    exportedAt: 1234,
    appVersion: '0.39.0',
    files: {
      'skills.json': Buffer.from('skill').toString('base64'),
    },
  }, 'jelico-backups/chunks/test-run', {
    chunkChars: 8,
  })

  assert.throws(() => assembleGithubChunkedBackupPayload(manifest, []), /Incomplete GitHub backup payload/)
})
