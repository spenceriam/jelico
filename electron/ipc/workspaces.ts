import { ipcMain, dialog, BrowserWindow } from 'electron'
import { workspaceDb, conversationDb } from '../services/database'
import * as fs from 'fs'
import * as path from 'path'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

interface WorkspaceConfig {
  id: string
  name: string
  path: string
  isGit: boolean
  isWorktree?: boolean
  projectPath?: string
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
    isWorktree: row.is_worktree === 1,
    projectPath: row.project_path || undefined,
    gitBranch: row.git_branch || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function workspacePathExists(workspacePath: string): boolean {
  try {
    return fs.existsSync(workspacePath) && fs.statSync(workspacePath).isDirectory()
  } catch {
    return false
  }
}

function resolveGitPath(baseDir: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value)
}

async function resolveWorktreeRemovalRepoPath(worktreePath: string, projectPath?: string | null): Promise<string> {
  if (projectPath && workspacePathExists(projectPath)) {
    return projectPath
  }

  try {
    const { stdout } = await execAsync('git rev-parse --git-common-dir', { cwd: worktreePath })
    const resolvedCommonDir = resolveGitPath(worktreePath, stdout.trim())
    const repoRoot = path.dirname(resolvedCommonDir)
    if (workspacePathExists(repoRoot)) {
      return repoRoot
    }
  } catch {
    // Fall back to the worktree path below.
  }

  return worktreePath
}

