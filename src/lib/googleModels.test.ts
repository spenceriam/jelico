import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getGoogleModelId,
  getGoogleModelVariantId,
  isSpecializedGoogleModel,
  mergeDocumentedGeminiModels,
  selectPreferredGoogleModels,
  sortGoogleModels,
  supportsGoogleGenerateContent,
} from './googleModels'

test('google discovery prefers baseModelId over versioned resource names', () => {
  assert.equal(
    getGoogleModelId({
      id: 'models/gemini-1.5-pro-001',
      name: 'Gemini 1.5 Pro',
      baseModelId: 'gemini-1.5-pro',
    }),
    'gemini-1.5-pro'
  )
})

test('google variant ids preserve versioned resource names for selection', () => {
  assert.equal(
    getGoogleModelVariantId({
      id: 'models/gemini-2.5-flash-preview-001',
      name: 'models/gemini-2.5-flash-preview-001',
      baseModelId: 'gemini-2.5-flash',
    }),
    'gemini-2.5-flash-preview-001'
  )
})

test('google model selection prefers newer dated preview revisions within the same family', () => {
  const selected = selectPreferredGoogleModels([
    {
      id: 'models/gemini-3-flash-preview-04-17',
      name: 'models/gemini-3-flash-preview-04-17',
      baseModelId: 'gemini-3-flash-preview',
    },
    {
      id: 'models/gemini-3-flash-preview-05-06',
      name: 'models/gemini-3-flash-preview-05-06',
      baseModelId: 'gemini-3-flash-preview',
    },
  ])

  assert.deepEqual(selected.map((model) => model.name), [
    'models/gemini-3-flash-preview-05-06',
  ])
})

test('google model sorting keeps current general-purpose families ahead of specialized variants', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-3-flash-preview-native-audio', name: 'Gemini 3 Flash Native Audio Preview' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3-pro-image-preview',
    'gemini-3-flash-preview-native-audio',
  ])
})

test('google specialization detection excludes image and audio chat variants', () => {
  assert.equal(isSpecializedGoogleModel({ id: 'gemini-3-pro-image-preview' }), true)
  assert.equal(isSpecializedGoogleModel({ id: 'gemini-3-flash-preview-native-audio' }), true)
  assert.equal(isSpecializedGoogleModel({ id: 'gemini-3-pro-preview' }), false)
})

test('google generateContent support accepts absent capability lists and explicit generateContent support', () => {
  assert.equal(supportsGoogleGenerateContent({ id: 'gemini-3-pro-preview' }), true)
  assert.equal(
    supportsGoogleGenerateContent({
      id: 'gemini-3-pro-preview',
      supportedGenerationMethods: ['generateContent'],
    }),
    true
  )
  assert.equal(
    supportsGoogleGenerateContent({
      id: 'embedding-001',
      supportedGenerationMethods: ['embedContent'],
    }),
    false
  )
})

test('google fallback merge keeps documented Gemini 3 models when live discovery omits them', () => {
  const merged = mergeDocumentedGeminiModels([
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ])

  assert.equal(merged.some((model) => model.id === 'gemini-3-pro-preview'), true)
  assert.equal(merged.some((model) => model.id === 'gemini-3-flash-preview'), true)
  assert.equal(merged.some((model) => model.id.startsWith('gemini-3.1')), false)
})
