import { ipcMain } from 'electron'
import { todoDb } from '../services/database.js'

export function registerTodoHandlers() {
  // Get todos for a conversation
  ipcMain.handle('todos:getByConversation', async (_, conversationId: string) => {
    return todoDb.getByConversation(conversationId)
  })

  // Replace all todos for a conversation
  ipcMain.handle('todos:replaceAll', async (_, conversationId: string, todos: Array<{
    id: string
    text: string
    status: 'pending' | 'in_progress' | 'done' | 'failed' | 'cancelled'
    created_at?: number
    updated_at?: number
  }>) => {
    todoDb.replaceAllForConversation(conversationId, todos)
    return { success: true }
  })

  // Update a single todo
  ipcMain.handle('todos:update', async (_, conversationId: string, todoId: string, updates: {
    text?: string
    status?: 'pending' | 'in_progress' | 'done' | 'failed' | 'cancelled'
  }) => {
    const result = todoDb.updateTodo(conversationId, todoId, updates)
    return { success: !!result, todo: result }
  })

  // Delete all todos for a conversation
  ipcMain.handle('todos:deleteByConversation', async (_, conversationId: string) => {
    todoDb.deleteByConversation(conversationId)
    return { success: true }
  })

  // Migrate todos from localStorage (one-time)
  ipcMain.handle('todos:migrateFromLocalStorage', async () => {
    todoDb.migrateFromLocalStorage()
    return { success: true }
  })
}
