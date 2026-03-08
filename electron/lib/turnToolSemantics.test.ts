import test from 'node:test'
import assert from 'node:assert/strict'
import { hasInterruptedMeaningfulMutationTool } from './turnToolSemantics'

test('hasInterruptedMeaningfulMutationTool ignores unknown fallback names', () => {
  const result = hasInterruptedMeaningfulMutationTool(
    [
      {
        id: 'tool-1',
        name: 'unknown_tool',
        sawToolCall: false,
        nameIsKnown: false,
      },
    ],
    { expectedArtifactMutation: true, expectedFileMutation: false }
  )

  assert.equal(result, false)
})

test('hasInterruptedMeaningfulMutationTool requires a known meaningful tool on mutation turns', () => {
  const result = hasInterruptedMeaningfulMutationTool(
    [
      {
        id: 'tool-2',
        name: 'create_artifact',
        sawToolCall: true,
        nameIsKnown: true,
      },
    ],
    { expectedArtifactMutation: true, expectedFileMutation: false }
  )

  assert.equal(result, true)
})

test('hasInterruptedMeaningfulMutationTool ignores internal tools', () => {
  const result = hasInterruptedMeaningfulMutationTool(
    [
      {
        id: 'tool-3',
        name: 'todo_write',
        sawToolCall: true,
        nameIsKnown: true,
      },
    ],
    { expectedArtifactMutation: false, expectedFileMutation: true }
  )

  assert.equal(result, false)
})
