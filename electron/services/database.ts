import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import {
  writeArtifactFile,
  readArtifactFile,
  deleteArtifactFile,
  deleteConversationArtifacts,
  getArtifactFilePath,
  artifactFileExists,
  sanitizeFilename,
} from './artifactFiles'

// Simple JSON file-based storage for Phase 1
// More reliable than sql.js with Electron bundling

interface DbSchema {
  providers: ProviderRow[]
  conversations: ConversationRow[]
  messages: MessageRow[]
  workspaces: WorkspaceRow[]
  artifacts: ArtifactRow[]
  memories: MemoryRow[]
  permissions: PermissionRow[]
  todos: TodoRow[]
}

let db: DbSchema = {
  providers: [],
  conversations: [],
  messages: [],
  workspaces: [],
  artifacts: [],
  memories: [],
  permissions: [],
  todos: [],
}

function getDbPath() {
  return path.join(app.getPath('userData'), 'jelico-data.json')
}

function loadDb(): void {
  try {
    const dbPath = getDbPath()
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8')
      db = JSON.parse(content)
      // Ensure arrays exist for migration
      if (!db.workspaces) {
        db.workspaces = []
      }
      if (!db.artifacts) {
        db.artifacts = []
      }
      if (!db.memories) {
        db.memories = []
      }
      if (!db.permissions) {
        db.permissions = []
      }
      if (!db.todos) {
        db.todos = []
      }
      // Provider visibility migration: ensure legacy records have explicit flag.
      if (db.providers?.length) {
        db.providers.forEach((provider: any) => {
          if (provider.hidden_from_selector === undefined) {
            provider.hidden_from_selector = 0
          }
        })
      }
    }
  } catch (err) {
    console.error('Failed to load database:', err)
    db = { providers: [], conversations: [], messages: [], workspaces: [], artifacts: [], memories: [], permissions: [], todos: [] }
  }
}

function saveDb(): void {
  try {
    fs.writeFileSync(getDbPath(), JSON.stringify(db, null, 2))
  } catch (err) {
    console.error('Failed to save database:', err)
  }
}

/**
 * One-time migration: Move artifact content from database to files
 * This runs once and migrates all existing artifacts that have content in database
 * but no file on disk. After migration, content is cleared from database.
 */
function migrateArtifactsToFiles(): void {
  let migratedCount = 0
  let skippedCount = 0

  for (const artifact of db.artifacts) {
    // Skip if artifact already has a file and the file exists
    if (artifact.file_path && fs.existsSync(artifact.file_path)) {
      skippedCount++
      continue
    }

    // Skip if artifact has no content to migrate
    if (!artifact.content || artifact.content.length === 0) {
      skippedCount++
      continue
    }

    try {
      // Look up workspace path for this conversation
      let workspacePath: string | null = null
      if (artifact.conversation_id) {
        const conversation = db.conversations.find(c => c.id === artifact.conversation_id)
        if (conversation?.workspace_id) {
          const workspace = db.workspaces.find(w => w.id === conversation.workspace_id)
          if (workspace) {
            workspacePath = workspace.path
          }
        }
      }

      // Write content to file (workspace or sandbox based on lookup)
      const filePath = writeArtifactFile(
        artifact.id,
        artifact.conversation_id,
        artifact.type,
        artifact.language,
        artifact.content,
        workspacePath,
        artifact.title  // Use title for human-readable filename
      )

      // Update artifact record with file path and clear content
      artifact.file_path = filePath
      artifact.content = '' // Clear content from database

      migratedCount++
      const location = workspacePath ? `workspace: ${workspacePath}` : 'sandbox'
      console.log(`[Migration] Migrated artifact ${artifact.id} (${artifact.title}) to ${location}: ${filePath}`)
    } catch (error) {
      console.error(`[Migration] Failed to migrate artifact ${artifact.id}:`, error)
    }
  }

  if (migratedCount > 0) {
    saveDb()
    console.log(`[Migration] Artifact migration complete: ${migratedCount} migrated, ${skippedCount} skipped`)
  }
}

/**
 * ONE-TIME MIGRATION: Relocate artifacts to correct workspace/sandbox locations
 * This moves existing artifact files from the old centralized location
 * to their proper workspace or sandbox directories.
 *
 * Run once during development to sync existing artifacts.
 * Can be safely removed after running.
 */
