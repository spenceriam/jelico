import test from 'node:test'
import assert from 'node:assert/strict'
import { createInlineToolProtocolFilter } from './inlineToolProtocol'

test('inline tool protocol filter preserves normal prose containing [tool_calls]', () => {
  const filter = createInlineToolProtocolFilter()

  const first = filter.consume('The available [tool_cal')
  const second = filter.consume('ls] are listed here.')
  const tail = filter.flush()

  assert.equal(first, 'The available ')
  assert.equal(second, '[tool_calls] are listed here.')
  assert.equal(tail, '')
})

test('inline tool protocol filter strips exact [tool_call] blocks across chunk boundaries', () => {
  const filter = createInlineToolProtocolFilter()

  const first = filter.consume('Before [tool_cal')
  const second = filter.consume('l]{"id":"1"}[/tool_call] after')
  const tail = filter.flush()

  assert.equal(first, 'Before ')
  assert.equal(second, ' after')
  assert.equal(tail, '')
})

test('inline tool protocol filter drops trailing partial protocol markers on flush', () => {
  const filter = createInlineToolProtocolFilter()

  const body = filter.consume('Hello <|tool_call_beg')
  const tail = filter.flush()

  assert.equal(body, 'Hello ')
  assert.equal(tail, '')
})
