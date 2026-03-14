import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveStreamReasoningEffort } from './conversationReasoning'

test('resolveStreamReasoningEffort uses the active selector for the active conversation', () => {
  assert.equal(
    resolveStreamReasoningEffort({
      activeConversationId: 'conversation-active',
      targetConversationId: 'conversation-active',
      activeReasoningEffort: 'high',
      targetConversationReasoningEffort: 'low',
    }),
    'high'
  )
})

test('resolveStreamReasoningEffort uses the target conversation override for background sends', () => {
  assert.equal(
    resolveStreamReasoningEffort({
      activeConversationId: 'conversation-active',
      targetConversationId: 'conversation-queued',
      activeReasoningEffort: 'high',
      targetConversationReasoningEffort: 'low',
    }),
    'low'
  )
})

test('resolveStreamReasoningEffort preserves default reasoning for background sends without overrides', () => {
  assert.equal(
    resolveStreamReasoningEffort({
      activeConversationId: 'conversation-active',
      targetConversationId: 'conversation-queued',
      activeReasoningEffort: 'high',
      targetConversationReasoningEffort: null,
    }),
    null
  )
})