function relocateArtifactsToWorkspaces(): void {
  console.log('[Migration] Starting artifact relocation to workspace/sandbox locations...')
  let relocatedCount = 0
  let skippedCount = 0

  for (const artifact of db.artifacts) {
    // Skip artifacts without files
    if (!artifact.file_path) {
      skippedCount++
      continue
    }

    // Determine where artifact SHOULD be stored
    let workspacePath: string | null = null
    if (artifact.conversation_id) {
      const conversation = db.conversations.find(c => c.id === artifact.conversation_id)
      if (conversation?.workspace_id) {
        const workspace = db.workspaces.find(w => w.id === conversation.workspace_id)
        if (workspace) {
          workspacePath = workspace.path
        }
      }
    }

    // Calculate the correct file path
    const correctPath = getArtifactFilePath(
      artifact.id,
      artifact.conversation_id,
      artifact.type,
      artifact.language,
      workspacePath,
      artifact.title  // Use title for human-readable filename
    )

    // If already in correct location, skip
    if (artifact.file_path === correctPath) {
      skippedCount++
      continue
    }

    try {
      // Read content from old location
      let content: string
      if (fs.existsSync(artifact.file_path)) {
        content = fs.readFileSync(artifact.file_path, 'utf-8')
      } else if (artifact.content && artifact.content.length > 0) {
        // Fallback to database content if file doesn't exist
        content = artifact.content
      } else {
        // Final fallback: recover from another readable revision in the same chain.
        const baseId = artifact.base_artifact_id || artifact.id
        const sibling = db.artifacts
          .filter(a => (a.base_artifact_id || a.id) === baseId && a.id !== artifact.id)
          .sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))
          .find(a => a.file_path && fs.existsSync(a.file_path))

        if (sibling?.file_path) {
          content = fs.readFileSync(sibling.file_path, 'utf-8')
          console.warn(
            `[Migration] Recovered missing content for ${artifact.id} from sibling revision ${sibling.id}`
          )
        } else {
          console.warn(`[Migration] Skipping ${artifact.id}: no file or content found`)
          skippedCount++
          continue
        }
      }

      // Write to correct location
      const newPath = writeArtifactFile(
        artifact.id,
        artifact.conversation_id,
        artifact.type,
        artifact.language,
        content,
        workspacePath,
        artifact.title  // Use title for human-readable filename
      )

      // Delete old file if it exists and is different
      if (artifact.file_path !== newPath && fs.existsSync(artifact.file_path)) {
        try {
          fs.unlinkSync(artifact.file_path)
        } catch (e) {
          console.warn(`[Migration] Could not delete old file: ${artifact.file_path}`)
        }
      }

      // Update artifact record
      artifact.file_path = newPath
      artifact.content = '' // Ensure content is cleared

      relocatedCount++
      const location = workspacePath ? `workspace: ${workspacePath}` : 'sandbox'
      console.log(`[Migration] Relocated artifact ${artifact.id} (${artifact.title}) to ${location}: ${newPath}`)
    } catch (error) {
      console.error(`[Migration] Failed to relocate artifact ${artifact.id}:`, error)
    }
  }

  if (relocatedCount > 0) {
    saveDb()
  }
  console.log(`[Migration] Artifact relocation complete: ${relocatedCount} relocated, ${skippedCount} skipped`)
}

export async function initDatabase(): Promise<void> {
  loadDb()
  console.log('Database initialized at:', getDbPath())

  // Run one-time migration for existing artifacts
  migrateArtifactsToFiles()

  // ONE-TIME: Relocate artifacts to workspace/sandbox locations
  // This can be removed after running once in development
  relocateArtifactsToWorkspaces()
}

// Provider operations
export const providerDb = {
  list(): ProviderRow[] {
    // Preserve insertion order for stable UI ordering.
    // Deleting a provider should not reshuffle the remaining list.
    return [...db.providers]
  },

  get(id: string): ProviderRow | null {
    return db.providers.find(p => p.id === id) || null
  },

  create(provider: ProviderInput): ProviderRow {
    const now = Date.now()
    const id = uuid()

    // If this is marked as default, clear other defaults
    if (provider.isDefault) {
      db.providers.forEach(p => p.is_default = 0)
    }

    // If no providers exist, make this one default
    const isDefault = provider.isDefault || db.providers.length === 0

    const record: ProviderRow = {
      id,
      type: provider.type,
      name: provider.name,
      base_url: provider.baseUrl || null,
      default_model: provider.defaultModel,
      hidden_from_selector: provider.hiddenFromSelector ? 1 : 0,
      is_default: isDefault ? 1 : 0,
      created_at: now,
      updated_at: now,
    }

    db.providers.push(record)
    saveDb()
    return record
  },

  update(id: string, updates: Partial<ProviderInput>): ProviderRow | null {
    const index = db.providers.findIndex(p => p.id === id)
    if (index === -1) return null

    const now = Date.now()

    if (updates.isDefault) {
      db.providers.forEach(p => p.is_default = 0)
    }

    const provider = db.providers[index]
    if (updates.type !== undefined) provider.type = updates.type
    if (updates.name !== undefined) provider.name = updates.name
    if (updates.baseUrl !== undefined) provider.base_url = updates.baseUrl || null
    if (updates.defaultModel !== undefined) provider.default_model = updates.defaultModel
    if (updates.hiddenFromSelector !== undefined) provider.hidden_from_selector = updates.hiddenFromSelector ? 1 : 0
    if (updates.isDefault !== undefined) provider.is_default = updates.isDefault ? 1 : 0
    provider.updated_at = now

    saveDb()
    return provider
  },

  delete(id: string): void {
    const index = db.providers.findIndex(p => p.id === id)
    if (index === -1) return

    const wasDefault = db.providers[index].is_default === 1
    db.providers.splice(index, 1)

    // If deleted provider was default, make another one default
    if (wasDefault && db.providers.length > 0) {
      db.providers[0].is_default = 1
    }

    saveDb()
  },

  getDefault(): ProviderRow | null {
    return db.providers.find(p => p.is_default === 1) || null
  },
}

