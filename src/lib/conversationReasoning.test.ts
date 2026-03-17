import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveStreamReasoningEffort } from './conversationReasoning'

test('resolveStreamReasoningEffort uses the active selector for the active conversation', () => {
  assert.equal(
    resolveStreamReasoningEffort({
      activeConversationId: 'conversation-active',
      targetConversationId: 'conversation-active',
      providerType: 'openai',
      modelId: 'gpt-5.1',
      activeReasoningEffort: 'high',
      targetProviderDefaultReasoningEffort: 'low',
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
      providerType: 'openai',
      modelId: 'gpt-5.1',
      activeReasoningEffort: 'high',
      targetProviderDefaultReasoningEffort: 'medium',
      targetConversationReasoningEffort: 'low',
    }),
    'low'
  )
})

test('resolveStreamReasoningEffort falls back to the provider default for active conversations using Default', () => {
  assert.equal(
    resolveStreamReasoningEffort({
      activeConversationId: 'conversation-active',
      targetConversationId: 'conversation-active',
      providerType: 'openai',
      modelId: 'gpt-5.1',
      activeReasoningEffort: null,
      targetProviderDefaultReasoningEffort: 'medium',
      targetConversationReasoningEffort: 'low',
    }),
    'medium'
  )
})

test('resolveStreamReasoningEffort falls back to the provider default for background sends without overrides', () => {
  assert.equal(
    resolveStreamReasoningEffort({
      activeConversationId: 'conversation-active',
      targetConversationId: 'conversation-queued',
      providerType: 'openai',
      modelId: 'gpt-5.1',
      activeReasoningEffort: 'high',
      targetProviderDefaultReasoningEffort: 'medium',
      targetConversationReasoningEffort: null,
    }),
    'medium'
  )
})
