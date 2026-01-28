import { useState, useEffect, useCallback } from 'react'
import { Mic, Check, Download, Loader2, Volume2 } from 'lucide-react'

interface WhisperModel {
  id: string
  name: string
  size: string
  speed: string
}

interface ModelStatus {
  isLoaded: boolean
  isLoading: boolean
  currentModel: string
  error: string | null
}

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
  const [models, setModels] = useState<WhisperModel[]>([])
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en')
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<string>('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>('')

  // Load models and status
  useEffect(() => {
    async function loadData() {
      try {
        const [modelsData, statusData] = await Promise.all([
          window.jelico.speech.getModels(),
          window.jelico.speech.getStatus(),
        ])
        setModels(modelsData)
        setStatus(statusData)
        setSelectedModel(statusData.currentModel)

        // Check which models are downloaded
        const downloaded = new Set<string>()
        for (const model of modelsData) {
          const isDownloaded = await window.jelico.speech.isModelDownloaded(model.id)
          if (isDownloaded) {
            downloaded.add(model.id)
          }
        }
        setDownloadedModels(downloaded)
      } catch (error) {
        console.error('Failed to load speech settings:', error)
      }
    }
    loadData()
  }, [])

  // Load audio devices
  useEffect(() => {
    async function loadDevices() {
      try {
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

  // Listen for progress updates
  useEffect(() => {
    const unsubscribe = window.jelico.speech.onProgress((progress) => {
      if (progress.status === 'loading') {
        setDownloadProgress(progress.message || 'Loading...')
      }
    })
    return unsubscribe
  }, [])

  const handleModelSelect = useCallback(async (modelId: string) => {
    setSelectedModel(modelId)

    if (downloadedModels.has(modelId)) {
      // Model already downloaded, just switch to it
      setIsDownloading(true)
      setDownloadProgress('Switching model...')
      try {
        await window.jelico.speech.setModel(modelId)
        const newStatus = await window.jelico.speech.getStatus()
        setStatus(newStatus)
      } catch (error) {
        console.error('Failed to switch model:', error)
      } finally {
        setIsDownloading(false)
        setDownloadProgress('')
      }
    }
  }, [downloadedModels])

  const handleDownloadModel = useCallback(async (modelId: string) => {
    setIsDownloading(true)
    setDownloadProgress('Starting download...')
    try {
      await window.jelico.speech.setModel(modelId)
      setDownloadedModels(prev => new Set([...prev, modelId]))
      const newStatus = await window.jelico.speech.getStatus()
      setStatus(newStatus)
      setSelectedModel(modelId)
    } catch (error) {
      console.error('Failed to download model:', error)
    } finally {
      setIsDownloading(false)
      setDownloadProgress('')
    }
  }, [])

  const handleLanguageChange = useCallback(async (language: string) => {
    setSelectedLanguage(language)
    try {
      await window.jelico.speech.setLanguage(language)
    } catch (error) {
      console.error('Failed to set language:', error)
    }
  }, [])

  const handleTestMicrophone = useCallback(async () => {
    setIsTesting(true)
    setTestResult('')

    try {
      // Request microphone access and record for 3 seconds
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDevice ? { deviceId: selectedDevice } : true,
      })

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())

        if (chunks.length === 0) {
          setTestResult('No audio recorded')
          setIsTesting(false)
          return
        }

        try {
          // Convert to ArrayBuffer
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const arrayBuffer = await blob.arrayBuffer()

          // Transcribe
          setTestResult('Transcribing...')
          const result = await window.jelico.speech.transcribe(arrayBuffer, {
            language: selectedLanguage,
          })

          if (result.success && result.result?.text) {
            setTestResult(`Transcription: "${result.result.text}"`)
          } else if (result.error) {
            setTestResult(`Error: ${result.error}`)
          } else {
            setTestResult('No transcription result')
          }
        } catch (error: any) {
          setTestResult(`Error: ${error.message}`)
        }
        setIsTesting(false)
      }

      // Record for 3 seconds
      mediaRecorder.start()
      setTestResult('Recording... (3 seconds)')

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
        }
      }, 3000)
    } catch (error: any) {
      setTestResult(`Microphone error: ${error.message}`)
      setIsTesting(false)
    }
  }, [selectedDevice, selectedLanguage])

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

          <button
            onClick={handleTestMicrophone}
            disabled={isTesting || !status?.isLoaded}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            Test Microphone
          </button>

          {testResult && (
            <div className="p-3 bg-bg-surface border border-border rounded-lg text-sm text-text-secondary">
              {testResult}
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

        <div className="grid gap-2">
          {models.map((model) => {
            const isDownloaded = downloadedModels.has(model.id)
            const isSelected = selectedModel === model.id
            const isLoaded = status?.currentModel === model.id && status?.isLoaded

            return (
              <div
                key={model.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-border-strong'
                }`}
                onClick={() => isDownloaded && handleModelSelect(model.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                      {model.name}
                    </span>
                    {isLoaded && (
                      <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {model.size} • {model.speed}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isDownloaded ? (
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