// Conversation operations
export const conversationDb = {
  list(): ConversationRow[] {
    return [...db.conversations].sort((a, b) => b.updated_at - a.updated_at)
  },

  get(id: string): ConversationRow | null {
    return db.conversations.find(c => c.id === id) || null
  },

  getWithMessages(id: string): (ConversationRow & { messages: MessageRow[] }) | null {
    const conversation = this.get(id)
    if (!conversation) return null

    const messages = db.messages
      .filter(m => m.conversation_id === id)
      .sort((a, b) => a.created_at - b.created_at)

    return { ...conversation, messages }
  },

  create(conv: ConversationInput): ConversationRow {
    const now = Date.now()
    const id = uuid()

    const record: ConversationRow = {
      id,
      title: conv.title,
      workspace_id: conv.workspaceId || null,
      model: conv.model,
      provider_id: conv.providerId,
      created_at: now,
      updated_at: now,
    }

    db.conversations.push(record)
    saveDb()
    return record
  },

  updateTitle(id: string, title: string): void {
    const conv = db.conversations.find(c => c.id === id)
    if (conv) {
      conv.title = title
      conv.updated_at = Date.now()
      saveDb()
    }
  },

  updateWorkspaceId(id: string, workspaceId: string | null): void {
    const conv = db.conversations.find(c => c.id === id)
    if (conv) {
      conv.workspace_id = workspaceId
      conv.updated_at = Date.now()
      saveDb()
    }
  },

  updateModelProvider(id: string, providerId: string, model: string): void {
    const conv = db.conversations.find(c => c.id === id)
    if (conv) {
      conv.provider_id = providerId
      conv.model = model
      conv.updated_at = Date.now()
      saveDb()
    }
  },

  touch(id: string): void {
    const conv = db.conversations.find(c => c.id === id)
    if (conv) {
      conv.updated_at = Date.now()
      saveDb()
    }
  },

  delete(id: string): void {
    // Delete messages first
    db.messages = db.messages.filter(m => m.conversation_id !== id)
    // Delete conversation
    db.conversations = db.conversations.filter(c => c.id !== id)
    saveDb()
  },

  // Replace all messages for a conversation (used by compaction)
  updateMessages(id: string, newMessages: MessageRow[]): void {
    // Remove existing messages
    db.messages = db.messages.filter(m => m.conversation_id !== id)
    // Add new messages
    db.messages.push(...newMessages)
    // Update conversation timestamp
    this.touch(id)
    saveDb()
  },
}

// Workspace operations
export const workspaceDb = {
  list(): WorkspaceRow[] {
    return [...db.workspaces].sort((a, b) => b.updated_at - a.updated_at)
  },

  get(id: string): WorkspaceRow | null {
    return db.workspaces.find(w => w.id === id) || null
  },

  getByPath(path: string): WorkspaceRow | null {
    return db.workspaces.find(w => w.path === path) || null
  },

  create(workspace: WorkspaceInput): WorkspaceRow {
    const now = Date.now()
    const id = uuid()

    // Check if workspace with same path already exists
    const existing = this.getByPath(workspace.path)
    if (existing) {
      return existing
    }

    const record: WorkspaceRow = {
      id,
      name: workspace.name,
      path: workspace.path,
      is_git: workspace.isGit ? 1 : 0,
      is_worktree: workspace.isWorktree ? 1 : 0,
      project_path: workspace.projectPath || null,
      git_branch: workspace.gitBranch || null,
      created_at: now,
      updated_at: now,
    }

    db.workspaces.push(record)
    saveDb()
    return record
  },

  update(id: string, updates: Partial<WorkspaceInput>): WorkspaceRow | null {
    const index = db.workspaces.findIndex(w => w.id === id)
    if (index === -1) return null

    const workspace = db.workspaces[index]
    if (updates.name !== undefined) workspace.name = updates.name
    if (updates.path !== undefined) workspace.path = updates.path
    if (updates.isGit !== undefined) workspace.is_git = updates.isGit ? 1 : 0
    if (updates.isWorktree !== undefined) workspace.is_worktree = updates.isWorktree ? 1 : 0
    if (updates.projectPath !== undefined) workspace.project_path = updates.projectPath || null
    if (updates.gitBranch !== undefined) workspace.git_branch = updates.gitBranch || null
    workspace.updated_at = Date.now()

    saveDb()
    return workspace
  },

  delete(id: string): void {
    // Update conversations to remove workspace reference
    db.conversations.forEach(c => {
      if (c.workspace_id === id) {
        c.workspace_id = null
      }
    })
    // Delete workspace
    db.workspaces = db.workspaces.filter(w => w.id !== id)
    saveDb()
  },

  touch(id: string): void {
    const workspace = db.workspaces.find(w => w.id === id)
    if (workspace) {
      workspace.updated_at = Date.now()
      saveDb()
    }
  },
}

// Message operations
export const messageDb = {
  add(conversationId: string, message: MessageInput): MessageRow {
    const now = Date.now()
    const id = uuid()
    const createdAt = message.createdAt ?? now

    const record: MessageRow = {
      id,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      segments: message.segments,
      tool_calls: message.toolCalls,
      tool_results: message.toolResults,
      attachments: message.attachments,
      usage: message.usage,
      created_at: createdAt,
    }

    db.messages.push(record)

    // Update conversation timestamp
    conversationDb.touch(conversationId)

    saveDb()
    return record
  },

  // Update an existing message (for adding tool calls/results after creation)
  update(id: string, updates: Partial<MessageInput>): MessageRow | null {
    const message = db.messages.find(m => m.id === id)
    if (!message) return null

    if (updates.content !== undefined) message.content = updates.content
    if (updates.segments !== undefined) message.segments = updates.segments
    if (updates.toolCalls !== undefined) message.tool_calls = updates.toolCalls
    if (updates.toolResults !== undefined) message.tool_results = updates.toolResults
    if (updates.attachments !== undefined) message.attachments = updates.attachments
    if (updates.usage !== undefined) message.usage = updates.usage

    saveDb()
    return message
  },

  delete(id: string): boolean {
    const index = db.messages.findIndex(m => m.id === id)
    if (index === -1) return false

    const conversationId = db.messages[index].conversation_id
    db.messages.splice(index, 1)

    // Keep conversation ordering fresh after message deletion.
    conversationDb.touch(conversationId)
    saveDb()
    return true
  },

  getByConversation(conversationId: string): MessageRow[] {
    return db.messages
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => a.created_at - b.created_at)
  },
}

