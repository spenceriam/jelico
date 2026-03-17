import test from 'node:test'
import assert from 'node:assert/strict'
import { findRelevantSkills, type SkillRecord } from './skills'

function createTestSkill(overrides: Partial<SkillRecord>): SkillRecord {
  return {
    id: 'custom:test-skill',
    source: 'custom',
    format: 'claude-code',
    name: 'Test Skill',
    description: 'Target a specific workflow',
    whenToUse: 'Use when the request matches the expected task',
    suggestedMode: 'execute',
    tags: [],
    instructions: 'Follow the expected workflow.',
    content: 'skill content',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

test('findRelevantSkills does not match short tags inside unrelated words', () => {
  const skills = [
    createTestSkill({
      id: 'custom:short-tags',
      name: 'Short Tag Skill',
      description: 'Handle zebra quartz workflows',
      whenToUse: 'Activate only for literal ui or pr tags.',
      tags: ['ui', 'pr'],
    }),
  ]

  const matches = findRelevantSkills(skills, 'Improve guide prose.')

  assert.deepEqual(matches, [])
})

test('findRelevantSkills still matches tags on token boundaries', () => {
  const skill = createTestSkill({
    id: 'custom:review',
    name: 'PR Review Skill',
    description: 'Review pull requests carefully',
    whenToUse: 'Use when the user asks for pull request review help.',
    tags: ['pull request'],
  })

  const matches = findRelevantSkills([skill], 'Please review this pull request for regressions.')

  assert.deepEqual(matches, [skill])
})
