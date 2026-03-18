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

test('generic local providers do not use arbitrary display names for models.dev lookup', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('local', 'Custom Local', 'http://localhost:8080/v1'),
    { baseUrl: 'http://localhost:8080/v1' }
  )
})

test('known local provider aliases remain available for local models.dev lookup', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('local', 'LM Studio', 'http://devbox.local:1234/v1'),
    {
      baseUrl: 'http://devbox.local:1234/v1',
      providerName: 'LM Studio',
    }
  )
  assert.deepEqual(
    buildModelsDevLookupOptions('local', 'Ollama', 'http://192.168.1.20:11434'),
    {
      baseUrl: 'http://192.168.1.20:11434',
      providerName: 'Ollama',
    }
  )
})

test('native providers rely on provider type and base url, not editable display names', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('anthropic', 'Anthropic', 'https://api.anthropic.com'),
    { baseUrl: 'https://api.anthropic.com' }
  )
})
