import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSoulLearningMessages } from './chatLearning'

test('buildSoulLearningMessages keeps the current turn plus the prior assistant for corrections', () => {
  const messages = buildSoulLearningMessages(
    [
      { role: 'user', content: 'Initial question' },
      { role: 'assistant', content: 'Initial answer' },
      { role: 'assistant', content: 'Previous answer to correct' },
      { role: 'user', content: 'Actually, that is not right' },
    ],
    { role: 'assistant', content: 'Updated answer' },
    false
  )

  assert.deepEqual(messages, [
    { role: 'assistant', content: 'Previous answer to correct' },
    { role: 'user', content: 'Actually, that is not right' },
    { role: 'assistant', content: 'Updated answer' },
  ])
})

test('buildSoulLearningMessages skips historical users when there is no prior assistant', () => {
  const messages = buildSoulLearningMessages(
    [
      { role: 'user', content: 'First preference' },
      { role: 'user', content: 'I prefer concise answers' },
    ],
    { role: 'assistant', content: 'Understood.' },
    false
  )

  assert.deepEqual(messages, [
    { role: 'user', content: 'I prefer concise answers' },
    { role: 'assistant', content: 'Understood.' },
  ])
})

test('buildSoulLearningMessages skips regenerate turns', () => {
  const messages = buildSoulLearningMessages(
    [
      { role: 'assistant', content: 'Previous answer' },
      { role: 'user', content: 'Retry this' },
    ],
    { role: 'assistant', content: 'Regenerated answer' },
    true
  )

  assert.deepEqual(messages, [])
})

test('buildSoulLearningMessages ignores analysis windows without a trailing user turn', () => {
  const messages = buildSoulLearningMessages(
    [
      { role: 'user', content: 'Initial question' },
      { role: 'assistant', content: 'Previous answer' },
    ],
    { role: 'assistant', content: 'Updated answer' },
    false
  )

  assert.deepEqual(messages, [])
})
