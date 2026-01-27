import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'

// Soul System - Jelico's learning and memory of the user

export type PatternCategory =
  | 'coding_style'
  | 'communication'
  | 'mistake'
  | 'preference'
  | 'workflow'
  | 'personality'

export interface SoulPattern {
  id: string
  category: PatternCategory
  pattern: string // Description of the learned pattern
  evidence: string[] // Examples that support this pattern
  confidence: number // 0-1 confidence score
  frequency: number // How often observed
  lastObserved: number // Timestamp
  decay: number // Rate of confidence decay over time (default 0.01)
  source: 'explicit' | 'inferred' // User stated vs. AI detected
}

export interface Correction {
  id: string
  original: string // What the AI said/did
  corrected: string // What it should have been
  context: string // Surrounding context
  category: string // Type of correction
  timestamp: number
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

export function loadSoul(): Soul {
  try {
    const soulPath = getSoulPath()
    if (fs.existsSync(soulPath)) {
      const content = fs.readFileSync(soulPath, 'utf-8')
      soul = JSON.parse(content)
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
  } catch (err) {
    console.error('Failed to save soul:', err)
  }
}

export function getSoul(): Soul {
  return soul
}

// Pattern management
export function addPattern(pattern: Omit<SoulPattern, 'id'>): SoulPattern {
  // Check for existing similar pattern
  const existing = soul.patterns.find(
    p => p.category === pattern.category && p.pattern.toLowerCase() === pattern.pattern.toLowerCase()
  )

  if (existing) {
    // Reinforce existing pattern
    existing.frequency++
    existing.lastObserved = Date.now()
    existing.confidence = Math.min(1, existing.confidence + 0.1)
    existing.evidence = [...new Set([...existing.evidence, ...pattern.evidence])].slice(-10)
    saveSoul()
    return existing
  }

  const newPattern: SoulPattern = {
    ...pattern,
    id: uuid(),
    decay: pattern.decay ?? DEFAULT_DECAY_RATE,
  }

  soul.patterns.push(newPattern)
  saveSoul()
  return newPattern
}

export function updatePattern(id: string, updates: Partial<SoulPattern>): SoulPattern | null {
  const pattern = soul.patterns.find(p => p.id === id)
  if (!pattern) return null

  Object.assign(pattern, updates)
  pattern.lastObserved = Date.now()
  saveSoul()
  return pattern
}

export function removePattern(id: string): void {
  soul.patterns = soul.patterns.filter(p => p.id !== id)
  saveSoul()
}

export function getPatterns(category?: PatternCategory): SoulPattern[] {
  let patterns = [...soul.patterns]

  if (category) {
    patterns = patterns.filter(p => p.category === category)
  }

  // Sort by confidence then frequency
  return patterns.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.frequency - a.frequency
  })
}

// Correction tracking
export function addCorrection(correction: Omit<Correction, 'id' | 'timestamp'>): Correction {
  const newCorrection: Correction = {
    ...correction,
    id: uuid(),
    timestamp: Date.now(),
  }

  soul.corrections.push(newCorrection)

  // Keep only last 100 corrections
  if (soul.corrections.length > 100) {
    soul.corrections = soul.corrections.slice(-100)
  }

  saveSoul()
  return newCorrection
}

export function getCorrections(): Correction[] {
  return [...soul.corrections].sort((a, b) => b.timestamp - a.timestamp)
}

// Preference management
export function setPreference(key: string, value: unknown, confidence: number = 0.8): void {
  soul.preferences[key] = {
    value,
    confidence,
    updatedAt: Date.now(),
  }
  saveSoul()
}

export function getPreference(key: string): { value: unknown; confidence: number } | null {
  const pref = soul.preferences[key]
  if (!pref) return null
  return { value: pref.value, confidence: pref.confidence }
}

export function getAllPreferences(): Record<string, { value: unknown; confidence: number }> {
  const result: Record<string, { value: unknown; confidence: number }> = {}
  for (const [key, pref] of Object.entries(soul.preferences)) {
    result[key] = { value: pref.value, confidence: pref.confidence }
  }
  return result
}

// Confidence decay - call periodically
export function decayConfidence(): void {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const daysSinceLastDecay = (now - soul.lastAnalyzedAt) / dayMs

  // Only decay if enough time has passed
  if (daysSinceLastDecay < DECAY_INTERVAL_DAYS) return

  // Decay patterns
  soul.patterns.forEach(p => {
    const daysSinceObserved = (now - p.lastObserved) / dayMs
    const decay = p.decay * (daysSinceObserved / DECAY_INTERVAL_DAYS)
    p.confidence = Math.max(0, p.confidence - decay)
  })

  // Remove patterns with very low confidence
  soul.patterns = soul.patterns.filter(p => p.confidence > MIN_CONFIDENCE)

  // Decay preferences
  for (const [key, pref] of Object.entries(soul.preferences)) {
    const daysSinceUpdate = (now - pref.updatedAt) / dayMs
    const decay = DEFAULT_DECAY_RATE * (daysSinceUpdate / DECAY_INTERVAL_DAYS)
    pref.confidence = Math.max(0, pref.confidence - decay)

    if (pref.confidence <= MIN_CONFIDENCE) {
      delete soul.preferences[key]
    }
  }

  soul.lastAnalyzedAt = now
  saveSoul()
}

