import test from 'node:test'
import assert from 'node:assert/strict'
import { hasIncompleteToolEvidence } from './chatInterruption'

function createAssistantMessage(cancellationReason?: string, error?: string) {
  return {
    role: 'assistant',
    toolResults: [
      {
        result: {
          success: false,
          canceled: true,
          cancellationReason,
          error,
        },
      },
    ],
  }
}

test('hasIncompleteToolEvidence treats provider interruption reasons as restartable evidence', () => {
  const providerAbortMessages = [
    createAssistantMessage(
      'provider_abort',
      'Provider interrupted tool execution before a final tool result was returned.'
    ),
  ]
  const providerStreamInterruptedMessages = [
    createAssistantMessage(
      'provider_stream_interrupted',
      'Provider ended the stream before finalizing this tool call.'
    ),
  ]

  assert.equal(hasIncompleteToolEvidence(providerAbortMessages), true)
  assert.equal(hasIncompleteToolEvidence(providerStreamInterruptedMessages), true)
})

test('hasIncompleteToolEvidence treats stream_end_incomplete as restartable evidence', () => {
  const messages = [
    createAssistantMessage(
      'stream_end_incomplete',
      'Tool ended before returning a final result.'
    ),
  ]

  assert.equal(hasIncompleteToolEvidence(messages), true)
})

test('hasIncompleteToolEvidence ignores completed tool results', () => {
  const messages = [
    {
      role: 'assistant',
      toolResults: [
        {
          result: {
            success: true,
          },
        },
      ],
    },
  ]

  assert.equal(hasIncompleteToolEvidence(messages), false)
})
