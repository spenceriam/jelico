import test from 'node:test'
import assert from 'node:assert/strict'

import { buildUpdatedTodo, type TodoItem } from './todos'

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: '1',
    text: 'Review recommendations',
    status: 'in_progress',
    owner: 'main',
    dependencies: [],
    blockedReason: null,
    history: [{ status: 'pending', at: 10, actor: 'main' }],
    createdAt: 10,
    updatedAt: 20,
    ...overrides,
  }
}

test('buildUpdatedTodo appends a normalized history entry for status-only updates', () => {
  const updated = buildUpdatedTodo(
    makeTodo(),
    { status: 'completed' as never },
    42
  )

  assert.equal(updated.status, 'done')
  assert.deepEqual(updated.history, [
    { status: 'pending', at: 10, actor: 'main' },
    { status: 'done', at: 42, actor: 'main' },
  ])
})

test('buildUpdatedTodo preserves explicit history instead of auto-appending', () => {
  const updated = buildUpdatedTodo(
    makeTodo(),
    {
      status: 'completed' as never,
      history: [{ status: 'finished' as never, at: 41, actor: 'agent:kai' }],
    },
    42
  )

  assert.equal(updated.status, 'done')
  assert.deepEqual(updated.history, [
    { status: 'done', at: 41, actor: 'agent:kai' },
  ])
})
