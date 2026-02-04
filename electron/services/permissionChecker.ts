/**
 * Permission Checker Service
 * Bridges main process tool execution with renderer permission dialogs
 */

import { BrowserWindow, ipcMain } from 'electron'
import { permissionDb } from './database.js'

// Types
export type PermissionAction = 'allow_always' | 'allow_once' | 'deny'
export type ActionType = 'read' | 'write' | 'delete' | 'execute' | 'web' | 'spawn'

interface PendingRequest {
  id: string
  request: PermissionRequest
  resolve: (result: { permission: PermissionAction; remembered: boolean }) => void
  reject: (error: Error) => void
}

interface PermissionRequest {
  toolName: string
  action: string
  description: string
  preview?: string
  workspaceId?: string
}

// Session-scoped permissions (cleared on app restart)
const sessionPermissions = new Map<string, PermissionAction>()

// Pending permission requests awaiting user response
const pendingRequests = new Map<string, PendingRequest>()

// Global "allow all" flag for this session
let allowAllSession = false

// Destructive command patterns
const DESTRUCTIVE_PATTERNS = [
  // File deletion
  /\brm\s+(-[rfivI]+\s+)*[^\s]/,    // rm with any flags
  /\brmdir\b/,
  /\bunlink\b/,
  /\bshred\b/,

  // Git destructive
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[fd]+\b/,
  /\bgit\s+push\s+.*--force\b/,
  /\bgit\s+push\s+-f\b/,
  /\bgit\s+checkout\s+\.\s*$/,
  /\bgit\s+restore\s+\.\s*$/,

  // Process/System
  /\bkill\s+-9\b/,
  /\bkillall\b/,
  /\bpkill\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bhalt\b/,
  /\bpoweroff\b/,

  // Dangerous file operations
  />\s*\/dev\/(sd|hd|nvme)/,     // Writing to disk devices
  /\bdd\s+.*of=/,                // dd with output
  /\bmkfs\b/,                    // Format filesystem
  /\bfdisk\b/,                   // Partition tools

  // Database destructive
  /\bDROP\s+(TABLE|DATABASE|INDEX)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b.*WHERE\s*$/i,  // DELETE without WHERE condition

  // Package manager uninstalls
  /\bnpm\s+uninstall\b/,
  /\byarn\s+remove\b/,
  /\bpip\s+uninstall\b/,
  /\bapt(-get)?\s+(remove|purge)\b/,
  /\bbrew\s+uninstall\b/,

  // Other dangerous
  /\bchmod\s+777\b/,             // Overly permissive
  /\bchown\s+-R\b.*\//,          // Recursive chown on paths
  /\bcurl\s+.*\|\s*(ba)?sh\b/,   // Pipe curl to shell
  /\bwget\s+.*\|\s*(ba)?sh\b/,   // Pipe wget to shell
]

// Safe command patterns (auto-allow)
const SAFE_PATTERNS = [
  // Read-only git
  /\bgit\s+(status|log|diff|show|branch|tag|remote|fetch)\b/,
  /\bgit\s+ls-/,

  // Directory listing
  /\bls\b/,
  /\bdir\b/,
  /\bfind\s+.*-type\s+[fd]\b/,
  /\bfind\s+.*-name\b/,

  // File viewing
  /\bcat\b/,
  /\bhead\b/,
  /\btail\b/,
  /\bless\b/,
  /\bmore\b/,
  /\bgrep\b/,
  /\brg\b/,
  /\bwc\b/,

  // Environment/info
  /\bpwd\b/,
  /\bwhoami\b/,
  /\becho\s/,
  /\benv\b/,
  /\bprintenv\b/,
  /\bwhich\b/,
  /\btype\b/,
  /\bfile\b/,

  // Package info (not install/uninstall)
  /\bnpm\s+(list|ls|info|view|search)\b/,
  /\byarn\s+(list|info|why)\b/,
  /\bpip\s+(list|show|search)\b/,

  // Build/test (generally safe)
  /\bnpm\s+(run|test|start|build)\b/,
  /\byarn\s+(run|test|start|build)\b/,
  /\bnpx\b/,
  /\bpython\s+-c\b/,
  /\bnode\s+-e\b/,

  // Version checks
  /--version\b/,
  /-v\b$/,
  /\b(node|npm|yarn|python|pip|git|cargo|go)\s+-v\b/,
]

