import { ipcMain } from 'electron'
import { conversationDb, messageDb } from '../services/database'

// Convert database row to API format
function toConversationApi(row: any) {
  return {
    id: row.id,
    title: row.title,
    workspaceId: row.workspace_id,
    model: row.model,
    providerId: row.provider_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: row.messages?.map(toMessageApi),
  }
}

function toMessageApi(row: any) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

export function registerConversationHandlers() {
  // List all conversations
  ipcMain.handle('conversations:list', async () => {
    const conversations = conversationDb.list()
    return conversations.map(toConversationApi)
  })

  // Get a single conversation with messages
  ipcMain.handle('conversations:get', async (_, id: string) => {
    const conversation = conversationDb.getWithMessages(id)
    return conversation ? toConversationApi(conversation) : null
  })

  // Create a new conversation
  ipcMain.handle('conversations:create', async (_, input: any) => {
    const conversation = conversationDb.create({
      title: input.title,
      model: input.model,
      providerId: input.providerId,
      workspaceId: input.workspaceId,
    })
    return toConversationApi(conversation)
  })

  // Add a message to a conversation
  ipcMain.handle('conversations:addMessage', async (_, convId: string, messageInput: any) => {
    const message = messageDb.add(convId, {
      role: messageInput.role,
      content: messageInput.content,
    })
    return toMessageApi(message)
  })

  // Update conversation title
  ipcMain.handle('conversations:updateTitle', async (_, id: string, title: string) => {
    conversationDb.updateTitle(id, title)
    const conversation = conversationDb.get(id)
    return conversation ? toConversationApi(conversation) : null
  })

  // Delete a conversation
  ipcMain.handle('conversations:delete', async (_, id: string) => {
    conversationDb.delete(id)
  })
}
