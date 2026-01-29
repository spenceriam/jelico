import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Bot, Copy, Check } from 'lucide-react'
import { ToolCallDisplay } from './ToolCallDisplay'
import { MessageActions } from './MessageActions'
import { MermaidInline } from '../Canvas/MermaidViewer'
import type { ToolCall, ToolResult, MessageUsage } from '../../stores/chat'

interface MessageProps {
  message: {
    id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    createdAt: number
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
    usage?: MessageUsage
  }
  isStreaming?: boolean
  streamingToolCalls?: ToolCall[]
  streamingToolResults?: ToolResult[]
  isLastAssistantMessage?: boolean
  onRegenerate?: () => void
  isRegenerating?: boolean
}

export function Message({
  message,
  isStreaming,
  streamingToolCalls,
  streamingToolResults,
  isLastAssistantMessage,
  onRegenerate,
  isRegenerating,
}: MessageProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // Use streaming tool calls if currently streaming, otherwise use saved tool calls
  const toolCalls = isStreaming ? streamingToolCalls : message.toolCalls
  const toolResults = isStreaming ? streamingToolResults : message.toolResults

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // User messages - actions OUTSIDE the bubble
  if (isUser) {
    return (
      <div className="flex gap-4 justify-end group">
        <div className="max-w-[80%] flex flex-col items-end">
          {/* Message bubble */}
          <div className="rounded-2xl px-4 py-3 bg-bg-elevated text-text-primary">
            <p className="whitespace-pre-wrap">{message.content}</p>
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
        <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-text-secondary" />
        </div>
      </div>
    )
  }

  // Assistant messages
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-accent" />
      </div>

      <div className="max-w-[80%]">
        <div className="prose prose-invert prose-sm max-w-none">
          {/* Show tool calls before the text response */}
          {toolCalls && toolCalls.length > 0 && (
            <ToolCallDisplay
              toolCalls={toolCalls}
              toolResults={toolResults}
              isStreaming={isStreaming}
            />
          )}
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
            {message.content || (isStreaming ? '▊' : '')}
          </ReactMarkdown>

          {/* Message actions for assistant messages (not while streaming) */}
          {isAssistant && !isStreaming && isLastAssistantMessage && (
            <MessageActions
              content={message.content}
              usage={message.usage}
              onRegenerate={onRegenerate}
              isRegenerating={isRegenerating}
            />
          )}
        </div>
      </div>
    </div>
  )
}
