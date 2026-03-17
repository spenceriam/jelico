import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { keychainService } from './keychain.js'
import { applyBackupPayload, collectBackupPayload } from './backupPayload.js'
import { validateBackupPayload } from './backupPayloadSchema.js'

type GithubBackupMode = 'manual' | 'on_change' | 'scheduled'
type GithubBackupTrigger = 'manual' | 'on_change' | 'scheduled'

interface GithubBackupConfig {
  repoUrl: string
  mode: GithubBackupMode
  scheduleHours: number
  lastBackupAt?: number
  lastBackupPath?: string
  lastError?: string | null
}

interface GithubRepoTarget {
  owner: string
  repo: string
}

const CONFIG_FILE = 'github-backup.json'
const TOKEN_KEY = 'github-backup-token'
const LATEST_BACKUP_PATH = 'jelico-backups/latest.json'
const CHANGE_BACKUP_DEBOUNCE_MS = 20000
const DEFAULT_SCHEDULE_HOURS = 24

let scheduleTimer: NodeJS.Timeout | null = null
let changeTimer: NodeJS.Timeout | null = null
let activeBackupPromise: Promise<{ success: boolean; backupPath?: string; error?: string }> | null = null

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE)
}

function loadConfig(): GithubBackupConfig {
  try {
    if (fs.existsSync(getConfigPath())) {
      const parsed = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8')) as Partial<GithubBackupConfig>
      return {
        repoUrl: parsed.repoUrl || '',
        mode: parsed.mode || 'manual',
        scheduleHours: parsed.scheduleHours || DEFAULT_SCHEDULE_HOURS,
        lastBackupAt: parsed.lastBackupAt,
        lastBackupPath: parsed.lastBackupPath,
        lastError: parsed.lastError || null,
      }
    }
  } catch (error) {
    console.error('[GitHub Backup] Failed to load config:', error)
  }

  return {
    repoUrl: '',
    mode: 'manual',
    scheduleHours: DEFAULT_SCHEDULE_HOURS,
    lastError: null,
  }
}

function saveConfig(config: GithubBackupConfig) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
}

function parseRepoUrl(repoUrl: string): GithubRepoTarget {
  const normalized = repoUrl.trim()

  const httpsMatch = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  throw new Error('Enter a GitHub repository URL like https://github.com/owner/repo.')
}

async function githubRequest<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitHub API ${response.status}: ${errorText || response.statusText}`)
  }

  return response.json() as Promise<T>
}

async function getRepositoryMetadata(target: GithubRepoTarget, token: string): Promise<{ default_branch: string }> {
  return githubRequest<{ default_branch: string }>(
    `https://api.github.com/repos/${target.owner}/${target.repo}`,
    token
  )
}

async function getExistingFileSha(target: GithubRepoTarget, filePath: string, branch: string, token: string): Promise<string | undefined> {
  const response = await fetch(
    `https://api.github.com/repos/${target.owner}/${target.repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (response.status === 404) return undefined
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitHub API ${response.status}: ${errorText || response.statusText}`)
  }

  const payload = await response.json() as { sha?: string }
  return payload.sha
}

async function putFile(target: GithubRepoTarget, branch: string, filePath: string, content: string, token: string, message: string) {
  const sha = await getExistingFileSha(target, filePath, branch, token)
  await githubRequest(
    `https://api.github.com/repos/${target.owner}/${target.repo}/contents/${filePath}`,
    token,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    }
  )
}

function clearScheduleTimer() {
  if (scheduleTimer) {
    clearInterval(scheduleTimer)
    scheduleTimer = null
  }
}

function clearChangeTimer() {
  if (changeTimer) {
    clearTimeout(changeTimer)
    changeTimer = null
  }
}

function scheduleIfNeeded(config: GithubBackupConfig, hasToken: boolean) {
  clearScheduleTimer()

  if (!config.repoUrl || !hasToken || config.mode !== 'scheduled') {
    return
  }

  const everyMs = Math.max(1, config.scheduleHours) * 60 * 60 * 1000
  scheduleTimer = setInterval(() => {
    void runGithubBackup('scheduled')
  }, everyMs)
}

async function updateStoredConfig(updater: (config: GithubBackupConfig) => GithubBackupConfig) {
  const next = updater(loadConfig())
  saveConfig(next)
  scheduleIfNeeded(next, Boolean(await keychainService.getApiKey(TOKEN_KEY)))
}