/**
 * Classify a command as safe, destructive, or unknown
 */
export function classifyCommand(command: string): 'safe' | 'destructive' | 'unknown' {
  const trimmed = command.trim()

  // Check destructive first (higher priority)
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'destructive'
    }
  }

  // Check safe patterns
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'safe'
    }
  }

  return 'unknown'
}

/**
 * Classify an action type
 */
export function classifyAction(toolName: string, args: Record<string, unknown>): {
  type: ActionType
  description: string
  isDestructive: boolean
} {
  switch (toolName) {
    case 'read_file':
    case 'list_directory':
    case 'search_files':
      return { type: 'read', description: `Read: ${args.path || args.pattern || 'file'}`, isDestructive: false }

    case 'write_file':
      return { type: 'write', description: `Write to: ${args.path}`, isDestructive: true }

    case 'create_artifact':
    case 'update_artifact':
      return { type: 'write', description: `Create/update artifact: ${args.title || args.id}`, isDestructive: false }

    case 'execute_command': {
      const cmd = String(args.command || '')
      const classification = classifyCommand(cmd)
      const shortCmd = cmd.length > 50 ? cmd.slice(0, 50) + '...' : cmd
      return {
        type: 'execute',
        description: `Run: ${shortCmd}`,
        isDestructive: classification === 'destructive',
      }
    }

    case 'web_search':
    case 'web_fetch':
      return { type: 'web', description: `Web: ${args.query || args.url}`, isDestructive: false }

    case 'spawn_agent':
      return { type: 'spawn', description: `Spawn agent: ${args.name}`, isDestructive: false }

    default:
      return { type: 'execute', description: `${toolName}`, isDestructive: false }
  }
}

/**
 * Generate a cache key for session permissions
 */
function getSessionKey(toolName: string, action: string, workspaceId?: string): string {
  return `${toolName}:${action}:${workspaceId || 'global'}`
}

/**
 * Check if an action is allowed without prompting
 */
export async function checkPermission(
  toolName: string,
  args: Record<string, unknown>,
  workspaceId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Global "allow all" session flag
  if (allowAllSession) {
    return { allowed: true, reason: 'session_allow_all' }
  }

  const { type, description, isDestructive } = classifyAction(toolName, args)

  // Non-destructive actions are auto-allowed
  if (!isDestructive && (type === 'read' || type === 'web' || type === 'spawn')) {
    return { allowed: true, reason: 'auto_allow_safe' }
  }

  // Check execute_command specifically
  if (toolName === 'execute_command') {
    const cmd = String(args.command || '')
    const classification = classifyCommand(cmd)

    if (classification === 'safe') {
      return { allowed: true, reason: 'safe_command' }
    }
  }

  // Artifacts (create/update) are generally safe
  if (toolName === 'create_artifact' || toolName === 'update_artifact') {
    return { allowed: true, reason: 'artifact_safe' }
  }

  // Check session permissions
  const sessionKey = getSessionKey(toolName, description, workspaceId)
  const sessionPermission = sessionPermissions.get(sessionKey)
  if (sessionPermission === 'allow_always' || sessionPermission === 'allow_once') {
    // Remove "allow_once" after use
    if (sessionPermission === 'allow_once') {
      sessionPermissions.delete(sessionKey)
    }
    return { allowed: true, reason: 'session_permission' }
  }
  if (sessionPermission === 'deny') {
    return { allowed: false, reason: 'session_denied' }
  }

  // Check database for persistent permissions
  const dbPermission = await permissionDb.checkPermission(toolName, description, workspaceId)
  if (dbPermission === 'allow_always') {
    return { allowed: true, reason: 'db_permission' }
  }
  if (dbPermission === 'deny') {
    return { allowed: false, reason: 'db_denied' }
  }

  // Need to ask user
  return { allowed: false, reason: 'needs_approval' }
}

