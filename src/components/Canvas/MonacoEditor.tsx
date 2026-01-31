import { useRef, useEffect, useCallback } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface MonacoEditorProps {
  value: string
  language: string
  isStreaming?: boolean
  onChange?: (value: string) => void
  onValidation?: (markers: editor.IMarkerData[]) => void
}

// Map our artifact types to Monaco language IDs
function getMonacoLanguage(language: string): string {
  const mapping: Record<string, string> = {
    // Web
    html: 'html',
    css: 'css',
    javascript: 'javascript',
    js: 'javascript',
    typescript: 'typescript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    json: 'json',

    // Other languages
    python: 'python',
    py: 'python',
    rust: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'csharp',
    ruby: 'ruby',
    php: 'php',
    swift: 'swift',
    kotlin: 'kotlin',
    sql: 'sql',
    yaml: 'yaml',
    xml: 'xml',
    markdown: 'markdown',
    md: 'markdown',
    shell: 'shell',
    bash: 'shell',

    // Diagram types
    mermaid: 'markdown', // No native mermaid support, use markdown
    svg: 'xml',

    // Default
    text: 'plaintext',
  }

  return mapping[language.toLowerCase()] || 'plaintext'
}

export function MonacoEditor({
  value,
  language,
  isStreaming = false,
  onChange,
  onValidation,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Configure editor options
    editor.updateOptions({
      readOnly: isStreaming,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      renderLineHighlight: 'line',
      automaticLayout: true,
      wordWrap: 'on',
      tabSize: 2,
    })

    // Listen for validation markers
    if (onValidation) {
      monaco.editor.onDidChangeMarkers(([uri]) => {
        const model = editor.getModel()
        if (model && uri.toString() === model.uri.toString()) {
          const markers = monaco.editor.getModelMarkers({ resource: uri })
          onValidation(markers)
        }
      })
    }
  }, [isStreaming, onValidation])

  // Update read-only state when streaming changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: isStreaming })
    }
  }, [isStreaming])

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && editorRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        const lineCount = model.getLineCount()
        editorRef.current.revealLine(lineCount)
      }
    }
  }, [value, isStreaming])

  // Handle content changes from user
  const handleChange: OnChange = useCallback((newValue) => {
    if (!isStreaming && onChange && newValue !== undefined) {
      onChange(newValue)
    }
  }, [isStreaming, onChange])

  const monacoLanguage = getMonacoLanguage(language)

  return (
    <div className="h-full w-full relative">
      {/* Streaming indicator overlay */}
      {isStreaming && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-2 py-1 bg-bg-elevated/90 rounded text-xs text-accent border border-accent/30">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Streaming...
        </div>
      )}

      <Editor
        height="100%"
        language={monacoLanguage}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          readOnly: isStreaming,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          automaticLayout: true,
          wordWrap: 'on',
          tabSize: 2,
          // Disable some features during streaming for performance
          ...(isStreaming ? {
            quickSuggestions: false,
            parameterHints: { enabled: false },
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnEnter: 'off',
            tabCompletion: 'off',
            wordBasedSuggestions: 'off',
          } : {}),
        }}
        loading={
          <div className="h-full w-full flex items-center justify-center bg-bg-deep text-text-muted">
            Loading editor...
          </div>
        }
      />
    </div>
  )
}
