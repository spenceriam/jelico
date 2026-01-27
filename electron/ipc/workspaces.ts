import { ipcMain, dialog, BrowserWindow } from 'electron'
import { workspaceDb, conversationDb } from '../services/database'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface WorkspaceConfig {
  id: string
  name: string
  path: string
  isGit: boolean
  gitBranch?: string
  createdAt: number
  updatedAt: number
}

function toConfig(row: any): WorkspaceConfig {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    isGit: row.is_git === 1,
    gitBranch: row.git_branch || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function isGitRepository(dirPath: string): Promise<{ isGit: boolean; branch?: string }> {
  const gitDir = path.join(dirPath, '.git')
  const isGit = fs.existsSync(gitDir)

  if (!isGit) {
    return { isGit: false }
  }

  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: dirPath })
    return { isGit: true, branch: stdout.trim() }
  } catch {
    return { isGit: true }
  }
}

// Git worktree helpers
async function listWorktrees(repoPath: string): Promise<{ path: string; branch: string; isBare: boolean }[]> {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', { cwd: repoPath })
    const worktrees: { path: string; branch: string; isBare: boolean }[] = []
    const lines = stdout.split('\n')

    let current: { path?: string; branch?: string; isBare: boolean } = { isBare: false }
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as any)
        }
        current = { path: line.substring(9), isBare: false }
      } else if (line.startsWith('HEAD ')) {
        // Ignore HEAD commit
      } else if (line.startsWith('branch refs/heads/')) {
        current.branch = line.substring(18)
      } else if (line === 'bare') {
        current.isBare = true
      } else if (line.startsWith('detached')) {
        current.branch = 'detached'
      }
    }
    if (current.path) {
      worktrees.push(current as any)
    }

    return worktrees.filter(w => !w.isBare)
  } catch {
    return []
  }
}

async function listBranches(repoPath: string): Promise<{ name: string; isRemote: boolean; isCurrent: boolean }[]> {
  try {
    const { stdout } = await execAsync('git branch -a --format="%(HEAD) %(refname:short)"', { cwd: repoPath })
    return stdout.split('\n').filter(Boolean).map(line => {
      const isCurrent = line.startsWith('*')
      const name = line.substring(2).trim()
      const isRemote = name.startsWith('remotes/') || name.includes('/')
      return { name: name.replace('remotes/', ''), isRemote, isCurrent }
    })
  } catch {
    return []
  }
}

async function createWorktree(repoPath: string, branch: string, targetPath: string): Promise<boolean> {
  try {
    // Check if branch exists
    const branches = await listBranches(repoPath)
    const branchExists = branches.some(b => b.name === branch || b.name === `origin/${branch}`)

    if (branchExists) {
      // Use existing branch
      await execAsync(`git worktree add "${targetPath}" "${branch}"`, { cwd: repoPath })
    } else {
      // Create new branch
      await execAsync(`git worktree add -b "${branch}" "${targetPath}"`, { cwd: repoPath })
    }
    return true
  } catch (err) {
    console.error('Failed to create worktree:', err)
    return false
  }
}

async function removeWorktree(repoPath: string, worktreePath: string): Promise<boolean> {
  try {
    await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: repoPath })
    return true
  } catch {
    return false
  }
}

