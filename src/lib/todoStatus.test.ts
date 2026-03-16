import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeHistoryEntries, normalizeTodoStatus } from './todoStatus'

test('normalizeTodoStatus maps common completion aliases to done', () => {
  assert.equal(normalizeTodoStatus('complete'), 'done')
  assert.equal(normalizeTodoStatus('completed'), 'done')
  assert.equal(normalizeTodoStatus('finished'), 'done')
})

test('normalizeTodoStatus maps progress aliases to canonical values', () => {
  assert.equal(normalizeTodoStatus('in progress'), 'in_progress')
  assert.equal(normalizeTodoStatus('working'), 'in_progress')
  assert.equal(normalizeTodoStatus('waiting'), 'blocked')
})

test('normalizeHistoryEntries normalizes every history status entry', () => {
  const normalized = normalizeHistoryEntries([
    { status: 'completed' as never, at: 1 },
    { status: 'working' as never, at: 2 },
    { status: 'blocked_on_dependency' as never, at: 3 },
  ])

  assert.deepEqual(normalized, [
    { status: 'done', at: 1 },
    { status: 'in_progress', at: 2 },
    { status: 'blocked', at: 3 },
  ])
})
