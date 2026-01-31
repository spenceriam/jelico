import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, ExternalLink, Edit3, Eye, Copy, Check, GitCompare, AlertCircle, CheckCircle } from 'lucide-react'
import { DiffViewer } from './DiffViewer'
import { MonacoEditor } from './MonacoEditor'
import type { editor } from 'monaco-editor'

interface HtmlViewerProps {
  html: string
  isStreaming?: boolean
  onSave?: (content: string) => void
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function HtmlViewer({ html, isStreaming = false, onSave }: HtmlViewerProps) {
  // Default to editor view when streaming, preview when complete
  const [view, setView] = useState<'preview' | 'editor' | 'diff'>(isStreaming ? 'editor' : 'preview')
  const [editedContent, setEditedContent] = useState(html)
  const [hasChanges, setHasChanges] = useState(false)
  const [monacoErrors, setMonacoErrors] = useState<editor.IMarkerData[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Track the last saved content to avoid duplicate saves
  const lastSavedRef = useRef(html)

  // Debounce content changes for auto-save (1 second delay)
  const debouncedContent = useDebounce(editedContent, 1000)

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
    lastSavedRef.current = html
    setMonacoErrors([])
    setSaveStatus('idle')
  }, [html])

  // Auto-save when debounced content changes (only if no Monaco errors)
  useEffect(() => {
    // Skip if no changes or same as last saved
    if (debouncedContent === lastSavedRef.current || !onSave || isStreaming) {
      return
    }

    // Check Monaco validation errors (only errors, not warnings)
    const hasErrors = monacoErrors.some(m => m.severity === 8) // 8 = Error

    if (!hasErrors) {
      setSaveStatus('saving')
      onSave(debouncedContent)
      lastSavedRef.current = debouncedContent
      setHasChanges(false)
      setSaveStatus('saved')

      // Reset status after a moment
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
    }
  }, [debouncedContent, onSave, isStreaming, monacoErrors])

  const [copied, setCopied] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent)
    setHasChanges(newContent !== lastSavedRef.current)
    setSaveStatus('idle')
  }, [])

  const handleValidation = useCallback((markers: editor.IMarkerData[]) => {
    setMonacoErrors(markers)
  }, [])

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
          {hasChanges && (
            <button
              onClick={() => setView('diff')}
              className={`
                flex items-center gap-1.5 px-2 py-1 text-xs rounded
                ${view === 'diff'
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'}
              `}
            >
              <GitCompare className="w-3 h-3" />
              Diff
            </button>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save/validation status */}
          {(view === 'editor' || view === 'diff') && !isStreaming && (
            <div className="flex items-center gap-1.5 text-xs">
              {saveStatus === 'saving' && (
                <span className="text-text-muted">Saving...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  Invalid
                </span>
              )}
              {hasChanges && saveStatus === 'idle' && (
                <span className="text-text-muted">Unsaved changes</span>
              )}
            </div>
          )}

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
      </div>

      {/* Monaco validation errors (only show errors, not warnings) */}
      {monacoErrors.filter(m => m.severity === 8).length > 0 && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-300">
              <div className="font-medium mb-1">Validation errors (changes not saved):</div>
              <ul className="list-disc list-inside space-y-0.5">
                {monacoErrors
                  .filter(m => m.severity === 8)
                  .slice(0, 5)
                  .map((error, idx) => (
                    <li key={idx}>
                      Line {error.startLineNumber}: {error.message}
                    </li>
                  ))}
                {monacoErrors.filter(m => m.severity === 8).length > 5 && (
                  <li>...and {monacoErrors.filter(m => m.severity === 8).length - 5} more errors</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

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
        ) : view === 'diff' ? (
          // Diff view showing changes
          <div className="h-full overflow-auto bg-bg-deep">
            <DiffViewer original={html} modified={editedContent} />
          </div>
        ) : (
          // Monaco Editor - handles both streaming (read-only) and editing modes
          <MonacoEditor
            value={isStreaming ? html : editedContent}
            language="html"
            isStreaming={isStreaming}
            onChange={handleContentChange}
            onValidation={handleValidation}
          />
        )}
      </div>
    </div>
  )
}
