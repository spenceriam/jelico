import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { Copy, Check, Download, Eye, Code, RefreshCw } from 'lucide-react'

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#d4a574',
    primaryTextColor: '#e8e6e3',
    primaryBorderColor: '#2a2926',
    lineColor: '#6b6660',
    secondaryColor: '#1a1a20',
    tertiaryColor: '#141418',
    background: '#0d0d10',
    mainBkg: '#141418',
    secondBkg: '#1a1a20',
    border1: '#2a2926',
    border2: '#1f1e1c',
    arrowheadColor: '#d4a574',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: '14px',
    textColor: '#e8e6e3',
    nodeTextColor: '#e8e6e3',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
})

interface MermaidViewerProps {
  content: string
  title?: string
}

export function MermaidViewer({ content, title }: MermaidViewerProps) {
  const [view, setView] = useState<'diagram' | 'source'>('diagram')
  const [copied, setCopied] = useState(false)
  const [svgContent, setSvgContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  const renderDiagram = async () => {
    try {
      setError(null)
      const { svg } = await mermaid.render(idRef.current, content)
      setSvgContent(svg)
    } catch (err: any) {
      setError(err.message || 'Failed to render diagram')
      console.error('Mermaid render error:', err)
    }
  }

  useEffect(() => {
    // Generate new ID for each render to avoid conflicts
    idRef.current = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    renderDiagram()
  }, [content])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadSvg = () => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'diagram'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPng = async () => {
    if (!svgContent) return

    // Create an image from SVG
    const img = new Image()
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = 2 // Higher resolution
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(scale, scale)
        ctx.fillStyle = '#0d0d10'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)

        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = pngUrl
            a.download = `${title || 'diagram'}.png`
            a.click()
            URL.revokeObjectURL(pngUrl)
          }
        }, 'image/png')
      }
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('diagram')}
            className={`
              flex items-center gap-1.5 px-2 py-1 text-xs rounded
              ${view === 'diagram'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            <Eye className="w-3 h-3" />
            Diagram
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
          {view === 'diagram' && (
            <>
              <button
                onClick={renderDiagram}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                title="Re-render diagram"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownloadSvg}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                title="Download SVG"
                disabled={!svgContent}
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Copy mermaid code"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-bg-deep">
        {view === 'diagram' ? (
          <div className="h-full flex items-center justify-center p-4">
            {error ? (
              <div className="text-center text-error">
                <p className="mb-2">Failed to render diagram</p>
                <pre className="text-xs text-text-muted bg-bg-surface p-2 rounded max-w-md overflow-auto">
                  {error}
                </pre>
              </div>
            ) : svgContent ? (
              <div
                ref={containerRef}
                className="max-w-full max-h-full overflow-auto"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : (
              <div className="text-text-muted">Loading diagram...</div>
            )}
          </div>
        ) : (
          <pre className="h-full overflow-auto p-4 text-sm font-mono text-text-secondary">
            {content}
          </pre>
        )}
      </div>
    </div>
  )
}

// Compact version for inline rendering in chat
interface MermaidInlineProps {
  content: string
  className?: string
}

export function MermaidInline({ content, className = '' }: MermaidInlineProps) {
  const [svgContent, setSvgContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-inline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        idRef.current = `mermaid-inline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const { svg } = await mermaid.render(idRef.current, content)
        setSvgContent(svg)
      } catch (err: any) {
        setError(err.message || 'Failed to render diagram')
      }
    }
    renderDiagram()
  }, [content])

  if (error) {
    return (
      <div className={`bg-bg-elevated border border-border rounded-lg p-4 ${className}`}>
        <div className="text-xs text-error mb-2">Diagram error</div>
        <pre className="text-xs font-mono text-text-muted overflow-x-auto">{content}</pre>
      </div>
    )
  }

  if (!svgContent) {
    return (
      <div className={`bg-bg-elevated border border-border rounded-lg p-4 text-text-muted ${className}`}>
        Loading diagram...
      </div>
    )
  }

  return (
    <div className={`bg-bg-elevated border border-border rounded-lg p-4 overflow-x-auto ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: svgContent }} />
    </div>
  )
}
