import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasInterruptedMeaningfulMutationTool,
  isMeaningfulTurnToolName,
  isMeaningfulTurnToolResult,
} from './turnToolSemantics'

test('isMeaningfulTurnToolName returns false for internal tools', () => {
  assert.equal(isMeaningfulTurnToolName('todo_write'), false)
  assert.equal(isMeaningfulTurnToolName('wait_for_agent'), false)
})

test('isMeaningfulTurnToolName returns true for user-visible tools', () => {
  assert.equal(isMeaningfulTurnToolName('create_artifact'), true)
  assert.equal(isMeaningfulTurnToolName('write_file'), true)
})

test('isMeaningfulTurnToolResult ignores internal web gate results', () => {
  const internalResult = {
    success: true,
    results: {
      type: 'deferred_to_subagents',
    },
  }

  assert.equal(isMeaningfulTurnToolResult('web_search', internalResult), false)
})

test('isMeaningfulTurnToolResult keeps normal web results meaningful', () => {
  const normalResult = {
    success: true,
    results: {
      type: 'direct',
    },
  }

  assert.equal(isMeaningfulTurnToolResult('web_search', normalResult), true)
})

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
