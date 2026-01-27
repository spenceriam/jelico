import { useState } from 'react'
import { Shield, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react'
import { usePermissionStore, getToolDescription, type PermissionAction } from '../../stores/permissions'

export function PermissionDialog() {
  const { pendingRequest, grantPermission } = usePermissionStore()
  const [remember, setRemember] = useState(false)

  if (!pendingRequest) return null

  const handleGrant = (permission: PermissionAction) => {
    grantPermission(permission, remember)
    setRemember(false)
  }

  const description = getToolDescription(pendingRequest.toolName, pendingRequest.action)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-void/80 backdrop-blur-sm">
      <div className="bg-bg-surface border border-border rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Permission Required</h3>
            <p className="text-sm text-text-muted">Jelico needs your approval</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-text-primary mb-1">{description}</p>
              <p className="text-sm text-text-secondary">{pendingRequest.description}</p>
            </div>
          </div>

          <div className="bg-bg-deep rounded-lg p-3 mb-4">
            <p className="text-xs text-text-muted mb-1">Tool</p>
            <p className="text-sm font-mono text-text-secondary">{pendingRequest.toolName}</p>
            <p className="text-xs text-text-muted mt-2 mb-1">Action</p>
            <p className="text-sm font-mono text-text-secondary break-all">{pendingRequest.action}</p>
          </div>

          {/* Remember checkbox */}
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg-deep text-accent focus:ring-accent"
            />
            <span>Remember this choice</span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            onClick={() => handleGrant('deny')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-bg-elevated border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <ShieldX className="w-4 h-4" />
            Deny
          </button>
          <button
            onClick={() => handleGrant('allow_once')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-bg-elevated border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Shield className="w-4 h-4" />
            Allow Once
          </button>
          <button
            onClick={() => handleGrant('allow_always')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent text-bg-void rounded-lg hover:bg-accent-bright transition-colors font-medium"
          >
            <ShieldCheck className="w-4 h-4" />
            Always Allow
          </button>
        </div>
      </div>
    </div>
  )
}
