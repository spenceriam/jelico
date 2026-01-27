import { create } from 'zustand'
import type { AgentMode } from '../lib/modes'

export interface Skill {
  id: string
  name: string
  description: string
  prompt: string
  mode?: AgentMode
  shortcut?: string // e.g., "!review", "/fix"
  workspaceId?: string // If set, only available in this workspace
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}

interface SkillStore {
  skills: Skill[]
  isLoading: boolean

  // Actions
  loadSkills: () => void
  addSkill: (skill: Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>) => void
  updateSkill: (id: string, updates: Partial<Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt'>>) => void
  deleteSkill: (id: string) => void
  invokeSkill: (skillId: string, context?: string) => string // Returns the expanded prompt
  findSkillByShortcut: (input: string) => { skill: Skill; context: string } | null
}

// Built-in skills
const BUILT_IN_SKILLS: Skill[] = [
  {
    id: 'builtin:review',
    name: 'Code Review',
    description: 'Review code for issues, bugs, and improvements',
    prompt: `Please review the following code and provide:
1. Any bugs or potential issues
2. Security concerns
3. Performance improvements
4. Code style and best practices
5. Suggestions for better approaches

{{context}}`,
    mode: 'review',
    shortcut: '!review',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:explain',
    name: 'Explain Code',
    description: 'Get a detailed explanation of code',
    prompt: `Please explain this code in detail:
- What it does
- How it works
- Key concepts used
- Any notable patterns or techniques

{{context}}`,
    mode: 'explore',
    shortcut: '!explain',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:fix',
    name: 'Fix Issue',
    description: 'Fix a bug or issue in code',
    prompt: `Fix the following issue:

{{context}}

Please:
1. Identify the root cause
2. Implement the fix
3. Explain what was changed and why`,
    mode: 'execute',
    shortcut: '!fix',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:test',
    name: 'Write Tests',
    description: 'Generate tests for code',
    prompt: `Write comprehensive tests for the following:

{{context}}

Include:
- Unit tests for each function/method
- Edge cases and error handling
- Integration tests if applicable`,
    mode: 'execute',
    shortcut: '!test',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:docs',
    name: 'Write Documentation',
    description: 'Generate documentation for code',
    prompt: `Generate documentation for the following:

{{context}}

Include:
- Overview and purpose
- API reference with parameters and return values
- Usage examples
- Any important notes or caveats`,
    mode: 'plan',
    shortcut: '!docs',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:refactor',
    name: 'Refactor Code',
    description: 'Refactor code for better quality',
    prompt: `Refactor the following code:

{{context}}

Focus on:
- Improving readability
- Reducing complexity
- Better naming and organization
- Following best practices
- Maintaining the same behavior`,
    mode: 'execute',
    shortcut: '!refactor',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:optimize',
    name: 'Optimize Performance',
    description: 'Optimize code for better performance',
    prompt: `Optimize the following code for performance:

{{context}}

Consider:
- Time complexity improvements
- Memory usage optimization
- Caching opportunities
- Algorithm improvements
- Benchmarks if possible`,
    mode: 'execute',
    shortcut: '!optimize',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
]

const STORAGE_KEY = 'jelico:skills'

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [...BUILT_IN_SKILLS],
  isLoading: false,

  loadSkills: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const customSkills = JSON.parse(stored) as Skill[]
        set({ skills: [...BUILT_IN_SKILLS, ...customSkills] })
      }
    } catch (error) {
      console.error('Failed to load skills:', error)
    }
  },

  addSkill: (skill) => {
    const newSkill: Skill = {
      ...skill,
      id: crypto.randomUUID(),
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    set((state) => {
      const skills = [...state.skills, newSkill]
      saveCustomSkills(skills)
      return { skills }
    })
  },

  updateSkill: (id, updates) => {
    set((state) => {
      const skills = state.skills.map((s) =>
        s.id === id && !s.isBuiltIn
          ? { ...s, ...updates, updatedAt: Date.now() }
          : s
      )
      saveCustomSkills(skills)
      return { skills }
    })
  },

  deleteSkill: (id) => {
    set((state) => {
      const skills = state.skills.filter((s) => s.id !== id || s.isBuiltIn)
      saveCustomSkills(skills)
      return { skills }
    })
  },

  invokeSkill: (skillId, context = '') => {
    const skill = get().skills.find((s) => s.id === skillId)
    if (!skill) return context

    return skill.prompt.replace('{{context}}', context)
  },

  findSkillByShortcut: (input) => {
    const trimmed = input.trim()
    const skills = get().skills

    for (const skill of skills) {
      if (skill.shortcut && trimmed.startsWith(skill.shortcut)) {
        const context = trimmed.slice(skill.shortcut.length).trim()
        return { skill, context }
      }
    }

    return null
  },
}))

function saveCustomSkills(skills: Skill[]) {
  const customSkills = skills.filter((s) => !s.isBuiltIn)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customSkills))
}
