/**
 * Compaction IPC Handlers
 *
 * Exposes compaction functionality to the renderer process
 */

import { ipcMain, BrowserWindow } from 'electron'
import {
  compactConversation,
  shouldCompact,
  getCompactionStatus,
  COMPACTION_THRESHOLDS,
} from '../services/compaction'
import { conversationDb, messageDb } from '../services/database'

export function registerCompactionHandlers() {
  // Get compaction thresholds
  ipcMain.handle('compaction:getThresholds', () => {
    return COMPACTION_THRESHOLDS
  })

  // Check if compaction is needed
  ipcMain.handle('compaction:shouldCompact', (_, currentTokens: number, maxTokens: number) => {
    return shouldCompact(currentTokens, maxTokens)
  })

  // Get compaction status
  ipcMain.handle('compaction:getStatus', (_, currentTokens: number, maxTokens: number) => {
    return getCompactionStatus(currentTokens, maxTokens)
  })

  // Perform compaction
  ipcMain.handle('compaction:compact', async (event, params: {
    conversationId: string
    providerId: string
    model: string
    customInstructions?: string
    forceCompact?: boolean
  }) => {
    try {
      // Get conversation messages
      const conversation = conversationDb.getWithMessages(params.conversationId)
      if (!conversation) {
        return { success: false, error: 'Conversation not found' }
      }

      // Convert database messages to compaction format
      // Note: Tool calls/results are intentionally NOT included - compaction summarizes
      // the conversation to save tokens, and tool details are verbose
      const messages = (conversation.messages || []).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content,
        createdAt: m.created_at,
      }))

      if (messages.length < 4) {
        return { success: false, error: 'Not enough messages to compact' }
      }

      // Send progress update
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) {
        window.webContents.send('compaction:progress', {
          status: 'compacting',
          message: 'Analyzing conversation...',
        })
      }

      // Perform compaction
      const result = await compactConversation(
        messages,
        params.providerId,
        params.model,
        {
          forceCompact: params.forceCompact,
          customInstructions: params.customInstructions,
        }
      )

      if (!result.success) {
        return result
      }

      // Update progress
      if (window) {
        window.webContents.send('compaction:progress', {
          status: 'saving',
          message: 'Saving compacted context...',
        })
      }

      // Build new message history (must use snake_case for database)
      const newMessages: any[] = []

      // Add summary as system message
      if (result.summary) {
        newMessages.push({
          id: `compaction-summary-${Date.now()}`,
          conversation_id: params.conversationId,
          role: 'system',
          content: `## Session Context (Compacted)\n\nThe following is a summary of the previous conversation:\n\n${result.summary}`,
          created_at: Date.now(),
        })
      }

      // Add retained messages (convert from compaction format to DB format)
      // Note: Tool calls are NOT preserved through compaction - they're summarized in the text
      if (result.retainedMessages) {
        newMessages.push(...result.retainedMessages.map(m => ({
          id: m.id,
          conversation_id: params.conversationId,
          role: m.role,
          content: m.content,
          created_at: m.createdAt,
        })))
      }

      // Update conversation in database with new messages
      // Note: This replaces the message history with the compacted version
      conversationDb.updateMessages(params.conversationId, newMessages)

      // Final progress
      if (window) {
        window.webContents.send('compaction:progress', {
          status: 'complete',
          message: 'Compaction complete',
          tokensBefore: result.tokensBefore,
          tokensAfter: result.tokensAfter,
        })
      }

      return {
        success: true,
        tokensBefore: result.tokensBefore,
        tokensAfter: result.tokensAfter,
        messagesBefore: messages.length,
        messagesAfter: newMessages.length,
      }
    } catch (error: any) {
      console.error('[Compaction IPC] Error:', error)
      return {
        success: false,
        error: error.message || 'Compaction failed',
      }
    }
  })

  // Manual compact command (like /compact)
  ipcMain.handle('compaction:manualCompact', async (event, params: {
    conversationId: string
    providerId: string
    model: string
    focus?: string // Optional focus for what to preserve
  }) => {
    // Reuse the compact handler logic
    const compactParams = {
      ...params,
      customInstructions: params.focus,
      forceCompact: true,
    }

    // Get conversation messages
    const conversation = conversationDb.getWithMessages(params.conversationId)
    if (!conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    // Convert to compaction format - tool calls NOT included, they're summarized in text
    const messages = (conversation.messages || []).map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
      createdAt: m.created_at,
    }))

    if (messages.length < 2) {
      return { success: false, error: 'Not enough messages to compact' }
    }

    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.webContents.send('compaction:progress', {
        status: 'compacting',
        message: 'Compacting conversation...',
      })
    }

    const result = await compactConversation(
      messages,
      params.providerId,
      params.model,
      {
        forceCompact: true,
        customInstructions: params.focus,
      }
    )

    if (!result.success) {
      return result
    }

    // Build new message history
    const newMessages: any[] = []

    if (result.summary) {
      newMessages.push({
        id: `compaction-summary-${Date.now()}`,
        conversation_id: params.conversationId,
        role: 'system',
        content: `## Session Context (Compacted)\n\nThe following is a summary of the previous conversation:\n\n${result.summary}`,
        created_at: Date.now(),
      })
    }

    if (result.retainedMessages) {
      newMessages.push(...result.retainedMessages.map(m => ({
        id: m.id,
        conversation_id: params.conversationId,
        role: m.role,
        content: m.content,
        created_at: m.createdAt,
      })))
    }

    conversationDb.updateMessages(params.conversationId, newMessages)

    if (window) {
      window.webContents.send('compaction:progress', {
        status: 'complete',
        message: 'Compaction complete',
        tokensBefore: result.tokensBefore,
        tokensAfter: result.tokensAfter,
      })
    }

    return {
      success: true,
      tokensBefore: result.tokensBefore,
      tokensAfter: result.tokensAfter,
      messagesBefore: messages.length,
      messagesAfter: newMessages.length,
    }
  })
}
