import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'

// Dynamic import for Transformers.js (ESM module)
let pipeline: any = null
let transcriber: any = null
let isLoading = false
let loadError: string | null = null

// Model cache directory
const MODELS_DIR = path.join(app.getPath('userData'), 'models')

// Available Whisper models (smallest to largest)
export const WHISPER_MODELS = [
  { id: 'Xenova/whisper-tiny', name: 'Tiny (39M)', size: '39MB', speed: 'fastest' },
  { id: 'Xenova/whisper-base', name: 'Base (74M)', size: '74MB', speed: 'fast' },
  { id: 'Xenova/whisper-small', name: 'Small (244M)', size: '244MB', speed: 'medium' },
  { id: 'Xenova/whisper-medium', name: 'Medium (769M)', size: '769MB', speed: 'slow' },
] as const

export type WhisperModelId = typeof WHISPER_MODELS[number]['id']

// Current settings
let currentModelId: WhisperModelId = 'Xenova/whisper-small'
let currentLanguage = 'en'

interface TranscriptionResult {
  text: string
  language?: string
  duration?: number
}

interface TranscriptionProgress {
  status: 'loading' | 'transcribing' | 'done'
  progress?: number
  message?: string
}

/**
 * Initialize the Whisper pipeline
 */
async function initializePipeline(
  modelId: WhisperModelId = currentModelId,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<void> {
  if (transcriber && currentModelId === modelId) {
    return // Already loaded
  }

  if (isLoading) {
    throw new Error('Model is already loading')
  }

  isLoading = true
  loadError = null

  try {
    onProgress?.({ status: 'loading', message: 'Loading Whisper model...' })

    // Ensure models directory exists
    await fs.mkdir(MODELS_DIR, { recursive: true })

    // Dynamic import of Transformers.js
    if (!pipeline) {
      const transformers = await import('@xenova/transformers')
      pipeline = transformers.pipeline

      // Configure cache directory
      transformers.env.cacheDir = MODELS_DIR
      transformers.env.allowLocalModels = true
    }

    // Create the automatic speech recognition pipeline
    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      quantized: true, // Use quantized model for faster loading
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          onProgress?.({
            status: 'loading',
            progress: progress.progress,
            message: `Downloading model: ${Math.round(progress.progress)}%`,
          })
        }
      },
    })

    currentModelId = modelId
    console.log(`Whisper model loaded: ${modelId}`)
  } catch (error: any) {
    loadError = error.message
    console.error('Failed to load Whisper model:', error)
    throw error
  } finally {
    isLoading = false
  }
}

/**
 * Transcribe audio data to text
 */
export async function transcribeAudio(
  audioData: Float32Array | ArrayBuffer,
  options?: {
    language?: string
    onProgress?: (progress: TranscriptionProgress) => void
  }
): Promise<TranscriptionResult> {
  const { language = currentLanguage, onProgress } = options || {}

  // Ensure model is loaded
  if (!transcriber) {
    await initializePipeline(currentModelId, onProgress)
  }

  onProgress?.({ status: 'transcribing', message: 'Transcribing audio...' })

  try {
    // Convert ArrayBuffer to Float32Array if needed
    let audio: Float32Array
    if (audioData instanceof ArrayBuffer) {
      audio = new Float32Array(audioData)
    } else {
      audio = audioData
    }

    // Run transcription
    const result = await transcriber(audio, {
      language,
      task: 'transcribe',
      return_timestamps: false,
    })

    onProgress?.({ status: 'done', message: 'Transcription complete' })

    return {
      text: result.text.trim(),
      language,
    }
  } catch (error: any) {
    console.error('Transcription error:', error)
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

/**
 * Get current model status
 */
export function getModelStatus(): {
  isLoaded: boolean
  isLoading: boolean
  currentModel: WhisperModelId
  error: string | null
} {
  return {
    isLoaded: !!transcriber,
    isLoading,
    currentModel: currentModelId,
    error: loadError,
  }
}

/**
 * Set the Whisper model to use
 */
export async function setModel(
  modelId: WhisperModelId,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<void> {
  if (modelId === currentModelId && transcriber) {
    return // Already using this model
  }

  // Clear current transcriber to load new model
  transcriber = null
  await initializePipeline(modelId, onProgress)
}

/**
 * Set the transcription language
 */
export function setLanguage(language: string): void {
  currentLanguage = language
}

/**
 * Get available models
 */
export function getAvailableModels() {
  return WHISPER_MODELS
}

/**
 * Preload the model (called at startup if desired)
 */
export async function preloadModel(
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<void> {
  if (!transcriber && !isLoading) {
    await initializePipeline(currentModelId, onProgress)
  }
}

/**
 * Check if a model is downloaded
 */
export async function isModelDownloaded(modelId: WhisperModelId): Promise<boolean> {
  try {
    const modelDir = path.join(MODELS_DIR, modelId.replace('/', '--'))
    await fs.access(modelDir)
    return true
  } catch {
    return false
  }
}
