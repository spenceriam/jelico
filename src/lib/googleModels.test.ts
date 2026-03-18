import assert from 'node:assert/strict'
import test from 'node:test'
import { sortGoogleModels } from './googleModels'

test('google model sorting prefers newer Gemini families over alphabetical order', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
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

test('google model sorting keeps date-coded experimental ids behind current stable families', () => {
  const sorted = sortGoogleModels([
    { id: 'gemini-exp-1206', name: 'Gemini Exp 1206' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  ])

  assert.deepEqual(sorted.map((model) => model.id), [
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-exp-1206',
  ])
})
