import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  elideBulkyToolOutputs,
  estimateMessagesTokensLoose,
  ELIDED_TOOL_OUTPUT_STUB,
} from './contextElision'

function toolMessage(outputValue: string, toolCallId = 'tc1') {
  return {
    role: 'tool' as const,
    content: [
      {
        type: 'tool-result',
        toolCallId,
        toolName: 'read_file',
        output: { type: 'text', value: outputValue },
      },
    ],
  }
}

test('estimateMessagesTokensLoose handles string and part-array content', () => {
  const estimate = estimateMessagesTokensLoose([
    { content: 'a'.repeat(400) },
    { content: [{ type: 'text', text: 'b'.repeat(400) }] },
  ])
  // 100 + serialized parts (a bit over 100)
  assert.ok(estimate >= 200, `expected >= 200, got ${estimate}`)
  assert.ok(estimate < 400, `expected < 400, got ${estimate}`)
})

test('elides bulky tool outputs but keeps the last two tool messages verbatim', () => {
  const bulky = 'x'.repeat(5000)
  const messages = [
    { role: 'user' as const, content: 'hello' },
    toolMessage(bulky, 'tc1'),
    toolMessage(bulky, 'tc2'),
    toolMessage(bulky, 'tc3'),
    toolMessage('small', 'tc4'),
  ]

  const elided = elideBulkyToolOutputs(messages)
  assert.notEqual(elided, messages, 'expected a new array when elision happens')

  // First two tool messages stubbed (kept recent = tc3, tc4)
  const first = (elided[1].content as any[])[0]
  const second = (elided[2].content as any[])[0]
  const third = (elided[3].content as any[])[0]
  const fourth = (elided[4].content as any[])[0]

  assert.equal(first.output.value, ELIDED_TOOL_OUTPUT_STUB)
  assert.equal(second.output.value, ELIDED_TOOL_OUTPUT_STUB)
  assert.equal(third.output.value, bulky)
  assert.equal(fourth.output.value, 'small')

  // Original messages untouched (non-destructive)
  const originalFirst = (messages[1].content as any[])[0]
  assert.equal(originalFirst.output.value, bulky)
})

test('returns the same array reference when nothing is elidable', () => {
  const messages = [
    { role: 'user' as const, content: 'hi' },
    toolMessage('short', 'tc1'),
  ]
  assert.equal(elideBulkyToolOutputs(messages), messages)
})

test('elision is idempotent', () => {
  const bulky = 'y'.repeat(4000)
  const messages = [toolMessage(bulky, 'tc1'), toolMessage(bulky, 'tc2'), toolMessage(bulky, 'tc3')]
  const once = elideBulkyToolOutputs(messages)
  const twice = elideBulkyToolOutputs(once)
  assert.equal(twice, once, 'second pass should not change anything')
})
