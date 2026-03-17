import { useEffect, useState } from 'react'
import {
  Download,
  Upload,
  Trash2,
  HardDrive,
  Database,
  Brain,
  RefreshCw,
  AlertCircle,
  Check,
  Loader2,
  Github,
  Eye,
  EyeOff,
  UploadCloud,
  RotateCcw,
} from 'lucide-react'

interface BackupStats {
  dataPath: string
  database?: {
    providers: number
    conversations: number
    messages: number
    workspaces: number
    artifacts: number
    memories: number
    permissions: number
  }
  databaseSize?: number
  soul?: {
    patterns: number
    corrections: number
    preferences: number
  }
  soulSize?: number
}

interface GithubBackupStatus {
  repoUrl: string
  mode: 'manual' | 'on_change' | 'scheduled'
  scheduleHours: number
  hasToken: boolean
  lastBackupAt?: number
  lastBackupPath?: string
  lastError?: string | null
}

const SCHEDULE_OPTIONS = [
  { value: 1, label: 'Every hour' },
  { value: 6, label: 'Every 6 hours' },
  { value: 12, label: 'Every 12 hours' },
  { value: 24, label: 'Daily' },
  { value: 168, label: 'Weekly' },
]

function formatRelativeSchedule(hours: number) {
  const option = SCHEDULE_OPTIONS.find((entry) => entry.value === hours)
  return option?.label || `Every ${hours} hours`
}

