import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getConversationSidebarStatus,
  getConversationSidebarStatusMeta,
} from './conversationSidebarStatus.ts'

test('streaming conversations are classified as in progress', () => {
  const status = getConversationSidebarStatus({
    isStreaming: true,
    hasRunningAgent: false,
    hasPendingAgent: false,
    hasClarificationRequest: false,
    hasInterruptedStream: false,
    hasFailedAgent: false,
    hasConversationError: false,
  })

  assert.equal(status, 'in_progress')
  assert.equal(getConversationSidebarStatusMeta(status).label, 'In progress')
})

test('clarification requests are classified as waiting when not actively streaming', () => {
  const status = getConversationSidebarStatus({
    isStreaming: false,
    hasRunningAgent: false,
    hasPendingAgent: false,
    hasClarificationRequest: true,
    hasInterruptedStream: false,
    hasFailedAgent: false,
    hasConversationError: false,
  })

  assert.equal(status, 'waiting')
})

test('interrupted or failed conversations are classified as error', () => {
  const status = getConversationSidebarStatus({
    isStreaming: false,
    hasRunningAgent: false,
    hasPendingAgent: false,
    hasClarificationRequest: false,
    hasInterruptedStream: true,
    hasFailedAgent: false,
    hasConversationError: false,
  })

  assert.equal(status, 'error')
  assert.equal(getConversationSidebarStatusMeta(status).sectionLabel, 'Needs Attention')
})

test('idle conversations default to done', () => {
  const status = getConversationSidebarStatus({
    isStreaming: false,
    hasRunningAgent: false,
    hasPendingAgent: false,
    hasClarificationRequest: false,
    hasInterruptedStream: false,
    hasFailedAgent: false,
    hasConversationError: false,
  })

  assert.equal(status, 'done')
})
