import { useState, useRef, useEffect } from 'react'
import { RefreshCw, ExternalLink, Code, Eye, Copy, Check } from 'lucide-react'

interface HtmlViewerProps {
  html: string
}

export function HtmlViewer({ html }: HtmlViewerProps) {
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Check if the content is already a complete HTML document
  const isCompleteDocument = html.trim().toLowerCase().startsWith('<!doctype') ||
    html.trim().toLowerCase().startsWith('<html')

  // Use the HTML as-is if it's a complete document, otherwise wrap it
  const sandboxedHtml = isCompleteDocument
    ? html
    : `<!DOCTYPE html>
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
          background: #141418;
          color: #f5f4f1;
          line-height: 1.5;
        }
        a { color: #f59e0b; }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = () => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(sandboxedHtml)
        doc.close()
      }
    }
  }

  const handleOpenExternal = () => {
    const blob = new Blob([sandboxedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  useEffect(() => {
    handleRefresh()
  }, [html])

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
            <Code className="w-3 h-3" />
            Source
          </button>
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
      <div className="flex-1 overflow-hidden bg-bg-deep">
        {view === 'preview' ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title="HTML Preview"
          />
        ) : (
          <pre className="h-full overflow-auto p-4 text-sm font-mono text-text-secondary">
            {html}
          </pre>
        )}
      </div>
    </div>
  )
}
