import { useState, useRef, useCallback, KeyboardEvent, useMemo, DragEvent, useEffect } from 'react'
import { Send, Square, Clock, Paperclip, X, FileText, Image, File, Loader2 } from 'lucide-react'
import { useChatStore, type MessageAttachment } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'
// Speech-to-text disabled - WASM crashes on Windows ARM64
// import { speechClient } from '../../lib/speechClient'

// Detect if user is on macOS
function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

// Speech-to-text disabled - WASM crashes on Windows ARM64
// const MAX_RECORDING_TIME = 120 // 2 minutes in seconds

// Attachment types
interface Attachment {
  id: string
  type: 'file' | 'pasted'
  name: string
  file?: File
  content?: string
  lineCount?: number
  isExpanded?: boolean
}

// Supported file types
const SUPPORTED_FILE_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  text: ['text/plain', 'text/markdown', 'application/json'],
  document: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
}

const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json,.pdf,.docx,.pptx'

// Line threshold for collapsing pasted content
const PASTE_COLLAPSE_THRESHOLD = 10

interface ChatInputProps {
  disabled?: boolean
  isStreaming?: boolean
  centered?: boolean // For new chat view - hides hints below
}

// Speech-to-text disabled - WASM crashes on Windows ARM64
// type RecordingState = 'idle' | 'recording' | 'transcribing'

