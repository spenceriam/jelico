import { ipcMain, BrowserWindow } from 'electron'
import {
  transcribeAudio,
  getModelStatus,
  setModel,
  setLanguage,
  getAvailableModels,
  preloadModel,
  isModelDownloaded,
  type WhisperModelId,
} from '../services/speech'

export function registerSpeechHandlers() {
  // Get available Whisper models
  ipcMain.handle('speech:getModels', () => {
    return getAvailableModels()
  })

  // Get current model status
  ipcMain.handle('speech:getStatus', () => {
    return getModelStatus()
  })

  // Set the model to use
  ipcMain.handle('speech:setModel', async (event, modelId: WhisperModelId) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    await setModel(modelId, (progress) => {
      window?.webContents.send('speech:progress', progress)
    })

    return { success: true }
  })

  // Set transcription language
  ipcMain.handle('speech:setLanguage', (_, language: string) => {
    setLanguage(language)
    return { success: true }
  })

  // Check if model is downloaded
  ipcMain.handle('speech:isModelDownloaded', async (_, modelId: WhisperModelId) => {
    return isModelDownloaded(modelId)
  })

  // Preload the model
  ipcMain.handle('speech:preload', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    try {
      await preloadModel((progress) => {
        window?.webContents.send('speech:progress', progress)
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Transcribe audio
  ipcMain.handle(
    'speech:transcribe',
    async (event, audioData: ArrayBuffer, options?: { language?: string }) => {
      const window = BrowserWindow.fromWebContents(event.sender)

      try {
        const result = await transcribeAudio(audioData, {
          language: options?.language,
          onProgress: (progress) => {
            window?.webContents.send('speech:progress', progress)
          },
        })

        return { success: true, result }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )
}
