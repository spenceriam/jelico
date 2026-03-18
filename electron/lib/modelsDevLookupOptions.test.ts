import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModelsDevLookupOptions } from './modelsDevLookupOptions'

test('user-editable compatible providers do not use display names for models.dev lookup', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('openai-compatible', 'Kimi For Coding', 'https://example.com/v1'),
    { baseUrl: 'https://example.com/v1' }
  )
  assert.deepEqual(
    buildModelsDevLookupOptions('custom', 'Known Host Alias', 'https://gateway.example.com'),
    { baseUrl: 'https://gateway.example.com' }
  )
})

test('managed providers keep provider names available for models.dev lookup', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('anthropic', 'Anthropic', 'https://api.anthropic.com'),
    {
      baseUrl: 'https://api.anthropic.com',
      providerName: 'Anthropic',
    }
  )
})
