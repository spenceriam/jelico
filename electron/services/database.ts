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
}

let db: DbSchema = {
  providers: [],
  conversations: [],
  messages: [],
  workspaces: [],
  artifacts: [],
  memories: [],
  permissions: [],
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
    }
  } catch (err) {
    console.error('Failed to load database:', err)
    db = { providers: [], conversations: [], messages: [], workspaces: [], artifacts: [], memories: [], permissions: [] }
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
        workspacePath
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

export async function initDatabase(): Promise<void> {
  loadDb()
  console.log('Database initialized at:', getDbPath())

  // Run one-time migration for existing artifacts
  migrateArtifactsToFiles()
}

// Provider operations
export const providerDb = {
  list(): ProviderRow[] {
    return [...db.providers].sort((a, b) => {
      if (a.is_default !== b.is_default) return b.is_default - a.is_default
      return a.name.localeCompare(b.name)
    })
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

    const record: MessageRow = {
      id,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      tool_calls: message.toolCalls,
      tool_results: message.toolResults,
      attachments: message.attachments,
      created_at: now,
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
    if (updates.toolCalls !== undefined) message.tool_calls = updates.toolCalls
    if (updates.toolResults !== undefined) message.tool_results = updates.toolResults
    if (updates.attachments !== undefined) message.attachments = updates.attachments

    saveDb()
    return message
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
  is_default: number
  created_at: number
  updated_at: number
}

interface ProviderInput {
  type: string
  name: string
  baseUrl?: string
  defaultModel: string
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
  status?: 'starting' | 'executing' | 'complete' | 'error'
}

interface ToolResultRow {
  toolCallId: string
  result: unknown
  error?: string
}

interface MessageAttachment {
  id: string
  type: 'text' | 'image' | 'document'
  name: string
  mimeType: string
  data: string // base64 for images, text content for text files
}

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  tool_calls?: ToolCallRow[]
  tool_results?: ToolResultRow[]
  attachments?: MessageAttachment[]
  created_at: number
}

interface MessageInput {
  role: string
  content: string
  toolCalls?: ToolCallRow[]
  toolResults?: ToolResultRow[]
  attachments?: MessageAttachment[]
}

interface WorkspaceRow {
  id: string
  name: string
  path: string
  is_git: number
  git_branch: string | null
  created_at: number
  updated_at: number
}

interface WorkspaceInput {
  name: string
  path: string
  isGit?: boolean
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
export const artifactDb = {
  list(): ArtifactRow[] {
    return [...db.artifacts].sort((a, b) => b.updated_at - a.updated_at)
  },

  get(id: string): ArtifactRow | null {
    const artifact = db.artifacts.find(a => a.id === id)
    if (!artifact) return null

    // Load content from file if file_path exists
    if (artifact.file_path && artifactFileExists(artifact.file_path)) {
      const content = readArtifactFile(artifact.file_path)
      if (content !== null) {
        return { ...artifact, content }
      }
    }

    // Fallback to database content (for legacy artifacts not yet migrated)
    return artifact
  },

  getByConversation(conversationId: string): ArtifactRow[] {
    // Return only the latest revision of each base artifact
    const artifacts = db.artifacts.filter(a => a.conversation_id === conversationId)

    // Group by base_artifact_id (or own id if base)
    const latestByBase = new Map<string, ArtifactRow>()
    for (const a of artifacts) {
      const baseId = a.base_artifact_id || a.id
      const existing = latestByBase.get(baseId)
      if (!existing || a.revision > existing.revision) {
        latestByBase.set(baseId, a)
      }
    }

    // Load content from files for each artifact
    const result: ArtifactRow[] = []
    for (const artifact of latestByBase.values()) {
      if (artifact.file_path && artifactFileExists(artifact.file_path)) {
        const content = readArtifactFile(artifact.file_path)
        if (content !== null) {
          result.push({ ...artifact, content })
          continue
        }
      }
      // Fallback to database content
      result.push(artifact)
    }

    return result.sort((a, b) => b.updated_at - a.updated_at)
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
    return artifacts.map(artifact => {
      if (artifact.file_path && artifactFileExists(artifact.file_path)) {
        const content = readArtifactFile(artifact.file_path)
        if (content !== null) {
          return { ...artifact, content }
        }
      }
      return artifact
    })
  },

  // Get the latest revision of an artifact - with content loaded from file
  getLatestRevision(baseArtifactId: string): ArtifactRow | null {
    const revisions = this.getRevisions(baseArtifactId)
    return revisions.length > 0 ? revisions[revisions.length - 1] : null
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
      workspacePath
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

    // If content is changing, create a revision instead
    if (updates.content !== undefined && updates.content !== artifact.content) {
      return this.createRevision(id, updates)
    }

    // Otherwise update in place (title, metadata changes)
    if (updates.conversationId !== undefined) artifact.conversation_id = updates.conversationId || null
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
    // Delete all artifact files for this conversation
    deleteConversationArtifacts(conversationId)

    db.artifacts = db.artifacts.filter(a => a.conversation_id !== conversationId)
    saveDb()
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
