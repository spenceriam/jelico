import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCompatibleChatCompletionsEndpoint,
  buildCompatibleModelsEndpointCandidates,
  getZaiProviderBaseUrl,
} from './compatibleProviderModels'

test('compatible model endpoint builder preserves v1 compatible base URLs', () => {
  assert.deepEqual(
    buildCompatibleModelsEndpointCandidates('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
    ['https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models']
  )
})

test('compatible endpoint builder handles Z.ai paas v4 paths without appending v1', () => {
  assert.deepEqual(
    buildCompatibleModelsEndpointCandidates('https://api.z.ai/api/paas/v4'),
    ['https://api.z.ai/api/paas/v4/models']
  )
  assert.equal(
    buildCompatibleChatCompletionsEndpoint('https://api.z.ai/api/paas/v4'),
    'https://api.z.ai/api/paas/v4/chat/completions'
  )
})

test('compatible endpoint builder normalizes full chat completion URLs', () => {
  assert.equal(
    buildCompatibleChatCompletionsEndpoint('https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions'),
    'https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions'
  )
})

test('Z.ai provider base URLs fall back to documented endpoints', () => {
  assert.equal(getZaiProviderBaseUrl('zai'), 'https://api.z.ai/api/paas/v4')
  assert.equal(getZaiProviderBaseUrl('zai-coding'), 'https://api.z.ai/api/coding/paas/v4')
})

test('Z.ai provider base URLs preserve custom compatible endpoints', () => {
  assert.equal(
    getZaiProviderBaseUrl('zai', 'https://example.com/custom/v1'),
    'https://example.com/custom/v1'
  )
  assert.equal(
    getZaiProviderBaseUrl('zai-coding', 'https://example.com/custom/v1/chat/completions'),
    'https://example.com/custom/v1'
  )
})
