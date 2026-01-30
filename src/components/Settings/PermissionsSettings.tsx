import { useState, useEffect } from 'react'
import { Shield, ShieldAlert, ShieldCheck, Trash2, AlertTriangle } from 'lucide-react'
import { usePermissionStore, type PermissionAction } from '../../stores/permissions'

export function PermissionsSettings() {
  const {
    permissions,
    allowAllSession,
    sessionPermissions,
    loadPermissions,
    loadAllowAllSession,
    setAllowAllSession,
    loadSessionPermissions,
    clearSessionPermissions,
    deletePermission,
  } = usePermissionStore()

  const [loading, setLoading] = useState(true)
  const [confirmAllowAll, setConfirmAllowAll] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([
        loadPermissions(),
        loadAllowAllSession(),
        loadSessionPermissions(),
      ])
      setLoading(false)
    }
    load()
  }, [loadPermissions, loadAllowAllSession, loadSessionPermissions])

  const handleAllowAllToggle = async () => {
    if (!allowAllSession) {
      // Turning on - require confirmation
      setConfirmAllowAll(true)
    } else {
      // Turning off
      await setAllowAllSession(false)
    }
  }

  const confirmAllowAllSession = async () => {
    await setAllowAllSession(true)
    setConfirmAllowAll(false)
  }

  const handleDeletePermission = async (id: string) => {
    await deletePermission(id)
  }

  const handleClearSession = async () => {
    await clearSessionPermissions()
  }

  const getPermissionBadge = (permission: PermissionAction) => {
    switch (permission) {
      case 'allow_always':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
            Always Allow
          </span>
        )
      case 'allow_once':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-accent/20 text-accent">
            Allow Once
          </span>
        )
      case 'deny':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-error/20 text-error">
            Deny
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-text-muted">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Danger Zone - Allow All */}
      <div className="border border-error/30 rounded-lg overflow-hidden">
        <div className="bg-error/5 px-4 py-3 border-b border-error/30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-error" />
            <h3 className="font-medium text-error">Danger Zone</h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-text-primary font-medium">Allow All Actions (This Session)</p>
              <p className="text-sm text-text-muted mt-1">
                Bypasses ALL permission checks until Jelico is closed. The AI will execute
                any command without asking.
              </p>
              <div className="mt-2 p-3 bg-bg-deep rounded-lg">
                <p className="text-xs text-text-muted flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>This setting does NOT persist.</strong> Only use in virtual machines,
                    containers, or sandboxed environments. You assume all risk.
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={handleAllowAllToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex-shrink-0 ${
                allowAllSession
                  ? 'bg-error text-white hover:bg-error/90'
                  : 'bg-bg-elevated border border-border text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {allowAllSession ? 'Disable' : 'Enable'}
            </button>
          </div>

          {/* Confirmation dialog */}
          {confirmAllowAll && (
            <div className="border border-error/50 rounded-lg p-4 bg-error/5">
              <p className="text-text-primary mb-3">
                Are you sure? This will allow all AI actions without prompting.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmAllowAllSession}
                  className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 font-medium"
                >
                  Yes, Allow All
                </button>
                <button
                  onClick={() => setConfirmAllowAll(false)}
                  className="px-4 py-2 bg-bg-elevated border border-border rounded-lg text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Default Behaviors - TODO: Make these configurable */}
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Default Behaviors
        </h3>
        <div className="bg-bg-elevated rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-text-muted font-medium">Action Type</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Default</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-text-primary">Read files</td>
                <td className="px-4 py-3">
                  <span className="text-green-400">Auto-allow</span>
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-text-primary">Web search/fetch</td>
                <td className="px-4 py-3">
                  <span className="text-green-400">Auto-allow</span>
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-text-primary">Spawn sub-agents</td>
                <td className="px-4 py-3">
                  <span className="text-green-400">Auto-allow</span>
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-text-primary">Write/create files</td>
                <td className="px-4 py-3">
                  <span className="text-accent">Ask first</span>
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-text-primary">Shell commands (safe)</td>
                <td className="px-4 py-3">
                  <span className="text-green-400">Auto-allow</span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-text-primary">Shell commands (destructive)</td>
                <td className="px-4 py-3">
                  <span className="text-accent">Ask first</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Safe commands: git status, ls, npm run, etc. Destructive: rm, kill, git reset --hard, etc.
        </p>
      </div>

      {/* Workspace Permissions */}
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          Saved Permissions
        </h3>
        {permissions.length === 0 ? (
          <div className="bg-bg-elevated rounded-lg border border-border p-6 text-center">
            <p className="text-text-muted">No saved permissions yet.</p>
            <p className="text-xs text-text-faint mt-1">
              Permissions you choose to remember will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-bg-elevated rounded-lg border border-border divide-y divide-border">
            {permissions.map((perm) => (
              <div key={perm.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-text-primary font-mono text-sm">{perm.toolName}</p>
                  <p className="text-xs text-text-muted truncate max-w-md">{perm.actionPattern}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getPermissionBadge(perm.permission)}
                  <button
                    onClick={() => handleDeletePermission(perm.id)}
                    className="p-1 text-text-muted hover:text-error transition-colors"
                    title="Delete permission"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Permissions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
            <Shield className="w-5 h-5 text-text-muted" />
            Session Permissions
          </h3>
          {sessionPermissions.length > 0 && (
            <button
              onClick={handleClearSession}
              className="text-xs text-text-muted hover:text-error transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        {sessionPermissions.length === 0 ? (
          <div className="bg-bg-elevated rounded-lg border border-border p-6 text-center">
            <p className="text-text-muted">No session permissions.</p>
            <p className="text-xs text-text-faint mt-1">
              These are cleared when Jelico closes.
            </p>
          </div>
        ) : (
          <div className="bg-bg-elevated rounded-lg border border-border divide-y divide-border">
            {sessionPermissions.map((perm, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <p className="text-text-primary font-mono text-sm">{perm.key}</p>
                {getPermissionBadge(perm.permission)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
