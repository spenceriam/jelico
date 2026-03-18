import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCompatibleModelsEndpointCandidates,
  buildPrimaryCompatibleModelsEndpoint,
  DEFAULT_OPENAI_MODELS_ENDPOINT,
} from './compatibleProviderModels'

test('z.ai hosted endpoints use the /models path without inserting /v1', () => {
  assert.deepEqual(buildCompatibleModelsEndpointCandidates('https://api.z.ai/api/paas/v4'), [
    'https://api.z.ai/api/paas/v4/models',
  ])
  assert.deepEqual(buildCompatibleModelsEndpointCandidates('https://api.z.ai/api/coding/paas/v4'), [
    'https://api.z.ai/api/coding/paas/v4/models',
  ])
})

test('anthropic compatibility endpoints keep their origin fallback', () => {
  assert.deepEqual(buildCompatibleModelsEndpointCandidates('https://example.com/anthropic'), [
    'https://example.com/anthropic/v1/models',
    'https://example.com/v1/models',
  ])
})

test('default openai endpoint is opt-in when base urls are missing', () => {
  assert.deepEqual(buildCompatibleModelsEndpointCandidates(), [])
  assert.equal(
    buildPrimaryCompatibleModelsEndpoint(undefined, { defaultOpenAI: true }),
    DEFAULT_OPENAI_MODELS_ENDPOINT
  )
})
