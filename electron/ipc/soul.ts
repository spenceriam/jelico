import { ipcMain } from 'electron'
import {
  loadSoul,
  getSoul,
  addPattern,
  updatePattern,
  removePattern,
  getPatterns,
  addCorrection,
  getCorrections,
  setPreference,
  getPreference,
  getAllPreferences,
  decayConfidence,
  formatSoulForContext,
  analyzeConversation,
  type PatternCategory,
  type SoulPattern,
  type SoulAnalysisMetadata,
} from '../services/soul.js'

export function registerSoulHandlers() {
  // Load soul on startup
  loadSoul()

  // Get the full soul state
  ipcMain.handle('soul:get', () => {
    return getSoul()
  })

  // Pattern operations
  ipcMain.handle('soul:getPatterns', (_, category?: PatternCategory) => {
    return getPatterns(category)
  })

  ipcMain.handle('soul:addPattern', (_, pattern: Omit<SoulPattern, 'id'>) => {
    return addPattern(pattern)
  })

  ipcMain.handle('soul:updatePattern', (_, id: string, updates: Partial<SoulPattern>) => {
    return updatePattern(id, updates)
  })

  ipcMain.handle('soul:removePattern', (_, id: string) => {
    removePattern(id)
    return { success: true }
  })

  // Correction operations
  ipcMain.handle('soul:getCorrections', () => {
    return getCorrections()
  })

  ipcMain.handle('soul:addCorrection', (_, correction: {
    original: string
    corrected: string
    context: string
    category: string
  }) => {
    return addCorrection(correction)
  })

  // Preference operations
  ipcMain.handle('soul:setPreference', (_, key: string, value: unknown, confidence?: number) => {
    setPreference(key, value, confidence)
    return { success: true }
  })

  ipcMain.handle('soul:getPreference', (_, key: string) => {
    return getPreference(key)
  })

  ipcMain.handle('soul:getAllPreferences', () => {
    return getAllPreferences()
  })

  // Maintenance operations
  ipcMain.handle('soul:decayConfidence', () => {
    decayConfidence()
    return { success: true }
  })

  // Get formatted context for AI
  ipcMain.handle('soul:getContext', () => {
    return formatSoulForContext()
  })

  // Analyze a conversation for patterns
  ipcMain.handle('soul:analyzeConversation', (_, messages: Array<{ role: string; content: string }>, metadata?: SoulAnalysisMetadata) => {
    return analyzeConversation(messages, metadata)
  })
}
