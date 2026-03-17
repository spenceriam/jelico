import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import { memoryDb } from './database.js'
import { notifyGithubBackupDataChanged } from './githubBackup.js'

export type PatternCategory =
  | 'coding_style'
  | 'communication'
  | 'mistake'
  | 'preference'
  | 'workflow'
  | 'personality'

export type LearningScope = 'global' | 'workspace' | 'conversation'

export interface SoulPattern {
  id: string
  category: PatternCategory
  pattern: string
  evidence: string[]
  confidence: number
  frequency: number
  lastObserved: number
  decay: number
  source: 'explicit' | 'inferred'
  scope?: LearningScope
  scopeId?: string | null
  taskTypes?: string[]
}

export interface Correction {
  id: string
  original: string
  corrected: string
  context: string
  category: string
  timestamp: number
  scope?: LearningScope
  scopeId?: string | null
  taskTypes?: string[]
}

export interface Soul {
  patterns: SoulPattern[]
  corrections: Correction[]
  preferences: Record<string, {
    value: unknown
    confidence: number
    updatedAt: number
  }>
  lastAnalyzedAt: number
  version: number
}

export interface SoulAnalysisMetadata {
  wasSuccessful?: boolean
  userFeedback?: string
  workspaceId?: string
  conversationId?: string
  latestUserText?: string
}

export interface RecordedLearning {
  kind: 'pattern' | 'correction' | 'memory'
  scope: LearningScope
  message: string
}

interface StoredMemoryValue {
  statement?: unknown
  taskTypes?: unknown
}

const SOUL_FILE = 'soul.json'
const DEFAULT_DECAY_RATE = 0.01
const MIN_CONFIDENCE = 0.1
const DECAY_INTERVAL_DAYS = 7

let soul: Soul = {
  patterns: [],
  corrections: [],
  preferences: {},
  lastAnalyzedAt: 0,
  version: 1,
}

function getSoulPath(): string {
  return path.join(app.getPath('userData'), SOUL_FILE)
}

function normalizePattern(pattern: SoulPattern): SoulPattern {
  return {
    ...pattern,
    scope: pattern.scope || 'global',
    scopeId: pattern.scopeId ?? null,
    taskTypes: Array.isArray(pattern.taskTypes) ? [...new Set(pattern.taskTypes)] : [],
  }
}

function normalizeCorrection(correction: Correction): Correction {
  return {
    ...correction,
    scope: correction.scope || 'global',
    scopeId: correction.scopeId ?? null,
    taskTypes: Array.isArray(correction.taskTypes) ? [...new Set(correction.taskTypes)] : [],
  }
}

export function loadSoul(): Soul {
  try {
    const soulPath = getSoulPath()
    if (fs.existsSync(soulPath)) {
      const content = fs.readFileSync(soulPath, 'utf-8')
      const parsed = JSON.parse(content) as Partial<Soul>
      soul = {
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns.map((pattern) => normalizePattern(pattern as SoulPattern)) : [],
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections.map((correction) => normalizeCorrection(correction as Correction)) : [],
        preferences: parsed.preferences || {},
        lastAnalyzedAt: parsed.lastAnalyzedAt || 0,
        version: parsed.version || 1,
      }
    }
  } catch (err) {
    console.error('Failed to load soul:', err)
    soul = {
      patterns: [],
      corrections: [],
      preferences: {},
      lastAnalyzedAt: 0,
      version: 1,
    }
  }

  return soul
}

export function saveSoul(): void {
  try {
    fs.writeFileSync(getSoulPath(), JSON.stringify(soul, null, 2))
    notifyGithubBackupDataChanged()
  } catch (err) {
    console.error('Failed to save soul:', err)
  }
}

export function getSoul(): Soul {
  return soul
}

function getScopeId(scope: LearningScope, workspaceId?: string, conversationId?: string): string | null {
  if (scope === 'workspace') return workspaceId || null
  if (scope === 'conversation') return conversationId || null
  return null
}

function getScopeLabel(scope: LearningScope): string {
  switch (scope) {
    case 'workspace':
      return 'workspace'
    case 'conversation':
      return 'conversation'
    default:
      return 'global'
  }
}

function normalizeLearnedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeTaskTypes(taskTypes: unknown): string[] {
  if (!Array.isArray(taskTypes)) return []
  return [...new Set(taskTypes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
}

function buildMemoryKey(prefix: string, statement: string): string {
  return `${prefix}:${normalizeLearnedText(statement).toLowerCase().slice(0, 120)}`
}

function matchesScope(
  scope: LearningScope | undefined,
  scopeId: string | null | undefined,
  options: { workspaceId?: string; conversationId?: string }
): boolean {
  const normalizedScope = scope || 'global'
  if (normalizedScope === 'global') return true
  if (normalizedScope === 'workspace') return !!options.workspaceId && scopeId === options.workspaceId
  return !!options.conversationId && scopeId === options.conversationId
}

export function classifyTaskTypes(input: string): string[] {
  const text = input.toLowerCase()
  const matches: string[] = []

  const taskMatchers: Array<[string, RegExp]> = [
    ['review', /\b(review|audit|bug hunt|pull request|pr)\b/],
    ['debugging', /\b(fix|bug|debug|broken|error|regression|issue)\b/],
    ['testing', /\b(test|tests|coverage|spec)\b/],
    ['documentation', /\b(doc|docs|documentation|readme|guide)\b/],
    ['refactor', /\b(refactor|cleanup|simplify|restructure)\b/],
    ['performance', /\b(optimi[sz]e|performance|slow|latency|memory usage)\b/],
    ['planning', /\b(plan|roadmap|design|architect|proposal)\b/],
    ['workspace', /\b(workspace|repo|repository|project|codebase)\b/],
  ]

  for (const [label, matcher] of taskMatchers) {
    if (matcher.test(text)) {
      matches.push(label)
    }
  }

  return matches.length > 0 ? matches : ['general']
}

function getTaskTypeRelevance(
  itemTaskTypes: string[] | undefined,
  currentTaskTypes: string[],
  scope?: LearningScope
): number {
  const normalizedCurrentTaskTypes = normalizeTaskTypes(currentTaskTypes)
  const normalizedItemTaskTypes = normalizeTaskTypes(itemTaskTypes)

  if (normalizedCurrentTaskTypes.length === 0 || normalizedCurrentTaskTypes.includes('general')) {
    return 1
  }

  if (normalizedItemTaskTypes.length === 0 || normalizedItemTaskTypes.includes('general')) {
    return 1
  }

  const overlap = normalizedItemTaskTypes.filter((taskType) => normalizedCurrentTaskTypes.includes(taskType)).length
  if (overlap > 0) {
    return 1 + overlap
  }

  if (scope === 'conversation') return 0.6
  if (scope === 'workspace') return 0.35
  return 0
}

function getScopePriority(scope: LearningScope | undefined): number {
  switch (scope) {
    case 'conversation':
      return 3
    case 'workspace':
      return 2
    default:
      return 1
  }
}

function inferScope(
  category: PatternCategory | 'correction',
  content: string,
  workspaceId?: string,
  conversationId?: string
): LearningScope {
  const normalized = content.toLowerCase()
  const mentionsWorkspace = /\b(this (project|repo|repository|workspace|codebase)|in this repo|for this project|here)\b/.test(normalized)

  if (mentionsWorkspace && workspaceId) {
    return 'workspace'
  }

  if (category === 'communication' || category === 'personality' || category === 'preference') {
    return 'global'
  }

  if (workspaceId && (category === 'coding_style' || category === 'workflow' || category === 'mistake' || category === 'correction')) {
    return 'workspace'
  }

  if (conversationId) {
    return 'conversation'
  }

  return 'global'
}

function formatMemoryValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const statement = (value as { statement?: unknown }).statement
    if (typeof statement === 'string') return statement
  }
  return JSON.stringify(value)
}

