import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import {
  __setRipgrepSpawnForTests,
  __setRipgrepTimeoutForTests,
  searchFileContents,
} from './contentSearch'

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jelico-content-search-'))
  try {
    await fn(dir)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

test('searchFileContents returns structured matches with path/line/column/snippet', async () => {
  await withTempDir(async (dir) => {
    const srcDir = path.join(dir, 'src')
    await fs.mkdir(srcDir, { recursive: true })
    await fs.writeFile(
      path.join(srcDir, 'example.ts'),
      [
        'const alpha = 1',
        '// TODO: replace this constant',
        'export const beta = alpha + 1',
      ].join('\n'),
      'utf-8'
    )

    const result = await searchFileContents({
      rootDir: dir,
      pattern: 'TODO',
      contextLines: 1,
    })

    assert.equal(result.truncated, false)
    assert.equal(result.partial, false)
    assert.equal(result.matches.length, 1)
    assert.equal(result.matches[0].path, 'src/example.ts')
    assert.equal(result.matches[0].line, 2)
    assert.equal(result.matches[0].column, 4)
    assert.match(result.matches[0].snippet, /TODO/)
    assert.match(result.matches[0].snippet, /const alpha = 1/)
    assert.match(result.matches[0].snippet, /export const beta = alpha \+ 1/)
  })
})

test('searchFileContents throws for invalid regex patterns', async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, 'a.txt'), 'abc', 'utf-8')
    await assert.rejects(
      () => searchFileContents({ rootDir: dir, pattern: '[' }),
      /Invalid regex pattern/
    )
  })
})

test('searchFileContents handles zero-length patterns without infinite loops', async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, 'a.txt'), 'first\nsecond\nthird', 'utf-8')
    const result = await searchFileContents({
      rootDir: dir,
      pattern: '^',
      multiline: true,
      maxResults: 20,
    })

    assert.equal(result.scannedFiles, 1)
    assert.equal(result.truncated, false)
    assert.equal(result.partial, false)
    assert.equal(result.matches.length, 0)
  })
})

test('searchFileContents enforces maxResults and truncates deterministically', async () => {
  await withTempDir(async (dir) => {
    const lines = Array.from({ length: 40 }, (_, idx) => `line ${idx} token`)
    await fs.writeFile(path.join(dir, 'many.txt'), lines.join('\n'), 'utf-8')

    const result = await searchFileContents({
      rootDir: dir,
      pattern: 'token',
      maxResults: 5,
    })

    assert.equal(result.truncated, true)
    assert.equal(result.partial, false)
    assert.equal(result.matches.length, 5)
    assert.equal(result.matches[0].line, 1)
  })
})

test('searchFileContents honors contextLines=0 without adding surrounding lines', async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(
      path.join(dir, 'exact.txt'),
      [
        'before match',
        'needle line',
        'after match',
      ].join('\n'),
      'utf-8'
    )

    const result = await searchFileContents({
      rootDir: dir,
      pattern: 'needle',
      contextLines: 0,
    })

    assert.equal(result.matches.length, 1)
    assert.equal(result.partial, false)
    assert.equal(result.matches[0].snippet, 'needle line')
  })
})

test('searchFileContents reports all scanned files even when nothing matches', async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, 'a.txt'), 'alpha', 'utf-8')
    await fs.writeFile(path.join(dir, 'b.txt'), 'beta', 'utf-8')
    await fs.writeFile(path.join(dir, 'c.txt'), 'gamma', 'utf-8')

    const result = await searchFileContents({
      rootDir: dir,
      pattern: 'zzz',
    })

    assert.equal(result.matches.length, 0)
    assert.equal(result.scannedFiles, 3)
    assert.equal(result.truncated, false)
    assert.equal(result.partial, false)
  })
})

test('searchFileContents skips binary-looking files', async () => {
  await withTempDir(async (dir) => {
    const binaryPayload = Buffer.from([0x00, 0x10, 0x20, 0x30, 0x41, 0x42])
    await fs.writeFile(path.join(dir, 'binary.bin'), binaryPayload)

    const result = await searchFileContents({
      rootDir: dir,
      pattern: 'AB',
    })

    assert.equal(result.matches.length, 0)
    assert.equal(result.scannedFiles, 1)
    assert.equal(result.partial, false)
  })
})

test('searchFileContents falls back to the node scanner when ripgrep times out', async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, 'slow.txt'), 'timeout token', 'utf-8')

    let killCalls = 0
    const fakeChild = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill() {
        killCalls += 1
        return true
      },
    })

    __setRipgrepSpawnForTests(() => fakeChild as any)
    __setRipgrepTimeoutForTests(5)

    try {
      const result = await searchFileContents({
        rootDir: dir,
        pattern: 'token',
      })

      assert.equal(killCalls, 1)
      assert.equal(result.partial, false)
      assert.equal(result.matches.length, 1)
      assert.equal(result.matches[0].path, 'slow.txt')
      assert.match(result.matches[0].snippet, /timeout token/)
    } finally {
      __setRipgrepSpawnForTests(null)
      __setRipgrepTimeoutForTests(null)
    }
  })
})
