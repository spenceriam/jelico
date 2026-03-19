import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModelsDevLookupOptions } from './modelsDevLookupOptions'

test('compatible and custom providers keep provider names available for proxied models.dev lookup', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('openai-compatible', 'Kimi For Coding', 'https://proxy.internal.example/v1'),
    {
      baseUrl: 'https://proxy.internal.example/v1',
      providerName: 'Kimi For Coding',
    }
  )
  assert.deepEqual(
    buildModelsDevLookupOptions('custom', 'Known Host Alias', 'https://gateway.internal.example'),
    {
      baseUrl: 'https://gateway.internal.example',
      providerName: 'Known Host Alias',
    }
  )
})

test('public compatible endpoints do not inherit provider-name matches from editable labels', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('openai-compatible', 'Kimi For Coding', 'https://gateway.example.com/v1'),
    { baseUrl: 'https://gateway.example.com/v1' }
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

test('repointed local aliases do not reuse local metadata on public hosts', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('local', 'LM Studio', 'https://public.example.com/v1'),
    { baseUrl: 'https://public.example.com/v1' }
  )
})

test('native providers rely on provider type and base url, not editable display names', () => {
  assert.deepEqual(
    buildModelsDevLookupOptions('anthropic', 'Anthropic', 'https://api.anthropic.com'),
    { baseUrl: 'https://api.anthropic.com' }
  )
})
