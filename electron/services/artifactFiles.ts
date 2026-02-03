/**
 * Artifact File Storage Service
 *
 * Stores artifact content as actual files on disk instead of in the database.
 * Files are organized by conversation: ~/.config/jelico/artifacts/{conversation-id}/{artifact-id}.{ext}
 *
 * Benefits:
 * - Artifacts can be accessed outside of Jelico
 * - Database stays small (metadata only)
 * - AI can read artifacts using normal file tools
 * - Easy backup/sync of artifact files
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const ARTIFACTS_DIR = 'artifacts'

/**
 * Get the base artifacts directory path
 */
export function getArtifactsBasePath(): string {
  const artifactsPath = path.join(app.getPath('userData'), ARTIFACTS_DIR)

  if (!fs.existsSync(artifactsPath)) {
    fs.mkdirSync(artifactsPath, { recursive: true })
  }

  return artifactsPath
}

/**
 * Get the directory for a conversation's artifacts
 */
export function getConversationArtifactsPath(conversationId: string | null): string {
  const basePath = getArtifactsBasePath()
  const convDir = conversationId || '_global'
  const conversationPath = path.join(basePath, convDir)

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
 * Generate the full file path for an artifact
 */
export function getArtifactFilePath(
  artifactId: string,
  conversationId: string | null,
  type: string,
  language: string | null
): string {
  const conversationPath = getConversationArtifactsPath(conversationId)
  const ext = getArtifactExtension(type, language)
  return path.join(conversationPath, `${artifactId}.${ext}`)
}

/**
 * Write artifact content to file
 */
export function writeArtifactFile(
  artifactId: string,
  conversationId: string | null,
  type: string,
  language: string | null,
  content: string
): string {
  const filePath = getArtifactFilePath(artifactId, conversationId, type, language)

  // Ensure directory exists
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(filePath, content, 'utf-8')
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
