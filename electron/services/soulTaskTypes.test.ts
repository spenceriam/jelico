import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeTaskTypes, normalizeTaskTypes } from './soulTaskTypes'

test('normalizeTaskTypes keeps unique non-empty strings', () => {
  assert.deepEqual(
    normalizeTaskTypes(['review', '', 'review', 'debugging', 1, null]),
    ['review', 'debugging']
  )
})

test('mergeTaskTypes accumulates prior and new task types', () => {
  assert.deepEqual(
    mergeTaskTypes(['review', 'workspace'], ['debugging', 'review']),
    ['review', 'workspace', 'debugging']
  )
})

test('mergeTaskTypes tolerates missing stored values', () => {
  assert.deepEqual(mergeTaskTypes(undefined, ['general']), ['general'])
})
