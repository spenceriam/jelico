/**
 * Speech recognition client for the renderer process
 * Uses a Web Worker to run transformers.js with WASM backend
 * This enables cross-platform speech recognition including Windows ARM64
 */

export interface TranscriptionProgress {
  status: 'loading' | 'transcribing' | 'done' | 'error'
  progress?: number
  message?: string
}

export interface TranscriptionResult {
  text: string
  language?: string
}

export interface SpeechModelStatus {
  isLoaded: boolean
  isLoading: boolean
  currentModel: string
  error: string | null
}

type ProgressCallback = (progress: TranscriptionProgress) => void

interface PendingRequest {
  resolve: (value: any) => void
  reject: (error: Error) => void
  onProgress?: ProgressCallback
}

class SpeechClient {
  private worker: Worker | null = null
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private messageId = 0
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the speech worker
   */
  private async ensureWorker(): Promise<Worker> {
    if (this.worker) {
      return this.worker
    }

    if (this.initPromise) {
      await this.initPromise
      return this.worker!
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Create worker using Vite's worker import syntax
        this.worker = new Worker(
          new URL('../workers/speech.worker.ts', import.meta.url),
          { type: 'module' }
        )

        this.worker.onmessage = (event) => {
          this.handleWorkerMessage(event.data)
        }

        this.worker.onerror = (error) => {
          console.error('[SpeechClient] Worker error:', error)
          // Reject all pending requests
          this.pendingRequests.forEach((request) => {
            request.reject(new Error(`Worker error: ${error.message}`))
          })
          this.pendingRequests.clear()
        }

        console.log('[SpeechClient] Worker created')
        resolve()
      } catch (error: any) {
        console.error('[SpeechClient] Failed to create worker:', error)
        reject(error)
      }
    })

    await this.initPromise
    return this.worker!
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(data: any) {
    const { type, id, payload } = data
    const request = this.pendingRequests.get(id)

    if (!request) {
      console.warn('[SpeechClient] No pending request for message:', id)
      return
    }

    switch (type) {
      case 'progress':
        request.onProgress?.(payload)
        break

      case 'result':
        this.pendingRequests.delete(id)
        request.resolve(payload)
        break

      case 'status':
        this.pendingRequests.delete(id)
        request.resolve(payload)
        break

      case 'error':
        this.pendingRequests.delete(id)
        request.reject(new Error(payload.message))
        break
    }
  }

  /**
   * Send a message to the worker and wait for response
   */
  private async sendMessage(
    type: string,
    payload?: any,
    onProgress?: ProgressCallback
  ): Promise<any> {
    const worker = await this.ensureWorker()
    const id = `msg-${++this.messageId}`

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onProgress })
      worker.postMessage({ type, id, payload })
    })
  }

  /**
   * Initialize/preload the speech model
   */
  async init(
    modelId?: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean }> {
    return this.sendMessage('init', { modelId }, onProgress)
  }

  /**
   * Transcribe audio data to text
   */
  async transcribe(
    audioData: Float32Array,
    options?: {
      language?: string
      modelId?: string
      onProgress?: ProgressCallback
    }
  ): Promise<{ success: boolean; result?: TranscriptionResult; error?: string }> {
    const { onProgress, ...transcribeOptions } = options || {}

    try {
      const result = await this.sendMessage(
        'transcribe',
        { audioData, options: transcribeOptions },
        onProgress
      )
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Set the model to use (doesn't load immediately)
   */
  async setModel(modelId: string): Promise<{ success: boolean }> {
    return this.sendMessage('setModel', { modelId })
  }

  /**
   * Get current model status
   */
  async getStatus(): Promise<SpeechModelStatus> {
    return this.sendMessage('getStatus')
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.initPromise = null
      this.pendingRequests.clear()
      console.log('[SpeechClient] Worker terminated')
    }
  }
}

// Export singleton instance
export const speechClient = new SpeechClient()

// Available Whisper models (same as backend)
export const WHISPER_MODELS = [
  { id: 'Xenova/whisper-tiny', name: 'Tiny (39M)', size: '39MB', speed: 'fastest' },
  { id: 'Xenova/whisper-base', name: 'Base (74M)', size: '74MB', speed: 'fast' },
  { id: 'Xenova/whisper-small', name: 'Small (244M)', size: '244MB', speed: 'medium' },
  { id: 'Xenova/whisper-medium', name: 'Medium (769M)', size: '769MB', speed: 'slow' },
] as const

export type WhisperModelId = typeof WHISPER_MODELS[number]['id']
