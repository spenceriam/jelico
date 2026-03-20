import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCompatibleChatCompletionsEndpoint,
  buildCompatibleModelsEndpointCandidates,
  buildPrimaryCompatibleModelsEndpoint,
  DEFAULT_OPENAI_MODELS_ENDPOINT,
  getZaiProviderBaseUrl,
  normalizeCompatibleBaseUrl,
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

test('compatible model endpoint builder strips explicit chat completion paths', () => {
  assert.deepEqual(
    buildCompatibleModelsEndpointCandidates('https://api.z.ai/api/paas/v4/chat/completions'),
    ['https://api.z.ai/api/paas/v4/models']
  )
  assert.deepEqual(
    buildCompatibleModelsEndpointCandidates('https://example.com/v1/chat/completions'),
    ['https://example.com/v1/models']
  )
})

test('default openai endpoint is opt-in when base urls are missing', () => {
  assert.deepEqual(buildCompatibleModelsEndpointCandidates(), [])
  assert.equal(
    buildPrimaryCompatibleModelsEndpoint(undefined, { defaultOpenAI: true }),
    DEFAULT_OPENAI_MODELS_ENDPOINT
  )
})

test('compatible chat completion endpoints keep hosted Z.ai paths intact', () => {
  assert.equal(
    buildCompatibleChatCompletionsEndpoint('https://api.z.ai/api/paas/v4'),
    'https://api.z.ai/api/paas/v4/chat/completions'
  )
  assert.equal(
    buildCompatibleChatCompletionsEndpoint('https://api.z.ai/api/coding/paas/v4'),
    'https://api.z.ai/api/coding/paas/v4/chat/completions'
  )
})

test('z.ai provider base url helper preserves custom endpoints and hosted defaults', () => {
  assert.equal(
    getZaiProviderBaseUrl('zai', 'https://proxy.example.com/api/paas/v4/chat/completions'),
    'https://proxy.example.com/api/paas/v4'
  )
  assert.equal(
    getZaiProviderBaseUrl('zai-coding-china'),
    'https://open.bigmodel.cn/api/coding/paas/v4'
  )
})

test('compatible chat completion endpoints preserve explicit v1 bases', () => {
  assert.equal(
    buildCompatibleChatCompletionsEndpoint('https://example.com/v1'),
    'https://example.com/v1/chat/completions'
  )
})

test('compatible base url normalization strips endpoint suffixes', () => {
  assert.equal(
    normalizeCompatibleBaseUrl('https://api.z.ai/api/paas/v4/chat/completions'),
    'https://api.z.ai/api/paas/v4'
  )
  assert.equal(
    normalizeCompatibleBaseUrl('https://example.com/v1/models'),
    'https://example.com/v1/models'
  )
  assert.equal(
    normalizeCompatibleBaseUrl('https://example.com/v1/models', { stripModelsPath: true }),
    'https://example.com/v1'
  )
})