// Format soul learnings for AI context
export function formatSoulForContext(): string {
  const lines: string[] = []

  // High-confidence patterns
  const highConfPatterns = soul.patterns.filter(p => p.confidence >= 0.6)
  if (highConfPatterns.length > 0) {
    lines.push('### Learned Patterns')
    for (const p of highConfPatterns.slice(0, 10)) {
      const confidence = Math.round(p.confidence * 100)
      lines.push(`- [${p.category}] ${p.pattern} (${confidence}% confident)`)
    }
    lines.push('')
  }

  // Key preferences
  const prefs = getAllPreferences()
  const highConfPrefs = Object.entries(prefs).filter(([, v]) => v.confidence >= 0.6)
  if (highConfPrefs.length > 0) {
    lines.push('### User Preferences')
    for (const [key, pref] of highConfPrefs.slice(0, 10)) {
      const value = typeof pref.value === 'string' ? pref.value : JSON.stringify(pref.value)
      lines.push(`- ${key}: ${value}`)
    }
    lines.push('')
  }

  // Recent corrections (for avoiding similar mistakes)
  const recentCorrections = soul.corrections.slice(-5)
  if (recentCorrections.length > 0) {
    lines.push('### Recent Corrections to Remember')
    for (const c of recentCorrections) {
      lines.push(`- ${c.category}: "${c.original}" → "${c.corrected}"`)
    }
  }

  return lines.join('\n')
}

// Analyze a conversation for patterns (to be called after conversations)
export function analyzeConversation(
  messages: Array<{ role: string; content: string }>,
  metadata?: { wasSuccessful?: boolean; userFeedback?: string }
): { newPatterns: SoulPattern[]; updates: string[] } {
  const newPatterns: SoulPattern[] = []
  const updates: string[] = []

  // Look for explicit user statements about preferences
  for (const msg of messages) {
    if (msg.role !== 'user') continue

    const content = msg.content.toLowerCase()

    // Detect explicit preferences
    const preferencePatterns = [
      { regex: /i (always|prefer|like to|want to) (.+)/i, category: 'preference' as PatternCategory },
      { regex: /please (always|never) (.+)/i, category: 'preference' as PatternCategory },
      { regex: /i (use|work with) (.+)/i, category: 'workflow' as PatternCategory },
      { regex: /my (style|approach) is (.+)/i, category: 'coding_style' as PatternCategory },
    ]

    for (const { regex, category } of preferencePatterns) {
      const match = msg.content.match(regex)
      if (match) {
        const pattern = addPattern({
          category,
          pattern: match[0],
          evidence: [msg.content.slice(0, 200)],
          confidence: 0.9,
          frequency: 1,
          lastObserved: Date.now(),
          decay: DEFAULT_DECAY_RATE,
          source: 'explicit',
        })
        newPatterns.push(pattern)
        updates.push(`Learned: "${pattern.pattern}"`)
      }
    }

    // Detect corrections ("no, I meant...", "actually...", "that's not what I wanted")
    const correctionIndicators = [
      /no,?\s*(i meant|i wanted|that's wrong)/i,
      /actually,?\s*(i wanted|i need|let me clarify)/i,
      /that's not (what i wanted|right|correct)/i,
    ]

    for (const indicator of correctionIndicators) {
      if (indicator.test(content)) {
        // Find the previous assistant message
        const msgIndex = messages.indexOf(msg)
        if (msgIndex > 0) {
          const prevMsg = messages[msgIndex - 1]
          if (prevMsg.role === 'assistant') {
            addCorrection({
              original: prevMsg.content.slice(0, 200),
              corrected: msg.content.slice(0, 200),
              context: messages.slice(Math.max(0, msgIndex - 2), msgIndex + 1)
                .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
                .join('\n'),
              category: 'user_correction',
            })
            updates.push('Recorded a correction to learn from')
          }
        }
        break
      }
    }
  }

  // If user provided positive feedback, reinforce patterns
  if (metadata?.wasSuccessful && metadata?.userFeedback) {
    const positiveIndicators = /thank|perfect|great|exactly|awesome|nice/i
    if (positiveIndicators.test(metadata.userFeedback)) {
      // Slightly boost confidence of all recent patterns
      for (const p of soul.patterns) {
        if (Date.now() - p.lastObserved < 24 * 60 * 60 * 1000) {
          p.confidence = Math.min(1, p.confidence + 0.05)
        }
      }
      updates.push('Reinforced recent learnings based on positive feedback')
    }
  }

  if (newPatterns.length > 0 || updates.length > 0) {
    saveSoul()
  }

  return { newPatterns, updates }
}
