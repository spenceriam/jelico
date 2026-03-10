import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, FileText, Image, File, RotateCcw, Loader2 } from 'lucide-react'
import {
  ToolCallDisplay,
  SingleToolCallDisplay,
  ConsolidatedToolCallGroup,
  buildProcessingToneByToolCallId,
  buildToolRenderEntries,
  isHiddenToolCall,
} from './ToolCallDisplay'
import { MessageActions } from './MessageActions'
import { MermaidInline } from '../Canvas/MermaidViewer'
import { useAgentStore } from '../../stores/agents'
import type { ToolCall, ToolResult, MessageUsage, MessageAttachment, StreamingSegment } from '../../stores/chat'

interface MessageProps {
  message: {
    id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    createdAt: number
    segments?: StreamingSegment[]
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
    usage?: MessageUsage
    attachments?: MessageAttachment[]
  }
  isStreaming?: boolean
  streamingToolCalls?: ToolCall[]
  streamingToolResults?: ToolResult[]
  streamingSegments?: StreamingSegment[]
  isLastAssistantMessage?: boolean
  onRegenerate?: () => void
  isRegenerating?: boolean
  showRetry?: boolean
  onRetry?: () => void
  isRetrying?: boolean
  userName?: string  // User's name for avatar initial
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

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1 || lastDot === fileName.length - 1) return ''
  return fileName.slice(lastDot + 1).toLowerCase()
}

function inferImageMimeTypeFromName(fileName: string): string | null {
  const extension = getFileExtension(fileName)
  return IMAGE_MIME_BY_EXTENSION[extension] || null
}

function inferImageMimeTypeFromBase64(base64Data: string): string | null {
  const sample = base64Data.slice(0, 32)
  if (sample.startsWith('iVBORw0KGgo')) return 'image/png'
  if (sample.startsWith('/9j/')) return 'image/jpeg'
  if (sample.startsWith('R0lGOD')) return 'image/gif'
  if (sample.startsWith('UklGR')) return 'image/webp'
  if (sample.startsWith('Qk')) return 'image/bmp'
  if (sample.startsWith('PHN2Zy') || sample.startsWith('PD94bWwg')) return 'image/svg+xml'
  return null
}

function normalizeImageMimeType(mimeType: string, fileName: string, base64Data: string): string {
  const normalizedMime = mimeType.trim().toLowerCase()
  if (normalizedMime.startsWith('image/')) return normalizedMime

  const inferredFromName = inferImageMimeTypeFromName(fileName)
  if (inferredFromName) return inferredFromName

  const inferredFromData = inferImageMimeTypeFromBase64(base64Data)
  if (inferredFromData) return inferredFromData

  return 'image/png'
}

function isDataUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith('data:')
}

function resolveAttachmentImageSource(att: MessageAttachment): string | null {
  const rawData = att.data?.trim()
  if (!rawData) return null

  if (isDataUrl(rawData)) {
    return rawData
  }

  if (
    rawData.startsWith('http://') ||
    rawData.startsWith('https://') ||
    rawData.startsWith('blob:') ||
    rawData.startsWith('file:')
  ) {
    return rawData
  }

  const compactBase64 = rawData.replace(/\s+/g, '')
  if (!compactBase64) return null

  const mimeType = normalizeImageMimeType(att.mimeType || '', att.name || '', compactBase64)
  return `data:${mimeType};base64,${compactBase64}`
}

// User avatar - shows first initial or fallback icon
function UserAvatar({ name }: { name?: string }) {
  const initial = name?.trim().charAt(0).toUpperCase()

  return (
    <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center flex-shrink-0">
      {initial ? (
        <span className="text-sm font-medium text-text-secondary">{initial}</span>
      ) : (
        <span className="text-sm font-medium text-text-muted">U</span>
      )}
    </div>
  )
}

// AI avatar - "J" with accent outline
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-accent bg-transparent flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-semibold text-accent">J</span>
    </div>
  )
}