// Types
interface ProviderRow {
  id: string
  type: string
  name: string
  base_url: string | null
  default_model: string
  hidden_from_selector: number
  is_default: number
  created_at: number
  updated_at: number
}

interface ProviderInput {
  type: string
  name: string
  baseUrl?: string
  defaultModel: string
  hiddenFromSelector?: boolean
  isDefault?: boolean
}

interface ConversationRow {
  id: string
  title: string
  workspace_id: string | null
  model: string
  provider_id: string
  created_at: number
  updated_at: number
}

interface ConversationInput {
  title: string
  model: string
  providerId: string
  workspaceId?: string
}

interface ToolCallRow {
  id: string
  name: string
  args: Record<string, unknown>
  status?: 'starting' | 'executing' | 'complete' | 'error' | 'canceled' | 'cancelled'
}

interface ToolResultRow {
  toolCallId: string
  result: unknown
  error?: string
}

type MessageSegmentRow =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCallId: string }

interface MessageAttachment {
  id: string
  type: 'text' | 'image' | 'document'
  name: string
  mimeType: string
  data: string // base64 for images, text content for text files
}

interface MessageUsageRow {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokensPerSecond?: number
  durationMs?: number
  mode?: string
  model?: string
}

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  segments?: MessageSegmentRow[]
  tool_calls?: ToolCallRow[]
  tool_results?: ToolResultRow[]
  attachments?: MessageAttachment[]
  usage?: MessageUsageRow
  created_at: number
}

interface MessageInput {
  role: string
  content: string
  createdAt?: number
  segments?: MessageSegmentRow[]
  toolCalls?: ToolCallRow[]
  toolResults?: ToolResultRow[]
  attachments?: MessageAttachment[]
  usage?: MessageUsageRow
}

interface WorkspaceRow {
  id: string
  name: string
  path: string
  is_git: number
  is_worktree?: number
  project_path?: string | null
  git_branch: string | null
  created_at: number
  updated_at: number
}

interface WorkspaceInput {
  name: string
  path: string
  isGit?: boolean
  isWorktree?: boolean
  projectPath?: string
  gitBranch?: string
}

interface ArtifactRow {
  id: string
  conversation_id: string | null
  type: string
  title: string
  content: string
  language: string | null
  file_path: string | null
  created_at: number
  updated_at: number
  // Versioning fields
  base_artifact_id: string | null  // null = this is the base version
  revision: number                  // 1 for base, 2+ for revisions
}

interface ArtifactInput {
  conversationId?: string
  type: string
  title: string
  content: string
  language?: string
  filePath?: string
  baseArtifactId?: string  // For creating revisions
}

// Artifact operations
// NOTE: Artifact content is stored as files on disk, not in the database.
// The database only stores metadata and file_path references.
// Files are stored at: ~/.config/jelico/artifacts/{conversation-id}/{artifact-id}.{ext}
function hasPersistedArtifactContent(artifact: ArtifactRow): boolean {
  return typeof artifact.content === 'string' && artifact.content.length > 0
}

/**
 * Try to recover a renamed artifact file by searching the same directory
 * for a file whose name ends with the artifact's 8-char ID suffix.
 * Returns the new path if found, null otherwise.
 */
function recoverRenamedArtifact(artifact: ArtifactRow): string | null {
  if (!artifact.file_path) return null

  const dir = path.dirname(artifact.file_path)
  const ext = path.extname(artifact.file_path)
  const shortId = artifact.id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)

  try {
    if (!fs.existsSync(dir)) return null
    const files = fs.readdirSync(dir)
    const match = files.find(f => {
      const base = path.basename(f, path.extname(f))
      return base.endsWith(shortId) && path.extname(f) === ext
    })
    if (match) {
      const recovered = path.join(dir, match)
      console.log(`[ArtifactFiles] Recovered renamed artifact: ${artifact.file_path} -> ${recovered}`)
      return recovered
    }
  } catch {
    // Directory unreadable — skip recovery
  }

  return null
}

function hydrateArtifactContent(artifact: ArtifactRow): ArtifactRow | null {
  if (artifact.file_path && artifactFileExists(artifact.file_path)) {
    const content = readArtifactFile(artifact.file_path)
    if (content !== null && content.length > 0) {
      return { ...artifact, content }
    }
  }

  // File missing at stored path — try to recover by ID suffix match
  if (artifact.file_path && !artifactFileExists(artifact.file_path)) {
    const recovered = recoverRenamedArtifact(artifact)
    if (recovered) {
      // Update the stored path in the database so future loads are instant
      artifact.file_path = recovered
      saveDb()

      const content = readArtifactFile(recovered)
      if (content !== null && content.length > 0) {
        return { ...artifact, content }
      }
    }
  }

  if (hasPersistedArtifactContent(artifact)) {
    return artifact
  }

  return null
}

function getLatestReadableArtifacts(artifacts: ArtifactRow[]): ArtifactRow[] {
  const groupedByBase = new Map<string, ArtifactRow[]>()

  for (const artifact of artifacts) {
    const baseId = artifact.base_artifact_id || artifact.id
    const existing = groupedByBase.get(baseId)
    if (existing) {
      existing.push(artifact)
    } else {
      groupedByBase.set(baseId, [artifact])
    }
  }

  const resolved: ArtifactRow[] = []
  for (const revisions of groupedByBase.values()) {
    const sorted = revisions.sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))
    const latestReadable = sorted
      .map((artifact) => hydrateArtifactContent(artifact))
      .find((artifact): artifact is ArtifactRow => artifact !== null)

    resolved.push(latestReadable || sorted[0])
  }

  return resolved
}

