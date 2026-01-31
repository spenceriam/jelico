import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, Download, Eye, Code } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface DocumentViewerProps {
  content: string
  isStreaming?: boolean
}

export function DocumentViewer({ content, isStreaming = false }: DocumentViewerProps) {
  const [view, setView] = useState<'rendered' | 'source'>(isStreaming ? 'source' : 'rendered')
  const [copied, setCopied] = useState(false)
  const sourceRef = useRef<HTMLPreElement>(null)

  // Switch to rendered when streaming completes
  useEffect(() => {
    if (!isStreaming) {
      setView('rendered')
    }
  }, [isStreaming])

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && view === 'source' && sourceRef.current) {
      sourceRef.current.scrollTop = sourceRef.current.scrollHeight
    }
  }, [content, isStreaming, view])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-border">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-accent">Generating...</span>
            </div>
          )}
          <div className="flex items-center gap-1">
          <button
            onClick={() => setView('rendered')}
            className={`
              flex items-center gap-1.5 px-2 py-1 text-xs rounded
              ${view === 'rendered'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            <Eye className="w-3 h-3" />
            Rendered
          </button>
          <button
            onClick={() => setView('source')}
            className={`
              flex items-center gap-1.5 px-2 py-1 text-xs rounded
              ${view === 'source'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            <Code className="w-3 h-3" />
            Source
          </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Copy content"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Download as markdown"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-bg-deep">
        {view === 'rendered' ? (
          <div className="p-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-semibold text-text-primary mb-4 mt-6 first:mt-0 border-b border-border pb-2">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-text-primary mb-3 mt-5 first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-medium text-text-primary mb-2 mt-4 first:mt-0">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-text-secondary leading-relaxed mb-4">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-4 space-y-1 text-text-secondary">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-4 space-y-1 text-text-secondary">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="text-text-secondary">{children}</li>,
                code: ({ className, children }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  if (match) {
                    return (
                      <pre className="bg-bg-surface rounded-lg p-4 overflow-x-auto my-4">
                        <code className="font-mono text-sm text-text-primary">{children}</code>
                      </pre>
                    )
                  }
                  return (
                    <code className="px-1.5 py-0.5 bg-bg-surface rounded text-accent-bright font-mono text-sm">
                      {children}
                    </code>
                  )
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-accent pl-4 italic text-text-muted my-4">
                    {children}
                  </blockquote>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-bright underline"
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse border border-border">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-bg-surface px-4 py-2 text-left text-text-primary font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-4 py-2 text-text-secondary">
                    {children}
                  </td>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre
            ref={sourceRef}
            className="h-full overflow-auto p-4 text-sm font-mono text-text-secondary"
          >
            {content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
            )}
          </pre>
        )}
      </div>
    </div>
  )
}
