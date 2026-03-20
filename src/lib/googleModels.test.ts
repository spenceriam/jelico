import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getGoogleModelId,
  getGoogleModelVariantId,
  isSpecializedGoogleModel,
  selectPreferredGoogleModels,
  sortGoogleModels,
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

test('google model sorting uses versioned resource ids when baseModelId is shared', () => {
  const sorted = sortGoogleModels([
    {
      id: 'models/gemini-2.5-flash-preview-001',
      name: 'models/gemini-2.5-flash-preview-001',
      baseModelId: 'gemini-2.5-flash',
    },
    {
      id: 'models/gemini-2.5-flash-001',
      name: 'models/gemini-2.5-flash-001',
      baseModelId: 'gemini-2.5-flash',
    },
  ])

  assert.deepEqual(sorted.map((model) => model.name), [
    'models/gemini-2.5-flash-001',
    'models/gemini-2.5-flash-preview-001',
  ])
})

test('google specialization detection excludes audio and image chat variants', () => {
  assert.equal(
    isSpecializedGoogleModel({
      id: 'gemini-2.5-flash-native-audio-preview-09-2025',
      name: 'Gemini 2.5 Flash Native Audio Preview',
    }),
    true
  )
  assert.equal(
    isSpecializedGoogleModel({
      id: 'gemini-2.0-flash-preview-image-generation',
      name: 'Gemini 2.0 Flash Image Generation Preview',
    }),
    true
  )
  assert.equal(
    isSpecializedGoogleModel({
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
    }),
    false
  )
})

test('google model sorting prefers stable Gemini families before newer preview ids', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-3-flash-preview',
  ])
})

test('google model sorting prefers stable releases ahead of newer preview families', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash Preview' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-preview',
  ])
})

test('google model sorting keeps general-purpose models ahead of specialized variants', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-3-flash-preview-native-audio', name: 'Gemini 3 Flash Native Audio Preview' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
    { id: 'gemini-3-flash-preview-image-generation', name: 'Gemini 3 Flash Image Generation Preview' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3-flash-preview-image-generation',
    'gemini-3-flash-preview-native-audio',
  ])
})

test('google model sorting prefers stable releases within the same Gemini family', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro Preview' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-pro-preview',
    'gemini-2.5-flash-preview',
  ])
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

test('google model selection keeps the preferred variant for each base model family', () => {
  const selected = selectPreferredGoogleModels([
    {
      id: 'models/gemini-2.5-flash-preview-001',
      name: 'models/gemini-2.5-flash-preview-001',
      baseModelId: 'gemini-2.5-flash',
    },
    {
      id: 'models/gemini-2.5-flash-001',
      name: 'models/gemini-2.5-flash-001',
      baseModelId: 'gemini-2.5-flash',
    },
    {
      id: 'models/gemini-2.5-pro-preview-002',
      name: 'models/gemini-2.5-pro-preview-002',
      baseModelId: 'gemini-2.5-pro',
    },
    {
      id: 'models/gemini-2.5-pro-001',
      name: 'models/gemini-2.5-pro-001',
      baseModelId: 'gemini-2.5-pro',
    },
  ])

  assert.deepEqual(selected.map((model) => model.name), [
    'models/gemini-2.5-pro-001',
    'models/gemini-2.5-flash-001',
  ])
})

test('google model sorting keeps date-coded experimental ids behind current stable families', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-exp-1206', name: 'Gemini Exp 1206' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-2.5-pro',
    'gemini-3-flash-preview',
    'gemini-exp-1206',
  ])
})
