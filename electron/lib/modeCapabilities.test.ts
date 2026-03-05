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

test('sub-agent mutation permissions match capability matrix policy', () => {
  const expectedMutableModes = new Set(['auto', 'execute', 'review', 'pr-review'])
  const modes = Object.keys(MODE_CAPABILITY_MATRIX) as Array<keyof typeof MODE_CAPABILITY_MATRIX>
  for (const mode of modes) {
    const shouldMutate = expectedMutableModes.has(mode)
    assert.equal(
      canSubAgentMutate(mode),
      shouldMutate,
      `unexpected sub-agent mutation policy for mode ${mode}`
    )

    const caps = getModeCapabilities(mode)
    assert.equal(caps.subAgent.canWriteFiles, shouldMutate)
    assert.equal(caps.subAgent.canExecuteCommands, shouldMutate)
  }
})

test('unknown modes fall back to auto capabilities', () => {
  const fallback = getModeCapabilities('unexpected-mode' as any)
  const autoCaps = getModeCapabilities('auto')
  assert.deepEqual(fallback, autoCaps)
})