/**
 * Request permission from user via dialog
 */
export async function requestPermission(
  request: PermissionRequest
): Promise<{ permission: PermissionAction; remembered: boolean }> {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (!mainWindow) {
    throw new Error('No window available for permission request')
  }

  const requestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2)}`

  return new Promise((resolve, reject) => {
    // No timeout - wait indefinitely for user response
    // Store pending request
    pendingRequests.set(requestId, { id: requestId, request, resolve, reject })

    // Send to renderer
    mainWindow.webContents.send('permission:request', {
      requestId,
      ...request,
    })
  })
}

function getOldestPendingRequest(): (PermissionRequest & { requestId: string }) | null {
  const pending = pendingRequests.values().next().value as PendingRequest | undefined
  if (!pending) return null
  return {
    requestId: pending.id,
    ...pending.request,
  }
}

/**
 * Handle permission response from renderer
 */
export function handlePermissionResponse(
  requestId: string,
  permission: PermissionAction,
  remember: boolean,
  toolName: string,
  action: string,
  workspaceId?: string
) {
  const pending = pendingRequests.get(requestId)
  if (!pending) {
    console.warn('[PermissionChecker] Unknown request ID:', requestId)
    return
  }

  pendingRequests.delete(requestId)

  // Store in session if "allow_once" or save to session for this session
  if (permission === 'allow_once') {
    const sessionKey = getSessionKey(toolName, action, workspaceId)
    sessionPermissions.set(sessionKey, 'allow_once')
  }

  pending.resolve({ permission, remembered: remember })
}

/**
 * Set global "allow all" for this session
 */
export function setAllowAllSession(allow: boolean) {
  allowAllSession = allow
  if (!allow) {
    // Clear session permissions when disabling
    sessionPermissions.clear()
  }
}

/**
 * Get current "allow all" status
 */
export function getAllowAllSession(): boolean {
  return allowAllSession
}

/**
 * Clear all session permissions
 */
export function clearSessionPermissions() {
  sessionPermissions.clear()
}

/**
 * Get session permissions for UI display
 */
export function getSessionPermissions(): Array<{ key: string; permission: PermissionAction }> {
  return Array.from(sessionPermissions.entries()).map(([key, permission]) => ({
    key,
    permission,
  }))
}

/**
 * Add custom safe pattern
 */
export function addSafePattern(pattern: RegExp) {
  SAFE_PATTERNS.push(pattern)
}

/**
 * Add custom destructive pattern
 */
export function addDestructivePattern(pattern: RegExp) {
  DESTRUCTIVE_PATTERNS.push(pattern)
}

// Register IPC handler for permission responses
ipcMain.handle('permission:respond', async (_, data: {
  requestId: string
  permission: PermissionAction
  remember: boolean
  toolName: string
  action: string
  workspaceId?: string
}) => {
  handlePermissionResponse(
    data.requestId,
    data.permission,
    data.remember,
    data.toolName,
    data.action,
    data.workspaceId
  )
  return { success: true }
})

// Get/set allow all session
ipcMain.handle('permission:getAllowAll', () => allowAllSession)
ipcMain.handle('permission:setAllowAll', (_, allow: boolean) => {
  setAllowAllSession(allow)
  return { success: true }
})
ipcMain.handle('permission:getPending', () => getOldestPendingRequest())

// Get session permissions
ipcMain.handle('permission:getSessionPermissions', () => getSessionPermissions())
ipcMain.handle('permission:clearSessionPermissions', () => {
  clearSessionPermissions()
  return { success: true }
})
