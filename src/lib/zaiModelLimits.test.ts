import assert from 'node:assert/strict'
import test from 'node:test'
import { findZaiContextFallback, findZaiOutputFallback } from './zaiModelLimits'

test('Z.ai GLM 4.7 limits use documented 200k context and 128k output', () => {
  assert.equal(findZaiContextFallback('glm-4.7'), 200000)
  assert.equal(findZaiOutputFallback('glm-4.7'), 128000)
})

test('Z.ai fallback limits cover GLM 4.5 Flash output cap', () => {
  assert.equal(findZaiContextFallback('glm-4.5-flash'), 128000)
  assert.equal(findZaiOutputFallback('glm-4.5-flash'), 98304)
})
