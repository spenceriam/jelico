import assert from 'node:assert/strict'
import test from 'node:test'
import { findZaiContextFallback, findZaiOutputFallback } from './zaiModelLimits'

test('glm-5 and glm-4.7 families use the documented 200k Z.ai context window', () => {
  assert.equal(findZaiContextFallback('glm-5'), 200000)
  assert.equal(findZaiContextFallback('glm-4.7'), 200000)
  assert.equal(findZaiContextFallback('glm-4.7-flashx'), 200000)
  assert.equal(findZaiContextFallback('glm-4.6'), 200000)
  assert.equal(findZaiContextFallback('glm-4.5-flash'), 200000)
})

test('glm-4.5 family and legacy 32b models keep their smaller fallback limits', () => {
  assert.equal(findZaiContextFallback('glm-4.5-airx'), 128000)
  assert.equal(findZaiContextFallback('glm-4-32b-0414-128k'), 128000)
  assert.equal(findZaiContextFallback('glm-4.6v'), 128000)
  assert.equal(findZaiContextFallback('glm-4.5v'), 64000)
  assert.equal(findZaiOutputFallback('glm-4.5'), 98304)
  assert.equal(findZaiOutputFallback('glm-4.5-flash'), 98304)
  assert.equal(findZaiOutputFallback('glm-4.6v'), 32000)
  assert.equal(findZaiOutputFallback('glm-4.5v'), 16000)
  assert.equal(findZaiOutputFallback('glm-4-32b-0414-128k'), 16000)
})

test('z.ai fallback helpers stay null for unknown model ids', () => {
  assert.equal(findZaiContextFallback('future-zai-model'), null)
  assert.equal(findZaiOutputFallback('future-zai-model'), null)
})
