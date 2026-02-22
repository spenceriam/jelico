import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export type ConnectorId = 'github' | 'linear' | 'slack' | 'notion'

interface ConnectorTemplate {
  id: ConnectorId
  label: string
  description: string
  authType: 'oauth' | 'token'
  status: 'planned' | 'beta'
}

interface ConnectorRecord {
  id: ConnectorId
  connected: boolean
  accountLabel?: string
  updatedAt: number
}

interface ConnectorState {
  records: ConnectorRecord[]
}

const templates: ConnectorTemplate[] = [
  { id: 'github', label: 'GitHub', description: 'Issues, pull requests, checks, and repo actions.', authType: 'oauth', status: 'beta' },
  { id: 'linear', label: 'Linear', description: 'Sync issues, projects, and status updates.', authType: 'oauth', status: 'planned' },
  { id: 'slack', label: 'Slack', description: 'Post updates and read channel threads.', authType: 'oauth', status: 'planned' },
  { id: 'notion', label: 'Notion', description: 'Read and update docs and task pages.', authType: 'oauth', status: 'planned' },
]

function statePath() {
  return path.join(app.getPath('userData'), 'connectors.json')
}

function defaultState(): ConnectorState {
  return {
    records: templates.map((template) => ({ id: template.id, connected: false, updatedAt: Date.now() })),
  }
}

function readState(): ConnectorState {
  const target = statePath()
  if (!fs.existsSync(target)) {
    const next = defaultState()
    fs.writeFileSync(target, JSON.stringify(next, null, 2), 'utf8')
    return next
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as ConnectorState
    if (!parsed.records) return defaultState()
    return parsed
  } catch {
    return defaultState()
  }
}

function writeState(next: ConnectorState) {
  fs.writeFileSync(statePath(), JSON.stringify(next, null, 2), 'utf8')
}

export function registerConnectorHandlers() {
  ipcMain.handle('connectors:listTemplates', () => templates)

  ipcMain.handle('connectors:listConnections', () => {
    const state = readState()
    return state.records
  })

  ipcMain.handle('connectors:connectStub', (_event, id: ConnectorId, accountLabel?: string) => {
    const state = readState()
    const existing = state.records.find((record) => record.id === id)
    if (!existing) throw new Error('Unknown connector')

    existing.connected = true
    existing.accountLabel = accountLabel || `${id}-account`
    existing.updatedAt = Date.now()
    writeState(state)
    return existing
  })

  ipcMain.handle('connectors:disconnect', (_event, id: ConnectorId) => {
    const state = readState()
    const existing = state.records.find((record) => record.id === id)
    if (!existing) throw new Error('Unknown connector')

    existing.connected = false
    existing.accountLabel = undefined
    existing.updatedAt = Date.now()
    writeState(state)
    return existing
  })
}
