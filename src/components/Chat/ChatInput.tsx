import { useState, useRef, useCallback, KeyboardEvent, useMemo, DragEvent, useEffect } from 'react'
import { Send, Square, Clock, Paperclip, X, FileText, Image, File as FileIcon, ChevronUp, ChevronDown } from 'lucide-react'
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

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
}

const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.tif,.tiff,.avif,.heic,.heif,.txt,.md,.json,.pdf,.docx,.pptx'

// Line threshold for collapsing pasted content
const PASTE_COLLAPSE_THRESHOLD = 10
const NEW_CHAT_DRAFT_KEY = '__new__'
const chatDraftsByConversation = new Map<string, string>()

function getDraftKey(conversationId: string | null): string {
  return conversationId || NEW_CHAT_DRAFT_KEY
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1 || lastDot === fileName.length - 1) return ''
  return fileName.slice(lastDot + 1).toLowerCase()
}

function inferMimeTypeFromFilename(fileName: string): string | null {
  const extension = getFileExtension(fileName)
  return IMAGE_MIME_BY_EXTENSION[extension] || null
}

function normalizeFileMimeType(file: File): string {
  const raw = file.type.trim().toLowerCase()
  if (raw && raw !== 'application/octet-stream') return raw

  const inferredFromName = inferMimeTypeFromFilename(file.name)
  if (inferredFromName) return inferredFromName

  if (raw) return raw
  return 'application/octet-stream'
}

