import test from 'node:test'
import assert from 'node:assert/strict'
import { getSupportedReasoningEfforts, sanitizeReasoningEffort } from './reasoning'

test('gpt-5.1 reasoning efforts exclude minimal', () => {
  assert.deepEqual(getSupportedReasoningEfforts('openai', 'gpt-5.1'), [
    'none',
    'low',
    'medium',
    'high',
  ])
})

test('gpt-5.1-codex-max exposes only documented extra-high options', () => {
  assert.deepEqual(getSupportedReasoningEfforts('openai', 'openai/gpt-5.1-codex-max-2025-11-13'), [
    'none',
    'medium',
    'high',
    'xhigh',
  ])
})

test('invalid reasoning effort values are sanitized away', () => {
  assert.equal(sanitizeReasoningEffort('openai', 'gpt-4o', 'xhigh'), null)
  assert.equal(sanitizeReasoningEffort('openai', 'gpt-5.1-codex-max', 'xhigh'), 'xhigh')
})
