import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildModelsDevIndexes,
  lookupModelsDevContextLimitInIndexes,
  lookupModelsDevModelMetadataInIndexes,
  lookupModelsDevOutputLimitInIndexes,
} from './modelsDevResolver'

const indexes = buildModelsDevIndexes({
  'kimi-for-coding': {
    id: 'kimi-for-coding',
    name: 'Kimi For Coding',
    api: 'https://api.kimi.com/coding/v1',
    models: {
      k2p5: {
        id: 'k2p5',
        name: 'Kimi K2.5',
        reasoning: true,
        tool_call: true,
        release_date: '2026-01',
        last_updated: '2026-01',
        limit: {
          context: 262144,
          output: 32768,
        },
      },
      'kimi-k2-thinking': {
        id: 'kimi-k2-thinking',
        name: 'Kimi K2 Thinking',
        reasoning: true,
        tool_call: true,
        release_date: '2025-11',
        last_updated: '2025-12',
        limit: {
          context: 262144,
          output: 32768,
        },
      },
    },
  },
})

test('provider-specific model ids can resolve to preferred provider models', () => {
  assert.equal(
    lookupModelsDevOutputLimitInIndexes(indexes, 'anthropic-compatible', 'kimi-for-coding'),
    32768
  )
  assert.equal(
    lookupModelsDevContextLimitInIndexes(indexes, 'anthropic-compatible', 'kimi-for-coding'),
    262144
  )

  const metadata = lookupModelsDevModelMetadataInIndexes(
    indexes,
    'anthropic-compatible',
    'kimi-for-coding'
  )
  assert.equal(metadata?.providerKey, 'kimi-for-coding')
  assert.equal(metadata?.modelId, 'k2p5')
})

test('direct model ids continue to win over provider-key alias fallback', () => {
  const metadata = lookupModelsDevModelMetadataInIndexes(
    indexes,
    'anthropic-compatible',
    'kimi-k2-thinking',
    {
      baseUrl: 'https://api.kimi.com/coding/v1/messages',
      providerName: 'Kimi For Coding',
    }
  )

  assert.equal(metadata?.modelId, 'kimi-k2-thinking')
  assert.equal(metadata?.toolCall, true)
})

test('compatible provider base URLs can anchor provider-specific names to models.dev providers', () => {
  const metadata = lookupModelsDevModelMetadataInIndexes(
    indexes,
    'anthropic-compatible',
    'Kimi For Coding',
    {
      baseUrl: 'https://api.kimi.com/coding',
      providerName: 'Kimi For Coding',
    }
  )

  assert.equal(metadata?.providerKey, 'kimi-for-coding')
  assert.equal(metadata?.modelId, 'k2p5')
  assert.equal(
    lookupModelsDevOutputLimitInIndexes(indexes, 'anthropic-compatible', 'Kimi For Coding', {
      baseUrl: 'https://api.kimi.com/coding',
      providerName: 'Kimi For Coding',
    }),
    32768
  )
})
