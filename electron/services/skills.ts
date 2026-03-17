import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { notifyGithubBackupDataChanged } from './githubBackup.js'
import {
  createLegacySkillDraft,
  createSkillRecord,
  getBuiltInSkillRecords,
  parseSkillContent,
  type LegacySkillInput,
  type SkillDraft,
  type SkillRecord,
} from '../../shared/skills'

interface StoredCustomSkill {
  id: string
  content: string
  createdAt: number
  updatedAt: number
}

interface SkillsFile {
  version: number
  customSkills: StoredCustomSkill[]
}

const SKILLS_FILE = 'skills.json'

function getSkillsPath(): string {
  return path.join(app.getPath('userData'), SKILLS_FILE)
}

function loadSkillsFile(): SkillsFile {
  try {
    const filePath = getSkillsPath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(content) as Partial<SkillsFile>
      return {
        version: parsed.version || 1,
        customSkills: Array.isArray(parsed.customSkills) ? parsed.customSkills : [],
      }
    }
  } catch (error) {
    console.error('[Skills] Failed to load skills file:', error)
  }

  return {
    version: 1,
    customSkills: [],
  }
}

function saveSkillsFile(data: SkillsFile): void {
  fs.writeFileSync(getSkillsPath(), JSON.stringify(data, null, 2))
  notifyGithubBackupDataChanged()
}

function toCustomSkillRecord(skill: StoredCustomSkill): SkillRecord {
  return createSkillRecord(
    skill.id,
    'custom',
    parseSkillContent(skill.content),
    skill.createdAt,
    skill.updatedAt
  )
}

function replaceCustomSkill(skills: StoredCustomSkill[], next: StoredCustomSkill): StoredCustomSkill[] {
  return [...skills.filter((skill) => skill.id !== next.id), next].sort((a, b) => a.createdAt - b.createdAt)
}

export function listSkills(): SkillRecord[] {
  const builtIn = getBuiltInSkillRecords()
  const custom = loadSkillsFile().customSkills.flatMap((skill) => {
    try {
      return [toCustomSkillRecord(skill)]
    } catch (error) {
      console.error('[Skills] Skipping invalid custom skill:', error)
      return []
    }
  })
  return [...builtIn, ...custom]
}

export function createCustomSkill(draft: SkillDraft): SkillRecord {
  const now = Date.now()
  const id = uuid()
  const record = createSkillRecord(id, 'custom', draft, now, now)
  const file = loadSkillsFile()

  file.customSkills = replaceCustomSkill(file.customSkills, {
    id,
    content: record.content,
    createdAt: now,
    updatedAt: now,
  })
  saveSkillsFile(file)

  return record
}

export function updateCustomSkill(id: string, draft: SkillDraft): SkillRecord | null {
  const file = loadSkillsFile()
  const existing = file.customSkills.find((skill) => skill.id === id)
  if (!existing) return null

  const updatedAt = Date.now()
  const record = createSkillRecord(id, 'custom', draft, existing.createdAt, updatedAt)
  file.customSkills = replaceCustomSkill(file.customSkills, {
    id,
    content: record.content,
    createdAt: existing.createdAt,
    updatedAt,
  })
  saveSkillsFile(file)

  return record
}

export function deleteCustomSkill(id: string): boolean {
  const file = loadSkillsFile()
  const nextSkills = file.customSkills.filter((skill) => skill.id !== id)
  if (nextSkills.length === file.customSkills.length) {
    return false
  }

  file.customSkills = nextSkills
  saveSkillsFile(file)
  return true
}

export function importLegacySkills(skills: LegacySkillInput[]): SkillRecord[] {
  const existing = new Set(listSkills().filter((skill) => skill.source === 'custom').map((skill) => skill.name.toLowerCase()))
  const imported: SkillRecord[] = []

  for (const legacySkill of skills) {
    if (existing.has(legacySkill.name.toLowerCase())) {
      continue
    }

    const record = createCustomSkill(createLegacySkillDraft(legacySkill))
    imported.push(record)
    existing.add(record.name.toLowerCase())
  }

  return imported
}