function base64ToFile(base64Data: string, name: string, mimeType: string): File {
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })
  return new window.File([blob], name, { type: mimeType })
}

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
  const {
    sendMessage,
    stopStreaming,
    sendQueuedNow,
    messageQueue,
    activeConversationId,
  } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()

  const resizeTextarea = useCallback((content: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    // Chat view (not centered): compact 1-line style, grows as needed
    // Welcome screen (centered): taller 4-line style
    const minHeight = centered ? 96 : 72
    const maxHeight = centered ? 200 : 150
    if (!content) {
      textarea.style.height = `${minHeight}px`
      return
    }
    const newHeight = Math.max(textarea.scrollHeight, minHeight)
    textarea.style.height = `${Math.min(newHeight, maxHeight)}px`
  }, [centered])

  const focusTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    if (document.activeElement !== textarea) {
      textarea.focus()
    }
  }, [])

  // Restore draft when switching conversations (including new-chat view)
  useEffect(() => {
    const draft = chatDraftsByConversation.get(getDraftKey(activeConversationId)) || ''
    setInput(draft)
    resizeTextarea(draft)
  }, [activeConversationId, resizeTextarea])

  // Robust focus management - handles view transitions and dialog dismissals
  useEffect(() => {
    // Multi-attempt focus to handle race conditions after dialogs/transitions
    const frame = requestAnimationFrame(() => {
      focusTextarea()
    })
    const focusAttempts = [50, 150, 300, 600, 900] // Try at multiple intervals
    const timers: NodeJS.Timeout[] = []

    focusAttempts.forEach(delay => {
      const timer = setTimeout(() => {
        focusTextarea()
      }, delay)
      timers.push(timer)
    })

    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(t => clearTimeout(t))
    }
  }, [activeConversationId, centered, focusTextarea]) // Re-run on mount and view/conversation changes

  // OS-aware modifier key
  const modKey = useMemo(() => isMac() ? '⌘' : 'Ctrl', [])

  // Generate unique ID for attachments
  const generateId = () => `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Accept externally generated attachments (for example, artifact screenshots).
  useEffect(() => {
    const onAddAttachment = (event: Event) => {
      const customEvent = event as CustomEvent<{ name?: string; mimeType?: string; data?: string }>
      const name = customEvent.detail?.name
      const mimeType = customEvent.detail?.mimeType
      const data = customEvent.detail?.data
      if (!name || !mimeType || !data) return

      try {
        const file = base64ToFile(data, name, mimeType)
        setAttachments((prev) => [
          ...prev,
          {
            id: generateId(),
            type: 'file',
            name,
            file,
          },
        ])
        requestAnimationFrame(() => focusTextarea())
      } catch (error) {
        console.error('[ChatInput] Failed to import external attachment:', error)
      }
    }

    window.addEventListener('jelico:add-chat-attachment', onAddAttachment as EventListener)
    return () => window.removeEventListener('jelico:add-chat-attachment', onAddAttachment as EventListener)
  }, [focusTextarea])

  // Get file type icon
  const getFileIcon = (file: File | undefined, type: string) => {
    if (type === 'pasted') return FileText
    if (!file) return FileIcon

    const normalizedMimeType = normalizeFileMimeType(file)
    if (normalizedMimeType.startsWith('image/')) return Image
    if (SUPPORTED_FILE_TYPES.text.includes(normalizedMimeType) || normalizedMimeType.startsWith('text/')) return FileText

    return FileIcon
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
    requestAnimationFrame(() => focusTextarea())
  }, [focusTextarea, handleFileSelect])

  const persistDraft = useCallback((nextValue: string) => {
    const draftKey = getDraftKey(activeConversationId)
    if (nextValue) {
      chatDraftsByConversation.set(draftKey, nextValue)
    } else {
      chatDraftsByConversation.delete(draftKey)
    }
    resizeTextarea(nextValue)
  }, [activeConversationId, resizeTextarea])

  // Handle paste with content detection
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Welcome/new-chat view prioritizes reliability over custom paste behavior.
    // Let the browser handle paste natively so users can always paste and edit.
    if (centered) {
      requestAnimationFrame(() => focusTextarea())
      return
    }

    // Prefer textual clipboard payloads over file payloads.
    // Some clipboard sources include both, and text should win for prompt authoring.
    const pastedText = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text')
    if (pastedText) {
      const lineCount = pastedText.split('\n').length

      // Keep large paste-as-attachment behavior in active chat view only.
      if (!centered && lineCount > PASTE_COLLAPSE_THRESHOLD) {
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

      requestAnimationFrame(() => focusTextarea())
      return
    }

    // If no text payload exists, treat clipboard files as attachments.
    const files = e.clipboardData.files
    if (files.length > 0) {
      e.preventDefault()
      handleFileSelect(files)
      requestAnimationFrame(() => focusTextarea())
    }
  }, [centered, focusTextarea, handleFileSelect])

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
    if (mimeType.startsWith('image/')) return 'image'
    if (SUPPORTED_FILE_TYPES.text.includes(mimeType) || mimeType.startsWith('text/')) return 'text'
    return 'document'
  }

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    if ((!input.trim() && attachments.length === 0) || !activeProviderId || !activeModel) return false
    const trimmedInput = input.trim()

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
          const normalizedMimeType = normalizeFileMimeType(att.file)
          const base64 = await fileToBase64(att.file)
          return {
            id: att.id,
            type: getAttachmentType(normalizedMimeType),
            name: att.name,
            mimeType: normalizedMimeType,
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

    try {
      await sendMessage(
        trimmedInput,
        activeProviderId,
        activeModel,
        messageAttachments.length > 0 ? messageAttachments : undefined
      )
      setInput('')
      setAttachments([])
      persistDraft('')
      return true
    } catch (error) {
      console.error('[ChatInput] Failed to send message:', error)
      return false
    }
  }, [input, attachments, activeProviderId, activeModel, sendMessage, persistDraft])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === 'Backspace' &&
      input.length === 0 &&
      attachments.length > 0 &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault()
      removeAttachment(attachments[attachments.length - 1].id)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value
    setInput(nextValue)
    persistDraft(nextValue)
  }

  const handleStop = () => {
    stopStreaming()
  }

  const queueEntriesForActiveConversation = useMemo(() => {
    const activeConversationKey = activeConversationId ?? null
    return messageQueue
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => (message.conversationId ?? null) === activeConversationKey)
  }, [messageQueue, activeConversationId])

  const queuedCount = queueEntriesForActiveConversation.length
  const [queueExpanded, setQueueExpanded] = useState(false)
  const [sendingNowIndex, setSendingNowIndex] = useState<number | null>(null)

  useEffect(() => {
    if (queuedCount === 0) {
      setQueueExpanded(false)
    }
  }, [queuedCount])

  const handleSendQueuedNow = useCallback(async (queueIndex: number) => {
    setSendingNowIndex(queueIndex)
    try {
      await sendQueuedNow(queueIndex)
    } catch (error) {
      console.error('[ChatInput] Failed to send queued message now:', error)
    } finally {
      setSendingNowIndex(null)
    }
  }, [sendQueuedNow])

  const hasDraftToSend = input.trim().length > 0 || attachments.length > 0
  const showQueueSubmit = Boolean(isStreaming && hasDraftToSend)
  const isQueueDocked = !centered && queuedCount > 0

  const handleQueueSubmit = useCallback(async () => {
    const sent = await handleSubmit()
    if (sent) {
      setQueueExpanded(true)
    }
  }, [handleSubmit])

  return (
    <div className="space-y-0" data-window-toggle="ignore">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Queued messages panel - slides up from bottom */}
      {queuedCount > 0 && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-out border border-border border-b-0 bg-bg-surface hover:border-border-strong ${
            centered ? 'rounded-t-lg rounded-b-none' : 'rounded-t-xl rounded-b-none'
          } ${
            queueExpanded ? 'max-h-48' : 'max-h-10'
          }`}
        >
          {/* Header - always visible */}
          <div className="w-full flex items-center gap-2 px-2 py-1.5">
            <button
              onClick={() => setQueueExpanded(!queueExpanded)}
              className="flex-1 flex items-center justify-between gap-2 px-1 py-0.5"
            >
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Clock className="w-4 h-4 text-accent" />
                <span className="font-medium">{queuedCount} queued message{queuedCount > 1 ? 's' : ''}</span>
              </div>
              {queueExpanded ? (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              ) : (
                <ChevronUp className="w-4 h-4 text-text-muted" />
              )}
            </button>
          </div>

          {/* Expanded queue list */}
          {queueExpanded && (
            <div className="border-t border-border-subtle px-2 pt-1.5 pb-2 space-y-1.5 max-h-36 overflow-y-auto">
              {queueEntriesForActiveConversation.map(({ message: msg, index: queueIndex }, idx) => (
                <div
                  key={queueIndex}
                  className="flex items-start gap-2 p-2 bg-bg-elevated border border-border-subtle rounded-lg text-sm"
                >
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-accent/20 text-accent text-xs font-medium rounded">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-secondary truncate">
                      {msg.content || (msg.attachments?.length ? `${msg.attachments.length} attachment(s)` : 'Empty message')}
                    </p>
                    {msg.attachments && msg.attachments.length > 0 && msg.content && (
                      <p className="text-xs text-text-muted mt-0.5">
                        + {msg.attachments.length} attachment{msg.attachments.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSendQueuedNow(queueIndex)}
                    disabled={sendingNowIndex !== null}
                    className="flex-shrink-0 px-2 py-1 text-xs rounded bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Send this queued message now"
                  >
                    {sendingNowIndex === queueIndex ? 'Sending...' : 'Send now'}
                  </button>
                </div>
              ))}
            </div>
          )}
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
        className={`flex flex-col bg-bg-elevated border transition-colors ${
          centered ? 'rounded-xl' : isQueueDocked ? 'rounded-t-none rounded-b-none' : 'rounded-t-xl rounded-b-none'
        } ${
          isDragging
            ? 'border-accent border-dashed bg-accent/5'
            : 'border-border hover:border-border-strong focus-within:border-accent'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={focusTextarea} // Click anywhere to focus
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
              ? 'Draft message... (select a provider to send)'
              : isStreaming
              ? 'Message will be queued...'
              : 'Message Jelico...'
          }
          autoFocus
          rows={centered ? 4 : 2}
          className={`flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none resize-none focus:outline-none focus:ring-0 border-none leading-6 px-3 pt-4 pb-0 scroll-pt-4 overflow-y-auto select-text ${
            centered ? 'min-h-[96px] max-h-[200px]' : 'min-h-[72px] max-h-[150px]'
          }`}
        />

        {/* Divider */}
        <div className="mx-3 border-t border-border-subtle" />

        {/* Icon row */}
        <div className="flex items-center justify-between px-[0.75em] py-[0.6em]">
          {/* Left side - Attachments */}
          <button
            onClick={openFilePicker}
            className="p-[0.45em] text-text-muted hover:text-text-secondary transition-colors rounded-lg hover:bg-bg-hover"
            title="Attach files"
          >
            <Paperclip className="w-[1.15em] h-[1.15em]" />
          </button>

	          {/* Right side - Send button */}
	          <div className="flex items-center gap-1.5">
	            {/* Speech-to-text disabled - WASM crashes on Windows ARM64, will revisit later */}

	            {/* Stop button */}
	            {isStreaming && (
	              <button
	                onClick={handleStop}
	                className="inline-flex h-[2.2em] w-[2.2em] items-center justify-center rounded-full bg-error text-white hover:bg-error/90 transition-colors flex-shrink-0"
	                title="Stop generating"
	              >
	                <Square className="w-[1.15em] h-[1.15em]" />
	              </button>
	            )}

            {/* Send / Queue button */}
	            {(!isStreaming || showQueueSubmit) && (
	              <button
	                onClick={isStreaming ? handleQueueSubmit : handleSubmit}
	                disabled={disabled || !hasDraftToSend}
	                className="relative inline-flex h-[2.2em] w-[2.2em] items-center justify-center rounded-full bg-accent text-black hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
	                title={isStreaming ? 'Queue message' : 'Send message'}
	              >
	                <Send className="w-[1.15em] h-[1.15em]" />
	              </button>
	            )}
          </div>
        </div>

        {/* Hints footer (inside prompt box) */}
        {!centered && (
          <div
            className="px-3 pb-2 text-text-primary flex items-center justify-between gap-3"
            style={{
              fontSize: 'calc(11px * var(--chat-font-scale, 1))',
              lineHeight: 'calc(16px * var(--chat-font-scale, 1))',
            }}
          >
            <span>Enter to send · Shift+Enter for new line · Tab to cycle modes</span>
            <span>{modKey}+K for commands</span>
          </div>
        )}
      </div>
    </div>
  )
}