export const artifactDb = {
  list(): ArtifactRow[] {
    // Return latest readable revision for each base artifact across all conversations.
    return getLatestReadableArtifacts(db.artifacts).sort((a, b) => b.updated_at - a.updated_at)
  },

  get(id: string): ArtifactRow | null {
    const artifact = db.artifacts.find(a => a.id === id)
    if (!artifact) return null

    const hydrated = hydrateArtifactContent(artifact)
    if (hydrated) {
      return hydrated
    }

    // Fallback: if this revision lost its file path, reuse newest readable content
    // from the same artifact chain so Canvas can still render.
    const baseId = artifact.base_artifact_id || artifact.id
    const revisions = db.artifacts
      .filter((a) => (a.base_artifact_id || a.id) === baseId)
      .sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))

    for (const revision of revisions) {
      const resolved = hydrateArtifactContent(revision)
      if (resolved) {
        return { ...artifact, content: resolved.content }
      }
    }

    return artifact
  },

  getByConversation(conversationId: string): ArtifactRow[] {
    // Return latest readable revision of each base artifact for this conversation.
    const artifacts = db.artifacts.filter(a => a.conversation_id === conversationId)
    return getLatestReadableArtifacts(artifacts).sort((a, b) => b.updated_at - a.updated_at)
  },

  // Get all revisions of an artifact (by base id) - with content loaded from files
  getRevisions(baseArtifactId: string): ArtifactRow[] {
    // Get the base artifact
    const base = db.artifacts.find(a => a.id === baseArtifactId)
    if (!base) return []

    // Get all artifacts with this base_artifact_id OR the base itself
    const artifacts = db.artifacts
      .filter(a => a.id === baseArtifactId || a.base_artifact_id === baseArtifactId)
      .sort((a, b) => a.revision - b.revision)  // Sort by revision ascending

    // Load content from files for each revision
    return artifacts.map((artifact) => hydrateArtifactContent(artifact) || artifact)
  },

  // Get the latest revision of an artifact - with content loaded from file
  getLatestRevision(baseArtifactId: string): ArtifactRow | null {
    const revisions = this.getRevisions(baseArtifactId)
    if (revisions.length === 0) return null

    for (let i = revisions.length - 1; i >= 0; i -= 1) {
      if (hasPersistedArtifactContent(revisions[i])) {
        return revisions[i]
      }
    }

    return revisions[revisions.length - 1]
  },

  create(artifact: ArtifactInput): ArtifactRow {
    const now = Date.now()
    const id = uuid()

    // Migrate existing artifacts without revision field
    db.artifacts.forEach(a => {
      if (a.revision === undefined) {
        a.revision = 1
        a.base_artifact_id = null
      }
    })

    // Look up workspace path for this conversation
    let workspacePath: string | null = null
    if (artifact.conversationId) {
      const conversation = db.conversations.find(c => c.id === artifact.conversationId)
      if (conversation?.workspace_id) {
        const workspace = db.workspaces.find(w => w.id === conversation.workspace_id)
        if (workspace) {
          workspacePath = workspace.path
        }
      }
    }

    // Write content to file and get file path
    // If workspace exists, store in workspace/.jelico/artifacts/
    // Otherwise store in sandbox/{conversation-id}/artifacts/
    const filePath = writeArtifactFile(
      id,
      artifact.conversationId || null,
      artifact.type,
      artifact.language || null,
      artifact.content,
      workspacePath,
      artifact.title  // Use title for human-readable filename
    )

    const record: ArtifactRow = {
      id,
      conversation_id: artifact.conversationId || null,
      type: artifact.type,
      title: artifact.title,
      content: '', // Content is now stored in file, not database
      language: artifact.language || null,
      file_path: filePath, // Always set file_path now
      created_at: now,
      updated_at: now,
      base_artifact_id: artifact.baseArtifactId || null,
      revision: artifact.baseArtifactId ? this.getNextRevision(artifact.baseArtifactId) : 1,
    }

    db.artifacts.push(record)
    saveDb()

    // Return with content populated (for immediate use)
    return { ...record, content: artifact.content }
  },

  // Get the next revision number for a base artifact
  getNextRevision(baseArtifactId: string): number {
    const revisions = this.getRevisions(baseArtifactId)
    return revisions.length > 0 ? revisions[revisions.length - 1].revision + 1 : 2
  },

  // Create a new revision instead of updating in place
  createRevision(baseArtifactId: string, updates: Partial<ArtifactInput>): ArtifactRow | null {
    // Find the base artifact (could be original or need to find the true base)
    let base = db.artifacts.find(a => a.id === baseArtifactId)
    if (!base) return null

    // If this artifact has a base, use that instead
    const trueBaseId = base.base_artifact_id || base.id

    // Get the latest revision to copy properties from
    const latest = this.getLatestRevision(trueBaseId)
    if (!latest) return null

    if (
      updates.conversationId !== undefined &&
      updates.conversationId !== (latest.conversation_id || undefined)
    ) {
      console.error(
        `[Artifacts] Refusing to move artifact ${baseArtifactId} across conversations during revision create`
      )
      return null
    }

    return this.create({
      conversationId: latest.conversation_id || undefined,
      type: updates.type || latest.type,
      title: updates.title || latest.title,
      content: updates.content || latest.content,
      language: updates.language || latest.language || undefined,
      filePath: updates.filePath || latest.file_path || undefined,
      baseArtifactId: trueBaseId,
    })
  },

  // Update in place (for metadata changes only, not content)
  update(id: string, updates: Partial<ArtifactInput>): ArtifactRow | null {
    const index = db.artifacts.findIndex(a => a.id === id)
    if (index === -1) return null

    const artifact = db.artifacts[index]

    // Artifacts are conversation-scoped. Prevent accidental cross-conversation moves.
    if (updates.conversationId !== undefined) {
      const requestedConversationId = updates.conversationId || null
      if (requestedConversationId !== artifact.conversation_id) {
        console.error(
          `[Artifacts] Refusing to move artifact ${id} from conversation ${artifact.conversation_id} to ${requestedConversationId}`
        )
        return null
      }
    }

    // If content is changing, create a revision instead.
    // Stored rows keep content in files (row.content may be empty), so compare against hydrated content.
    const persistedContent = hydrateArtifactContent(artifact)?.content ?? artifact.content
    if (updates.content !== undefined && updates.content !== persistedContent) {
      return this.createRevision(id, updates)
    }

    // Otherwise update in place (title, metadata changes)
    if (updates.type !== undefined) artifact.type = updates.type
    if (updates.title !== undefined) artifact.title = updates.title
    if (updates.language !== undefined) artifact.language = updates.language || null
    if (updates.filePath !== undefined) artifact.file_path = updates.filePath || null
    artifact.updated_at = Date.now()

    saveDb()
    return artifact
  },

  delete(id: string): void {
    // Delete the artifact and all its revisions
    const artifact = db.artifacts.find(a => a.id === id)
    if (!artifact) return

    const baseId = artifact.base_artifact_id || artifact.id

    // Delete artifact files for base and all revisions
    const toDelete = db.artifacts.filter(a => a.id === baseId || a.base_artifact_id === baseId)
    for (const a of toDelete) {
      if (a.file_path) {
        deleteArtifactFile(a.file_path)
      }
    }

    db.artifacts = db.artifacts.filter(a => a.id !== baseId && a.base_artifact_id !== baseId)
    saveDb()
  },

  deleteByConversation(conversationId: string): void {
    // Delete all known artifact files for this conversation, regardless of storage location.
    const toDelete = db.artifacts.filter(a => a.conversation_id === conversationId)
    for (const artifact of toDelete) {
      if (artifact.file_path) {
        deleteArtifactFile(artifact.file_path)
      }
    }

    // Legacy cleanup path (older builds stored by conversation folder under legacy root).
    deleteConversationArtifacts(conversationId)

    db.artifacts = db.artifacts.filter(a => a.conversation_id !== conversationId)
    saveDb()
  },

  /**
   * Transfer all artifacts for a conversation to a new workspace location
   * @param conversationId - The conversation whose artifacts to transfer
   * @param newWorkspacePath - The new workspace path (null for sandbox)
   * @returns Object with counts of transferred and failed artifacts
   */
  transferToWorkspace(
    conversationId: string,
    newWorkspacePath: string | null
  ): { transferred: number; failed: number; errors: string[] } {
    const artifacts = db.artifacts.filter(a => a.conversation_id === conversationId)
    let transferred = 0
    let failed = 0
    const errors: string[] = []

    for (const artifact of artifacts) {
      try {
        // Read content from current location
        let content: string | null = null
        if (artifact.file_path && artifactFileExists(artifact.file_path)) {
          content = readArtifactFile(artifact.file_path)
        } else if (artifact.content) {
          content = artifact.content
        }

        if (!content) {
          errors.push(`${artifact.title}: No content found`)
          failed++
          continue
        }

        // Calculate new file path
        const newPath = getArtifactFilePath(
          artifact.id,
          conversationId,
          artifact.type,
          artifact.language,
          newWorkspacePath,
          artifact.title
        )

        // Ensure destination directory exists
        const dir = path.dirname(newPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        // Write to new location
        fs.writeFileSync(newPath, content, 'utf-8')

        // Delete old file if different location
        if (artifact.file_path && artifact.file_path !== newPath && fs.existsSync(artifact.file_path)) {
          fs.unlinkSync(artifact.file_path)
        }

        // Update artifact record
        artifact.file_path = newPath
        artifact.updated_at = Date.now()

        transferred++
      } catch (err) {
        errors.push(`${artifact.title}: ${err instanceof Error ? err.message : String(err)}`)
        failed++
      }
    }

    saveDb()
    return { transferred, failed, errors }
  },
}