// Format timestamp for display
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isToday) {
    return timeStr
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${dateStr} ${timeStr}`
}

function MarkdownCodeBlock({
  language,
  codeContent,
}: {
  language: string
  codeContent: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.error('Failed to copy code block:', err)
    }
  }

  return (
    <div className="relative group my-4">
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <span className="text-xs text-text-muted">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          title="Copy code block"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-bg-elevated rounded-lg p-4 overflow-x-auto">
        <code className="font-mono text-sm">
          {codeContent}
        </code>
      </pre>
    </div>
  )
}

export function Message({
  message,
  isStreaming,
  streamingToolCalls,
  streamingToolResults,
  streamingSegments,
  isLastAssistantMessage,
  onRegenerate,
  isRegenerating,
  showRetry,
  onRetry,
  isRetrying,
  userName,
}: MessageProps) {
  const [copied, setCopied] = useState(false)
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null)
  const [failedImagePreviews, setFailedImagePreviews] = useState<Record<string, boolean>>({})
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const timestamp = formatTimestamp(message.createdAt)

  // Use streaming tool calls if currently streaming, otherwise use saved tool calls
  const toolCalls = isStreaming ? streamingToolCalls : message.toolCalls
  const toolResults = isStreaming ? streamingToolResults : message.toolResults
  const agents = useAgentStore((state) => state.agents)
  // Prefer live streaming segments while generating, otherwise use persisted segments from message history
  const segments = isStreaming ? streamingSegments : message.segments
  const normalizedContent = message.content === '(Used tools)' && ((toolCalls?.length || 0) > 0 || (toolResults?.length || 0) > 0)
    ? 'Completed requested tool actions.'
    : message.content
  const processingToneByToolCallId = buildProcessingToneByToolCallId({
    toolCalls: toolCalls || [],
    toolResults: toolResults || [],
    agents,
    isStreaming,
  })
  const toolCallsMap = new Map((toolCalls || []).map((toolCall) => [toolCall.id, toolCall]))
  const toolResultsMap = new Map((toolResults || []).map((result) => [result.toolCallId, result]))
  const hasVisibleToolSegments = !!segments?.some((segment) => segment.type === 'tool')
  const hasVisibleToolCalls = !!toolCalls?.some((toolCall) => !isHiddenToolCall(toolCall, toolResultsMap.get(toolCall.id)))
  const shouldStretchAssistantContent = hasVisibleToolSegments || hasVisibleToolCalls

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const openLightbox = (imageUrl: string) => {
    setLightboxImageUrl(imageUrl)
  }

  const closeLightbox = () => {
    setLightboxImageUrl(null)
  }

  const markImagePreviewFailed = (key: string) => {
    setFailedImagePreviews((prev) => (
      prev[key]
        ? prev
        : { ...prev, [key]: true }
    ))
  }

  const canOpenLightboxInNewTab = lightboxImageUrl ? !isDataUrl(lightboxImageUrl) : false

  // Get icon for attachment type
  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'image': return Image
      case 'text': return FileText
      default: return File
    }
  }

  // User messages - actions OUTSIDE the bubble
  if (isUser) {
    const hasContent = message.content && message.content.trim().length > 0
    const hasAttachments = message.attachments && message.attachments.length > 0

    return (
      <div className="flex gap-4 justify-end group relative">
        {/* Timestamp - shows on hover */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-text-muted">{timestamp}</span>
        </div>
        <div className="max-w-[80%] flex flex-col items-end">
          {/* Message bubble */}
          <div className="rounded-2xl px-4 py-3 bg-bg-hover text-text-primary">
            {/* Show attachments first */}
            {hasAttachments && (
              <div className={`space-y-2 ${hasContent ? 'mb-3' : ''}`}>
                {message.attachments!.map((att) => {
                  const IconComponent = getAttachmentIcon(att.type)
                  const isTextAttachment = att.type === 'text' && att.data
                  const imagePreviewKey = `att:${att.id}`
                  const imageSrc = att.type === 'image'
                    ? resolveAttachmentImageSource(att)
                    : null
                  const imagePreviewFailed = Boolean(failedImagePreviews[imagePreviewKey])

                  return (
                    <div key={att.id} className="text-sm">
                      <div className="flex items-center gap-2 text-text-muted mb-1">
                        <IconComponent className="w-4 h-4" />
                        <span>{att.name}</span>
                      </div>
                      {imageSrc && !imagePreviewFailed && (
                        <button
                          type="button"
                          onClick={() => openLightbox(imageSrc)}
                          className="block rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                          title="Open full-size preview"
                        >
                          <img
                            src={imageSrc}
                            alt={att.name}
                            className="max-h-40 max-w-full object-cover"
                            onError={() => markImagePreviewFailed(imagePreviewKey)}
                          />
                        </button>
                      )}
                      {att.type === 'image' && (!imageSrc || imagePreviewFailed) && (
                        <div className="rounded-lg border border-border bg-bg-deep px-3 py-2 text-xs text-text-muted">
                          Preview unavailable for this image attachment.
                        </div>
                      )}
                      {/* Show text content for pasted text */}
                      {isTextAttachment && (
                        <pre className="text-xs bg-bg-deep rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono text-text-secondary max-h-60 overflow-y-auto">
                          {att.data}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {/* Show text content */}
            {hasContent && (
              <p className="whitespace-pre-wrap text-sm break-words">{message.content}</p>
            )}
            {/* Show placeholder if completely empty (shouldn't happen) */}
            {!hasContent && !hasAttachments && (
              <p className="text-text-muted italic">Empty message</p>
            )}
          </div>
          {/* Actions OUTSIDE and BELOW the bubble */}
          <div className={`mt-1 flex items-center gap-3 transition-opacity ${showRetry ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {showRetry && onRetry && (
              <button
                onClick={onRetry}
                disabled={Boolean(isRetrying)}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-bright disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
                title="Retry this message"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-success" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
        <UserAvatar name={userName} />
        {lightboxImageUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg-void/80 backdrop-blur-sm p-4"
            onClick={closeLightbox}
          >
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <img
                src={lightboxImageUrl}
                alt="Full-size preview"
                className="max-w-[80vw] max-h-[80vh] object-contain rounded-lg"
              />
              {canOpenLightboxInNewTab && (
                <a
                  href={lightboxImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Open image in new tab
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Helper to render markdown content
  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match
          const codeContent = String(children).replace(/\n$/, '')

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 bg-bg-elevated rounded text-accent-bright font-mono text-sm"
              >
                {children}
              </code>
            )
          }

          // Render mermaid diagrams inline
          if (match && match[1] === 'mermaid') {
            return (
              <MermaidInline content={codeContent} className="my-4" />
            )
          }

          return <MarkdownCodeBlock language={match[1]} codeContent={codeContent} />
        },
        p: ({ children }) => (
          <p className="mb-3 last:mb-0 text-sm text-text-primary leading-relaxed [overflow-wrap:anywhere]">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-4 mt-2 space-y-2 text-sm text-text-primary leading-relaxed">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-4 mt-2 space-y-2 text-sm text-text-primary leading-relaxed">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-text-primary leading-relaxed [overflow-wrap:anywhere]">{children}</li>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline [overflow-wrap:anywhere]"
          >
            {children}
          </a>
        ),
        img: ({ src, alt }) => {
          if (!src) return null
          const imagePreviewKey = `md:${src}`
          if (failedImagePreviews[imagePreviewKey]) {
            return (
              <div className="my-3 rounded-lg border border-border bg-bg-deep px-3 py-2 text-xs text-text-muted">
                Image preview unavailable.
              </div>
            )
          }
          return (
            <button
              type="button"
              onClick={() => openLightbox(src)}
              className="my-3 block rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
              title="Open full-size preview"
            >
              <img
                src={src}
                alt={alt || 'Image'}
                className="max-h-48 max-w-full object-contain"
                onError={() => markImagePreviewFailed(imagePreviewKey)}
              />
            </button>
          )
        },
        h1: ({ children }) => (
          <h1 className="text-xl font-semibold text-text-primary mb-3 mt-4 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-text-primary mb-2 mt-4 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-text-primary mb-2 mt-3 first:mt-0">
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-accent pl-4 italic text-sm text-text-secondary my-3">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="my-4 border-0 border-t border-border" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )

  type InterleavedRenderBlock =
    | { type: 'text'; key: string; content: string }
    | { type: 'tools'; key: string; toolEntries: ReturnType<typeof buildToolRenderEntries> }

  const interleavedBlocks: InterleavedRenderBlock[] = (() => {
    if (!segments || segments.length === 0) return []

    const blocks: InterleavedRenderBlock[] = []
    let segmentIndex = 0
    while (segmentIndex < segments.length) {
      const segment = segments[segmentIndex]
      if (segment.type === 'text') {
        blocks.push({
          type: 'text',
          key: `text-${segmentIndex}`,
          content: segment.content || (isStreaming ? '▊' : ''),
        })
        segmentIndex += 1
        continue
      }

      const runStart = segmentIndex
      const visibleToolCallsInRun: ToolCall[] = []
      while (segmentIndex < segments.length && segments[segmentIndex].type === 'tool') {
        const currentSegment = segments[segmentIndex]
        if (currentSegment.type !== 'tool') break
        const toolCall = toolCallsMap.get(currentSegment.toolCallId)
        const toolResult = toolResultsMap.get(currentSegment.toolCallId)

        if (toolCall && !isHiddenToolCall(toolCall, toolResult)) {
          visibleToolCallsInRun.push(toolCall)
        }

        segmentIndex += 1
      }

      if (visibleToolCallsInRun.length > 0) {
        blocks.push({
          type: 'tools',
          key: `tools-${runStart}`,
          toolEntries: buildToolRenderEntries(visibleToolCallsInRun),
        })
      }
    }

    return blocks
  })()

  // Assistant messages
  return (
    <div className="flex gap-4 group relative">
      {/* Timestamp - shows on hover */}
      <div className="absolute right-0 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-text-muted">{timestamp}</span>
      </div>
      <AIAvatar />

      <div className={shouldStretchAssistantContent ? 'w-full max-w-none' : 'max-w-[80%]'}>
        <div className="prose prose-invert prose-sm max-w-none">
          {/* Interleaved segments during streaming */}
          {segments && segments.length > 0 ? (
            <>
              {interleavedBlocks.map((block, blockIndex) => {
                if (block.type === 'text') {
                  const textSpacingClass = blockIndex > 0 ? 'mt-[10px]' : undefined
                  return (
                    <div key={block.key} className={textSpacingClass}>
                      {renderMarkdown(block.content)}
                    </div>
                  )
                }

                const toolSpacingClass = blockIndex > 0 ? 'mt-4' : undefined
                const blockClassName = toolSpacingClass ? `${toolSpacingClass} space-y-3` : 'space-y-3'

                return (
                  <div key={block.key} className={blockClassName}>
                    {block.toolEntries.map((entry, entryIndex) => {
                      if (entry.type === 'single') {
                        const { toolCall } = entry
                        return (
                          <SingleToolCallDisplay
                            key={toolCall.id || `tool-${block.key}-${entryIndex}`}
                            toolCall={toolCall}
                            toolResult={toolResultsMap.get(toolCall.id)}
                            isStreaming={isStreaming}
                            processingTone={processingToneByToolCallId.get(toolCall.id)}
                          />
                        )
                      }

                      return (
                        <ConsolidatedToolCallGroup
                          key={`group-${entry.toolName}-${block.key}-${entryIndex}`}
                          toolName={entry.toolName}
                          toolCalls={entry.toolCalls}
                          resultsMap={toolResultsMap}
                          isStreaming={isStreaming}
                          processingToneByToolCallId={processingToneByToolCallId}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </>
          ) : (
            <>
              {/* Fallback: Show text first (for saved messages without segments) */}
              {renderMarkdown(normalizedContent || (isStreaming ? '▊' : ''))}
              {/* Then show tool calls */}
              {toolCalls && toolCalls.length > 0 && (
                <ToolCallDisplay
                  toolCalls={toolCalls}
                  toolResults={toolResults}
                  isStreaming={isStreaming}
                />
              )}
            </>
          )}

          {/* Message actions for assistant messages (not while streaming) */}
          {isAssistant && !isStreaming && (
              <MessageActions
              content={normalizedContent}
              segments={segments}
              toolCalls={toolCalls}
              toolResults={toolResults}
              usage={isLastAssistantMessage ? message.usage : undefined}
              onRegenerate={isLastAssistantMessage ? onRegenerate : undefined}
              isRegenerating={isLastAssistantMessage ? isRegenerating : undefined}
            />
          )}
        </div>
      </div>
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-void/80 backdrop-blur-sm p-4"
          onClick={closeLightbox}
        >
          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImageUrl}
              alt="Full-size preview"
              className="max-w-[80vw] max-h-[80vh] object-contain rounded-lg"
            />
            {canOpenLightboxInNewTab && (
              <a
                href={lightboxImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Open image in new tab
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