async function isGitRepository(
  dirPath: string
): Promise<{ isGit: boolean; isWorktree?: boolean; projectPath?: string; branch?: string }> {
  try {
    const { stdout: insideWorkTreeOut } = await execAsync('git rev-parse --is-inside-work-tree', { cwd: dirPath })
    if (insideWorkTreeOut.trim() !== 'true') {
      return { isGit: false, projectPath: dirPath }
    }

    const [{ stdout: branchOut }, { stdout: gitDirOut }, { stdout: gitCommonDirOut }, { stdout: topLevelOut }] = await Promise.all([
      execAsync('git rev-parse --abbrev-ref HEAD', { cwd: dirPath }),
      execAsync('git rev-parse --git-dir', { cwd: dirPath }),
      execAsync('git rev-parse --git-common-dir', { cwd: dirPath }),
      execAsync('git rev-parse --show-toplevel', { cwd: dirPath }),
    ])

    const resolvedGitDir = resolveGitPath(dirPath, gitDirOut.trim())
    const resolvedCommonDir = resolveGitPath(dirPath, gitCommonDirOut.trim())
    const projectPath = resolveGitPath(dirPath, topLevelOut.trim())
    const isWorktree = resolvedGitDir !== resolvedCommonDir

    return { isGit: true, isWorktree, projectPath, branch: branchOut.trim() }
  } catch {
    return { isGit: false, projectPath: dirPath }
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
      } else if (line.startsWith('branch ')) {
        const rawBranch = line.substring(7)
        current.branch = rawBranch.startsWith('refs/heads/') ? rawBranch.substring(11) : rawBranch
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

type WorkspaceDbRow = ReturnType<typeof workspaceDb.list>[number]

async function discoverAndUpsertWorktrees(workspaces: WorkspaceDbRow[]): Promise<void> {
  const repositoryRoots = new Set<string>()

  for (const workspace of workspaces) {
    if (workspace.is_git !== 1) continue
    repositoryRoots.add(workspace.project_path || workspace.path)
  }

  for (const repositoryRoot of repositoryRoots) {
    const worktrees = await listWorktrees(repositoryRoot)

    for (const worktree of worktrees) {
      const worktreePath = path.resolve(worktree.path)
      const normalizedRoot = path.resolve(repositoryRoot)
      const isMainWorktree = worktreePath === normalizedRoot
      const existing = workspaceDb.getByPath(worktreePath)

      if (existing) {
        workspaceDb.update(existing.id, {
          name: !isMainWorktree ? path.basename(worktreePath) : existing.name,
          isGit: true,
          isWorktree: !isMainWorktree,
          projectPath: normalizedRoot,
          gitBranch: worktree.branch,
        })
        continue
      }

      workspaceDb.create({
        name: path.basename(worktreePath),
        path: worktreePath,
        isGit: true,
        isWorktree: !isMainWorktree,
        projectPath: normalizedRoot,
        gitBranch: worktree.branch,
      })
    }
  }
}

async function listBranches(repoPath: string): Promise<{ name: string; isRemote: boolean; isCurrent: boolean }[]> {
  try {
    const { stdout } = await execAsync('git branch -a --format="%(HEAD) %(refname:short)"', { cwd: repoPath })
    return stdout.split('\n').filter(Boolean).map(line => {
      const isCurrent = line.startsWith('*')
      const rawName = line.substring(2).trim()
      const isRemote = rawName.startsWith('remotes/')
      const name = isRemote ? rawName.replace(/^remotes\//, '') : rawName
      return { name, isRemote, isCurrent }
    })
  } catch {
    return []
  }
}

async function getPreferredWorktreeBaseRef(repoPath: string): Promise<string | null> {
  const branches = await listBranches(repoPath)

  const localBranches = new Set(
    branches
      .filter((branchInfo) => !branchInfo.isRemote)
      .map((branchInfo) => branchInfo.name)
  )
  const remoteBranches = new Set(
    branches
      .filter((branchInfo) => branchInfo.isRemote)
      .map((branchInfo) => branchInfo.name)
  )

  if (localBranches.has('main')) return 'main'
  if (localBranches.has('master')) return 'master'
  if (remoteBranches.has('origin/main')) return 'origin/main'
  if (remoteBranches.has('origin/master')) return 'origin/master'

  return null
}

async function execGit(repoPath: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: repoPath, windowsHide: true })
}

async function createWorktree(repoPath: string, branch: string, targetPath: string): Promise<boolean> {
  try {
    // Check if local or remote branch exists
    const branches = await listBranches(repoPath)
    const localBranchExists = branches.some((branchInfo) => !branchInfo.isRemote && branchInfo.name === branch)
    const remoteBranchExists = branches.some((branchInfo) => branchInfo.isRemote && branchInfo.name === `origin/${branch}`)

    if (localBranchExists) {
      // Use existing local branch
      await execGit(repoPath, ['worktree', 'add', targetPath, branch])
    } else if (remoteBranchExists) {
      // Create local branch that tracks the remote branch.
      await execGit(repoPath, ['worktree', 'add', '-b', branch, targetPath, `origin/${branch}`])
    } else {
      // Create a new branch from main/master when available; otherwise fallback to current HEAD.
      const preferredBaseRef = await getPreferredWorktreeBaseRef(repoPath)
      if (preferredBaseRef) {
        await execGit(repoPath, ['worktree', 'add', '-b', branch, targetPath, preferredBaseRef])
      } else {
        await execGit(repoPath, ['worktree', 'add', '-b', branch, targetPath])
      }
    }
    return true
  } catch (err) {
    console.error('Failed to create worktree:', err)
    return false
  }
}

async function removeWorktree(repoPath: string, worktreePath: string): Promise<boolean> {
  try {
    await execGit(repoPath, ['worktree', 'remove', worktreePath, '--force'])
    return true
  } catch {
    return false
  }
}

export function registerWorkspaceHandlers() {
  // List all workspaces
  ipcMain.handle('workspaces:list', async () => {
    const allWorkspaces = workspaceDb.list()
    const staleWorktreeIds = allWorkspaces
      .filter((workspace) => (workspace.is_worktree || 0) === 1 && !workspacePathExists(workspace.path))
      .map((workspace) => workspace.id)

    for (const id of staleWorktreeIds) {
      workspaceDb.delete(id)
    }

    const workspaces = workspaceDb.list()

    // Keep git metadata synchronized in case records were imported/stale.
    const hydrated = await Promise.all(workspaces.map(async (workspace) => {
      const gitInfo = await isGitRepository(workspace.path)
      const nextIsGit = gitInfo.isGit ? 1 : 0
      const nextIsWorktree = gitInfo.isWorktree ? 1 : 0
      const nextProjectPath = gitInfo.projectPath || null
      const nextBranch = gitInfo.branch || null
      const expectedName = nextIsWorktree === 1 ? path.basename(workspace.path) : workspace.name

      if (
        workspace.name === expectedName &&
        workspace.is_git === nextIsGit &&
        (workspace.is_worktree || 0) === nextIsWorktree &&
        (workspace.project_path || null) === nextProjectPath &&
        (workspace.git_branch || null) === nextBranch
      ) {
        return workspace
      }

      return workspaceDb.update(workspace.id, {
        name: expectedName,
        isGit: gitInfo.isGit,
        isWorktree: gitInfo.isWorktree,
        projectPath: gitInfo.projectPath,
        gitBranch: gitInfo.branch,
      }) || workspace
    }))

    await discoverAndUpsertWorktrees(hydrated)

    return workspaceDb.list().map(toConfig)
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
        isWorktree: gitInfo.isWorktree,
        projectPath: gitInfo.projectPath,
        gitBranch: gitInfo.branch,
      })
      return toConfig(workspaceDb.get(existing.id)!)
    }

    // Create new workspace
    const workspace = workspaceDb.create({
      name: folderName,
      path: folderPath,
      isGit: gitInfo.isGit,
      isWorktree: gitInfo.isWorktree,
      projectPath: gitInfo.projectPath,
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
      isWorktree: gitInfo.isWorktree,
      projectPath: gitInfo.projectPath,
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
  ipcMain.handle('workspaces:delete', async (_, id: string) => {
    const workspace = workspaceDb.get(id)
    if (!workspace) return

    const isWorktree = (workspace.is_worktree || 0) === 1
    const isGit = workspace.is_git === 1

    // If this record represents a git worktree, remove the real worktree first.
    if (isWorktree && isGit && workspacePathExists(workspace.path)) {
      const repoPath = await resolveWorktreeRemovalRepoPath(workspace.path, workspace.project_path)
      const removed = await removeWorktree(repoPath, workspace.path)
      if (!removed) {
        throw new Error('Failed to remove git worktree. Resolve local changes and try again.')
      }
    }

    workspaceDb.delete(id)
  })

  // Refresh git info for a workspace
  ipcMain.handle('workspaces:refreshGit', async (_, id: string) => {
    const workspace = workspaceDb.get(id)
    if (!workspace) return null

    const gitInfo = await isGitRepository(workspace.path)
    const updated = workspaceDb.update(id, {
      isGit: gitInfo.isGit,
      isWorktree: gitInfo.isWorktree,
      projectPath: gitInfo.projectPath,
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
      name: path.basename(worktreePath),
      path: worktreePath,
      isGit: gitInfo.isGit,
      isWorktree: gitInfo.isWorktree,
      projectPath: gitInfo.projectPath,
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
    const normalizedTargetPath = path.resolve(worktreePath)
    const worktreeWorkspace = workspaceDb
      .list()
      .find((entry) => path.resolve(entry.path) === normalizedTargetPath)
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
