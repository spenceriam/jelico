import { useState, useMemo, useEffect, useRef } from 'react'
import { RefreshCw, ExternalLink, Edit3, Eye, Copy, Check, Save } from 'lucide-react'

interface HtmlViewerProps {
  html: string
  isStreaming?: boolean
  onSave?: (content: string) => void
}

export function HtmlViewer({ html, isStreaming = false, onSave }: HtmlViewerProps) {
  // Default to editor view when streaming, preview when complete
  const [view, setView] = useState<'preview' | 'editor'>(isStreaming ? 'editor' : 'preview')
  const [editedContent, setEditedContent] = useState(html)
  const [hasChanges, setHasChanges] = useState(false)

  // Switch to preview when streaming completes
  useEffect(() => {
    if (!isStreaming) {
      setView('preview')
    }
  }, [isStreaming])

  // Sync edited content when html prop changes (new artifact or streaming)
  useEffect(() => {
    setEditedContent(html)
    setHasChanges(false)
  }, [html])

  const [copied, setCopied] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const streamingRef = useRef<HTMLPreElement>(null)

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && view === 'editor' && streamingRef.current) {
      streamingRef.current.scrollTop = streamingRef.current.scrollHeight
    }
  }, [html, isStreaming, view])

  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent)
    setHasChanges(newContent !== html)
  }

  const handleSave = () => {
    if (onSave && hasChanges) {
      onSave(editedContent)
      setHasChanges(false)
    }
  }

  // Use editedContent for preview (so edits are reflected)
  const displayContent = view === 'preview' ? editedContent : html

  // Check if the content is already a complete HTML document
  const isCompleteDocument = displayContent.trim().toLowerCase().startsWith('<!doctype') ||
    displayContent.trim().toLowerCase().startsWith('<html')

  // Use the HTML as-is if it's a complete document, otherwise wrap it
  // Memoize to avoid recalculating on every render
  const sandboxedHtml = useMemo(() => {
    if (isCompleteDocument) return displayContent

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
  ${displayContent}
</body>
</html>`
  }, [displayContent, isCompleteDocument])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent)
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
            onClick={() => setView('editor')}
            className={`
              flex items-center gap-1.5 px-2 py-1 text-xs rounded
              ${view === 'editor'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            <Edit3 className="w-3 h-3" />
            Editor
            {hasChanges && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
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
          {view === 'editor' && hasChanges && onSave && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-accent text-bg-base rounded hover:bg-accent-bright transition-colors"
              title="Save changes"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
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
        ) : isStreaming ? (
          // Read-only streaming view
          <pre
            ref={streamingRef}
            className="h-full overflow-auto p-4 text-sm font-mono text-text-secondary bg-bg-deep"
          >
            {html}
            <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
          </pre>
        ) : (
          // Editable editor view
          <textarea
            ref={editorRef}
            value={editedContent}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-full p-4 text-sm font-mono text-text-secondary bg-bg-deep border-0 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  )
}
