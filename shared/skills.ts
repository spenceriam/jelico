export type SkillMode = 'auto' | 'explore' | 'execute' | 'plan' | 'review'
export type SkillSource = 'builtin' | 'custom'
export type SkillFormat = 'claude-code'

export interface SkillDraft {
  name: string
  description: string
  whenToUse: string
  suggestedMode?: SkillMode
  tags: string[]
  instructions: string
}

export interface SkillRecord extends SkillDraft {
  id: string
  source: SkillSource
  format: SkillFormat
  content: string
  createdAt: number
  updatedAt: number
}

export interface LegacySkillInput {
  name: string
  description: string
  prompt: string
  mode?: SkillMode
}

const FRONTMATTER_BOUNDARY = '---'

const BUILT_IN_SKILL_DRAFTS: Array<{ id: string; draft: SkillDraft }> = [
  {
    id: 'builtin:review',
    draft: {
      name: 'Code Review',
      description: 'Review code for correctness, regressions, and meaningful quality issues.',
      whenToUse: 'Use when the user asks for a review, audit, bug hunt, or quality pass on code or a pull request.',
      suggestedMode: 'review',
      tags: ['review', 'audit', 'bugs', 'quality', 'pull request', 'regression'],
      instructions: `Focus on defects, risks, and missing validation before style notes.

Check for:
- Behavioral regressions and edge cases
- Incorrect assumptions and broken state handling
- Missing or weak tests
- Security or performance risks when they are material

Lead with findings ordered by severity. Keep the summary brief if you find issues.`,
    },
  },
  {
    id: 'builtin:explain',
    draft: {
      name: 'Explain Code',
      description: 'Explain code, architecture, or behavior clearly and concretely.',
      whenToUse: 'Use when the user wants to understand a file, function, flow, or subsystem.',
      suggestedMode: 'explore',
      tags: ['explain', 'understand', 'walkthrough', 'architecture', 'flow'],
      instructions: `Explain the code at the right level for the question.

Cover:
- What it does
- How the main pieces fit together
- Important control flow or data flow
- Non-obvious tradeoffs, invariants, or gotchas

Reference concrete files or functions when they matter.`,
    },
  },
  {
    id: 'builtin:fix',
    draft: {
      name: 'Fix Issue',
      description: 'Diagnose the root cause of a bug and implement the smallest correct fix.',
      whenToUse: 'Use when the user reports a bug, regression, broken behavior, or failing workflow.',
      suggestedMode: 'execute',
      tags: ['fix', 'bug', 'debug', 'issue', 'broken', 'regression'],
      instructions: `Work from symptoms to root cause before editing.

Preferred flow:
1. Reproduce or narrow the failure.
2. Identify the actual cause.
3. Implement the fix with minimal surface area.
4. Add or update validation when appropriate.

Preserve existing behavior outside the intended fix.`,
    },
  },
  {
    id: 'builtin:test',
    draft: {
      name: 'Write Tests',
      description: 'Add targeted tests that prove the intended behavior and guard regressions.',
      whenToUse: 'Use when the user asks for tests, coverage, or regression protection for existing or new behavior.',
      suggestedMode: 'execute',
      tags: ['test', 'tests', 'coverage', 'regression', 'unit', 'integration'],
      instructions: `Write tests that are specific and behavior-focused.

Favor:
- The smallest test set that covers the contract
- Edge cases and failure handling
- Clear assertions tied to the bug or feature

Avoid redundant snapshot-style coverage unless the project already relies on it.`,
    },
  },
  {
    id: 'builtin:docs',
    draft: {
      name: 'Write Documentation',
      description: 'Write or improve documentation with clear user-facing guidance.',
      whenToUse: 'Use when the user asks for docs, README updates, onboarding notes, or usage guidance.',
      suggestedMode: 'plan',
      tags: ['docs', 'documentation', 'readme', 'guide', 'instructions'],
      instructions: `Write concise documentation aimed at the right reader.

Include the information needed to:
- Understand the purpose
- Use the feature or workflow correctly
- Avoid common mistakes

Prefer plain language over implementation details unless the user asked for internals.`,
    },
  },
  {
    id: 'builtin:refactor',
    draft: {
      name: 'Refactor Code',
      description: 'Improve structure, readability, and maintainability without changing behavior.',
      whenToUse: 'Use when the user wants cleanup, simplification, reorganization, or a safer structure.',
      suggestedMode: 'execute',
      tags: ['refactor', 'cleanup', 'simplify', 'maintainability', 'readability'],
      instructions: `Refactor conservatively.

Goals:
- Reduce complexity
- Improve naming and structure
- Remove duplication
- Preserve external behavior

Call out meaningful tradeoffs if the refactor changes internal conventions.`,
    },
  },
  {
    id: 'builtin:optimize',
    draft: {
      name: 'Optimize Performance',
      description: 'Identify and improve meaningful performance bottlenecks.',
      whenToUse: 'Use when the user asks to optimize something slow, expensive, or resource-heavy.',
      suggestedMode: 'execute',
      tags: ['performance', 'optimize', 'slow', 'latency', 'memory', 'efficiency'],
      instructions: `Target real bottlenecks instead of speculative tuning.

Focus on:
- The dominant cost in the current flow
- Simpler algorithms or fewer expensive operations
- Memory churn or unnecessary repeated work

Preserve readability unless a measured tradeoff is justified.`,
    },
  },
]

function cleanLineValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '')
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function splitKeywords(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
}

