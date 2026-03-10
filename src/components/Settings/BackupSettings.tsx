import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, HardDrive, Database, Brain, RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react'

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

export function BackupSettings() {
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStats = async () => {
    try {
      const result = await window.jelico.backup.getStats()
      setStats(result)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    try {
      const result = await window.jelico.backup.export()
      if (result.success) {
        setMessage({ type: 'success', text: `Backup saved to ${result.filePath}` })
      } else if (result.cancelled) {
        // User cancelled, no message needed
      } else {
        setMessage({ type: 'error', text: result.error || 'Export failed' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Export failed' })
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
        loadStats()
      } else if (result.cancelled) {
        // User cancelled, no message needed
      } else {
        setMessage({ type: 'error', text: result.error || 'Import failed' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Import failed' })
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
        loadStats()
      } else {
        setMessage({ type: 'error', text: result.error || 'Clear failed' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Clear failed' })
    } finally {
      setClearing(false)
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
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-2">Data Management</h3>
        <p className="text-sm text-text-muted">
          Export, import, or manage your Jelico data. Backups include conversations, memories, and learned patterns.
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-success/10 border border-success/20 text-success'
              : 'bg-error/10 border border-error/20 text-error'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Data stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          {/* Database stats */}
          <div className="p-4 bg-bg-elevated rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-accent" />
              <h4 className="font-medium text-text-primary">Database</h4>
              {stats.databaseSize && (
                <span className="text-xs text-text-muted ml-auto">
                  {formatBytes(stats.databaseSize)}
                </span>
              )}
            </div>
            {stats.database ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Providers</span>
                  <span className="text-text-primary">{stats.database.providers}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Conversations</span>
                  <span className="text-text-primary">{stats.database.conversations}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Messages</span>
                  <span className="text-text-primary">{stats.database.messages}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Workspaces</span>
                  <span className="text-text-primary">{stats.database.workspaces}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Artifacts</span>
                  <span className="text-text-primary">{stats.database.artifacts}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Memories</span>
                  <span className="text-text-primary">{stats.database.memories}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Permissions</span>
                  <span className="text-text-primary">{stats.database.permissions}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No database found</p>
            )}
          </div>

          {/* Soul stats */}
          <div className="p-4 bg-bg-elevated rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-accent" />
              <h4 className="font-medium text-text-primary">Soul</h4>
              {stats.soulSize && (
                <span className="text-xs text-text-muted ml-auto">
                  {formatBytes(stats.soulSize)}
                </span>
              )}
            </div>
            {stats.soul ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Patterns</span>
                  <span className="text-text-primary">{stats.soul.patterns}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Corrections</span>
                  <span className="text-text-primary">{stats.soul.corrections}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Preferences</span>
                  <span className="text-text-primary">{stats.soul.preferences}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No soul data found</p>
            )}
          </div>
        </div>
      )}

      {/* Data path */}
      {stats?.dataPath && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <HardDrive className="w-3 h-3" />
          <span className="font-mono">{stats.dataPath}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export Backup
        </button>

        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-bg-elevated text-text-primary border border-border rounded-lg hover:bg-bg-hover transition-colors disabled:opacity-50"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Import Backup
        </button>

        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>

        <button
          onClick={handleClearAll}
          disabled={clearing}
          className="flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50 ml-auto"
        >
          {clearing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Clear All Data
        </button>
      </div>
    </div>
  )
}
