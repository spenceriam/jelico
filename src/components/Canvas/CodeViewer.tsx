import { Copy, Check, Download, AlertCircle, CheckCircle } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MonacoEditor } from './MonacoEditor'
import type { editor } from 'monaco-editor'

interface CodeViewerProps {
  code: string
  language: string
  title?: string
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

export function CodeViewer({ code, language, title, isStreaming = false, onSave }: CodeViewerProps) {
  const [copied, setCopied] = useState(false)
  const [editedContent, setEditedContent] = useState(code)
  const [hasChanges, setHasChanges] = useState(false)
  const [monacoErrors, setMonacoErrors] = useState<editor.IMarkerData[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Track the last saved content
  const lastSavedRef = useRef(code)

  // Debounce for auto-save
  const debouncedContent = useDebounce(editedContent, 1000)

  // Sync when code prop changes
  useEffect(() => {
    setEditedContent(code)
    setHasChanges(false)
    lastSavedRef.current = code
    setMonacoErrors([])
    setSaveStatus('idle')
  }, [code])

  // Auto-save when debounced content changes
  useEffect(() => {
    if (debouncedContent === lastSavedRef.current || !onSave || isStreaming) {
      return
    }

    const hasErrors = monacoErrors.some(m => m.severity === 8)

    if (!hasErrors) {
      setSaveStatus('saving')
      onSave(debouncedContent)
      lastSavedRef.current = debouncedContent
      setHasChanges(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
    }
  }, [debouncedContent, onSave, isStreaming, monacoErrors])

  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent)
    setHasChanges(newContent !== lastSavedRef.current)
    setSaveStatus('idle')
  }, [])

  const handleValidation = useCallback((markers: editor.IMarkerData[]) => {
    setMonacoErrors(markers)
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const ext = getFileExtension(language)
    const filename = title ? `${title.replace(/\s+/g, '-').toLowerCase()}.${ext}` : `code.${ext}`
    const blob = new Blob([editedContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col bg-bg-deep">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-border">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-accent">Generating...</span>
            </div>
          )}
          <span className="text-xs font-mono text-text-muted uppercase">{language}</span>
          {title && (
            <>
              <span className="text-text-faint">/</span>
              <span className="text-sm text-text-secondary">{title}</span>
            </>
          )}
          {hasChanges && !isStreaming && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save status */}
          {!isStreaming && onSave && (
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
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Validation errors */}
      {monacoErrors.filter(m => m.severity === 8).length > 0 && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-300">
              <div className="font-medium mb-1">Errors (changes not saved):</div>
              <ul className="list-disc list-inside space-y-0.5">
                {monacoErrors
                  .filter(m => m.severity === 8)
                  .slice(0, 5)
                  .map((error, idx) => (
                    <li key={idx}>
                      Line {error.startLineNumber}: {error.message}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          value={isStreaming ? code : editedContent}
          language={language}
          isStreaming={isStreaming}
          onChange={onSave ? handleContentChange : undefined}
          onValidation={handleValidation}
        />
      </div>
    </div>
  )
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    ruby: 'rb',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    php: 'php',
    swift: 'swift',
    kotlin: 'kt',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    markdown: 'md',
    sql: 'sql',
    bash: 'sh',
    shell: 'sh',
  }
  return extensions[language.toLowerCase()] || 'txt'
}
