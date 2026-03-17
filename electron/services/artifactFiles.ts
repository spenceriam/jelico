/**
 * Artifact File Storage Service
 *
 * Stores artifact content as actual files on disk instead of in the database.
 *
 * Storage locations:
 * - With workspace: {workspace}/{filename}.{ext} (directly in project root)
 * - Without workspace (sandbox): ~/.jelico/sandbox/{conversation-id}/{filename}.{ext}
 * - Legacy fallback: ~/.jelico/artifacts/{conversation-id}/{artifact-id}.{ext}
 *
 * Benefits:
 * - Artifacts can be accessed outside of Jelico
 * - Database stays small (metadata only)
 * - AI can read artifacts using normal file tools
 * - Workspace artifacts appear directly in project directory
 * - Sandbox files (artifacts + runtime) all in same conversation folder
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { notifyGithubBackupDataChanged } from './githubBackup.js'

const ARTIFACTS_DIR = 'artifacts'
const JELICO_DIR = '.jelico'
const SANDBOX_DIR = 'sandbox'

/**
 * Get the legacy artifacts directory path (for migration/fallback)
 */
export function getLegacyArtifactsBasePath(): string {
  const artifactsPath = path.join(app.getPath('userData'), ARTIFACTS_DIR)

  if (!fs.existsSync(artifactsPath)) {
    fs.mkdirSync(artifactsPath, { recursive: true })
  }

  return artifactsPath
}

/**
 * Get the base artifacts directory path
 * Now returns the sandbox base when no workspace
 */
export function getArtifactsBasePath(): string {
  return getLegacyArtifactsBasePath()
}

/**
 * Get the artifacts directory for a workspace
 * Artifacts go directly in the workspace root (no hidden subfolder)
 */
export function getWorkspaceArtifactsPath(workspacePath: string): string {
  // Ensure workspace directory exists
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true })
  }

  return workspacePath
}

/**
 * Get the artifacts directory for sandbox (no workspace)
 * All sandbox files (artifacts + runtime) go in the same conversation folder
 */
export function getSandboxArtifactsPath(conversationId: string): string {
  const sandboxPath = path.join(app.getPath('userData'), SANDBOX_DIR, conversationId)

  if (!fs.existsSync(sandboxPath)) {
    fs.mkdirSync(sandboxPath, { recursive: true })
  }

  return sandboxPath
}

/**
 * Get the directory for a conversation's artifacts
 * @param conversationId - The conversation ID
 * @param workspacePath - Optional workspace path. If provided, artifacts go in workspace.
 */
export function getConversationArtifactsPath(conversationId: string | null, workspacePath?: string | null): string {
  // If workspace path provided, use workspace storage
  if (workspacePath) {
    return getWorkspaceArtifactsPath(workspacePath)
  }

  // If conversation ID provided but no workspace, use sandbox
  if (conversationId) {
    return getSandboxArtifactsPath(conversationId)
  }

  // Fallback to legacy path for global artifacts
  const basePath = getLegacyArtifactsBasePath()
  const conversationPath = path.join(basePath, '_global')

  if (!fs.existsSync(conversationPath)) {
    fs.mkdirSync(conversationPath, { recursive: true })
  }

  return conversationPath
}

/**
 * Determine file extension based on artifact type and language
 */
export function getArtifactExtension(type: string, language: string | null): string {
  switch (type) {
    case 'html':
      return 'html'
    case 'svg':
      return 'svg'
    case 'mermaid':
      return 'mmd'
    case 'document':
      return 'md'
    case 'code':
      // Use language for code artifacts
      switch (language?.toLowerCase()) {
        case 'javascript':
        case 'js':
          return 'js'
        case 'typescript':
        case 'ts':
          return 'ts'
        case 'python':
        case 'py':
          return 'py'
        case 'rust':
        case 'rs':
          return 'rs'
        case 'go':
          return 'go'
        case 'java':
          return 'java'
        case 'c':
          return 'c'
        case 'cpp':
        case 'c++':
          return 'cpp'
        case 'csharp':
        case 'c#':
          return 'cs'
        case 'ruby':
        case 'rb':
          return 'rb'
        case 'php':
          return 'php'
        case 'swift':
          return 'swift'
        case 'kotlin':
        case 'kt':
          return 'kt'
        case 'json':
          return 'json'
        case 'yaml':
        case 'yml':
          return 'yaml'
        case 'xml':
          return 'xml'
        case 'css':
          return 'css'
        case 'scss':
        case 'sass':
          return 'scss'
        case 'sql':
          return 'sql'
        case 'shell':
        case 'bash':
        case 'sh':
          return 'sh'
        case 'powershell':
        case 'ps1':
          return 'ps1'
        case 'markdown':
        case 'md':
          return 'md'
        case 'tsx':
          return 'tsx'
        case 'jsx':
          return 'jsx'
        default:
          return 'txt'
      }
    default:
      return 'txt'
  }
}

