import { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, Check, Download, Loader2, Volume2, MessageSquare, Play, Square } from 'lucide-react'
import {
  speechClient,
  WHISPER_MODELS,
  type SpeechModelStatus,
  type TranscriptionProgress,
} from '../../lib/speechClient'

type ModelStatus = SpeechModelStatus

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
]

export function MicrophoneSettings() {
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('Xenova/whisper-tiny')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<string>('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')

  // Microphone test state (audio playback only)
  const [isMicTesting, setIsMicTesting] = useState(false)
  const [micTestStatus, setMicTestStatus] = useState<string>('')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  // Transcription test state
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionResult, setTranscriptionResult] = useState<{
    text: string
    duration: number
    audioLength: number
  } | null>(null)
  const [transcriptionError, setTranscriptionError] = useState<string>('')

  // Track which models have been loaded (cached in browser's IndexedDB by transformers.js)
  const [loadedModels, setLoadedModels] = useState<Set<string>>(new Set())

  // Load status on mount
  useEffect(() => {
    async function loadStatus() {
      try {
        const statusData = await speechClient.getStatus()
        setStatus(statusData)
        setSelectedModel(statusData.currentModel || 'Xenova/whisper-tiny')
        if (statusData.isLoaded) {
          setLoadedModels(new Set([statusData.currentModel]))
        }
      } catch (error) {
        console.error('Failed to load speech status:', error)
      }
    }
    loadStatus()
  }, [])

  // Load audio devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => stream.getTracks().forEach(track => track.stop()))
          .catch(() => {}) // Ignore if permission denied

        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(d => d.kind === 'audioinput')
        setAudioDevices(audioInputs)
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId)
        }
      } catch (error) {
        console.error('Failed to enumerate audio devices:', error)
      }
    }
    loadDevices()
  }, [])

  const handleProgressUpdate = useCallback((progress: TranscriptionProgress) => {
    if (progress.status === 'loading') {
      setDownloadProgress(progress.message || 'Loading...')
    }
  }, [])

  const handleModelSelect = useCallback(async (modelId: string) => {
    setSelectedModel(modelId)
    await speechClient.setModel(modelId)
  }, [])

  const handleDownloadModel = useCallback(async (modelId: string) => {
    setIsDownloading(true)
    setDownloadProgress('Initializing...')
    try {
      // Initialize the model (this triggers download if not cached)
      await speechClient.init(modelId, handleProgressUpdate)
      setLoadedModels(prev => new Set([...prev, modelId]))
      const newStatus = await speechClient.getStatus()
      setStatus(newStatus)
      setSelectedModel(modelId)
    } catch (error: any) {
      console.error('Failed to download model:', error)
      setStatus(prev => prev ? { ...prev, error: error.message } : null)
    } finally {
      setIsDownloading(false)
      setDownloadProgress('')
    }
  }, [handleProgressUpdate])

  const handleLanguageChange = useCallback((language: string) => {
    setSelectedLanguage(language)
    // Language is passed at transcription time, no need to persist
  }, [])

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.src = ''
        audioElementRef.current = null
      }
    }
  }, [])

  /**
   * Test Microphone - Records audio and plays it back (no transcription)
   */
  const handleTestMicrophone = useCallback(async () => {
    // Stop any playing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }
    setRecordedBlob(null)
    setIsPlaying(false)
    setIsMicTesting(true)
    setMicTestStatus('Requesting microphone access...')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
      })

      setMicTestStatus('Recording... speak now (3 seconds)')

      // Find supported mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ]
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm'
      console.log('[MicTest] Using mimeType:', mimeType)

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        console.log('[MicTest] Data available, size:', e.data.size)
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onerror = (e) => {
        console.error('[MicTest] MediaRecorder error:', e)
        setMicTestStatus('Recording error occurred')
        setIsMicTesting(false)
      }

      mediaRecorder.onstop = () => {
        console.log('[MicTest] Recording stopped, chunks:', chunks.length)
        stream.getTracks().forEach(track => track.stop())

        if (chunks.length === 0) {
          setMicTestStatus('No audio data captured. Check microphone permissions.')
          setIsMicTesting(false)
          return
        }

        const blob = new Blob(chunks, { type: mimeType })
        console.log('[MicTest] Created blob, size:', blob.size, 'type:', blob.type)

        if (blob.size === 0) {
          setMicTestStatus('Recording was empty. Try speaking louder.')
          setIsMicTesting(false)
          return
        }

        setRecordedBlob(blob)
        setMicTestStatus(`Recording complete (${(blob.size / 1024).toFixed(1)} KB). Click play to listen.`)
        setIsMicTesting(false)
      }

      // Start recording with timeslice to ensure ondataavailable fires
      mediaRecorder.start(500) // Collect data every 500ms
      console.log('[MicTest] Recording started')

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('[MicTest] Stopping recording')
          mediaRecorder.stop()
        }
      }, 3000)
    } catch (error: any) {
      console.error('[MicrophoneSettings] Mic test error:', error)
      setMicTestStatus(`Error: ${error.message}`)
      setIsMicTesting(false)
    }
  }, [selectedDevice])

  /**
   * Play the recorded audio
   */
  const handlePlayRecording = useCallback(() => {
    if (!recordedBlob) return

    // Stop if already playing
    if (isPlaying && audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
      setIsPlaying(false)
      setMicTestStatus('Playback stopped.')
      return
    }

    // Create new audio element and play
    const url = URL.createObjectURL(recordedBlob)
    const audio = new Audio(url)
    audioElementRef.current = audio

    audio.onplay = () => {
      console.log('[MicTest] Playback started')
      setIsPlaying(true)
      setMicTestStatus('Playing...')
    }

    audio.onended = () => {
      console.log('[MicTest] Playback ended')
      URL.revokeObjectURL(url)
      setIsPlaying(false)
      setMicTestStatus('Playback complete. Your microphone is working!')
      audioElementRef.current = null
    }

    audio.onerror = (e) => {
      console.error('[MicTest] Playback error:', e)
      URL.revokeObjectURL(url)
      setIsPlaying(false)
      setMicTestStatus('Playback failed. The audio format may not be supported.')
      audioElementRef.current = null
    }

    audio.play().catch(err => {
      console.error('[MicTest] Play failed:', err)
      URL.revokeObjectURL(url)
      setIsPlaying(false)
      setMicTestStatus(`Playback error: ${err.message}`)
      audioElementRef.current = null
    })
  }, [recordedBlob, isPlaying])

  /**
   * Decode audio blob to Float32Array at 16kHz (required by Whisper)
   */
  const decodeAudio = useCallback(async (blob: Blob): Promise<Float32Array> => {
    const audioContext = new AudioContext({ sampleRate: 16000 })
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const channelData = audioBuffer.getChannelData(0)

    if (audioBuffer.sampleRate !== 16000) {
      const ratio = 16000 / audioBuffer.sampleRate
      const newLength = Math.round(channelData.length * ratio)
      const resampled = new Float32Array(newLength)

      for (let i = 0; i < newLength; i++) {
        const srcIndex = i / ratio
        const srcIndexFloor = Math.floor(srcIndex)
        const srcIndexCeil = Math.min(srcIndexFloor + 1, channelData.length - 1)
        const t = srcIndex - srcIndexFloor
        resampled[i] = channelData[srcIndexFloor] * (1 - t) + channelData[srcIndexCeil] * t
      }

      await audioContext.close()
      return resampled
    }

    await audioContext.close()
    return channelData
  }, [])

  /**
   * Test Transcription - Records audio and transcribes it with timing info
   */
  const handleTestTranscription = useCallback(async () => {
    setIsTranscribing(true)
    setTranscriptionResult(null)
    setTranscriptionError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
      })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())

        if (chunks.length === 0) {
          setTranscriptionError('No audio recorded')
          setIsTranscribing(false)
          return
        }

        try {
          const blob = new Blob(chunks, { type: mimeType })
          const audioData = await decodeAudio(blob)
          const audioLengthSeconds = audioData.length / 16000

          // Time the transcription
          const startTime = performance.now()

          const result = await speechClient.transcribe(audioData, {
            language: selectedLanguage,
            modelId: selectedModel,
          })

          const endTime = performance.now()
          const durationMs = endTime - startTime

          if (result.success && result.result?.text) {
            setTranscriptionResult({
              text: result.result.text,
              duration: durationMs,
              audioLength: audioLengthSeconds,
            })
            setLoadedModels(prev => new Set([...prev, selectedModel]))
          } else if (result.error) {
            setTranscriptionError(result.error)
          } else {
            setTranscriptionResult({
              text: '(No speech detected)',
              duration: durationMs,
              audioLength: audioLengthSeconds,
            })
          }
        } catch (error: any) {
          console.error('[MicrophoneSettings] Transcription error:', error)
          setTranscriptionError(error.message)
        }
        setIsTranscribing(false)
      }

      mediaRecorder.start()

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
        }
      }, 5000) // 5 seconds for transcription test
    } catch (error: any) {
      setTranscriptionError(`Microphone error: ${error.message}`)
      setIsTranscribing(false)
    }
  }, [selectedDevice, selectedLanguage, selectedModel, decodeAudio])

  // Check if any model is available for transcription testing
  const hasModelAvailable = loadedModels.size > 0

  return (
    <div className="space-y-8">
      {/* Microphone Device */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Microphone Device
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Input Device
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
            >
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestMicrophone}
              disabled={isMicTesting}
              className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {isMicTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              {isMicTesting ? 'Recording...' : 'Test Microphone'}
            </button>

            {recordedBlob && (
              <button
                onClick={handlePlayRecording}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isPlaying
                    ? 'bg-error/10 border border-error/30 text-error hover:bg-error/20'
                    : 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Square className="w-4 h-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Play Recording
                  </>
                )}
              </button>
            )}
          </div>

          <p className="text-xs text-text-muted">
            Records 3 seconds of audio for playback to verify your microphone is working.
          </p>

          {micTestStatus && (
            <div className="p-3 bg-bg-surface border border-border rounded-lg text-sm text-text-secondary">
              {micTestStatus}
            </div>
          )}

        </div>
      </section>

      {/* Whisper Model */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Speech Recognition Model
        </h3>

        <p className="text-sm text-text-muted mb-4">
          Whisper models run locally on your device for privacy. Larger models are more accurate but slower.
        </p>

        {isDownloading && (
          <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-lg text-sm text-accent">
            {downloadProgress}
          </div>
        )}

        {status?.error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
            <strong>Model Error:</strong> {status.error}
          </div>
        )}

        <div className="grid gap-2">
          {WHISPER_MODELS.map((model) => {
            const isCached = loadedModels.has(model.id)
            const isSelected = selectedModel === model.id
            const isActive = status?.currentModel === model.id && status?.isLoaded

            return (
              <div
                key={model.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-border-strong'
                }`}
                onClick={() => handleModelSelect(model.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                      {model.name}
                    </span>
                    {isActive && (
                      <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded">
                        Active
                      </span>
                    )}
                    {isCached && !isActive && (
                      <span className="px-2 py-0.5 bg-bg-elevated text-text-muted text-xs rounded">
                        Cached
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {model.size} • {model.speed}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isCached ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadModel(model.id)
                      }}
                      disabled={isDownloading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent text-black rounded-lg hover:bg-accent-bright transition-colors text-sm disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Test Transcription - Only shown if a model is available */}
      {hasModelAvailable && (
        <section>
          <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Test Transcription
          </h3>

          <p className="text-sm text-text-muted mb-4">
            Speak into your microphone for 5 seconds to test the speech recognition model.
            Say something like: "Testing speech to text recognition"
          </p>

          <div className="space-y-4">
            <button
              onClick={handleTestTranscription}
              disabled={isTranscribing || isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording & Transcribing...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Test Transcription
                </>
              )}
            </button>

            {transcriptionError && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
                {transcriptionError}
              </div>
            )}

            {transcriptionResult && (
              <div className="p-4 bg-bg-surface border border-border rounded-lg space-y-3">
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Transcription</div>
                  <div className="text-text-primary font-medium">
                    "{transcriptionResult.text}"
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-text-muted">Processing time: </span>
                    <span className="text-text-primary font-medium">
                      {(transcriptionResult.duration / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Audio length: </span>
                    <span className="text-text-primary font-medium">
                      {transcriptionResult.audioLength.toFixed(1)}s
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Speed: </span>
                    <span className="text-text-primary font-medium">
                      {(transcriptionResult.audioLength / (transcriptionResult.duration / 1000)).toFixed(1)}x realtime
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Language */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Transcription Language
        </h3>

        <select
          value={selectedLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </section>

      {/* Info */}
      <section className="p-4 bg-bg-surface border border-border rounded-lg">
        <p className="text-sm text-text-muted">
          <strong>Privacy Note:</strong> All speech recognition happens locally on your device.
          Audio is never sent to external servers. Models are downloaded once and cached for offline use.
        </p>
      </section>
    </div>
  )
}