export async function getGithubBackupStatus() {
  const config = loadConfig()
  const token = await keychainService.getApiKey(TOKEN_KEY)
  return {
    ...config,
    hasToken: Boolean(token),
  }
}

export async function saveGithubBackupSettings(input: {
  repoUrl: string
  token?: string
  mode: GithubBackupMode
  scheduleHours?: number
}) {
  parseRepoUrl(input.repoUrl)

  if (typeof input.token === 'string' && input.token.trim()) {
    await keychainService.setApiKey(TOKEN_KEY, input.token.trim())
  }

  await updateStoredConfig((current) => ({
    ...current,
    repoUrl: input.repoUrl.trim(),
    mode: input.mode,
    scheduleHours: input.mode === 'scheduled'
      ? Math.max(1, input.scheduleHours || current.scheduleHours || DEFAULT_SCHEDULE_HOURS)
      : current.scheduleHours || DEFAULT_SCHEDULE_HOURS,
    lastError: null,
  }))

  return getGithubBackupStatus()
}

export async function runGithubBackup(trigger: GithubBackupTrigger): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  if (activeBackupPromise) {
    return activeBackupPromise
  }

  activeBackupPromise = (async () => {
    const config = loadConfig()
    const token = await keychainService.getApiKey(TOKEN_KEY)

    if (!config.repoUrl) {
      return { success: false, error: 'Configure a GitHub repository first.' }
    }
    if (!token) {
      return { success: false, error: 'Add a GitHub personal access token first.' }
    }

    try {
      const target = parseRepoUrl(config.repoUrl)
      const metadata = await getRepositoryMetadata(target, token)
      const branch = metadata.default_branch
      const payload = collectBackupPayload()
      const serializedPayload = JSON.stringify(payload, null, 2)
      const timestamp = new Date().toISOString().replace(/[:]/g, '-')
      const historyPath = `jelico-backups/history/${timestamp}.json`
      const message = `backup: jelico ${trigger} snapshot ${timestamp}`

      await putFile(target, branch, LATEST_BACKUP_PATH, serializedPayload, token, message)
      await putFile(target, branch, historyPath, serializedPayload, token, message)

      await updateStoredConfig((current) => ({
        ...current,
        lastBackupAt: Date.now(),
        lastBackupPath: historyPath,
        lastError: null,
      }))

      return {
        success: true,
        backupPath: historyPath,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GitHub backup failed.'
      await updateStoredConfig((current) => ({
        ...current,
        lastError: message,
      }))
      return { success: false, error: message }
    } finally {
      activeBackupPromise = null
    }
  })()

  return activeBackupPromise
}

export async function restoreLatestGithubBackup(): Promise<{
  success: boolean
  imported?: { database: boolean; soul: boolean; filesRestored: number }
  error?: string
}> {
  const config = loadConfig()
  const token = await keychainService.getApiKey(TOKEN_KEY)

  if (!config.repoUrl) {
    return { success: false, error: 'Configure a GitHub repository first.' }
  }
  if (!token) {
    return { success: false, error: 'Add a GitHub personal access token first.' }
  }

  try {
    const target = parseRepoUrl(config.repoUrl)
    const metadata = await getRepositoryMetadata(target, token)
    const response = await githubRequest<{ content: string; encoding: string }>(
      `https://api.github.com/repos/${target.owner}/${target.repo}/contents/${LATEST_BACKUP_PATH}?ref=${encodeURIComponent(metadata.default_branch)}`,
      token
    )

    if (response.encoding !== 'base64') {
      throw new Error('Unsupported backup encoding returned by GitHub.')
    }

    const payload = validateBackupPayload(JSON.parse(Buffer.from(response.content, 'base64').toString('utf-8')))
    const imported = applyBackupPayload(payload)

    return { success: true, imported }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore GitHub backup.',
    }
  }
}

export async function initializeGithubBackupScheduler() {
  const config = loadConfig()
  const token = await keychainService.getApiKey(TOKEN_KEY)
  scheduleIfNeeded(config, Boolean(token))
}

export function notifyGithubBackupDataChanged() {
  clearChangeTimer()

  changeTimer = setTimeout(async () => {
    const config = loadConfig()
    const token = await keychainService.getApiKey(TOKEN_KEY)
    if (!config.repoUrl || !token || config.mode !== 'on_change') {
      return
    }

    void runGithubBackup('on_change')
  }, CHANGE_BACKUP_DEBOUNCE_MS)
}
