import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProviderCapabilitySummary } from './providerCapabilitySummary'

test('compatible Nous shadow endpoints are labeled chat-only', () => {
  const summary = resolveProviderCapabilitySummary({
    providerType: 'openai-compatible',
    providerName: 'Nous Research',
    baseUrl: 'https://shadow.nousresearch.com/v1',
    modelId: 'nous-hermes',
  })

  assert.ok(summary)
  assert.equal(summary?.toolSupport, 'unsupported')
  assert.equal(summary.label, 'Chat only')
  assert.equal(summary.source, 'provider_override')
})

test('editable provider names alone do not force chat-only labels', () => {
  const summary = resolveProviderCapabilitySummary({
    providerType: 'openai-compatible',
    providerName: 'Nous Research',
    baseUrl: 'https://api.studio.nebius.com/v1',
    modelId: 'nous-hermes',
  })

  assert.ok(summary)
  assert.equal(summary?.toolSupport, 'unknown')
  assert.equal(summary?.source, 'default_unknown')
})

test('catalog tool metadata marks models as tool-capable', () => {
  const summary = resolveProviderCapabilitySummary({
    providerType: 'openrouter',
    modelsDevMetadata: { toolCall: true },
    modelId: 'openai/gpt-5',
  })

  assert.ok(summary)
  assert.equal(summary?.toolSupport, 'supported')
  assert.equal(summary.source, 'models_dev_provider_match')
})

test('native-provider model ids stay unknown until catalog metadata verifies tool support', () => {
  const summary = resolveProviderCapabilitySummary({
    providerType: 'google',
    modelId: 'gemini-3.1-pro-preview',
  })

  assert.ok(summary)
  assert.equal(summary?.toolSupport, 'unknown')
  assert.equal(summary.source, 'default_unknown')
})

test('generic compatible endpoints default to unknown tool support', () => {
  const summary = resolveProviderCapabilitySummary({
    providerType: 'openai-compatible',
    providerName: 'Custom Compatible',
    baseUrl: 'https://example.com/v1',
    modelId: 'example-chat',
  })

  assert.ok(summary)
  assert.equal(summary?.toolSupport, 'unknown')
  assert.equal(summary.label, 'Tool support unknown')
})
