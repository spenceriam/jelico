import { useRef, useEffect, useCallback } from 'react'
import Editor, { OnMount, OnChange, BeforeMount } from '@monaco-editor/react'
import type { editor, Uri } from 'monaco-editor'

interface MonacoEditorProps {
  value: string
  language: string
  isStreaming?: boolean
  onChange?: (value: string) => void
  onValidation?: (markers: editor.IMarkerData[]) => void
}

// Custom Jelico dark theme for Monaco
const JELICO_THEME_NAME = 'jelico-dark'

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

  // Define custom theme before editor mounts
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    // Define Jelico dark theme matching the app's color scheme
    monaco.editor.defineTheme(JELICO_THEME_NAME, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b6660', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'd4a574' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'd19a66' },
        { token: 'type', foreground: 'e5c07b' },
        { token: 'function', foreground: '61afef' },
        { token: 'variable', foreground: 'e8e6e3' },
        { token: 'tag', foreground: 'd4a574' },
        { token: 'attribute.name', foreground: 'd19a66' },
        { token: 'attribute.value', foreground: '98c379' },
      ],
      colors: {
        'editor.background': '#0d0d10',
        'editor.foreground': '#e8e6e3',
        'editor.lineHighlightBackground': '#1a1a2020',
        'editor.selectionBackground': '#d4a57440',
        'editor.inactiveSelectionBackground': '#d4a57420',
        'editorLineNumber.foreground': '#4a4844',
        'editorLineNumber.activeForeground': '#6b6660',
        'editorCursor.foreground': '#d4a574',
        'editor.selectionHighlightBackground': '#d4a57420',
        'editorIndentGuide.background': '#2a2926',
        'editorIndentGuide.activeBackground': '#3a3936',
        'editorBracketMatch.background': '#d4a57440',
        'editorBracketMatch.border': '#d4a574',
        'scrollbarSlider.background': '#2a292680',
        'scrollbarSlider.hoverBackground': '#3a393680',
        'scrollbarSlider.activeBackground': '#4a494680',
      },
    })
  }, [])

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
      monaco.editor.onDidChangeMarkers((uris: readonly Uri[]) => {
        const uri = uris[0]
        if (!uri) return
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

  // Auto-scroll to bottom during streaming (throttled to avoid layout thrashing)
  const lastScrollRef = useRef(0)
  useEffect(() => {
    if (isStreaming && editorRef.current) {
      const now = Date.now()
      // Throttle scrolls to every 100ms to prevent layout thrashing
      if (now - lastScrollRef.current < 100) return
      lastScrollRef.current = now

      const model = editorRef.current.getModel()
      if (model) {
        const lineCount = model.getLineCount()
        // Use revealLineNearTop to keep content visible at the bottom
        // with some context above, preventing the "disappearing content" issue
        editorRef.current.revealLineNearTop(Math.max(1, lineCount - 5))
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
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={monacoLanguage}
        value={value}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        theme={JELICO_THEME_NAME}
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
          // Disable some features during generating for performance
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