export function registerWorkspaceHandlers() {
  // List all workspaces
  ipcMain.handle('workspaces:list', () => {
    const workspaces = workspaceDb.list()
    return workspaces.map(toConfig)
  })

  // Get a specific workspace
  ipcMain.handle('workspaces:get', (_, id: string) => {
    const workspace = workspaceDb.get(id)
    return workspace ? toConfig(workspace) : null
  })

  // Open folder dialog and create workspace
  ipcMain.handle('workspaces:selectFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Workspace Folder',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const folderPath = result.filePaths[0]
    const folderName = path.basename(folderPath)

    // Check if it's a git repository
    const gitInfo = await isGitRepository(folderPath)

    // Check if workspace already exists
    const existing = workspaceDb.getByPath(folderPath)
    if (existing) {
      // Update git info if changed
      workspaceDb.update(existing.id, {
        isGit: gitInfo.isGit,
        gitBranch: gitInfo.branch,
      })
      return toConfig(workspaceDb.get(existing.id)!)
    }

    // Create new workspace
    const workspace = workspaceDb.create({
      name: folderName,
      path: folderPath,
      isGit: gitInfo.isGit,
      gitBranch: gitInfo.branch,
    })

    return toConfig(workspace)
  })

  // Create workspace from path (without dialog)
  ipcMain.handle('workspaces:create', async (_, input: { path: string; name?: string }) => {
    // Check if path exists
    if (!fs.existsSync(input.path)) {
      throw new Error('Path does not exist')
    }

    const stats = fs.statSync(input.path)
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory')
    }

    const folderName = input.name || path.basename(input.path)
    const gitInfo = await isGitRepository(input.path)

    const workspace = workspaceDb.create({
      name: folderName,
      path: input.path,
      isGit: gitInfo.isGit,
      gitBranch: gitInfo.branch,
    })

    return toConfig(workspace)
  })

  // Update workspace
  ipcMain.handle('workspaces:update', (_, id: string, updates: { name?: string }) => {
    const workspace = workspaceDb.update(id, updates)
    return workspace ? toConfig(workspace) : null
  })

  // Delete workspace
  ipcMain.handle('workspaces:delete', (_, id: string) => {
    workspaceDb.delete(id)
  })

  // Refresh git info for a workspace
  ipcMain.handle('workspaces:refreshGit', async (_, id: string) => {
    const workspace = workspaceDb.get(id)
    if (!workspace) return null

    const gitInfo = await isGitRepository(workspace.path)
    const updated = workspaceDb.update(id, {
      isGit: gitInfo.isGit,
      gitBranch: gitInfo.branch,
    })

    return updated ? toConfig(updated) : null
  })

  // Get conversations for a workspace
  ipcMain.handle('workspaces:getConversations', (_, workspaceId: string) => {
    const conversations = conversationDb.list()
    return conversations.filter(c => c.workspace_id === workspaceId)
  })

  // Get directory structure for a workspace
  ipcMain.handle('workspaces:getStructure', async (_, workspaceId: string, maxDepth: number = 3) => {
    const workspace = workspaceDb.get(workspaceId)
    if (!workspace) return null

    const structure = await getDirectoryStructure(workspace.path, maxDepth)
    return structure
  })

  // Git Worktree operations

  // List worktrees for a workspace
  ipcMain.handle('workspaces:listWorktrees', async (_, workspaceId: string) => {
    const workspace = workspaceDb.get(workspaceId)
    if (!workspace || !workspace.is_git) return []

    return await listWorktrees(workspace.path)
  })

  // List branches for a workspace
  ipcMain.handle('workspaces:listBranches', async (_, workspaceId: string) => {
    const workspace = workspaceDb.get(workspaceId)
    if (!workspace || !workspace.is_git) return []

    return await listBranches(workspace.path)
  })

  // Create a worktree
  ipcMain.handle('workspaces:createWorktree', async (_, workspaceId: string, branch: string, targetPath?: string) => {
    const workspace = workspaceDb.get(workspaceId)
    if (!workspace || !workspace.is_git) {
      throw new Error('Workspace is not a git repository')
    }

    // Default target path is sibling to current workspace
    const parentDir = path.dirname(workspace.path)
    const workspaceName = path.basename(workspace.path)
    const worktreePath = targetPath || path.join(parentDir, `${workspaceName}-${branch.replace(/\//g, '-')}`)

    const success = await createWorktree(workspace.path, branch, worktreePath)
    if (!success) {
      throw new Error('Failed to create worktree')
    }

    // Create a new workspace for the worktree
    const gitInfo = await isGitRepository(worktreePath)
    const newWorkspace = workspaceDb.create({
      name: `${workspace.name} (${branch})`,
      path: worktreePath,
      isGit: gitInfo.isGit,
      gitBranch: gitInfo.branch,
    })

    return toConfig(newWorkspace)
  })

  // Remove a worktree
  ipcMain.handle('workspaces:removeWorktree', async (_, mainWorkspaceId: string, worktreePath: string) => {
    const workspace = workspaceDb.get(mainWorkspaceId)
    if (!workspace || !workspace.is_git) {
      throw new Error('Workspace is not a git repository')
    }

    const success = await removeWorktree(workspace.path, worktreePath)
    if (!success) {
      throw new Error('Failed to remove worktree')
    }

    // Remove the workspace entry if it exists
    const worktreeWorkspace = workspaceDb.getByPath(worktreePath)
    if (worktreeWorkspace) {
      workspaceDb.delete(worktreeWorkspace.id)
    }

    return true
  })
}

interface DirectoryEntry {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: DirectoryEntry[]
}

async function getDirectoryStructure(
  dirPath: string,
  maxDepth: number,
  currentDepth: number = 0
): Promise<DirectoryEntry[]> {
  if (currentDepth >= maxDepth) return []

  const ignoreDirs = new Set([
    'node_modules', '.git', '.vscode', '.idea', '__pycache__',
    'dist', 'build', '.next', '.nuxt', 'venv', '.venv',
    'target', '.gradle', 'vendor', '.bundle'
  ])

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const result: DirectoryEntry[] = []

    for (const entry of entries) {
      // Skip hidden files and ignored directories
      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        if (entry.isDirectory()) continue
      }
      if (entry.isDirectory() && ignoreDirs.has(entry.name)) continue

      const fullPath = path.join(dirPath, entry.name)
      const item: DirectoryEntry = {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: fullPath,
      }

      if (entry.isDirectory()) {
        item.children = await getDirectoryStructure(fullPath, maxDepth, currentDepth + 1)
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
