import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSelectionSnapshot, resolveActiveSelection } from './providers'

type ProviderConfigLike = Parameters<typeof normalizeSelectionSnapshot>[0][number]

function createProvider(overrides: Partial<ProviderConfigLike> = {}): ProviderConfigLike {
  return {
    id: 'provider-openai',
    type: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-5.1',
    defaultReasoningEffort: 'medium',
    isDefault: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

test('normalizeSelectionSnapshot preserves explicit Default reasoning selections', () => {
  const normalized = normalizeSelectionSnapshot(
    [createProvider()],
    {
      providerId: 'provider-openai',
      model: 'gpt-5.1',
      reasoningEffort: null,
    }
  )

  assert.deepEqual(normalized, {
    providerId: 'provider-openai',
    model: 'gpt-5.1',
    reasoningEffort: null,
  })
})

test('resolveActiveSelection preserves active model and reasoning override when providers change elsewhere', () => {
  const activeSelection = resolveActiveSelection(
    [createProvider()],
    {
      providerId: 'provider-openai',
      model: 'gpt-5.1-mini',
      reasoningEffort: 'high',
    }
  )

  assert.deepEqual(activeSelection, {
    providerId: 'provider-openai',
    model: 'gpt-5.1-mini',
    reasoningEffort: 'high',
  })
})
