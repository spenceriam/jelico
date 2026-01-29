import { X, FileCode, FileText, Image, Presentation, ChevronLeft, ChevronRight, ChevronDown, File } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useArtifactStore, type Artifact, type ArtifactType } from '../../stores/artifacts'
import { useChatStore } from '../../stores/chat'
import { CodeViewer } from './CodeViewer'
import { DocumentViewer } from './DocumentViewer'
import { HtmlViewer } from './HtmlViewer'
import { MermaidViewer } from './MermaidViewer'

const TYPE_ICONS: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  code: FileCode,
  document: FileText,
  html: Presentation,
  svg: Image,
  mermaid: Image,
}

// Fallback icon for unknown artifact types
const DEFAULT_TYPE_ICON = File

const TYPE_LABELS: Record<ArtifactType, string> = {
  code: 'Code',
  document: 'Document',
  html: 'HTML Preview',
  svg: 'SVG',
  mermaid: 'Diagram',
}

// Fallback label for unknown artifact types
const DEFAULT_TYPE_LABEL = 'Unknown'

export function CanvasPanel() {
  const {
    artifacts,
    selectedArtifactId,
    canvasOpen,
    selectArtifact,
    closeCanvas,
    removeArtifact,
  } = useArtifactStore()
  const { activeConversationId } = useChatStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter artifacts to current conversation
  const conversationArtifacts = activeConversationId
    ? artifacts.filter((a) => a.conversationId === activeConversationId)
    : artifacts

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId)
  const currentIndex = conversationArtifacts.findIndex((a) => a.id === selectedArtifactId)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!canvasOpen) return null

  const handlePrevious = () => {
    if (currentIndex > 0) {
      selectArtifact(conversationArtifacts[currentIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (currentIndex < conversationArtifacts.length - 1) {
      selectArtifact(conversationArtifacts[currentIndex + 1].id)
    }
  }

  return (
    <div className="w-[500px] flex-shrink-0 border-l border-border bg-bg-surface flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-3 relative" ref={dropdownRef}>
          {selectedArtifact && (
            <>
              {(() => {
                const Icon = TYPE_ICONS[selectedArtifact.type] || DEFAULT_TYPE_ICON
                return <Icon className="w-5 h-5 text-accent" />
              })()}
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:bg-bg-hover rounded px-2 py-1 transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-sm font-medium text-text-primary">
                    {selectedArtifact.title}
                  </h3>
                  <span className="text-xs text-text-muted">
                    {TYPE_LABELS[selectedArtifact.type] || DEFAULT_TYPE_LABEL}
                  </span>
                </div>
                {conversationArtifacts.length > 1 && (
                  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* Dropdown picker */}
              {dropdownOpen && conversationArtifacts.length > 1 && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {conversationArtifacts.map((artifact) => {
                    const Icon = TYPE_ICONS[artifact.type] || DEFAULT_TYPE_ICON
                    return (
                      <button
                        key={artifact.id}
                        onClick={() => {
                          selectArtifact(artifact.id)
                          setDropdownOpen(false)
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-bg-hover transition-colors ${
                          artifact.id === selectedArtifactId ? 'bg-bg-hover' : ''
                        }`}
                      >
                        <Icon className="w-4 h-4 text-text-muted flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary truncate">{artifact.title}</div>
                          <div className="text-xs text-text-muted">{TYPE_LABELS[artifact.type] || DEFAULT_TYPE_LABEL}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
          {!selectedArtifact && (
            <span className="text-sm text-text-muted">No artifact selected</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Navigation */}
          {conversationArtifacts.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                disabled={currentIndex <= 0}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous artifact"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-muted px-1">
                {currentIndex + 1}/{conversationArtifacts.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex >= conversationArtifacts.length - 1}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next artifact"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Close button */}
          <button
            onClick={closeCanvas}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors ml-2"
            title="Close canvas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectedArtifact ? (
          <ArtifactContent artifact={selectedArtifact} />
        ) : conversationArtifacts.length === 0 ? (
          <EmptyState />
        ) : null}
      </div>

      {/* Footer with actions */}
      {selectedArtifact && (
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-faint">
            Created {new Date(selectedArtifact.createdAt).toLocaleTimeString()}
          </span>
          <button
            onClick={() => removeArtifact(selectedArtifact.id)}
            className="text-xs text-text-muted hover:text-error transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function ArtifactContent({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case 'code':
      return (
        <CodeViewer
          code={artifact.content}
          language={artifact.language || 'text'}
          title={artifact.title}
        />
      )
    case 'document':
      return <DocumentViewer content={artifact.content} />
    case 'html':
      return <HtmlViewer html={artifact.content} />
    case 'svg':
      return (
        <div className="h-full flex items-center justify-center p-4 bg-bg-deep">
          <div
            className="max-w-full max-h-full"
            dangerouslySetInnerHTML={{ __html: artifact.content }}
          />
        </div>
      )
    case 'mermaid':
      return (
        <MermaidViewer content={artifact.content} title={artifact.title} />
      )
    default:
      return (
        <div className="p-4 text-text-muted">
          Unknown artifact type
        </div>
      )
  }
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center p-8 text-center">
      <div>
        <FileCode className="w-12 h-12 text-text-faint mx-auto mb-4" />
        <h3 className="text-sm font-medium text-text-secondary mb-1">
          No artifacts yet
        </h3>
        <p className="text-xs text-text-muted max-w-48">
          Artifacts created during the conversation will appear here
        </p>
      </div>
    </div>
  )
}
