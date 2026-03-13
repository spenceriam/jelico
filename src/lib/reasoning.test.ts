import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReasoningProviderOptions, getSupportedReasoningEfforts, sanitizeReasoningEffort } from './reasoning'

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

test('anthropic effort options are exposed for supported opus models', () => {
  assert.deepEqual(getSupportedReasoningEfforts('anthropic', 'claude-opus-4-5-20251101'), [
    'low',
    'medium',
    'high',
  ])
  assert.deepEqual(
    buildReasoningProviderOptions('anthropic-compatible', 'claude-opus-4-20250514', 'medium'),
    {
      anthropic: {
        effort: 'medium',
      },
    }
  )
})

test('gemini 3 thinking levels reflect model family support', () => {
  assert.deepEqual(getSupportedReasoningEfforts('google', 'gemini-3-pro-preview'), ['low', 'high'])
  assert.deepEqual(getSupportedReasoningEfforts('google', 'google/gemini-3-flash-preview'), [
    'minimal',
    'low',
    'medium',
    'high',
  ])
  assert.equal(sanitizeReasoningEffort('google', 'gemini-3-pro-preview', 'medium'), null)
  assert.deepEqual(buildReasoningProviderOptions('google', 'gemini-3-flash-preview', 'high'), {
    google: {
      thinkingConfig: {
        thinkingLevel: 'high',
      },
    },
  })
})

test('openai-compatible providers reuse openai reasoning payloads', () => {
  assert.deepEqual(
    buildReasoningProviderOptions('openrouter', 'openai/gpt-5.1-codex-max-2025-11-13', 'xhigh'),
    {
      openai: {
        reasoningEffort: 'xhigh',
      },
    }
  )
})