/**
 * Sanitize a title to create a valid filename
 * - Lowercase
 * - Replace spaces with hyphens
 * - Remove special characters
 * - Limit length
 */
export function sanitizeFilename(title: string): string {
  const MAX_SLUG_LENGTH = 20 // + 9-char separator+ID + extension ≈ 33 chars max

  let slug = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^a-z0-9\-_.]/g, '')  // Remove special characters
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens

  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH)
    // Trim at last word boundary to avoid cut-off words like "feasibili"
    const lastHyphen = slug.lastIndexOf('-')
    if (lastHyphen > MAX_SLUG_LENGTH / 2) {
      slug = slug.slice(0, lastHyphen)
    }
  }

  return slug || 'untitled'
}

/**
 * Generate the full file path for an artifact
 * @param title - Artifact title (used for human-readable filename)
 * @param workspacePath - Optional workspace path for workspace-based storage
 */
export function getArtifactFilePath(
  artifactId: string,
  conversationId: string | null,
  type: string,
  language: string | null,
  workspacePath?: string | null,
  title?: string
): string {
  const conversationPath = getConversationArtifactsPath(conversationId, workspacePath)
  const ext = getArtifactExtension(type, language)

  // Include a short ID suffix for uniqueness across artifacts with the same title.
  // 8 hex chars (4 billion values) is plenty unique within a single directory.
  const safeId = artifactId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const baseName = title ? sanitizeFilename(title) : 'artifact'
  const filename = `${baseName}-${safeId}`

  return path.join(conversationPath, `${filename}.${ext}`)
}

/**
 * Write artifact content to file
 * @param workspacePath - Optional workspace path for workspace-based storage
 * @param title - Artifact title (used for human-readable filename)
 */
export function writeArtifactFile(
  artifactId: string,
  conversationId: string | null,
  type: string,
  language: string | null,
  content: string,
  workspacePath?: string | null,
  title?: string
): string {
  const filePath = getArtifactFilePath(artifactId, conversationId, type, language, workspacePath, title)

  // Ensure directory exists
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(filePath, content, 'utf-8')
  notifyGithubBackupDataChanged()
  return filePath
}

/**
 * Read artifact content from file
 */
export function readArtifactFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
  } catch (error) {
    console.error(`[ArtifactFiles] Error reading artifact file: ${filePath}`, error)
  }
  return null
}

/**
 * Delete artifact file
 */
export function deleteArtifactFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      notifyGithubBackupDataChanged()
      return true
    }
  } catch (error) {
    console.error(`[ArtifactFiles] Error deleting artifact file: ${filePath}`, error)
  }
  return false
}

/**
 * Delete all artifact files for a conversation
 */
export function deleteConversationArtifacts(conversationId: string): void {
  const conversationPath = path.join(getArtifactsBasePath(), conversationId)

  try {
    if (fs.existsSync(conversationPath)) {
      fs.rmSync(conversationPath, { recursive: true, force: true })
      notifyGithubBackupDataChanged()
    }
  } catch (error) {
    console.error(`[ArtifactFiles] Error deleting conversation artifacts: ${conversationId}`, error)
  }
}

/**
 * Check if an artifact file exists
 */
export function artifactFileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

/**
 * List all artifact files in a conversation directory
 */
export function listConversationArtifactFiles(conversationId: string | null): string[] {
  const conversationPath = path.join(getArtifactsBasePath(), conversationId || '_global')

  if (!fs.existsSync(conversationPath)) {
    return []
  }

  try {
    return fs.readdirSync(conversationPath).map(file => path.join(conversationPath, file))
  } catch {
    return []
  }
}

/**
 * Copy artifact file to a destination (for download/export)
 */
export function copyArtifactFile(sourcePath: string, destinationPath: string): boolean {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destinationPath)
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    fs.copyFileSync(sourcePath, destinationPath)
    return true
  } catch (error) {
    console.error(`[ArtifactFiles] Error copying artifact file: ${sourcePath} -> ${destinationPath}`, error)
    return false
  }
}
