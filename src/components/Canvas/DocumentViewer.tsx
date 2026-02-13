import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, Download, Eye, Edit3 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '../../stores/ui'

interface DocumentViewerProps {
  content: string
  isStreaming?: boolean
}

export function DocumentViewer({ content, isStreaming = false }: DocumentViewerProps) {
  const [view, setView] = useState<'preview' | 'source'>(isStreaming ? 'source' : 'preview')
  const [copied, setCopied] = useState(false)
  const sourceRef = useRef<HTMLPreElement>(null)
  const artifactDocumentFontPt = useUIStore((state) => state.artifactDocumentFontPt)

  const toPt = (multiplier: number, minimum = 8) =>
    `${Math.max(minimum, artifactDocumentFontPt * multiplier).toFixed(1)}pt`

  // Switch to preview when streaming completes
  useEffect(() => {
    if (!isStreaming) {
      setView('preview')
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('preview')}
            className={`
              flex items-center gap-1.5 px-2 py-1 text-xs rounded
              ${view === 'preview'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            <Eye className="w-3 h-3" />
            Preview
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
            <Edit3 className="w-3 h-3" />
            Editor
          </button>
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
        {view === 'preview' ? (
          <div className="p-6 max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1
                    className="font-semibold text-text-primary mb-4 mt-6 first:mt-0 border-b border-border pb-2"
                    style={{ fontSize: toPt(1.5), lineHeight: 1.25 }}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    className="font-semibold text-text-primary mb-3 mt-5 first:mt-0"
                    style={{ fontSize: toPt(1.3), lineHeight: 1.3 }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    className="font-medium text-text-primary mb-2 mt-4 first:mt-0"
                    style={{ fontSize: toPt(1.15), lineHeight: 1.35 }}
                  >
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p
                    className="text-text-secondary leading-relaxed mb-4"
                    style={{ fontSize: toPt(1), lineHeight: 1.7 }}
                  >
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul
                    className="list-disc list-inside mb-4 space-y-1 text-text-secondary"
                    style={{ fontSize: toPt(1), lineHeight: 1.7 }}
                  >
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol
                    className="list-decimal list-inside mb-4 space-y-1 text-text-secondary"
                    style={{ fontSize: toPt(1), lineHeight: 1.7 }}
                  >
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-text-secondary" style={{ fontSize: toPt(1), lineHeight: 1.7 }}>
                    {children}
                  </li>
                ),
                code: ({ className, children }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  if (match) {
                    return (
                      <pre className="bg-bg-surface rounded-lg p-4 overflow-x-auto my-4">
                        <code
                          className="font-mono text-text-primary"
                          style={{ fontSize: toPt(0.9, 7), lineHeight: 1.5 }}
                        >
                          {children}
                        </code>
                      </pre>
                    )
                  }
                  return (
                    <code
                      className="px-1.5 py-0.5 bg-bg-surface rounded text-accent-bright font-mono"
                      style={{ fontSize: toPt(0.9, 7), lineHeight: 1.5 }}
                    >
                      {children}
                    </code>
                  )
                },
                blockquote: ({ children }) => (
                  <blockquote
                    className="border-l-2 border-accent pl-4 italic text-text-muted my-4"
                    style={{ fontSize: toPt(0.95), lineHeight: 1.65 }}
                  >
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
                    <table
                      className="w-full border-collapse border border-border"
                      style={{ fontSize: toPt(0.95), lineHeight: 1.6 }}
                    >
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th
                    className="border border-border bg-bg-surface px-4 py-2 text-left text-text-primary font-medium"
                    style={{ fontSize: toPt(0.95), lineHeight: 1.6 }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td
                    className="border border-border px-4 py-2 text-text-secondary"
                    style={{ fontSize: toPt(0.95), lineHeight: 1.6 }}
                  >
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
            className="h-full overflow-auto p-4 font-mono text-text-secondary"
            style={{ fontSize: toPt(0.9, 7), lineHeight: 1.5 }}
          >
            {content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-accent ml-0.5" />
            )}
          </pre>
        )}
      </div>
    </div>
  )
}
