import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { notifyGithubBackupDataChanged } from './githubBackup.js'

// Sandbox directory for file generation when no workspace is selected
const SANDBOX_DIR = 'sandbox'

export function getSandboxPath(): string {
  const sandboxPath = path.join(app.getPath('userData'), SANDBOX_DIR)

  // Ensure sandbox directory exists
  if (!fs.existsSync(sandboxPath)) {
    fs.mkdirSync(sandboxPath, { recursive: true })
  }

  return sandboxPath
}

export function getConversationSandboxPath(conversationId: string): string {
  const sandboxPath = getSandboxPath()
  const conversationPath = path.join(sandboxPath, conversationId)

  // Ensure conversation sandbox directory exists
  if (!fs.existsSync(conversationPath)) {
    fs.mkdirSync(conversationPath, { recursive: true })
  }

  return conversationPath
}

export function listSandboxFiles(conversationId: string): string[] {
  const conversationPath = path.join(getSandboxPath(), conversationId)

  if (!fs.existsSync(conversationPath)) {
    return []
  }

  return getAllFiles(conversationPath)
}

function getAllFiles(dirPath: string, basePath: string = dirPath): string[] {
  const files: string[] = []

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(basePath, fullPath)

      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, basePath))
      } else {
        files.push(relativePath)
      }
    }
  } catch {
    // Ignore errors
  }

  return files
}

export function writeSandboxFile(
  conversationId: string,
  relativePath: string,
  content: string
): string {
  const conversationPath = getConversationSandboxPath(conversationId)
  const fullPath = path.join(conversationPath, relativePath)

  // Ensure parent directory exists
  const parentDir = path.dirname(fullPath)
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true })
  }

  fs.writeFileSync(fullPath, content, 'utf-8')
  notifyGithubBackupDataChanged()
  return fullPath
}

export function readSandboxFile(conversationId: string, relativePath: string): string | null {
  const conversationPath = path.join(getSandboxPath(), conversationId)
  const fullPath = path.join(conversationPath, relativePath)

  if (!fs.existsSync(fullPath)) {
    return null
  }

  return fs.readFileSync(fullPath, 'utf-8')
}

export function deleteSandboxFile(conversationId: string, relativePath: string): boolean {
  const conversationPath = path.join(getSandboxPath(), conversationId)
  const fullPath = path.join(conversationPath, relativePath)

  if (!fs.existsSync(fullPath)) {
    return false
  }

  fs.unlinkSync(fullPath)
  notifyGithubBackupDataChanged()
  return true
}

export function clearConversationSandbox(conversationId: string): void {
  const conversationPath = path.join(getSandboxPath(), conversationId)

  if (fs.existsSync(conversationPath)) {
    fs.rmSync(conversationPath, { recursive: true, force: true })
    notifyGithubBackupDataChanged()
  }
}

export async function exportSandbox(
  conversationId: string,
  destinationPath: string
): Promise<{ success: boolean; filesCopied: number }> {
  const conversationPath = path.join(getSandboxPath(), conversationId)

  if (!fs.existsSync(conversationPath)) {
    return { success: false, filesCopied: 0 }
  }

  // Ensure destination exists
  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath, { recursive: true })
  }

  const files = listSandboxFiles(conversationId)
  let filesCopied = 0

  for (const file of files) {
    const sourcePath = path.join(conversationPath, file)
    const destPath = path.join(destinationPath, file)

    // Ensure parent directory exists
    const parentDir = path.dirname(destPath)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }

    fs.copyFileSync(sourcePath, destPath)
    filesCopied++
  }

  return { success: true, filesCopied }
}

// Get sandbox directory structure
export function getSandboxStructure(conversationId: string): DirectoryEntry[] {
  const conversationPath = path.join(getSandboxPath(), conversationId)

  if (!fs.existsSync(conversationPath)) {
    return []
  }

  return getDirectoryStructure(conversationPath)
}

interface DirectoryEntry {
  name: string
  type: 'file' | 'directory'
  path: string
  relativePath: string
  children?: DirectoryEntry[]
}

function getDirectoryStructure(
  dirPath: string,
  basePath: string = dirPath
): DirectoryEntry[] {
  const result: DirectoryEntry[] = []

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(basePath, fullPath)

      const item: DirectoryEntry = {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: fullPath,
        relativePath,
      }

      if (entry.isDirectory()) {
        item.children = getDirectoryStructure(fullPath, basePath)
      }

      result.push(item)
    }

    // Sort: directories first, then alphabetically
    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch {
    return []
  }
}
