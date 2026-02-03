import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, FileText, Image, File } from 'lucide-react'
import { ToolCallDisplay, SingleToolCallDisplay, HIDDEN_TOOLS } from './ToolCallDisplay'
import { MessageActions } from './MessageActions'
import { MermaidInline } from '../Canvas/MermaidViewer'
import type { ToolCall, ToolResult, MessageUsage, MessageAttachment, StreamingSegment } from '../../stores/chat'

interface MessageProps {
  message: {
    id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    createdAt: number
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
  userName?: string  // User's name for avatar initial
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

export function Message({
  message,
  isStreaming,
  streamingToolCalls,
  streamingToolResults,
  streamingSegments,
  isLastAssistantMessage,
  onRegenerate,
  isRegenerating,
  userName,
}: MessageProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const timestamp = formatTimestamp(message.createdAt)

  // Use streaming tool calls if currently streaming, otherwise use saved tool calls
  const toolCalls = isStreaming ? streamingToolCalls : message.toolCalls
  const toolResults = isStreaming ? streamingToolResults : message.toolResults
  // Segments are only available during streaming
  const segments = isStreaming ? streamingSegments : undefined

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

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
          <div className="rounded-2xl px-4 py-3 bg-bg-elevated text-text-primary">
            {/* Show attachments first */}
            {hasAttachments && (
              <div className={`space-y-2 ${hasContent ? 'mb-3' : ''}`}>
                {message.attachments!.map((att) => {
                  const IconComponent = getAttachmentIcon(att.type)
                  const isTextAttachment = att.type === 'text' && att.data

                  return (
                    <div key={att.id} className="text-sm">
                      <div className="flex items-center gap-2 text-text-muted mb-1">
                        <IconComponent className="w-4 h-4" />
                        <span>{att.name}</span>
                      </div>
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
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
            {/* Show placeholder if completely empty (shouldn't happen) */}
            {!hasContent && !hasAttachments && (
              <p className="text-text-muted italic">Empty message</p>
            )}
          </div>
          {/* Actions OUTSIDE and BELOW the bubble */}
          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      </div>
    )
  }

  // Helper to render markdown content
  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ node, className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match
          const codeContent = String(children).replace(/\n$/, '')

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 bg-bg-elevated rounded text-accent-bright font-mono text-sm"
                {...props}
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

          return (
            <div className="relative group my-4">
              <div className="absolute top-2 right-2 text-xs text-text-muted">
                {match[1]}
              </div>
              <pre className="bg-bg-elevated rounded-lg p-4 overflow-x-auto">
                <code className="font-mono text-sm" {...props}>
                  {children}
                </code>
              </pre>
            </div>
          )
        },
        p: ({ children }) => (
          <p className="mb-3 last:mb-0 text-text-primary leading-relaxed">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-3 space-y-1 text-text-primary">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-3 space-y-1 text-text-primary">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-text-primary">{children}</li>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {children}
          </a>
        ),
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
          <blockquote className="border-l-2 border-accent pl-4 italic text-text-secondary my-3">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )

  // Assistant messages
  return (
    <div className="flex gap-4 group relative">
      {/* Timestamp - shows on hover */}
      <div className="absolute right-0 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-text-muted">{timestamp}</span>
      </div>
      <AIAvatar />

      <div className="max-w-[80%]">
        <div className="prose prose-invert prose-sm max-w-none">
          {/* Interleaved segments during streaming */}
          {segments && segments.length > 0 ? (
            <>
              {segments.map((segment, idx) => {
                if (segment.type === 'text') {
                  return (
                    <div key={`text-${idx}`}>
                      {renderMarkdown(segment.content || (isStreaming ? '▊' : ''))}
                    </div>
                  )
                } else {
                  // Tool segment - find the tool call and result
                  const toolCall = toolCalls?.find(tc => tc.id === segment.toolCallId)
                  const toolResult = toolResults?.find(tr => tr.toolCallId === segment.toolCallId)

                  // Skip hidden tools (wait_for_agent, get_agent_status, etc.)
                  if (!toolCall || HIDDEN_TOOLS.has(toolCall.name)) return null

                  return (
                    <SingleToolCallDisplay
                      key={`tool-${segment.toolCallId}`}
                      toolCall={toolCall}
                      toolResult={toolResult}
                      isStreaming={isStreaming}
                    />
                  )
                }
              })}
            </>
          ) : (
            <>
              {/* Fallback: Show tool calls first (for saved messages without segments) */}
              {toolCalls && toolCalls.length > 0 && (
                <ToolCallDisplay
                  toolCalls={toolCalls}
                  toolResults={toolResults}
                  isStreaming={isStreaming}
                />
              )}
              {/* Then show text content */}
              {renderMarkdown(message.content || (isStreaming ? '▊' : ''))}
            </>
          )}

          {/* Message actions for assistant messages (not while streaming) */}
          {isAssistant && !isStreaming && (
            <MessageActions
              content={message.content}
              toolCalls={toolCalls}
              toolResults={toolResults}
              usage={isLastAssistantMessage ? message.usage : undefined}
              onRegenerate={isLastAssistantMessage ? onRegenerate : undefined}
              isRegenerating={isLastAssistantMessage ? isRegenerating : undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}
