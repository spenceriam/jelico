import assert from 'node:assert/strict'
import test from 'node:test'
import { validateDashScopeProviderConfig } from './dashscopeProvider'

test('DashScope validation rejects SDK api/v1 base URLs for compatible providers', () => {
  assert.match(
    validateDashScopeProviderConfig({
      providerType: 'openai-compatible',
      baseUrl: 'https://dashscope-us.aliyuncs.com/api/v1',
      modelId: 'qwen-plus-us',
    }) || '',
    /compatible-mode\/v1/
  )
})

test('DashScope validation rejects full chat completion URLs as base URLs', () => {
  assert.match(
    validateDashScopeProviderConfig({
      providerType: 'openai-compatible',
      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      modelId: 'qwen-plus',
    }) || '',
    /base URL/
  )
})

test('DashScope validation catches commercial US model suffix mismatches', () => {
  assert.match(
    validateDashScopeProviderConfig({
      providerType: 'openai-compatible',
      baseUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
      modelId: 'qwen3.5-plus',
    }) || '',
    /-us suffix/
  )
})

test('DashScope validation catches US models on non-US endpoints', () => {
  assert.match(
    validateDashScopeProviderConfig({
      providerType: 'openai-compatible',
      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      modelId: 'qwen-plus-us',
    }) || '',
    /US/
  )
})

test('DashScope validation accepts matching documented presets', () => {
  assert.equal(
    validateDashScopeProviderConfig({
      providerType: 'openai-compatible',
      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      modelId: 'qwen3.5-plus',
    }),
    null
  )
  assert.equal(
    validateDashScopeProviderConfig({
      providerType: 'openai-compatible',
      baseUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
      modelId: 'qwen-plus-us',
    }),
    null
  )
})
