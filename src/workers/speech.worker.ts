/**
 * Speech recognition Web Worker
 * Runs transformers.js in browser context where WASM works natively
 * This enables cross-platform speech recognition including Windows ARM64
 */

// Dynamic import of transformers.js to avoid bundling issues
// The library will be loaded from CDN at runtime
let pipeline: any = null
let env: any = null
let transformersLoaded = false
let transformersError: string | null = null

async function loadTransformers() {
  if (transformersLoaded) return
  if (transformersError) throw new Error(transformersError)

  try {
    console.log('[SpeechWorker] Loading transformers.js from CDN...')
    // Use dynamic import from CDN to avoid Vite bundling issues
    const transformers = await import(
      /* @vite-ignore */
      'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
    )
    pipeline = transformers.pipeline
    env = transformers.env

    // Configure for browser environment
    env.allowLocalModels = false
    env.allowRemoteModels = true

    transformersLoaded = true
    console.log('[SpeechWorker] Transformers.js loaded successfully')
  } catch (error: any) {
    console.error('[SpeechWorker] Failed to load transformers.js:', error)
    transformersError = `Failed to load transformers.js: ${error.message}`
    throw new Error(transformersError)
  }
}

// Types
interface TranscriptionProgress {
  status: 'loading' | 'transcribing' | 'done' | 'error'
  progress?: number
  message?: string
}

interface WorkerMessage {
  type: 'init' | 'transcribe' | 'setModel' | 'getStatus'
  id: string
  payload?: any
}

interface WorkerResponse {
  type: 'progress' | 'result' | 'error' | 'status'
  id: string
  payload: any
}

// State
let transcriber: any = null
let currentModelId = 'Xenova/whisper-tiny'
let isLoading = false
let loadError: string | null = null

// Post message helper
function postResponse(response: WorkerResponse) {
  self.postMessage(response)
}

function postProgress(id: string, progress: TranscriptionProgress) {
  postResponse({ type: 'progress', id, payload: progress })
}

/**
 * Initialize the Whisper pipeline
 */
async function initializePipeline(modelId: string, messageId: string): Promise<void> {
  if (transcriber && currentModelId === modelId) {
    return // Already loaded
  }

  if (isLoading) {
    throw new Error('Model is already loading')
  }

  isLoading = true
  loadError = null

  try {
    postProgress(messageId, { status: 'loading', message: 'Loading transformers.js library...' })

    // First ensure transformers.js is loaded from CDN
    await loadTransformers()

    postProgress(messageId, { status: 'loading', message: 'Initializing speech recognition...' })

    console.log('[SpeechWorker] Loading model:', modelId)

    // Create the automatic speech recognition pipeline
    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      quantized: true,
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          const percent = Math.round(progress.progress || 0)
          postProgress(messageId, {
            status: 'loading',
            progress: percent,
            message: `Downloading model: ${percent}%`,
          })
        } else if (progress.status === 'initiate') {
          postProgress(messageId, {
            status: 'loading',
            message: `Initializing: ${progress.name || 'model'}...`,
          })
        } else if (progress.status === 'download') {
          postProgress(messageId, {
            status: 'loading',
            message: `Downloading: ${progress.name || 'files'}...`,
          })
        } else if (progress.status === 'done') {
          console.log('[SpeechWorker] Model component loaded:', progress.name)
        }
      },
    })

    currentModelId = modelId
    loadError = null
    console.log('[SpeechWorker] Model loaded successfully:', modelId)
  } catch (error: any) {
    loadError = error.message
    console.error('[SpeechWorker] Failed to load model:', error)
    throw error
  } finally {
    isLoading = false
  }
}

/**
 * Transcribe audio data
 */
async function transcribe(
  audioData: Float32Array,
  options: { language?: string; modelId?: string },
  messageId: string
): Promise<{ text: string; language?: string }> {
  const { language = 'en', modelId = currentModelId } = options

  // Ensure model is loaded
  if (!transcriber || currentModelId !== modelId) {
    await initializePipeline(modelId, messageId)
  }

  postProgress(messageId, { status: 'transcribing', message: 'Transcribing audio...' })

  try {
    console.log('[SpeechWorker] Starting transcription, audio length:', audioData.length)

    // Run transcription
    const result = await transcriber(audioData, {
      language,
      task: 'transcribe',
      return_timestamps: false,
    })

    console.log('[SpeechWorker] Transcription result:', result)

    postProgress(messageId, { status: 'done', message: 'Transcription complete' })

    return {
      text: result.text?.trim() || '',
      language,
    }
  } catch (error: any) {
    console.error('[SpeechWorker] Transcription error:', error)
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

/**
 * Handle incoming messages
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = event.data

  try {
    switch (type) {
      case 'init': {
        await initializePipeline(payload?.modelId || currentModelId, id)
        postResponse({ type: 'result', id, payload: { success: true } })
        break
      }

      case 'transcribe': {
        const result = await transcribe(payload.audioData, payload.options || {}, id)
        postResponse({ type: 'result', id, payload: { success: true, result } })
        break
      }

      case 'setModel': {
        currentModelId = payload.modelId
        // Don't load yet, will load on next transcribe
        transcriber = null
        postResponse({ type: 'result', id, payload: { success: true } })
        break
      }

      case 'getStatus': {
        postResponse({
          type: 'status',
          id,
          payload: {
            isLoaded: !!transcriber,
            isLoading,
            currentModel: currentModelId,
            error: loadError,
          },
        })
        break
      }

      default:
        throw new Error(`Unknown message type: ${type}`)
    }
  } catch (error: any) {
    console.error('[SpeechWorker] Error:', error)
    postResponse({
      type: 'error',
      id,
      payload: { message: error.message },
    })
  }
}

// Signal that worker is ready
console.log('[SpeechWorker] Worker initialized')
