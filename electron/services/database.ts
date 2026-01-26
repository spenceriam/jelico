import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'

// Simple JSON file-based storage for Phase 1
// More reliable than sql.js with Electron bundling

interface DbSchema {
  providers: ProviderRow[]
  conversations: ConversationRow[]
  messages: MessageRow[]
}

let db: DbSchema = {
  providers: [],
  conversations: [],
  messages: [],
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
    }
  } catch (err) {
    console.error('Failed to load database:', err)
    db = { providers: [], conversations: [], messages: [] }
  }
}

function saveDb(): void {
  try {
    fs.writeFileSync(getDbPath(), JSON.stringify(db, null, 2))
  } catch (err) {
    console.error('Failed to save database:', err)
  }
}

export async function initDatabase(): Promise<void> {
  loadDb()
  console.log('Database initialized at:', getDbPath())
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
      created_at: now,
    }

    db.messages.push(record)

    // Update conversation timestamp
    conversationDb.touch(conversationId)

    saveDb()
    return record
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

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  created_at: number
}

interface MessageInput {
  role: string
  content: string
}