export function BackupSettings() {
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [githubStatus, setGithubStatus] = useState<GithubBackupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [savingGithub, setSavingGithub] = useState(false)
  const [runningGithub, setRunningGithub] = useState(false)
  const [restoringGithub, setRestoringGithub] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [repoUrl, setRepoUrl] = useState('')
  const [githubMode, setGithubMode] = useState<GithubBackupStatus['mode']>('manual')
  const [scheduleHours, setScheduleHours] = useState(24)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  const loadStats = async () => {
    try {
      const [statsResult, githubResult] = await Promise.all([
        window.jelico.backup.getStats(),
        window.jelico.backup.getGithubStatus(),
      ])
      setStats(statsResult)
      setGithubStatus(githubResult)
      setRepoUrl(githubResult.repoUrl || '')
      setGithubMode(githubResult.mode)
      setScheduleHours(githubResult.scheduleHours || 24)
    } catch (error) {
      console.error('Failed to load backup settings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStats()
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    try {
      const result = await window.jelico.backup.export()
      if (result.success) {
        setMessage({ type: 'success', text: `Backup saved to ${result.filePath}` })
      } else if (!result.cancelled) {
        setMessage({ type: 'error', text: result.error || 'Export failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Export failed' })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setMessage(null)
    try {
      const result = await window.jelico.backup.import()
      if (result.success) {
        setMessage({ type: 'success', text: 'Backup imported successfully. Please restart Jelico.' })
        await loadStats()
      } else if (!result.cancelled) {
        setMessage({ type: 'error', text: result.error || 'Import failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  const handleClearAll = async () => {
    const confirmed = confirm(
      'Are you sure you want to clear all data? This will delete all conversations, memories, and learned patterns. A backup will be created automatically.'
    )
    if (!confirmed) return

    setClearing(true)
    setMessage(null)
    try {
      const result = await window.jelico.backup.clearAll()
      if (result.success) {
        setMessage({ type: 'success', text: 'All data cleared. A backup was created automatically.' })
        await loadStats()
      } else {
        setMessage({ type: 'error', text: result.error || 'Clear failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Clear failed' })
    } finally {
      setClearing(false)
    }
  }

  const handleSaveGithubSettings = async () => {
    setSavingGithub(true)
    setMessage(null)
    try {
      const result = await window.jelico.backup.saveGithubSettings({
        repoUrl,
        token: token.trim() || undefined,
        mode: githubMode,
        scheduleHours,
      })
      setGithubStatus(result)
      setToken('')
      setMessage({ type: 'success', text: 'GitHub backup settings saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save GitHub backup settings' })
    } finally {
      setSavingGithub(false)
    }
  }

  const handleRunGithubBackup = async () => {
    setRunningGithub(true)
    setMessage(null)
    try {
      const result = await window.jelico.backup.runGithubBackup()
      if (result.success) {
        setMessage({ type: 'success', text: `GitHub backup uploaded to ${result.backupPath}` })
        await loadStats()
      } else {
        setMessage({ type: 'error', text: result.error || 'GitHub backup failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'GitHub backup failed' })
    } finally {
      setRunningGithub(false)
    }
  }

  const handleRestoreGithubBackup = async () => {
    const confirmed = confirm(
      'Restore the latest GitHub backup onto this machine? Existing local Jelico data will be overwritten after a safety backup is created.'
    )
    if (!confirmed) return

    setRestoringGithub(true)
    setMessage(null)
    try {
      const result = await window.jelico.backup.restoreGithubBackup()
      if (result.success) {
        setMessage({ type: 'success', text: 'GitHub backup restored successfully. Please restart Jelico.' })
        await loadStats()
      } else {
        setMessage({ type: 'error', text: result.error || 'GitHub restore failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'GitHub restore failed' })
    } finally {
      setRestoringGithub(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-medium text-text-primary">Data Management</h3>
        <p className="text-sm text-text-muted">
          Export, import, or manage your Jelico data. Backups include conversations, memories, learned patterns, and local Jelico-managed files.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            message.type === 'success'
              ? 'border-success/20 bg-success/10 text-success'
              : 'border-error/20 bg-error/10 text-error'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" />
              <h4 className="font-medium text-text-primary">Database</h4>
              {stats.databaseSize && (
                <span className="ml-auto text-xs text-text-muted">{formatBytes(stats.databaseSize)}</span>
              )}
            </div>
            {stats.database ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-text-secondary"><span>Providers</span><span className="text-text-primary">{stats.database.providers}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Conversations</span><span className="text-text-primary">{stats.database.conversations}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Messages</span><span className="text-text-primary">{stats.database.messages}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Workspaces</span><span className="text-text-primary">{stats.database.workspaces}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Artifacts</span><span className="text-text-primary">{stats.database.artifacts}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Memories</span><span className="text-text-primary">{stats.database.memories}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Permissions</span><span className="text-text-primary">{stats.database.permissions}</span></div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No database found</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent" />
              <h4 className="font-medium text-text-primary">Soul</h4>
              {stats.soulSize && (
                <span className="ml-auto text-xs text-text-muted">{formatBytes(stats.soulSize)}</span>
              )}
            </div>
            {stats.soul ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-text-secondary"><span>Patterns</span><span className="text-text-primary">{stats.soul.patterns}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Corrections</span><span className="text-text-primary">{stats.soul.corrections}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Preferences</span><span className="text-text-primary">{stats.soul.preferences}</span></div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No soul data found</p>
            )}
          </div>
        </div>
      )}

      {stats?.dataPath && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <HardDrive className="h-3 w-3" />
          <span className="font-mono">{stats.dataPath}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <button
          onClick={() => { void handleExport() }}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground transition-colors hover:bg-accent-bright disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Backup
        </button>

        <button
          onClick={() => { void handleImport() }}
          disabled={importing}
          className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import Backup
        </button>

        <button
          onClick={() => { void loadStats() }}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>

        <button
          onClick={() => { void handleClearAll() }}
          disabled={clearing}
          className="ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-error transition-colors hover:bg-error/10 disabled:opacity-50"
        >
          {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Clear All Data
        </button>
      </div>

      <section className="space-y-4 border-t border-border pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-accent" />
            <h4 className="font-medium text-text-primary">GitHub Backup</h4>
          </div>
          <p className="text-sm text-text-secondary">
            Back up your Jelico database, soul data, memories, and local Jelico-managed files to a private GitHub repository you control.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Repository URL</label>
            <input
              type="url"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/owner/private-repo"
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Personal Access Token</label>
            <div className="flex rounded-lg border border-border bg-bg-elevated focus-within:border-accent">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={githubStatus?.hasToken ? 'Token saved. Enter a new token to replace it.' : 'ghp_...'}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-text-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="px-3 text-text-muted hover:text-text-primary"
                aria-label={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-text-muted">Token is stored with Jelico’s existing keychain-backed secret storage.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Backup mode</label>
            <select
              value={githubMode}
              onChange={(event) => setGithubMode(event.target.value as GithubBackupStatus['mode'])}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="manual">Manual backup only</option>
              <option value="on_change">Backup on incremental changes</option>
              <option value="scheduled">Scheduled backups</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Schedule frequency</label>
            <select
              value={scheduleHours}
              onChange={(event) => setScheduleHours(Number(event.target.value))}
              disabled={githubMode !== 'scheduled'}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none disabled:opacity-50"
            >
              {SCHEDULE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-elevated p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-text-primary">Status</span>
            <span className="text-xs text-text-muted">
              {githubMode === 'scheduled' ? formatRelativeSchedule(scheduleHours) : githubMode === 'on_change' ? 'On change' : 'Manual'}
            </span>
          </div>
          <div className="space-y-1 text-text-secondary">
            <div className="flex justify-between gap-4">
              <span>Repository</span>
              <span className="truncate text-text-primary">{githubStatus?.repoUrl || 'Not configured'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Token</span>
              <span className={githubStatus?.hasToken ? 'text-success' : 'text-text-primary'}>
                {githubStatus?.hasToken ? 'Stored' : 'Not saved'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Last backup</span>
              <span className="text-text-primary">
                {githubStatus?.lastBackupAt ? new Date(githubStatus.lastBackupAt).toLocaleString() : 'Never'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Latest snapshot</span>
              <span className="truncate text-text-primary">{githubStatus?.lastBackupPath || 'No remote snapshot yet'}</span>
            </div>
          </div>
          {githubStatus?.lastError && (
            <div className="mt-3 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
              {githubStatus.lastError}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { void handleSaveGithubSettings() }}
            disabled={savingGithub}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground hover:bg-accent-bright disabled:opacity-50"
          >
            {savingGithub ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
            Save GitHub Settings
          </button>

          <button
            onClick={() => { void handleRunGithubBackup() }}
            disabled={runningGithub}
            className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {runningGithub ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Run Backup Now
          </button>

          <button
            onClick={() => { void handleRestoreGithubBackup() }}
            disabled={restoringGithub}
            className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {restoringGithub ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Restore Latest Backup
          </button>
        </div>
      </section>
    </div>
  )
}