// Memory types and operations
type MemoryScope = 'global' | 'workspace' | 'conversation'
type MemoryCategory = 'preference' | 'fact' | 'style' | 'correction' | 'workflow' | 'custom'
type MemorySource = 'explicit' | 'inferred'
type MemoryPrivacy = 'private' | 'shared'

interface MemoryRow {
  id: string
  scope: MemoryScope
  scope_id: string | null // null for global, workspace_id or conversation_id
  category: MemoryCategory
  key: string
  value: string // JSON stringified
  confidence: number // 0-1
  source: MemorySource
  privacy: MemoryPrivacy
  created_at: number
  updated_at: number
}

interface MemoryInput {
  scope: MemoryScope
  scopeId?: string
  category: MemoryCategory
  key: string
  value: unknown
  confidence?: number
  source?: MemorySource
  privacy?: MemoryPrivacy
}

export const memoryDb = {
  list(scope?: MemoryScope, scopeId?: string): MemoryRow[] {
    let memories = [...db.memories]

    if (scope) {
      memories = memories.filter(m => m.scope === scope)
    }
    if (scopeId) {
      memories = memories.filter(m => m.scope_id === scopeId)
    }

    return memories.sort((a, b) => b.updated_at - a.updated_at)
  },

  get(id: string): MemoryRow | null {
    return db.memories.find(m => m.id === id) || null
  },

  getByKey(scope: MemoryScope, scopeId: string | null, key: string): MemoryRow | null {
    return db.memories.find(
      m => m.scope === scope && m.scope_id === scopeId && m.key === key
    ) || null
  },

  getGlobal(): MemoryRow[] {
    return db.memories.filter(m => m.scope === 'global')
  },

  getByWorkspace(workspaceId: string): MemoryRow[] {
    return db.memories.filter(m => m.scope === 'workspace' && m.scope_id === workspaceId)
  },

  getByConversation(conversationId: string): MemoryRow[] {
    return db.memories.filter(m => m.scope === 'conversation' && m.scope_id === conversationId)
  },

  // Get all memories relevant to a context (includes global + workspace + conversation)
  getForContext(workspaceId?: string, conversationId?: string): MemoryRow[] {
    const memories: MemoryRow[] = []

    // Always include global memories
    memories.push(...this.getGlobal())

    // Include workspace memories if provided
    if (workspaceId) {
      memories.push(...this.getByWorkspace(workspaceId))
    }

    // Include conversation memories if provided
    if (conversationId) {
      memories.push(...this.getByConversation(conversationId))
    }

    return memories.sort((a, b) => b.confidence - a.confidence)
  },

  create(memory: MemoryInput): MemoryRow {
    const now = Date.now()
    const id = uuid()

    // Check for existing memory with same key in same scope
    const existing = this.getByKey(
      memory.scope,
      memory.scopeId || null,
      memory.key
    )

    if (existing) {
      // Update existing memory instead of creating duplicate
      return this.update(existing.id, {
        value: memory.value,
        confidence: memory.confidence,
        source: memory.source,
      })!
    }

    const record: MemoryRow = {
      id,
      scope: memory.scope,
      scope_id: memory.scopeId || null,
      category: memory.category,
      key: memory.key,
      value: JSON.stringify(memory.value),
      confidence: memory.confidence ?? 0.8,
      source: memory.source || 'explicit',
      privacy: memory.privacy || 'shared',
      created_at: now,
      updated_at: now,
    }

    db.memories.push(record)
    saveDb()
    return record
  },

  update(id: string, updates: Partial<MemoryInput>): MemoryRow | null {
    const index = db.memories.findIndex(m => m.id === id)
    if (index === -1) return null

    const memory = db.memories[index]
    if (updates.scope !== undefined) memory.scope = updates.scope
    if (updates.scopeId !== undefined) memory.scope_id = updates.scopeId || null
    if (updates.category !== undefined) memory.category = updates.category
    if (updates.key !== undefined) memory.key = updates.key
    if (updates.value !== undefined) memory.value = JSON.stringify(updates.value)
    if (updates.confidence !== undefined) memory.confidence = updates.confidence
    if (updates.source !== undefined) memory.source = updates.source
    if (updates.privacy !== undefined) memory.privacy = updates.privacy
    memory.updated_at = Date.now()

    saveDb()
    return memory
  },

  delete(id: string): void {
    db.memories = db.memories.filter(m => m.id !== id)
    saveDb()
  },

  deleteByScope(scope: MemoryScope, scopeId?: string): void {
    db.memories = db.memories.filter(m => {
      if (m.scope !== scope) return true
      if (scopeId && m.scope_id !== scopeId) return true
      return false
    })
    saveDb()
  },

  // Decay confidence over time (call periodically)
  decayConfidence(decayRate: number = 0.01): void {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    db.memories.forEach(m => {
      const daysSinceUpdate = (now - m.updated_at) / dayMs
      const decay = decayRate * daysSinceUpdate
      m.confidence = Math.max(0, m.confidence - decay)
    })

    // Remove memories with very low confidence
    db.memories = db.memories.filter(m => m.confidence > 0.1)
    saveDb()
  },
}

