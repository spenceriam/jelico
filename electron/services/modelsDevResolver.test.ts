import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildModelsDevIndexes,
  lookupModelsDevContextLimitInIndexes,
  lookupModelsDevModelMetadataInIndexes,
  lookupModelsDevOutputLimitInIndexes,
  lookupStrictModelsDevModelMetadataInIndexes,
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
  nebius: {
    id: 'nebius',
    name: 'Nebius',
    api: 'https://api.studio.nebius.com/v1',
    models: {
      'NousResearch/Hermes-4-405B': {
        id: 'NousResearch/Hermes-4-405B',
        name: 'Hermes 4 405B',
        reasoning: true,
        tool_call: true,
        release_date: '2026-03',
        last_updated: '2026-03',
        limit: {
          context: 262144,
          output: 131072,
        },
      },
    },
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    api: 'http://127.0.0.1:1234/v1',
    models: {
      'gpt-oss-20b': {
        id: 'gpt-oss-20b',
        name: 'GPT OSS 20B',
        reasoning: false,
        tool_call: true,
        release_date: '2026-02',
        last_updated: '2026-02',
        limit: {
          context: 131072,
          output: 8192,
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

test('compatible provider names still anchor metadata when endpoints are proxied', () => {
  const metadata = lookupStrictModelsDevModelMetadataInIndexes(
    indexes,
    'anthropic-compatible',
    'Kimi For Coding',
    {
      baseUrl: 'https://proxy.internal.example/v1',
      providerName: 'Kimi For Coding',
    }
  )

  assert.equal(metadata?.providerKey, 'kimi-for-coding')
  assert.equal(metadata?.modelId, 'k2p5')
})

test('compatible chat-completions URLs still resolve provider-scoped metadata', () => {
  const metadata = lookupStrictModelsDevModelMetadataInIndexes(
    indexes,
    'openai-compatible',
    'NousResearch/Hermes-4-405B',
    {
      baseUrl: 'https://api.studio.nebius.com/v1/chat/completions',
    }
  )

  assert.equal(metadata?.providerKey, 'nebius')
  assert.equal(metadata?.modelId, 'NousResearch/Hermes-4-405B')
})

test('generic compatible providers do not inherit foreign global output limits without a provider match', () => {
  const options = {
    baseUrl: 'https://inference-api.nousresearch.com/v1',
    providerName: 'Nous Research',
  }

  assert.equal(
    lookupModelsDevOutputLimitInIndexes(indexes, 'openai-compatible', 'Hermes-4-405B', options),
    null
  )

  const metadata = lookupModelsDevModelMetadataInIndexes(
    indexes,
    'openai-compatible',
    'Hermes-4-405B',
    options
  )
  assert.equal(metadata?.providerKey, 'nebius')
  assert.equal(
    lookupModelsDevContextLimitInIndexes(indexes, 'openai-compatible', 'Hermes-4-405B', options),
    262144
  )
})

test('strict metadata lookup avoids foreign global fallback for compatible providers', () => {
  const options = {
    baseUrl: 'https://inference-api.nousresearch.com/v1',
    providerName: 'Nous Research',
  }

  const strictMetadata = lookupStrictModelsDevModelMetadataInIndexes(
    indexes,
    'openai-compatible',
    'Hermes-4-405B',
    options
  )

  assert.equal(strictMetadata, null)
})

test('generic local providers stay unknown unless their base url matches a known local host', () => {
  assert.equal(
    lookupStrictModelsDevModelMetadataInIndexes(indexes, 'local', 'gpt-oss-20b', {
      baseUrl: 'http://localhost:8080/v1',
    }),
    null
  )

  const lmStudioMetadata = lookupStrictModelsDevModelMetadataInIndexes(indexes, 'local', 'gpt-oss-20b', {
    baseUrl: 'http://127.0.0.1:1234/v1',
  })

  assert.equal(lmStudioMetadata?.providerKey, 'lmstudio')
  assert.equal(lmStudioMetadata?.modelId, 'gpt-oss-20b')
})

test('known local preset aliases still resolve metadata when users customize the local base url', () => {
  const lmStudioMetadata = lookupStrictModelsDevModelMetadataInIndexes(indexes, 'local', 'gpt-oss-20b', {
    baseUrl: 'http://devbox.local:1234/v1',
    providerName: 'LM Studio',
  })

  assert.equal(lmStudioMetadata?.providerKey, 'lmstudio')
  assert.equal(lmStudioMetadata?.modelId, 'gpt-oss-20b')

  assert.equal(
    lookupStrictModelsDevModelMetadataInIndexes(indexes, 'local', 'gpt-oss-20b', {
      baseUrl: 'http://devbox.local:1234/v1',
      providerName: 'Custom Local',
    }),
    null
  )
})
