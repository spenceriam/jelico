import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findModelMetadataTarget,
  findOpenAIContextFallback,
  findOpenAIOutputFallback,
  getCompatibleAuthHeaderCandidates,
} from './providerModelLimits'

test('compatible auth header candidates cover bearer and x-api-key variants', () => {
  assert.deepEqual(getCompatibleAuthHeaderCandidates('secret-key'), [
    { Authorization: 'Bearer secret-key' },
    { 'x-api-key': 'secret-key', 'anthropic-version': '2023-06-01' },
    { 'x-api-key': 'secret-key' },
  ])
  assert.deepEqual(getCompatibleAuthHeaderCandidates(null), [{}])
})

test('OpenAI family fallbacks match prefixed and dated model ids', () => {
  assert.equal(findOpenAIContextFallback('openai/gpt-4.1-2025-04-14'), 1047576)
  assert.equal(findOpenAIOutputFallback('openai/gpt-4.1-2025-04-14'), 32768)
  assert.equal(findOpenAIContextFallback('gpt-5.1-codex-max-2025-11-13'), 400000)
  assert.equal(findOpenAIOutputFallback('gpt-5.1-codex-max-2025-11-13'), 128000)
})

test('model target lookup matches full ids and provider-prefixed short ids', () => {
  const models = [
    { id: 'gpt-4.1' },
    { id: 'openai/gpt-4.1-2025-04-14' },
    { id: 'openai/gpt-4.1-mini' },
    { id: 'openai/gpt-5.1-codex-max' },
  ]

  assert.deepEqual(findModelMetadataTarget(models, 'gpt-4.1'), { id: 'gpt-4.1' })
  assert.deepEqual(findModelMetadataTarget(models, 'gpt-4.1-2025-04-14'), {
    id: 'openai/gpt-4.1-2025-04-14',
  })
  assert.deepEqual(findModelMetadataTarget(models.slice(1), 'gpt-4.1'), {
    id: 'openai/gpt-4.1-2025-04-14',
  })
  assert.equal(findModelMetadataTarget(models.slice(2, 3), 'gpt-4.1'), null)
  assert.deepEqual(findModelMetadataTarget(models, 'gpt-5.1-codex-max'), {
    id: 'openai/gpt-5.1-codex-max',
  })
  assert.equal(findModelMetadataTarget(models, 'missing-model'), null)
})