export function normalizeSkillTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => normalizeText(tag).toLowerCase()).filter(Boolean))]
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesSkillTag(request: string, tag: string): boolean {
  const escapedTag = escapeRegex(tag)
  const boundaryPattern = new RegExp(`(^|[^a-z0-9+#])${escapedTag}(?=$|[^a-z0-9+#])`, 'i')
  return boundaryPattern.test(request)
}

export function serializeSkillContent(draft: SkillDraft): string {
  const normalizedDraft: SkillDraft = {
    ...draft,
    name: normalizeText(draft.name),
    description: normalizeText(draft.description),
    whenToUse: normalizeText(draft.whenToUse),
    tags: normalizeSkillTags(draft.tags),
    instructions: draft.instructions.trim(),
  }

  const lines = [
    FRONTMATTER_BOUNDARY,
    `name: ${normalizedDraft.name}`,
    `description: ${normalizedDraft.description}`,
    `when_to_use: ${normalizedDraft.whenToUse}`,
  ]

  if (normalizedDraft.suggestedMode) {
    lines.push(`suggested_mode: ${normalizedDraft.suggestedMode}`)
  }

  lines.push('tags:')
  for (const tag of normalizedDraft.tags) {
    lines.push(`  - ${tag}`)
  }

  lines.push(
    FRONTMATTER_BOUNDARY,
    `# ${normalizedDraft.name}`,
    '',
    '## When to use',
    normalizedDraft.whenToUse,
    '',
    '## Instructions',
    normalizedDraft.instructions
  )

  return lines.join('\n').trim()
}

function parseFrontmatter(frontmatter: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  let currentArrayKey: string | null = null

  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue

    const arrayMatch = line.match(/^\s*-\s+(.+)$/)
    if (arrayMatch && currentArrayKey) {
      const currentValue = result[currentArrayKey]
      const nextValues = Array.isArray(currentValue) ? currentValue : []
      nextValues.push(cleanLineValue(arrayMatch[1]))
      result[currentArrayKey] = nextValues
      continue
    }

    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (!value) {
      result[key] = []
      currentArrayKey = key
      continue
    }

    result[key] = cleanLineValue(value)
    currentArrayKey = null
  }

  return result
}

function extractInstructions(body: string): string {
  const instructionsMatch = body.match(/^## Instructions\s*([\s\S]*)$/im)
  if (instructionsMatch) {
    return instructionsMatch[1].trim()
  }

  return body.trim()
}

export function parseSkillContent(content: string): SkillDraft {
  const normalizedContent = content.trim()
  const frontmatterMatch = normalizedContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

  if (!frontmatterMatch) {
    throw new Error('Skill content must use Claude Code style frontmatter.')
  }

  const [, frontmatter, body] = frontmatterMatch
  const parsed = parseFrontmatter(frontmatter)
  const name = String(parsed.name || '').trim()
  const description = String(parsed.description || '').trim()
  const whenToUse = String(parsed.when_to_use || '').trim()
  const suggestedMode = String(parsed.suggested_mode || '').trim() as SkillMode | ''
  const tags = Array.isArray(parsed.tags) ? parsed.tags : []
  const instructions = extractInstructions(body)

  if (!name || !description || !whenToUse || !instructions) {
    throw new Error('Skill content is missing required Claude Code skill metadata.')
  }

  return {
    name,
    description,
    whenToUse,
    suggestedMode: suggestedMode || undefined,
    tags: normalizeSkillTags(tags),
    instructions,
  }
}

export function createSkillRecord(
  id: string,
  source: SkillSource,
  draft: SkillDraft,
  createdAt: number,
  updatedAt: number
): SkillRecord {
  const normalizedDraft = parseSkillContent(serializeSkillContent(draft))

  return {
    id,
    source,
    format: 'claude-code',
    content: serializeSkillContent(normalizedDraft),
    createdAt,
    updatedAt,
    ...normalizedDraft,
  }
}

export function getBuiltInSkillRecords(): SkillRecord[] {
  return BUILT_IN_SKILL_DRAFTS.map(({ id, draft }) => createSkillRecord(id, 'builtin', draft, 0, 0))
}

export function createLegacySkillDraft(input: LegacySkillInput): SkillDraft {
  const tags = normalizeSkillTags([
    ...splitKeywords(input.name),
    ...splitKeywords(input.description),
    ...(input.mode ? [input.mode] : []),
  ])

  return {
    name: input.name,
    description: input.description,
    whenToUse: input.description,
    suggestedMode: input.mode,
    tags,
    instructions: input.prompt.trim(),
  }
}

function scoreIntentMatch(skill: SkillRecord, request: string): number {
  const normalizedRequest = normalizeText(request).toLowerCase()
  if (!normalizedRequest.trim()) return 0

  let score = 0

  for (const tag of skill.tags) {
    if (matchesSkillTag(normalizedRequest, tag)) {
      score += 4
    }
  }

  const metadataFields = [skill.name, skill.description, skill.whenToUse]
  for (const field of metadataFields) {
    const normalizedField = field.toLowerCase()
    if (!normalizedField) continue

    for (const token of splitKeywords(normalizedRequest)) {
      if (normalizedField.includes(token)) {
        score += 1
      }
    }
  }

  const instructionPreview = skill.instructions.toLowerCase().slice(0, 300)
  for (const token of splitKeywords(normalizedRequest)) {
    if (instructionPreview.includes(token)) {
      score += 0.4
    }
  }

  return score
}

export function findRelevantSkills(skills: SkillRecord[], request: string, limit: number = 3): SkillRecord[] {
  return skills
    .map((skill) => ({ skill, score: scoreIntentMatch(skill, request) }))
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, limit)
    .map((entry) => entry.skill)
}
