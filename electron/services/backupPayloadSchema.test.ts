import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import {
  normalizeBackupRelativePath,
  resolveBackupDestination,
  validateBackupPayload,
} from './backupPayloadSchema'

test('normalizeBackupRelativePath accepts supported Jelico-managed paths', () => {
  assert.equal(normalizeBackupRelativePath('skills.json'), 'skills.json')
  assert.equal(normalizeBackupRelativePath('artifacts/session/output.html'), 'artifacts/session/output.html')
  assert.equal(normalizeBackupRelativePath('sandbox\\conversation\\notes.md'), 'sandbox/conversation/notes.md')
})

test('normalizeBackupRelativePath rejects traversal, absolute, and unsupported paths', () => {
  assert.throws(() => normalizeBackupRelativePath('../skills.json'), /outside Jelico storage/)
  assert.throws(() => normalizeBackupRelativePath('/tmp/skills.json'), /absolute file path/)
  assert.throws(() => normalizeBackupRelativePath('C:/tmp/skills.json'), /absolute file path/)
  assert.throws(() => normalizeBackupRelativePath('github-backup.json'), /unsupported file path/)
})

test('resolveBackupDestination keeps restored files inside userData', () => {
  const destination = resolveBackupDestination('/tmp/jelico', 'artifacts/example/file.txt')
  assert.equal(destination, path.resolve('/tmp/jelico', 'artifacts/example/file.txt'))
})

test('validateBackupPayload requires metadata and normalizes file keys', () => {
  const payload = validateBackupPayload({
    version: 1,
    exportedAt: 1234,
    appVersion: '0.39.0',
    database: { conversations: [] },
    soul: { patterns: [] },
    files: {
      'sandbox\\session\\notes.md': 'Zm9v',
      'skills.json': 'YmFy',
    },
  })

  assert.deepEqual(payload.files, {
    'sandbox/session/notes.md': 'Zm9v',
    'skills.json': 'YmFy',
  })
})

test('validateBackupPayload preserves an explicit empty files snapshot', () => {
  const payload = validateBackupPayload({
    version: 1,
    exportedAt: 1234,
    appVersion: '0.39.0',
    files: {},
  })

  assert.deepEqual(payload.files, {})
})

test('validateBackupPayload rejects malformed content before restore', () => {
  assert.throws(() => validateBackupPayload(null), /Invalid backup format/)
  assert.throws(() => validateBackupPayload({
    version: 1,
    exportedAt: 1234,
    appVersion: '0.39.0',
  }), /does not contain any restorable data/)
  assert.throws(() => validateBackupPayload({
    version: 1,
    exportedAt: 1234,
    files: ['bad'],
  }), /Invalid backup file payload/)
  assert.throws(() => validateBackupPayload({
    version: 1,
    exportedAt: 1234,
    files: {
      '../escape.txt': 'Zm9v',
    },
  }), /outside Jelico storage/)
})
