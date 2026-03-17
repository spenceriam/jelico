import { create } from 'zustand'

const LEGACY_STORAGE_KEY = 'jelico:skills'

function isLegacySkillInput(value: unknown): value is LegacyAppSkillInput {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<LegacyAppSkillInput> & { prompt?: unknown }
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.prompt === 'string'
  )
}

function loadLegacyCustomSkills(): LegacyAppSkillInput[] {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored) as unknown[]
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isLegacySkillInput)
      .map((skill) => ({
        name: skill.name,
        description: skill.description,
        prompt: skill.prompt,
        mode: skill.mode,
      }))
  } catch (error) {
    console.error('Failed to read legacy skills:', error)
    return []
  }
}

interface SkillStore {
  skills: AppSkill[]
  isLoading: boolean
  loadSkills: () => Promise<void>
  addSkill: (draft: AppSkillDraft) => Promise<AppSkill>
  updateSkill: (id: string, draft: AppSkillDraft) => Promise<AppSkill | null>
  deleteSkill: (id: string) => Promise<void>
}

export const useSkillStore = create<SkillStore>((set) => ({
  skills: [],
  isLoading: false,

  loadSkills: async () => {
    set({ isLoading: true })

    try {
      const legacySkills = loadLegacyCustomSkills()
      if (legacySkills.length > 0) {
        await window.jelico.skills.importLegacy(legacySkills)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      }

      const skills = await window.jelico.skills.list()
      set({ skills, isLoading: false })
    } catch (error) {
      console.error('Failed to load skills:', error)
      set({ isLoading: false })
    }
  },

  addSkill: async (draft) => {
    const skill = await window.jelico.skills.create(draft)
    set((state) => ({
      skills: [...state.skills.filter((existing) => existing.id !== skill.id), skill],
    }))
    return skill
  },

  updateSkill: async (id, draft) => {
    const skill = await window.jelico.skills.update(id, draft)
    if (!skill) return null

    set((state) => ({
      skills: state.skills.map((existing) => (existing.id === id ? skill : existing)),
    }))
    return skill
  },

  deleteSkill: async (id) => {
    await window.jelico.skills.delete(id)
    set((state) => ({
      skills: state.skills.filter((skill) => skill.id !== id),
    }))
  },
}))
