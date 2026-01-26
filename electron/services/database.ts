import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'

let db: SqlJsDatabase
let dbPath: string

export async function initDatabase() {
  const SQL = await initSqlJs()
  dbPath = path.join(app.getPath('userData'), 'jelico.db')

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // Create tables
  db.run(`
    -- Providers (metadata only, keys stored separately)
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      base_url TEXT,
      default_model TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Conversations
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      workspace_id TEXT,
      model TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Messages
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `)

  // Create indexes
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)')
    db.run('CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)')
  } catch {
    // Indexes may already exist
  }

  saveDatabase()
}

function saveDatabase() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

export function getDatabase() {
  return db
}

// Helper to run queries and save
function runAndSave(sql: string, params: any[] = []) {
  db.run(sql, params)
  saveDatabase()
}

// Provider operations
export const providerDb = {
  list(): ProviderRow[] {
    const result = db.exec('SELECT * FROM providers ORDER BY is_default DESC, name ASC')
    if (!result.length) return []
    return resultToObjects(result[0]) as ProviderRow[]
  },

  get(id: string): ProviderRow | null {
    const result = db.exec('SELECT * FROM providers WHERE id = ?', [id])
    if (!result.length || !result[0].values.length) return null
    return resultToObjects(result[0])[0] as ProviderRow
  },

  create(provider: ProviderInput): ProviderRow {
    const now = Date.now()
    const id = uuid()

    // If this is marked as default, clear other defaults
    if (provider.isDefault) {
      runAndSave('UPDATE providers SET is_default = 0')
    }

    // If no providers exist, make this one default
    const countResult = db.exec('SELECT COUNT(*) as count FROM providers')
    const count = countResult.length ? (countResult[0].values[0][0] as number) : 0
    const isDefault = provider.isDefault || count === 0

    runAndSave(`
      INSERT INTO providers (id, type, name, base_url, default_model, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, provider.type, provider.name, provider.baseUrl || null, provider.defaultModel, isDefault ? 1 : 0, now, now])

    return this.get(id)!
  },

  update(id: string, updates: Partial<ProviderInput>): ProviderRow | null {
    const provider = this.get(id)
    if (!provider) return null

    const now = Date.now()

    if (updates.isDefault) {
      runAndSave('UPDATE providers SET is_default = 0')
    }

    const fields: string[] = []
    const values: any[] = []

    if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type) }
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
    if (updates.baseUrl !== undefined) { fields.push('base_url = ?'); values.push(updates.baseUrl || null) }
    if (updates.defaultModel !== undefined) { fields.push('default_model = ?'); values.push(updates.defaultModel) }
    if (updates.isDefault !== undefined) { fields.push('is_default = ?'); values.push(updates.isDefault ? 1 : 0) }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    runAndSave(`UPDATE providers SET ${fields.join(', ')} WHERE id = ?`, values)

    return this.get(id)
  },

  delete(id: string): void {
    const provider = this.get(id)
    runAndSave('DELETE FROM providers WHERE id = ?', [id])

    // If deleted provider was default, make another one default
    if (provider?.is_default) {
      const firstResult = db.exec('SELECT id FROM providers LIMIT 1')
      if (firstResult.length && firstResult[0].values.length) {
        const firstId = firstResult[0].values[0][0] as string
        runAndSave('UPDATE providers SET is_default = 1 WHERE id = ?', [firstId])
      }
    }
  },

  getDefault(): ProviderRow | null {
    const result = db.exec('SELECT * FROM providers WHERE is_default = 1')
    if (!result.length || !result[0].values.length) return null
    return resultToObjects(result[0])[0] as ProviderRow
  },
}

// Conversation operations
export const conversationDb = {
  list(): ConversationRow[] {
    const result = db.exec('SELECT * FROM conversations ORDER BY updated_at DESC')
    if (!result.length) return []
    return resultToObjects(result[0]) as ConversationRow[]
  },

  get(id: string): ConversationRow | null {
    const result = db.exec('SELECT * FROM conversations WHERE id = ?', [id])
    if (!result.length || !result[0].values.length) return null
    return resultToObjects(result[0])[0] as ConversationRow
  },

  getWithMessages(id: string): (ConversationRow & { messages: MessageRow[] }) | null {
    const conversation = this.get(id)
    if (!conversation) return null

    const messagesResult = db.exec('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [id])
    const messages = messagesResult.length ? resultToObjects(messagesResult[0]) as MessageRow[] : []
    return { ...conversation, messages }
  },

  create(conv: ConversationInput): ConversationRow {
    const now = Date.now()
    const id = uuid()

    runAndSave(`
      INSERT INTO conversations (id, title, workspace_id, model, provider_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, conv.title, conv.workspaceId || null, conv.model, conv.providerId, now, now])

    return this.get(id)!
  },

  updateTitle(id: string, title: string): void {
    const now = Date.now()
    runAndSave('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, now, id])
  },

  touch(id: string): void {
    const now = Date.now()
    runAndSave('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, id])
  },

  delete(id: string): void {
    runAndSave('DELETE FROM messages WHERE conversation_id = ?', [id])
    runAndSave('DELETE FROM conversations WHERE id = ?', [id])
  },
}

// Message operations
export const messageDb = {
  add(conversationId: string, message: MessageInput): MessageRow {
    const now = Date.now()
    const id = uuid()

    runAndSave(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, conversationId, message.role, message.content, now])

    // Update conversation timestamp
    conversationDb.touch(conversationId)

    const result = db.exec('SELECT * FROM messages WHERE id = ?', [id])
    return resultToObjects(result[0])[0] as MessageRow
  },

  getByConversation(conversationId: string): MessageRow[] {
    const result = db.exec('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId])
    if (!result.length) return []
    return resultToObjects(result[0]) as MessageRow[]
  },
}

// Helper to convert sql.js result to array of objects
function resultToObjects(result: { columns: string[], values: any[][] }): Record<string, any>[] {
  return result.values.map(row => {
    const obj: Record<string, any> = {}
    result.columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj
  })
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
