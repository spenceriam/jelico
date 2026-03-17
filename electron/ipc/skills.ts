import { ipcMain } from 'electron'
import {
  createCustomSkill,
  deleteCustomSkill,
  importLegacySkills,
  listSkills,
  updateCustomSkill,
} from '../services/skills.js'
import type { LegacySkillInput, SkillDraft } from '../../shared/skills'

export function registerSkillHandlers() {
  ipcMain.handle('skills:list', async () => {
    return listSkills()
  })

  ipcMain.handle('skills:create', async (_, draft: SkillDraft) => {
    return createCustomSkill(draft)
  })

  ipcMain.handle('skills:update', async (_, id: string, draft: SkillDraft) => {
    return updateCustomSkill(id, draft)
  })

  ipcMain.handle('skills:delete', async (_, id: string) => {
    return { success: deleteCustomSkill(id) }
  })

  ipcMain.handle('skills:importLegacy', async (_, skills: LegacySkillInput[]) => {
    return importLegacySkills(skills)
  })
}
