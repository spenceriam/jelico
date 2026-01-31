import { useState, useMemo, useEffect, useRef } from 'react'
import { RefreshCw, ExternalLink, Code, Eye, Copy, Check } from 'lucide-react'

interface HtmlViewerProps {
  html: string
  isStreaming?: boolean
}

export function HtmlViewer({ html, isStreaming = false }: HtmlViewerProps) {
  // Default to source view when streaming, preview when complete
  const [view, setView] = useState<'preview' | 'source'>(isStreaming ? 'source' : 'preview')

  // Switch to preview when streaming completes
  useEffect(() => {
    if (!isStreaming) {
      setView('preview')
    }
  }, [isStreaming])
  const [copied, setCopied] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const sourceRef = useRef<HTMLPreElement>(null)

  // Auto-scroll source view during streaming
  useEffect(() => {
    if (isStreaming && view === 'source' && sourceRef.current) {
      sourceRef.current.scrollTop = sourceRef.current.scrollHeight
    }
  }, [html, isStreaming, view])

  // Check if the content is already a complete HTML document
  const isCompleteDocument = html.trim().toLowerCase().startsWith('<!doctype') ||
    html.trim().toLowerCase().startsWith('<html')

  // Use the HTML as-is if it's a complete document, otherwise wrap it
  // Memoize to avoid recalculating on every render
  const sandboxedHtml = useMemo(() => {
    if (isCompleteDocument) return html

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #ffffff;
      color: #1a1a1a;
      line-height: 1.5;
    }
    a { color: #2563eb; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`
  }, [html, isCompleteDocument])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = () => {
    // Force iframe to re-render by changing key
    setRefreshKey(k => k + 1)
  }

  const handleOpenExternal = () => {
    const blob = new Blob([sandboxedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
            <Code className="w-3 h-3" />
            Source
          </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {view === 'preview' && (
            <>
              <button
                onClick={handleRefresh}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                title="Refresh preview"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleOpenExternal}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Copy HTML"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-white">
        {view === 'preview' ? (
          <iframe
            key={refreshKey}
            srcDoc={sandboxedHtml}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            title="HTML Preview"
          />
        ) : (
          <pre
            ref={sourceRef}
            className="h-full overflow-auto p-4 text-sm font-mono text-text-secondary bg-bg-deep"
          >
            {html}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
            )}
          </pre>
        )}
      </div>
    </div>
  )
}
