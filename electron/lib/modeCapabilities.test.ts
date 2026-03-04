import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MODE_CAPABILITY_MATRIX,
  assertCapabilityMatrix,
  canSubAgentMutate,
  getModeCapabilities,
} from './modeCapabilities'

test('capability matrix declares all required modes', () => {
  assert.doesNotThrow(() => assertCapabilityMatrix())
  const modes = Object.keys(MODE_CAPABILITY_MATRIX).sort()
  assert.deepEqual(modes, ['auto', 'execute', 'explore', 'plan', 'pr-review', 'review', 'security-review'])
})

test('sub-agents are read-only across all declared modes', () => {
  const modes = Object.keys(MODE_CAPABILITY_MATRIX) as Array<keyof typeof MODE_CAPABILITY_MATRIX>
  for (const mode of modes) {
    assert.equal(canSubAgentMutate(mode), false, `sub-agent should remain read-only in mode ${mode}`)
    const caps = getModeCapabilities(mode)
    assert.equal(caps.subAgent.canWriteFiles, false)
    assert.equal(caps.subAgent.canExecuteCommands, false)
  }
})

test('unknown modes fall back to auto capabilities', () => {
  const fallback = getModeCapabilities('unexpected-mode' as any)
  const autoCaps = getModeCapabilities('auto')
  assert.deepEqual(fallback, autoCaps)
})