export function ChatInput({ disabled, isStreaming, centered }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  // Speech-to-text disabled
  // const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  // const [recordingTime, setRecordingTime] = useState(0)
  // const [recordingError, setRecordingError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Speech-to-text disabled
  // const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  // const audioChunksRef = useRef<Blob[]>([])
  // const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { sendMessage, stopStreaming, messageQueue } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()

  // OS-aware modifier key
  const modKey = useMemo(() => isMac() ? '⌘' : 'Ctrl', [])

  // Generate unique ID for attachments
  const generateId = () => `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Get file type icon
  const getFileIcon = (file: File | undefined, type: string) => {
    if (type === 'pasted') return FileText
    if (!file) return File
    if (SUPPORTED_FILE_TYPES.image.includes(file.type)) return Image
    if (SUPPORTED_FILE_TYPES.text.includes(file.type)) return FileText
    return File
  }

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newAttachments: Attachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      newAttachments.push({
        id: generateId(),
        type: 'file',
        name: file.name,
        file,
      })
    }
    setAttachments(prev => [...prev, ...newAttachments])
  }, [])

  // Handle drag events
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  // Handle paste with content detection
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Check for files first
    const files = e.clipboardData.files
    if (files.length > 0) {
      e.preventDefault()
      handleFileSelect(files)
      return
    }

    // Check for large text paste
    const pastedText = e.clipboardData.getData('text')
    const lineCount = pastedText.split('\n').length

    if (lineCount > PASTE_COLLAPSE_THRESHOLD) {
      e.preventDefault()
      const newAttachment: Attachment = {
        id: generateId(),
        type: 'pasted',
        name: `Pasted ~${lineCount} lines`,
        content: pastedText,
        lineCount,
        isExpanded: false,
      }
      setAttachments(prev => [...prev, newAttachment])
    }
    // Otherwise let default paste behavior happen
  }, [handleFileSelect])

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }, [])

  // Toggle pasted content expansion
  const toggleAttachmentExpand = useCallback((id: string) => {
    setAttachments(prev => prev.map(att =>
      att.id === id ? { ...att, isExpanded: !att.isExpanded } : att
    ))
  }, [])

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /* Speech-to-text disabled - WASM crashes on Windows ARM64, will revisit later
  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Start recording
  const startRecording = useCallback(async () => {
    setRecordingError(null)
    // ... recording code removed for brevity
  }, [])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (recordingState === 'recording') {
      stopRecording()
    } else if (recordingState === 'idle') {
      startRecording()
    }
  }, [recordingState, startRecording, stopRecording])

  // Format recording time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  End of speech-to-text disabled code */

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix if present (e.g., "data:image/png;base64,")
        const base64 = result.includes(',') ? result.split(',')[1] : result
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Determine attachment type from MIME type
  const getAttachmentType = (mimeType: string): 'image' | 'text' | 'document' => {
    if (SUPPORTED_FILE_TYPES.image.includes(mimeType)) return 'image'
    if (SUPPORTED_FILE_TYPES.text.includes(mimeType)) return 'text'
    return 'document'
  }

  const handleSubmit = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || !activeProviderId || !activeModel) return

    // Convert attachments to MessageAttachment format
    const messageAttachments: MessageAttachment[] = await Promise.all(
      attachments.map(async (att): Promise<MessageAttachment> => {
        if (att.type === 'pasted') {
          return {
            id: att.id,
            type: 'text',
            name: att.name,
            mimeType: 'text/plain',
            data: att.content || '',
          }
        } else if (att.file) {
          const base64 = await fileToBase64(att.file)
          return {
            id: att.id,
            type: getAttachmentType(att.file.type),
            name: att.name,
            mimeType: att.file.type,
            data: base64,
          }
        }
        // Fallback
        return {
          id: att.id,
          type: 'text',
          name: att.name,
          mimeType: 'text/plain',
          data: '',
        }
      })
    )

    sendMessage(
      input.trim(),
      activeProviderId,
      activeModel,
      messageAttachments.length > 0 ? messageAttachments : undefined
    )
    setInput('')
    setAttachments([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, attachments, activeProviderId, activeModel, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize textarea (only grow beyond min height)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const minHeight = 96 // 4 lines approx
      const newHeight = Math.max(textarea.scrollHeight, minHeight)
      textarea.style.height = `${Math.min(newHeight, 200)}px`
    }
  }

  const handleStop = () => {
    stopStreaming()
  }

  const queuedCount = messageQueue.length

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Queued messages indicator */}
      {queuedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted px-1">
          <Clock className="w-3 h-3" />
          <span>{queuedCount} message{queuedCount > 1 ? 's' : ''} queued</span>
        </div>
      )}

      {/* Recording error - disabled with speech-to-text */}

      {/* Attachments display */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachments.map((att) => {
            const IconComponent = getFileIcon(att.file, att.type)
            return (
              <div key={att.id} className="group relative">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-sm cursor-pointer hover:border-border-strong transition-colors ${
                    att.isExpanded ? 'ring-1 ring-accent' : ''
                  }`}
                  onClick={() => att.type === 'pasted' && toggleAttachmentExpand(att.id)}
                >
                  <IconComponent className="w-4 h-4 text-text-muted" />
                  <span className="text-text-secondary max-w-[150px] truncate">
                    {att.type === 'pasted' ? `Pasted ~${att.lineCount} lines` : att.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAttachment(att.id)
                    }}
                    className="text-text-muted hover:text-error transition-colors"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Expanded pasted content preview */}
                {att.type === 'pasted' && att.isExpanded && att.content && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 max-h-60 overflow-auto bg-bg-elevated border border-border rounded-lg p-3 shadow-lg z-10">
                    <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                      {att.content}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Main input container */}
      <div
        className={`flex flex-col bg-bg-elevated rounded-xl border transition-colors ${
          isDragging
            ? 'border-accent border-dashed bg-accent/5'
            : 'border-border hover:border-border-strong focus-within:border-accent'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isDragging
              ? 'Drop files here...'
              : disabled
              ? 'Select a provider to start...'
              : isStreaming
              ? 'Message will be queued...'
              : 'Message Jelico...'
          }
          disabled={disabled}
          rows={4}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none resize-none min-h-[96px] max-h-[200px] disabled:cursor-not-allowed focus:outline-none focus:ring-0 border-none leading-6 p-3 pb-0"
        />

        {/* Divider */}
        <div className="mx-3 border-t border-border-subtle" />

        {/* Icon row */}
        <div className="flex items-center justify-between px-3 py-2">
          {/* Left side - Attachments */}
          <button
            onClick={openFilePicker}
            disabled={disabled}
            className="p-1.5 text-text-muted hover:text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-bg-hover"
            title="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Right side - Send button */}
          <div className="flex items-center gap-1">
            {/* Speech-to-text disabled - WASM crashes on Windows ARM64, will revisit later */}

            {/* Send/Stop button */}
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors"
                title="Stop generating"
              >
                <Square className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={disabled || (!input.trim() && attachments.length === 0)}
                className="p-2 bg-accent text-black rounded-lg hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hints - hidden when centered (new chat view) */}
      {!centered && (
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span>Enter to send · Shift+Enter for new line · Tab to cycle modes</span>
          <span>{modKey}+K for commands</span>
        </div>
      )}
    </div>
  )
}
