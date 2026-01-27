import { X, FileCode, FileText, Image, Presentation, ChevronLeft, ChevronRight } from 'lucide-react'
import { useArtifactStore, type Artifact, type ArtifactType } from '../../stores/artifacts'
import { CodeViewer } from './CodeViewer'
import { DocumentViewer } from './DocumentViewer'
import { HtmlViewer } from './HtmlViewer'

const TYPE_ICONS: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  code: FileCode,
  document: FileText,
  html: Presentation,
  svg: Image,
  mermaid: Image,
}

const TYPE_LABELS: Record<ArtifactType, string> = {
  code: 'Code',
  document: 'Document',
  html: 'HTML Preview',
  svg: 'SVG',
  mermaid: 'Diagram',
}

export function CanvasPanel() {
  const {
    artifacts,
    selectedArtifactId,
    canvasOpen,
    selectArtifact,
    closeCanvas,
    removeArtifact,
  } = useArtifactStore()

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId)
  const currentIndex = artifacts.findIndex((a) => a.id === selectedArtifactId)

  if (!canvasOpen) return null

  const handlePrevious = () => {
    if (currentIndex > 0) {
      selectArtifact(artifacts[currentIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (currentIndex < artifacts.length - 1) {
      selectArtifact(artifacts[currentIndex + 1].id)
    }
  }

  return (
    <div className="w-[500px] flex-shrink-0 border-l border-border bg-bg-surface flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-3">
          {selectedArtifact && (
            <>
              {(() => {
                const Icon = TYPE_ICONS[selectedArtifact.type]
                return <Icon className="w-5 h-5 text-accent" />
              })()}
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  {selectedArtifact.title}
                </h3>
                <span className="text-xs text-text-muted">
                  {TYPE_LABELS[selectedArtifact.type]}
                </span>
              </div>
            </>
          )}
          {!selectedArtifact && (
            <span className="text-sm text-text-muted">No artifact selected</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Navigation */}
          {artifacts.length > 1 && (
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
                {currentIndex + 1}/{artifacts.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex >= artifacts.length - 1}
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

      {/* Artifact list (tabs) */}
      {artifacts.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border overflow-x-auto">
          {artifacts.map((artifact) => {
            const Icon = TYPE_ICONS[artifact.type]
            return (
              <button
                key={artifact.id}
                onClick={() => selectArtifact(artifact.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 text-xs rounded-md whitespace-nowrap
                  transition-colors
                  ${artifact.id === selectedArtifactId
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                  }
                `}
              >
                <Icon className="w-3 h-3" />
                <span className="max-w-24 truncate">{artifact.title}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectedArtifact ? (
          <ArtifactContent artifact={selectedArtifact} />
        ) : artifacts.length === 0 ? (
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
      // Mermaid would need a library to render - for now show code
      return (
        <CodeViewer code={artifact.content} language="mermaid" title={artifact.title} />
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
