import { ipcMain } from 'electron'
import { queueDb } from '../services/database'

function toQueuedMessageApi(row: {
  id: string
  content: string
  attachments?: Array<{
    id: string
    type: 'image' | 'text' | 'document'
    name: string
    mimeType: string
    data: string
  }>
  provider_id: string
  model: string
  conversation_id: string | null
}) {
  return {
    id: row.id,
    content: row.content,
    attachments: row.attachments,
    providerId: row.provider_id,
    model: row.model,
    conversationId: row.conversation_id,
  }
}

export function registerQueueHandlers() {
  ipcMain.handle('queue:list', async () => {
    return queueDb.list().map(toQueuedMessageApi)
  })

  ipcMain.handle('queue:replaceAll', async (_, queuedMessages: Array<{
    id: string
    content: string
    attachments?: Array<{
      id: string
      type: 'image' | 'text' | 'document'
      name: string
      mimeType: string
      data: string
    }>
    providerId: string
    model: string
    conversationId?: string | null
  }>) => {
    queueDb.replaceAll(queuedMessages.map((queuedMessage) => ({
      id: queuedMessage.id,
      content: queuedMessage.content,
      attachments: queuedMessage.attachments,
      provider_id: queuedMessage.providerId,
      model: queuedMessage.model,
      conversation_id: queuedMessage.conversationId || null,
    })))

    return { success: true }
  })
}
