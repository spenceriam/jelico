import { useEffect } from 'react'
import { Shield, ShieldX, Clock, FolderOpen } from 'lucide-react'
import { usePermissionStore, type PermissionAction } from '../../stores/permissions'

export function PermissionDialog() {
  const {
    pendingRequest,
    mainProcessRequest,
    grantPermission,
    respondToMainProcess,
    setupMainProcessListener,
  } = usePermissionStore()

  // Set up listener for main process permission requests
  useEffect(() => {
    const cleanup = setupMainProcessListener()
    return cleanup
  }, [setupMainProcessListener])

  // Handle either type of request
  const activeRequest = mainProcessRequest || pendingRequest
  if (!activeRequest) return null

  const isMainProcess = !!mainProcessRequest

  const handleGrant = async (permission: PermissionAction, remember: boolean = false) => {
    if (isMainProcess) {
      await respondToMainProcess(permission, remember)
    } else {
      grantPermission(permission, remember)
    }
  }

  // Build a readable action label with resource included
  const actionLabel = (() => {
    const getShortPath = (p: string) => {
      const parts = p.split('/')
      return parts.length > 2 ? parts.slice(-2).join('/') : parts.slice(-1)[0] || p
    }

    // Parse action string to extract resource
    if (activeRequest.action.startsWith('Write to:')) {
      const path = activeRequest.action.replace('Write to:', '').trim()
      return `Write File: ${getShortPath(path)}`
    }
    if (activeRequest.action.startsWith('Run command')) {
      return 'Execute Command'
    }

    return activeRequest.action
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-void/80 backdrop-blur-sm">
      <div className="bg-bg-surface border border-border rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Permission Required</h3>
            <p className="text-sm text-text-muted">{actionLabel}</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Justification/Explanation - use description from main process */}
          <div className="mb-4">
            <p className="text-sm text-text-primary">
              {activeRequest.description || `The AI wants to perform: ${activeRequest.action}`}
            </p>
          </div>

          {/* Preview content if available */}
          {activeRequest.preview && (
            <div className="bg-bg-deep rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all">
                {activeRequest.preview}
              </pre>
            </div>
          )}
        </div>

        {/* Actions - vertical button layout */}
        <div className="px-6 py-4 border-t border-border space-y-2">
          {/* Allow Once */}
          <button
            onClick={() => handleGrant('allow_once', false)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Clock className="w-5 h-5 text-text-muted" />
            <div className="text-left flex-1">
              <div className="font-medium">Allow Once</div>
              <div className="text-xs text-text-muted">Only for this specific request</div>
            </div>
          </button>

          {/* Allow in Current Session */}
          <button
            onClick={() => handleGrant('allow_once', true)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Shield className="w-5 h-5 text-accent" />
            <div className="text-left flex-1">
              <div className="font-medium">Allow in Current Session</div>
              <div className="text-xs text-text-muted">Until you close Jelico</div>
            </div>
          </button>

          {/* Allow in Project */}
          <button
            onClick={() => handleGrant('allow_always', true)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-accent/10 border border-accent/30 rounded-lg text-accent hover:bg-accent/20 transition-colors"
          >
            <FolderOpen className="w-5 h-5" />
            <div className="text-left flex-1">
              <div className="font-medium">Allow in Project</div>
              <div className="text-xs text-accent/70">Always allow for this workspace</div>
            </div>
          </button>

          {/* Deny */}
          <button
            onClick={() => handleGrant('deny', false)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-bg-deep border border-border rounded-lg text-text-muted hover:text-error hover:border-error/30 transition-colors"
          >
            <ShieldX className="w-5 h-5" />
            <div className="text-left flex-1">
              <div className="font-medium">Deny</div>
              <div className="text-xs">Block this action</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
