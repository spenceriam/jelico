import { useState, useRef, useCallback, KeyboardEvent, useMemo, DragEvent, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SendHorizontal, Square, Clock, Paperclip, X, Trash2, FileText, Image, File as FileIcon, ChevronUp, ChevronDown, Edit3 } from 'lucide-react'
import { useChatStore, type MessageAttachment, type QueuedMessage } from '../../stores/chat'
import { useProviderStore } from '../../stores/providers'
import { useContextStore } from '../../stores/context'
import { getQueuePanelConversationKey, getQueuedMessagePreview } from '../../lib/chatQueuePanel'
// Speech-to-text disabled - WASM crashes on Windows ARM64
// import { speechClient } from '../../lib/speechClient'

// Detect if user is on macOS
function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

interface QueueActionIconButtonProps {
  label: string
  disabled: boolean
  className: string
  onClick: () => void
  children: ReactNode
}

function QueueActionIconButton({
  label,
  disabled,
  className,
  onClick,
  children,
}: QueueActionIconButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)

  const updateTooltipPosition = useCallback(() => {
    if (!buttonRef.current) return
    setTooltipRect(buttonRef.current.getBoundingClientRect())
  }, [])

  const showTooltip = useCallback(() => {
    if (disabled) return
    updateTooltipPosition()
    setTooltipVisible(true)
  }, [disabled, updateTooltipPosition])

  const hideTooltip = useCallback(() => {
    setTooltipVisible(false)
  }, [])

  useEffect(() => {
    if (disabled) {
      setTooltipVisible(false)
    }
  }, [disabled])

  useEffect(() => {
    if (!tooltipVisible) return

    const handleViewportChange = () => updateTooltipPosition()
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [tooltipVisible, updateTooltipPosition])

  const tooltip =
    tooltipVisible && tooltipRect && typeof document !== 'undefined'
      ? createPortal(
          <span
            className="pointer-events-none fixed z-[9999] max-w-[13rem] -translate-x-1/2 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-center text-[11px] leading-snug text-text-primary shadow-lg"
            style={{
              left: tooltipRect.left + (tooltipRect.width / 2),
              top: tooltipRect.top - 6,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {label}
          </span>,
          document.body
        )
      : null

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        disabled={disabled}
        className={className}
        aria-label={label}
      >
        {children}
      </button>
      {tooltip}
    </>
  )
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
const chatDraftAttachmentsByConversation = new Map<string, Attachment[]>()
const PROMPT_PLACEHOLDER_INDEX_KEY = 'jelico:prompt-placeholder-index'

const PROMPT_PLACEHOLDERS = [
  'What do you want to tackle next?',
  'Describe the task, and I’ll help you work through it.',
  'Share a goal, question, or plan.',
  'Tell me what you want to build or fix.',
  'Paste context or outline your next step.',
  'What should we focus on right now?',
  'Start with a prompt, and we’ll take it from there.',
  'Need a plan, code, or research?',
  'Give me the objective and constraints.',
  'What outcome are you aiming for?',
]

function readPlaceholderIndex(): number {
  try {
    const raw = globalThis?.localStorage?.getItem(PROMPT_PLACEHOLDER_INDEX_KEY)
    const parsed = raw ? Number(raw) : 0
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return parsed % PROMPT_PLACEHOLDERS.length
  } catch {
    return 0
  }
}

function writePlaceholderIndex(index: number) {
  try {
    globalThis?.localStorage?.setItem(PROMPT_PLACEHOLDER_INDEX_KEY, String(index))
  } catch {
    // Ignore storage failures.
  }
}

function getDraftKey(conversationId: string | null): string {
  return conversationId || NEW_CHAT_DRAFT_KEY
}

function cloneDraftAttachments(attachments: Attachment[]): Attachment[] {
  return attachments.map((attachment) => ({ ...attachment }))
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

function isPastedAttachment(attachment: MessageAttachment): boolean {
  return attachment.type === 'text' && /^Pasted ~\d+ lines$/.test(attachment.name)
}

function messageAttachmentToDraftAttachment(attachment: MessageAttachment): Attachment {
  if (isPastedAttachment(attachment)) {
    return {
      id: attachment.id,
      type: 'pasted',
      name: attachment.name,
      content: attachment.data,
      lineCount: attachment.data.split('\n').length,
      isExpanded: false,
    }
  }

  return {
    id: attachment.id,
    type: 'file',
    name: attachment.name,
    file: base64ToFile(attachment.data, attachment.name, attachment.mimeType),
  }
}

interface ChatInputProps {
  disabled?: boolean
  isStreaming?: boolean
  centered?: boolean // For new chat view - hides hints below
}

interface QueuedEditState {
  queuedMessage: QueuedMessage
  previousDraft: string
  previousAttachments: Attachment[]
}

// Speech-to-text disabled - WASM crashes on Windows ARM64
// type RecordingState = 'idle' | 'recording' | 'transcribing'

export function ChatInput({
  disabled,
  isStreaming,
  centered,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [editingQueuedMessage, setEditingQueuedMessage] = useState<QueuedEditState | null>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState<number>(() => readPlaceholderIndex())
  const [isDragging, setIsDragging] = useState(false)
  // Speech-to-text disabled
  // const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  // const [recordingTime, setRecordingTime] = useState(0)
  // const [recordingError, setRecordingError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const forceScrollTopAfterPasteRef = useRef(false)
  const editingQueuedMessageRef = useRef<QueuedEditState | null>(null)
  // Speech-to-text disabled
  // const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  // const audioChunksRef = useRef<Blob[]>([])
  // const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const {
    sendMessage,
    stopStreaming,
    sendQueuedNow,
    startQueuedMessageEdit,
    cancelQueuedMessageEdit,
    commitQueuedMessageEdit,
    removeQueuedMessage,
    processQueue,
    messageQueue,
    conversationStreams,
    queuePanelExpandedByConversation,
    setQueuePanelExpanded,
    activeConversationId,
  } = useChatStore()
  const { activeProviderId, activeModel } = useProviderStore()
  const { isConversationCompacting } = useContextStore()
  const isEditingQueuedMessageForActiveConversation = editingQueuedMessage
    ? (editingQueuedMessage.queuedMessage.conversationId ?? null) === (activeConversationId ?? null)
    : false

  const resizeTextarea = useCallback((content: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    // Keep welcome/new-chat composer roomy, but use a shorter default height in active chat.
    const minHeight = centered ? 92 : 64
    const maxHeight = centered ? 240 : 192
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

  useEffect(() => {
    editingQueuedMessageRef.current = editingQueuedMessage
  }, [editingQueuedMessage])

  // Restore draft when switching conversations (including new-chat view)
  useEffect(() => {
    const pendingQueuedEdit = editingQueuedMessageRef.current
    if (pendingQueuedEdit) {
      const previousDraftKey = getDraftKey(pendingQueuedEdit.queuedMessage.conversationId ?? null)
      if (pendingQueuedEdit.previousDraft) {
        chatDraftsByConversation.set(previousDraftKey, pendingQueuedEdit.previousDraft)
      } else {
        chatDraftsByConversation.delete(previousDraftKey)
      }

      if (pendingQueuedEdit.previousAttachments.length > 0) {
        chatDraftAttachmentsByConversation.set(
          previousDraftKey,
          cloneDraftAttachments(pendingQueuedEdit.previousAttachments)
        )
      } else {
        chatDraftAttachmentsByConversation.delete(previousDraftKey)
      }

      cancelQueuedMessageEdit()
      editingQueuedMessageRef.current = null
      setEditingQueuedMessage(null)
    }

    const draftKey = getDraftKey(activeConversationId)
    const draft = chatDraftsByConversation.get(draftKey) || ''
    const draftAttachments = cloneDraftAttachments(
      chatDraftAttachmentsByConversation.get(draftKey) || []
    )
    setInput(draft)
    setAttachments(draftAttachments)
    resizeTextarea(draft)
  }, [activeConversationId, cancelQueuedMessageEdit, resizeTextarea])

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
  const activePromptPlaceholder = useMemo(
    () => PROMPT_PLACEHOLDERS[placeholderIndex] || PROMPT_PLACEHOLDERS[0],
    [placeholderIndex]
  )

  const rotatePromptPlaceholder = useCallback(() => {
    setPlaceholderIndex((prev) => {
      const next = (prev + 1) % PROMPT_PLACEHOLDERS.length
      writePlaceholderIndex(next)
      return next
    })
  }, [])

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

  const persistDraft = useCallback((nextValue: string, nextAttachments: Attachment[] = attachments) => {
    const draftKey = getDraftKey(activeConversationId)
    if (nextValue) {
      chatDraftsByConversation.set(draftKey, nextValue)
    } else {
      chatDraftsByConversation.delete(draftKey)
    }

    if (nextAttachments.length > 0) {
      chatDraftAttachmentsByConversation.set(draftKey, cloneDraftAttachments(nextAttachments))
    } else {
      chatDraftAttachmentsByConversation.delete(draftKey)
    }

    resizeTextarea(nextValue)
  }, [activeConversationId, attachments, resizeTextarea])

  useEffect(() => {
    const draftKey = getDraftKey(activeConversationId)
    if (attachments.length > 0) {
      chatDraftAttachmentsByConversation.set(draftKey, cloneDraftAttachments(attachments))
    } else {
      chatDraftAttachmentsByConversation.delete(draftKey)
    }
  }, [activeConversationId, attachments])

  // Handle paste with content detection
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text')

    // Welcome/new-chat view prioritizes reliability over custom paste behavior.
    // Let the browser handle paste natively so users can always paste and edit.
    // For long pastes, force top-visible content after insertion for readability.
    if (centered) {
      if (pastedText && pastedText.length > 200) {
        forceScrollTopAfterPasteRef.current = true
      }
      requestAnimationFrame(() => focusTextarea())
      return
    }

    // Prefer textual clipboard payloads over file payloads.
    // Some clipboard sources include both, and text should win for prompt authoring.
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
      } else if (pastedText.length > 200) {
        forceScrollTopAfterPasteRef.current = true
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
    if (
      (!input.trim() && attachments.length === 0) ||
      (!isEditingQueuedMessageForActiveConversation && !editingQueuedMessage && (!activeProviderId || !activeModel))
    ) return false
    if (editingQueuedMessage && !isEditingQueuedMessageForActiveConversation) return false
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
      let nextDraftValue = ''
      let nextDraftAttachments: Attachment[] = []

      if (isEditingQueuedMessageForActiveConversation && editingQueuedMessage) {
        const restoredQueuedMessage: QueuedMessage = {
          ...editingQueuedMessage.queuedMessage,
          content: trimmedInput,
          attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
        }

        commitQueuedMessageEdit(restoredQueuedMessage)
        nextDraftValue = editingQueuedMessage.previousDraft
        nextDraftAttachments = cloneDraftAttachments(editingQueuedMessage.previousAttachments)

        const targetConversationId = restoredQueuedMessage.conversationId ?? activeConversationId ?? null
        if (!isStreaming && !(targetConversationId && isConversationCompacting(targetConversationId))) {
          await processQueue()
        }
      } else {
        const composerProviderId = activeProviderId
        const composerModel = activeModel
        if (!composerProviderId || !composerModel) return false

        await sendMessage(
          trimmedInput,
          composerProviderId,
          composerModel,
          messageAttachments.length > 0 ? messageAttachments : undefined
        )
      }

      setInput(nextDraftValue)
      setAttachments(nextDraftAttachments)
      editingQueuedMessageRef.current = null
      setEditingQueuedMessage(null)
      persistDraft(nextDraftValue, nextDraftAttachments)
      if (!nextDraftValue && nextDraftAttachments.length === 0) {
        rotatePromptPlaceholder()
      }
      return true
    } catch (error) {
      console.error('[ChatInput] Failed to send message:', error)
      return false
    }
  }, [
    activeConversationId,
    activeModel,
    activeProviderId,
    attachments,
    editingQueuedMessage,
    input,
    isEditingQueuedMessageForActiveConversation,
    isConversationCompacting,
    isStreaming,
    persistDraft,
    processQueue,
    rotatePromptPlaceholder,
    sendMessage,
    commitQueuedMessageEdit,
  ])

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

    if (forceScrollTopAfterPasteRef.current) {
      forceScrollTopAfterPasteRef.current = false
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.scrollTop = 0
        }
      })
    }
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
  const [sendingNowIndex, setSendingNowIndex] = useState<number | null>(null)
  const queuePanelKey = getQueuePanelConversationKey(activeConversationId)
  const queueExpanded = queuePanelExpandedByConversation[queuePanelKey] ?? queuedCount > 0

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

  const handleEditQueuedMessage = useCallback((queueIndex: number) => {
    const pendingQueuedEdit = editingQueuedMessageRef.current
    const previousDraft = pendingQueuedEdit?.previousDraft ?? input
    const previousAttachments = pendingQueuedEdit?.previousAttachments ?? cloneDraftAttachments(attachments)

    if (pendingQueuedEdit) {
      const previousDraftKey = getDraftKey(pendingQueuedEdit.queuedMessage.conversationId ?? null)
      if (pendingQueuedEdit.previousDraft) {
        chatDraftsByConversation.set(previousDraftKey, pendingQueuedEdit.previousDraft)
      } else {
        chatDraftsByConversation.delete(previousDraftKey)
      }

      if (pendingQueuedEdit.previousAttachments.length > 0) {
        chatDraftAttachmentsByConversation.set(
          previousDraftKey,
          cloneDraftAttachments(pendingQueuedEdit.previousAttachments)
        )
      } else {
        chatDraftAttachmentsByConversation.delete(previousDraftKey)
      }

      cancelQueuedMessageEdit()
      editingQueuedMessageRef.current = null
      setEditingQueuedMessage(null)
    }

    const pendingEdit = startQueuedMessageEdit(queueIndex)
    if (!pendingEdit) return

    const queuedMessageAttachments = (pendingEdit.queuedMessage.attachments || [])
      .map(messageAttachmentToDraftAttachment)

    setEditingQueuedMessage({
      queuedMessage: pendingEdit.queuedMessage,
      previousDraft,
      previousAttachments,
    })
    setInput(pendingEdit.queuedMessage.content)
    setAttachments(queuedMessageAttachments)
    persistDraft(pendingEdit.queuedMessage.content, queuedMessageAttachments)

    requestAnimationFrame(() => {
      focusTextarea()
    })
  }, [attachments, cancelQueuedMessageEdit, focusTextarea, input, persistDraft, startQueuedMessageEdit])

  const handleCancelQueuedMessage = useCallback((queueIndex: number) => {
    removeQueuedMessage(queueIndex)
  }, [removeQueuedMessage])

  const getQueuedSendLabel = useCallback((queuedMessage: QueuedMessage) => {
    const targetConversationId = queuedMessage.conversationId ?? activeConversationId ?? null
    const targetIsBusy = Boolean(
      targetConversationId && (
        conversationStreams[targetConversationId]?.isStreaming ||
        isConversationCompacting(targetConversationId)
      )
    )

    return targetIsBusy
      ? 'Send this queued message next without stopping the agent'
      : 'Send queued message now'
  }, [activeConversationId, conversationStreams, isConversationCompacting])

  const hasDraftToSend = input.trim().length > 0 || attachments.length > 0
  const canSaveQueuedEditWithoutProvider = Boolean(isEditingQueuedMessageForActiveConversation)
  const submitButtonDisabled = !hasDraftToSend || (disabled && !canSaveQueuedEditWithoutProvider)
  const showQueueSubmit = Boolean(isStreaming && hasDraftToSend)
  const showSubmitButton = !isStreaming || showQueueSubmit
  const isQueueDocked = !centered && queuedCount > 0
  const isEditingExistingMessage = Boolean(editingQueuedMessage)
  const submitPillLabel = isEditingExistingMessage ? 'Save' : 'Send'
  const submitButtonAriaLabel = isEditingExistingMessage
    ? 'Save edited message'
    : isStreaming
      ? 'Queue message'
      : 'Send message'

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
          <div className="w-full flex items-center gap-2 bg-bg-elevated px-2 py-1.5">
            <button
              onClick={() => setQueuePanelExpanded(activeConversationId, !queueExpanded)}
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
            <div className="border-t border-border-subtle px-2 pt-1.5 pb-2 space-y-1.5 max-h-36 overflow-y-auto overflow-x-hidden">
              {queueEntriesForActiveConversation.map(({ message: msg, index: queueIndex }, queuePosition) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 rounded-xl border border-border-subtle px-3 py-3 text-sm ${
                    queuePosition % 2 === 0 ? 'bg-bg-elevated' : 'bg-bg-surface'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const preview = getQueuedMessagePreview(msg)
                      return (
                        <>
                          <p
                            className="text-text-secondary whitespace-pre-wrap break-words leading-6"
                          >
                            {preview.primaryText}
                          </p>
                          {preview.secondaryText && (
                            <p className="mt-1.5 break-words text-xs text-text-muted">
                              {preview.secondaryText}
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 flex-shrink-0 self-start">
                    <QueueActionIconButton
                      label={getQueuedSendLabel(msg)}
                      onClick={() => handleSendQueuedNow(queueIndex)}
                      disabled={sendingNowIndex !== null}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-accent hover:bg-accent/12 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingNowIndex === queueIndex
                        ? <Clock className="h-3.5 w-3.5" />
                        : <SendHorizontal className="h-3.5 w-3.5" />}
                    </QueueActionIconButton>
                    <QueueActionIconButton
                      label="Click to edit your message"
                      onClick={() => handleEditQueuedMessage(queueIndex)}
                      disabled={sendingNowIndex !== null}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-accent hover:bg-accent/12 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </QueueActionIconButton>
                    <QueueActionIconButton
                      label="Delete queued message"
                      onClick={() => handleCancelQueuedMessage(queueIndex)}
                      disabled={sendingNowIndex !== null}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-accent hover:bg-error/10 hover:text-error disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </QueueActionIconButton>
                  </div>
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
            : 'border-accent hover:border-accent-bright focus-within:border-accent-bright'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={focusTextarea} // Click anywhere to focus
      >
        {/* Text area */}
        <div className="px-3 pt-3 pb-2">
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
                : activePromptPlaceholder
            }
            autoFocus
            rows={2}
            className={`block w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none resize-none focus:outline-none focus:ring-0 border-none leading-6 px-1 pt-1 pb-4 scroll-pt-2 scroll-pb-4 overflow-y-auto select-text ${
              centered ? 'min-h-[92px] max-h-[240px]' : 'min-h-[64px] max-h-[192px]'
            }`}
          />
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-border-subtle" />

        {/* Bottom controls + guidance row */}
        <div className="grid grid-cols-[8.25em_minmax(0,1fr)_8.25em] items-center gap-2 px-[0.75em] py-[0.6em]">
          <div className="flex items-center justify-start">
            <button
              onClick={openFilePicker}
              className="p-[0.45em] text-text-muted hover:text-text-secondary transition-colors rounded-lg hover:bg-bg-hover"
              title="Attach files"
            >
              <Paperclip className="w-[1.15em] h-[1.15em]" />
            </button>
          </div>

          <div
            className="min-w-0 text-center text-sm text-text-primary whitespace-nowrap overflow-hidden text-ellipsis px-1"
          >
            <span>Enter to submit · Shift+Enter for new line</span>
            <span className="mx-2 text-text-muted">|</span>
            <span>{modKey}+K for commands</span>
          </div>

          {/* Right side - Send button */}
          <div className="flex items-center justify-end gap-1.5">
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
            {showSubmitButton && (
              <div className="group relative h-[2.2em] w-[2.2em] flex-shrink-0 overflow-visible transition-[width] duration-200 ease-out hover:w-[5.2em] focus-within:w-[5.2em]">
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-y-0 right-0 inline-flex h-[2.2em] w-[2.2em] origin-right items-center justify-end overflow-hidden rounded-full pr-[0.52em] text-accent-foreground transition-[width,background-color,opacity] duration-200 ease-out group-hover:w-full group-focus-within:w-full ${
                    submitButtonDisabled
                      ? 'bg-accent opacity-50'
                      : 'bg-accent group-hover:bg-accent-bright group-focus-within:bg-accent-bright'
                  }`}
                >
                  <span className="pointer-events-none absolute left-[0.95em] whitespace-nowrap text-[0.76rem] font-medium opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100">
                    {submitPillLabel}
                  </span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitButtonDisabled}
                  aria-label={submitButtonAriaLabel}
                  className="absolute inset-y-0 right-0 inline-flex h-[2.2em] w-[2.2em] items-center justify-center rounded-full text-accent-foreground disabled:cursor-not-allowed"
                >
                  <SendHorizontal className="h-[1.05em] w-[1.05em]" strokeWidth={2.25} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