// Permission types and operations
type PermissionAction = 'allow_always' | 'allow_once' | 'deny'

interface PermissionRow {
  id: string
  tool_name: string
  action_pattern: string // e.g., "read:*", "write:/home/user/*"
  permission: PermissionAction
  workspace_id: string | null // null for global
  created_at: number
  updated_at: number
}

interface PermissionInput {
  toolName: string
  actionPattern: string
  permission: PermissionAction
  workspaceId?: string
}

export const permissionDb = {
  list(workspaceId?: string): PermissionRow[] {
    let permissions = [...db.permissions]

    if (workspaceId !== undefined) {
      // Include both workspace-specific and global permissions
      permissions = permissions.filter(
        p => p.workspace_id === workspaceId || p.workspace_id === null
      )
    }

    return permissions.sort((a, b) => b.updated_at - a.updated_at)
  },

  get(id: string): PermissionRow | null {
    return db.permissions.find(p => p.id === id) || null
  },

  getByToolAndPattern(
    toolName: string,
    actionPattern: string,
    workspaceId?: string
  ): PermissionRow | null {
    // First check workspace-specific permission
    if (workspaceId) {
      const workspacePermission = db.permissions.find(
        p => p.tool_name === toolName &&
          p.action_pattern === actionPattern &&
          p.workspace_id === workspaceId
      )
      if (workspacePermission) return workspacePermission
    }

    // Fall back to global permission
    return db.permissions.find(
      p => p.tool_name === toolName &&
        p.action_pattern === actionPattern &&
        p.workspace_id === null
    ) || null
  },

  // Check if an action is permitted
  checkPermission(
    toolName: string,
    action: string,
    workspaceId?: string
  ): PermissionAction | null {
    // Look for exact match first
    let permission = this.getByToolAndPattern(toolName, action, workspaceId)
    if (permission) return permission.permission

    // Look for wildcard patterns (e.g., "read:*" matches "read:/path/to/file")
    const permissions = this.list(workspaceId)
    for (const p of permissions) {
      if (p.tool_name !== toolName) continue

      // Check if pattern matches
      if (this.matchesPattern(p.action_pattern, action)) {
        return p.permission
      }
    }

    // Backward compatibility: earlier builds stored project-level write/command
    // approvals as exact action strings. Treat any persisted allow_always for these
    // tools as tool-scoped project approval.
    if (toolName === 'write_file' || toolName === 'execute_command') {
      const legacyBroadAllow = permissions.find(
        p => p.tool_name === toolName && p.permission === 'allow_always'
      )
      if (legacyBroadAllow) {
        return 'allow_always'
      }
    }

    return null // No permission found, should prompt user
  },

  matchesPattern(pattern: string, action: string): boolean {
    // Simple glob matching
    if (pattern === '*') return true
    if (pattern === action) return true

    // Handle trailing wildcard
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      return action.startsWith(prefix)
    }

    return false
  },

  create(permission: PermissionInput): PermissionRow {
    const now = Date.now()
    const id = uuid()

    // Check for existing permission with same tool/pattern/workspace
    const existing = this.getByToolAndPattern(
      permission.toolName,
      permission.actionPattern,
      permission.workspaceId
    )

    if (existing) {
      // Update existing permission
      return this.update(existing.id, { permission: permission.permission })!
    }

    const record: PermissionRow = {
      id,
      tool_name: permission.toolName,
      action_pattern: permission.actionPattern,
      permission: permission.permission,
      workspace_id: permission.workspaceId || null,
      created_at: now,
      updated_at: now,
    }

    db.permissions.push(record)
    saveDb()
    return record
  },

  update(id: string, updates: Partial<PermissionInput>): PermissionRow | null {
    const index = db.permissions.findIndex(p => p.id === id)
    if (index === -1) return null

    const permission = db.permissions[index]
    if (updates.toolName !== undefined) permission.tool_name = updates.toolName
    if (updates.actionPattern !== undefined) permission.action_pattern = updates.actionPattern
    if (updates.permission !== undefined) permission.permission = updates.permission
    if (updates.workspaceId !== undefined) permission.workspace_id = updates.workspaceId || null
    permission.updated_at = Date.now()

    saveDb()
    return permission
  },

  delete(id: string): void {
    db.permissions = db.permissions.filter(p => p.id !== id)
    saveDb()
  },

  deleteByWorkspace(workspaceId: string): void {
    db.permissions = db.permissions.filter(p => p.workspace_id !== workspaceId)
    saveDb()
  },

  // Clear all "allow_once" permissions (call at session start)
  clearOncePermissions(): void {
    db.permissions = db.permissions.filter(p => p.permission !== 'allow_once')
    saveDb()
  },
}

