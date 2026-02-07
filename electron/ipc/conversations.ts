import { ipcMain } from 'electron'
import { conversationDb, messageDb, artifactDb, workspaceDb } from '../services/database'

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
    segments: row.segments,
    toolCalls: row.tool_calls,
    toolResults: row.tool_results,
    attachments: row.attachments,
    usage: row.usage,
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
      segments: messageInput.segments,
      toolCalls: messageInput.toolCalls,
      toolResults: messageInput.toolResults,
      attachments: messageInput.attachments,
      usage: messageInput.usage,
    })
    return toMessageApi(message)
  })

  // Delete a message from a conversation
  ipcMain.handle('conversations:deleteMessage', async (_, messageId: string) => {
    return { success: messageDb.delete(messageId) }
  })

  // Update a message (for adding tool calls/results)
  ipcMain.handle('conversations:updateMessage', async (_, messageId: string, updates: any) => {
    const message = messageDb.update(messageId, {
      content: updates.content,
      segments: updates.segments,
      toolCalls: updates.toolCalls,
      toolResults: updates.toolResults,
      attachments: updates.attachments,
      usage: updates.usage,
    })
    return message ? toMessageApi(message) : null
  })

  // Update conversation title
  ipcMain.handle('conversations:updateTitle', async (_, id: string, title: string) => {
    conversationDb.updateTitle(id, title)
    const conversation = conversationDb.get(id)
    return conversation ? toConversationApi(conversation) : null
  })

  // Update conversation workspace (without transferring files)
  ipcMain.handle('conversations:updateWorkspaceId', async (_, id: string, workspaceId: string | null) => {
    conversationDb.updateWorkspaceId(id, workspaceId)
    const conversation = conversationDb.get(id)
    return conversation ? toConversationApi(conversation) : null
  })

  // Transfer conversation to new workspace (moves artifact files)
  ipcMain.handle('conversations:transferToWorkspace', async (_, id: string, workspaceId: string | null) => {
    // Get the workspace path if workspaceId provided
    let workspacePath: string | null = null
    if (workspaceId) {
      const workspace = workspaceDb.get(workspaceId)
      if (!workspace) {
        return { success: false, error: 'Workspace not found' }
      }
      workspacePath = workspace.path
    }

    // Transfer artifact files
    const result = artifactDb.transferToWorkspace(id, workspacePath)

    // Update conversation workspace_id
    conversationDb.updateWorkspaceId(id, workspaceId)

    const conversation = conversationDb.get(id)
    return {
      success: result.failed === 0,
      transferred: result.transferred,
      failed: result.failed,
      errors: result.errors,
      conversation: conversation ? toConversationApi(conversation) : null
    }
  })

  // Get artifact count for a conversation (for transfer confirmation)
  ipcMain.handle('conversations:getArtifactCount', async (_, id: string) => {
    const artifacts = artifactDb.getByConversation(id)
    return artifacts.length
  })

  // Delete a conversation
  ipcMain.handle('conversations:delete', async (_, id: string) => {
    conversationDb.delete(id)
  })
}