function parseStoredMemoryValue(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function getMemoryTaskTypes(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  return normalizeTaskTypes((value as StoredMemoryValue).taskTypes)
}

function patternToMemoryCategory(category: PatternCategory): 'preference' | 'style' | 'workflow' | 'fact' {
  switch (category) {
    case 'coding_style':
      return 'style'
    case 'workflow':
      return 'workflow'
    case 'preference':
    case 'communication':
    case 'personality':
      return 'preference'
    default:
      return 'fact'
  }
}

function recordMemory(
  category: 'preference' | 'style' | 'workflow' | 'fact' | 'correction',
  scope: LearningScope,
  workspaceId: string | undefined,
  conversationId: string | undefined,
  statement: string,
  taskTypes: string[],
  confidence: number
) : boolean {
  const key = buildMemoryKey(category, statement)
  const existing = memoryDb.getByKey(scope, getScopeId(scope, workspaceId, conversationId), key)

  memoryDb.create({
    scope,
    scopeId: getScopeId(scope, workspaceId, conversationId) || undefined,
    category,
    key,
    value: {
      statement,
      taskTypes,
    },
    confidence,
    source: 'explicit',
    privacy: 'shared',
  })

  return !existing
}

function findExistingPattern(pattern: Pick<SoulPattern, 'category' | 'pattern' | 'scope' | 'scopeId'>): SoulPattern | undefined {
  return soul.patterns.find(
    (candidate) =>
      candidate.category === pattern.category &&
      candidate.pattern.toLowerCase() === pattern.pattern.toLowerCase() &&
      (candidate.scope || 'global') === (pattern.scope || 'global') &&
      (candidate.scopeId ?? null) === (pattern.scopeId ?? null)
  )
}

function findExistingCorrection(correction: Pick<Correction, 'original' | 'corrected' | 'scope' | 'scopeId'>): Correction | undefined {
  return soul.corrections.find((candidate) => {
    const isRecent = Date.now() - candidate.timestamp < 5 * 60 * 1000
    return (
      isRecent &&
      candidate.original === correction.original &&
      candidate.corrected === correction.corrected &&
      (candidate.scope || 'global') === (correction.scope || 'global') &&
      (candidate.scopeId ?? null) === (correction.scopeId ?? null)
    )
  })
}

export function addPattern(pattern: Omit<SoulPattern, 'id'>): SoulPattern {
  const normalizedInput = normalizePattern(pattern as SoulPattern)
  const existing = findExistingPattern(normalizedInput)

  if (existing) {
    existing.frequency += 1
    existing.lastObserved = Date.now()
    existing.confidence = Math.min(1, existing.confidence + 0.05)
    existing.evidence = [...new Set([...existing.evidence, ...normalizedInput.evidence])].slice(-10)
    existing.taskTypes = [...new Set([...(existing.taskTypes || []), ...(normalizedInput.taskTypes || [])])]
    saveSoul()
    return existing
  }

  const newPattern: SoulPattern = {
    ...normalizedInput,
    id: uuid(),
    decay: normalizedInput.decay ?? DEFAULT_DECAY_RATE,
  }

  soul.patterns.push(newPattern)
  saveSoul()
  return newPattern
}

export function updatePattern(id: string, updates: Partial<SoulPattern>): SoulPattern | null {
  const pattern = soul.patterns.find((candidate) => candidate.id === id)
  if (!pattern) return null

  Object.assign(pattern, updates)
  pattern.lastObserved = Date.now()
  if (updates.taskTypes) {
    pattern.taskTypes = [...new Set(updates.taskTypes)]
  }
  if (updates.scope !== undefined && pattern.scope === undefined) {
    pattern.scope = updates.scope
  }
  saveSoul()
  return pattern
}

export function removePattern(id: string): void {
  soul.patterns = soul.patterns.filter((pattern) => pattern.id !== id)
  saveSoul()
}

export function getPatterns(category?: PatternCategory): SoulPattern[] {
  let patterns = [...soul.patterns]
  if (category) {
    patterns = patterns.filter((pattern) => pattern.category === category)
  }

  return patterns.sort((a, b) => {
    const scopeDelta = getScopePriority(b.scope) - getScopePriority(a.scope)
    if (scopeDelta !== 0) return scopeDelta
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.frequency - a.frequency
  })
}

export function addCorrection(correction: Omit<Correction, 'id' | 'timestamp'>): Correction {
  const normalizedCorrection = normalizeCorrection(correction as Correction)
  const existing = findExistingCorrection(normalizedCorrection)

  if (existing) {
    existing.timestamp = Date.now()
    existing.taskTypes = [...new Set([...(existing.taskTypes || []), ...(normalizedCorrection.taskTypes || [])])]
    saveSoul()
    return existing
  }

  const newCorrection: Correction = {
    ...normalizedCorrection,
    id: uuid(),
    timestamp: Date.now(),
  }

  soul.corrections.push(newCorrection)
  if (soul.corrections.length > 100) {
    soul.corrections = soul.corrections.slice(-100)
  }

  saveSoul()
  return newCorrection
}

export function getCorrections(): Correction[] {
  return [...soul.corrections].sort((a, b) => b.timestamp - a.timestamp)
}

export function setPreference(key: string, value: unknown, confidence: number = 0.8): void {
  soul.preferences[key] = {
    value,
    confidence,
    updatedAt: Date.now(),
  }
  saveSoul()
}

export function getPreference(key: string): { value: unknown; confidence: number } | null {
  const preference = soul.preferences[key]
  if (!preference) return null
  return { value: preference.value, confidence: preference.confidence }
}

export function getAllPreferences(): Record<string, { value: unknown; confidence: number }> {
  const result: Record<string, { value: unknown; confidence: number }> = {}
  for (const [key, preference] of Object.entries(soul.preferences)) {
    result[key] = { value: preference.value, confidence: preference.confidence }
  }
  return result
}

export function decayConfidence(): void {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const daysSinceLastDecay = (now - soul.lastAnalyzedAt) / dayMs

  if (daysSinceLastDecay < DECAY_INTERVAL_DAYS) return

  soul.patterns.forEach((pattern) => {
    const daysSinceObserved = (now - pattern.lastObserved) / dayMs
    const decay = pattern.decay * (daysSinceObserved / DECAY_INTERVAL_DAYS)
    pattern.confidence = Math.max(0, pattern.confidence - decay)
  })

  soul.patterns = soul.patterns.filter((pattern) => pattern.confidence > MIN_CONFIDENCE)

  for (const [key, preference] of Object.entries(soul.preferences)) {
    const daysSinceUpdate = (now - preference.updatedAt) / dayMs
    const decay = DEFAULT_DECAY_RATE * (daysSinceUpdate / DECAY_INTERVAL_DAYS)
    preference.confidence = Math.max(0, preference.confidence - decay)

    if (preference.confidence <= MIN_CONFIDENCE) {
      delete soul.preferences[key]
    }
  }

  soul.lastAnalyzedAt = now
  saveSoul()
}

export function buildMemoryContext(options?: {
  workspaceId?: string
  conversationId?: string
  latestUserText?: string
}): string {
  const currentTaskTypes = classifyTaskTypes(options?.latestUserText || '')
  const memories = memoryDb
    .getForContext(options?.workspaceId, options?.conversationId)
    .map((memory) => {
      const parsedValue = parseStoredMemoryValue(memory.value)
      return {
        memory,
        parsedValue,
        taskRelevance: getTaskTypeRelevance(
          getMemoryTaskTypes(parsedValue),
          currentTaskTypes,
          memory.scope as LearningScope
        ),
      }
    })
    .filter(({ memory, taskRelevance }) => memory.confidence >= 0.7 && taskRelevance > 0)
    .sort((a, b) => {
      if (b.taskRelevance !== a.taskRelevance) return b.taskRelevance - a.taskRelevance
      const scopeDelta = getScopePriority((b.memory.scope as LearningScope) || 'global') - getScopePriority((a.memory.scope as LearningScope) || 'global')
      if (scopeDelta !== 0) return scopeDelta
      if (b.memory.confidence !== a.memory.confidence) return b.memory.confidence - a.memory.confidence
      return b.memory.updated_at - a.memory.updated_at
    })
    .slice(0, 8)

  if (memories.length === 0) return ''

  const lines: string[] = ['<user_context>', '## Remembered Context']

  for (const { memory, parsedValue } of memories) {
    const scopeLabel = memory.scope === 'global' ? '' : `[${memory.scope}] `
    lines.push(`- ${scopeLabel}${formatMemoryValue(parsedValue)}`)
  }

  lines.push('</user_context>')
  return lines.join('\n')
}

export function formatSoulForContext(options?: {
  workspaceId?: string
  conversationId?: string
  latestUserText?: string
}): string {
  const lines: string[] = []
  const currentTaskTypes = classifyTaskTypes(options?.latestUserText || '')

  const relevantPatterns = soul.patterns
    .filter((pattern) => pattern.confidence >= 0.6)
    .filter((pattern) => matchesScope(pattern.scope, pattern.scopeId, options || {}))
    .map((pattern) => ({
      pattern,
      taskRelevance: getTaskTypeRelevance(pattern.taskTypes, currentTaskTypes, pattern.scope),
    }))
    .filter(({ taskRelevance }) => taskRelevance > 0)
    .sort((a, b) => {
      if (b.taskRelevance !== a.taskRelevance) return b.taskRelevance - a.taskRelevance
      const scopeDelta = getScopePriority(b.pattern.scope) - getScopePriority(a.pattern.scope)
      if (scopeDelta !== 0) return scopeDelta
      if (b.pattern.confidence !== a.pattern.confidence) return b.pattern.confidence - a.pattern.confidence
      return b.pattern.frequency - a.pattern.frequency
    })
    .slice(0, 8)

  if (relevantPatterns.length > 0) {
    lines.push('### Learned Patterns')
    for (const { pattern } of relevantPatterns) {
      const confidence = Math.round(pattern.confidence * 100)
      const scopeLabel = pattern.scope && pattern.scope !== 'global' ? `, ${getScopeLabel(pattern.scope)}` : ''
      lines.push(`- [${pattern.category}${scopeLabel}] ${pattern.pattern} (${confidence}% confident)`)
    }
    lines.push('')
  }

  const preferences = Object.entries(getAllPreferences()).filter(([, value]) => value.confidence >= 0.6)
  if (preferences.length > 0) {
    lines.push('### User Preferences')
    for (const [key, preference] of preferences.slice(0, 10)) {
      const value = typeof preference.value === 'string' ? preference.value : JSON.stringify(preference.value)
      lines.push(`- ${key}: ${value}`)
    }
    lines.push('')
  }

  const relevantCorrections = soul.corrections
    .filter((correction) => matchesScope(correction.scope, correction.scopeId, options || {}))
    .map((correction) => ({
      correction,
      taskRelevance: getTaskTypeRelevance(correction.taskTypes, currentTaskTypes, correction.scope),
    }))
    .filter(({ taskRelevance }) => taskRelevance > 0)
    .sort((a, b) => {
      if (b.taskRelevance !== a.taskRelevance) return b.taskRelevance - a.taskRelevance
      const scopeDelta = getScopePriority(b.correction.scope) - getScopePriority(a.correction.scope)
      if (scopeDelta !== 0) return scopeDelta
      return b.correction.timestamp - a.correction.timestamp
    })
    .slice(0, 3)

  if (relevantCorrections.length > 0) {
    lines.push('### Recent Corrections to Remember')
    for (const { correction } of relevantCorrections) {
      const scopeLabel = correction.scope && correction.scope !== 'global' ? ` [${getScopeLabel(correction.scope)}]` : ''
      lines.push(`- ${correction.category}${scopeLabel}: "${correction.original}" -> "${correction.corrected}"`)
    }
  }

  return lines.join('\n')
}

export function analyzeConversation(
  messages: Array<{ role: string; content: string }>,
  metadata?: SoulAnalysisMetadata
): { newPatterns: SoulPattern[]; updates: string[]; captured: RecordedLearning[] } {
  const newPatterns: SoulPattern[] = []
  const updates: string[] = []
  const captured: RecordedLearning[] = []
  const taskTypes = classifyTaskTypes(metadata?.latestUserText || messages.filter((message) => message.role === 'user').map((message) => message.content).join(' '))

  const preferencePatterns = [
    { regex: /i (?:always|prefer|like to|want to) (.+)/i, category: 'preference' as PatternCategory },
    { regex: /please (?:always|never) (.+)/i, category: 'communication' as PatternCategory },
    { regex: /i (?:use|work with) (.+)/i, category: 'workflow' as PatternCategory },
    { regex: /my (?:style|approach) is (.+)/i, category: 'coding_style' as PatternCategory },
  ]

  for (const message of messages) {
    if (message.role !== 'user') continue

    for (const { regex, category } of preferencePatterns) {
      const match = message.content.match(regex)
      if (!match) continue

      const learnedStatement = normalizeLearnedText(match[0])
      const scope = inferScope(category, learnedStatement, metadata?.workspaceId, metadata?.conversationId)
      const scopeId = getScopeId(scope, metadata?.workspaceId, metadata?.conversationId)
      const hadPattern = !!findExistingPattern({
        category,
        pattern: learnedStatement,
        scope,
        scopeId,
      })

      const pattern = addPattern({
        category,
        pattern: learnedStatement,
        evidence: [message.content.slice(0, 200)],
        confidence: 0.9,
        frequency: 1,
        lastObserved: Date.now(),
        decay: DEFAULT_DECAY_RATE,
        source: 'explicit',
        scope,
        scopeId,
        taskTypes,
      })

      if (!hadPattern) {
        newPatterns.push(pattern)
        updates.push(`Learned a ${getScopeLabel(scope)} ${category.replace('_', ' ')} preference`)
      } else {
        updates.push(`Reinforced a ${getScopeLabel(scope)} ${category.replace('_', ' ')} preference`)
      }

      const createdMemory = recordMemory(
        patternToMemoryCategory(category),
        scope,
        metadata?.workspaceId,
        metadata?.conversationId,
        learnedStatement,
        taskTypes,
        0.9
      )

      if (!hadPattern || createdMemory) {
        captured.push({
          kind: 'memory',
          scope,
          message: `Remembered a ${getScopeLabel(scope)} ${category.replace('_', ' ')} preference for future tasks.`,
        })
      }
      break
    }

    const correctionIndicators = [
      /no,?\s*(?:i meant|i wanted|that's wrong)/i,
      /actually,?\s*(?:i wanted|i need|let me clarify)/i,
      /that's not (?:what i wanted|right|correct)/i,
    ]

    for (const indicator of correctionIndicators) {
      if (!indicator.test(message.content.toLowerCase())) continue

      const messageIndex = messages.indexOf(message)
      if (messageIndex <= 0) break

      const previousMessage = messages[messageIndex - 1]
      if (previousMessage.role !== 'assistant') break

      const scope = inferScope('correction', message.content, metadata?.workspaceId, metadata?.conversationId)
      const scopeId = getScopeId(scope, metadata?.workspaceId, metadata?.conversationId)
      const hadCorrection = !!findExistingCorrection({
        original: previousMessage.content.slice(0, 200),
        corrected: message.content.slice(0, 200),
        scope,
        scopeId,
      })

      addCorrection({
        original: previousMessage.content.slice(0, 200),
        corrected: message.content.slice(0, 200),
        context: messages
          .slice(Math.max(0, messageIndex - 2), messageIndex + 1)
          .map((entry) => `${entry.role}: ${entry.content.slice(0, 100)}`)
          .join('\n'),
        category: 'user_correction',
        scope,
        scopeId,
        taskTypes,
      })

      const createdMemory = recordMemory(
        'correction',
        scope,
        metadata?.workspaceId,
        metadata?.conversationId,
        normalizeLearnedText(message.content),
        taskTypes,
        0.95
      )

      updates.push(`${hadCorrection ? 'Reinforced' : 'Recorded'} a ${getScopeLabel(scope)} correction`)
      if (!hadCorrection || createdMemory) {
        captured.push({
          kind: 'correction',
          scope,
          message: `Recorded a correction for similar ${getScopeLabel(scope)} tasks.`,
        })
      }
      break
    }
  }

  if (metadata?.wasSuccessful && metadata.userFeedback) {
    const positiveIndicators = /thank|perfect|great|exactly|awesome|nice/i
    if (positiveIndicators.test(metadata.userFeedback)) {
      for (const pattern of soul.patterns) {
        if (Date.now() - pattern.lastObserved < 24 * 60 * 60 * 1000) {
          pattern.confidence = Math.min(1, pattern.confidence + 0.05)
        }
      }
      updates.push('Reinforced recent learnings based on positive feedback')
    }
  }

  if (newPatterns.length > 0 || updates.length > 0 || captured.length > 0) {
    saveSoul()
  }

  return { newPatterns, updates, captured }
}