// Todo types and database operations (Issue #48: Move from localStorage to database)
export type TodoStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'cancelled'

interface TodoRow {
  id: string
  conversation_id: string
  text: string
  status: TodoStatus
  created_at: number
  updated_at: number
}

export const todoDb = {
  getByConversation(conversationId: string): TodoRow[] {
    return db.todos
      .filter(t => t.conversation_id === conversationId)
      .sort((a, b) => a.created_at - b.created_at)
  },

  replaceAllForConversation(conversationId: string, todos: Omit<TodoRow, 'conversation_id'>[]): void {
    // Remove existing todos for this conversation
    db.todos = db.todos.filter(t => t.conversation_id !== conversationId)
    
    // Add new todos
    const now = Date.now()
    const newTodos: TodoRow[] = todos.map((todo, index) => ({
      ...todo,
      conversation_id: conversationId,
      // Ensure timestamps are set
      created_at: todo.created_at || now + index,
      updated_at: todo.updated_at || now + index,
    }))
    
    db.todos.push(...newTodos)
    saveDb()
  },

  updateTodo(conversationId: string, todoId: string, updates: Partial<Pick<TodoRow, 'text' | 'status'>>): TodoRow | null {
    const todo = db.todos.find(t => t.id === todoId && t.conversation_id === conversationId)
    if (!todo) return null

    if (updates.text !== undefined) todo.text = updates.text
    if (updates.status !== undefined) todo.status = updates.status
    todo.updated_at = Date.now()

    saveDb()
    return todo
  },

  deleteByConversation(conversationId: string): void {
    db.todos = db.todos.filter(t => t.conversation_id !== conversationId)
    saveDb()
  },

  // Migration: Import todos from localStorage (one-time)
  migrateFromLocalStorage(): void {
    try {
      const TODOS_STORAGE_KEY = 'jelico.todosByConversation.v1'
      const raw = globalThis?.window?.localStorage?.getItem(TODOS_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return

      let migratedCount = 0
      for (const [conversationId, todos] of Object.entries(parsed)) {
        if (!Array.isArray(todos)) continue
        
        // Check if we already have todos for this conversation
        const existing = db.todos.filter(t => t.conversation_id === conversationId)
        if (existing.length > 0) continue // Skip if already migrated

        const validTodos = todos
          .filter((t: any) => t && typeof t === 'object' && typeof t.id === 'string')
          .map((t: any) => ({
            id: t.id,
            conversation_id: conversationId,
            text: String(t.text || ''),
            status: (t.status as TodoStatus) || 'pending',
            created_at: Number(t.createdAt) || Date.now(),
            updated_at: Number(t.updatedAt) || Date.now(),
          }))

        if (validTodos.length > 0) {
          db.todos.push(...validTodos)
          migratedCount += validTodos.length
        }
      }

      if (migratedCount > 0) {
        saveDb()
        console.log(`[Migration] Migrated ${migratedCount} todos from localStorage to database`)
      }
    } catch (err) {
      console.error('[Migration] Failed to migrate todos from localStorage:', err)
    }
  },
}
