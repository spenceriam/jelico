import { X, FileCode, FileText, Image, Presentation, ChevronLeft, ChevronRight, ChevronDown, File, History, FolderOpen, Trash2, Camera, LayoutGrid } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
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

// Get display label for artifact's actual file type
function getFileTypeLabel(artifact: Artifact): string {
  // For code artifacts, show the language
  if (artifact.type === 'code' && artifact.language) {
    const languageLabels: Record<string, string> = {
      javascript: 'JavaScript',
      js: 'JavaScript',
      typescript: 'TypeScript',
      ts: 'TypeScript',
      tsx: 'TypeScript React',
      jsx: 'JavaScript React',
      python: 'Python',
      py: 'Python',
      rust: 'Rust',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      c: 'C',
      cpp: 'C++',
      'c++': 'C++',
      csharp: 'C#',
      'c#': 'C#',
      ruby: 'Ruby',
      rb: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kotlin: 'Kotlin',
      kt: 'Kotlin',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      css: 'CSS',
      scss: 'SCSS',
      sass: 'SCSS',
      sql: 'SQL',
      shell: 'Shell',
      bash: 'Bash',
      sh: 'Shell',
      powershell: 'PowerShell',
      ps1: 'PowerShell',
      markdown: 'Markdown',
      md: 'Markdown',
      html: 'HTML',
      text: 'Text',
      txt: 'Text',
    }
    return languageLabels[artifact.language.toLowerCase()] || artifact.language.toUpperCase()
  }

  // For document type, check if language specifies format
  if (artifact.type === 'document') {
    if (artifact.language) {
      if (artifact.language.toLowerCase() === 'text' || artifact.language.toLowerCase() === 'txt') {
        return 'Text'
      }
      if (artifact.language.toLowerCase() === 'markdown' || artifact.language.toLowerCase() === 'md') {
        return 'Markdown'
      }
      return artifact.language
    }
    return 'Markdown' // Default for documents
  }

  // For other types, use type-specific labels
  const typeLabels: Record<ArtifactType, string> = {
    code: 'Code',
    document: 'Markdown',
    html: 'HTML',
    svg: 'SVG',
    mermaid: 'Mermaid',
  }
  return typeLabels[artifact.type] || 'File'
}

// Format date/time for display
function formatDateTime(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function CanvasPanel() {
  const {
    artifacts,
    selectedArtifactId,
    selectedRevisionId,
    openArtifactIds,
    canvasOpen,
    libraryOpen,
    selectArtifact,
    closeArtifactTab,
    selectRevision,
    getRevisions,
    getBaseArtifactId,
    closeCanvas,
    toggleLibrary,
    removeArtifact,
    ensureArtifactContent,
  } = useArtifactStore()
  const { activeConversationId } = useChatStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [revisionDropdownOpen, setRevisionDropdownOpen] = useState(false)
  const [revisions, setRevisions] = useState<Artifact[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const revisionDropdownRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const revisionsRequestRef = useRef(0)

  // Filter artifacts to current conversation
  const conversationArtifacts = activeConversationId
    ? artifacts.filter((a) => a.conversationId === activeConversationId)
    : artifacts

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId)
  const currentIndex = conversationArtifacts.findIndex((a) => a.id === selectedArtifactId)

  // Auto-select appropriate artifact when conversation changes
  useEffect(() => {
    if (!activeConversationId) return

    // If selected artifact doesn't belong to current conversation
    const selectedBelongsToConversation = selectedArtifact?.conversationId === activeConversationId

    if (!selectedBelongsToConversation && conversationArtifacts.length > 0) {
      // Select the most recent artifact from current conversation
      const latestArtifact = conversationArtifacts[conversationArtifacts.length - 1]
      selectArtifact(latestArtifact.id)
    } else if (!selectedBelongsToConversation && conversationArtifacts.length === 0) {
      // No artifacts in this conversation, clear selection
      selectArtifact(null)
    }
  }, [activeConversationId, selectedArtifact?.conversationId, conversationArtifacts.length, selectArtifact])

  // Load revisions when selected artifact identity/content changes
  useEffect(() => {
    if (!selectedArtifact) {
      revisionsRequestRef.current += 1
      setRevisions([])
      return
    }

    const requestId = revisionsRequestRef.current + 1
    revisionsRequestRef.current = requestId
    const baseId = getBaseArtifactId(selectedArtifact)

    getRevisions(baseId)
      .then((nextRevisions) => {
        if (revisionsRequestRef.current !== requestId) return
        setRevisions(nextRevisions)
      })
      .catch((error) => {
        console.error('Failed to load artifact revisions:', error)
        if (revisionsRequestRef.current === requestId) {
          setRevisions([])
        }
      })
  }, [selectedArtifact?.id, selectedArtifact?.baseArtifactId, selectedArtifact?.updatedAt, getBaseArtifactId, getRevisions])

  useEffect(() => {
    if (!selectedRevisionId) return
    if (revisions.some((revision) => revision.id === selectedRevisionId)) return
    selectRevision(null)
  }, [revisions, selectedRevisionId, selectRevision])

  // Get the artifact to display (selected revision or latest)
  const displayArtifact = selectedRevisionId
    ? revisions.find(r => r.id === selectedRevisionId) || selectedArtifact
    : selectedArtifact

  // Lazy-load artifact file content: summaries ship without content, so the
  // first time an artifact is displayed we pull its body from disk on demand.
  useEffect(() => {
    if (displayArtifact && !displayArtifact.content && displayArtifact.filePath) {
      void ensureArtifactContent(displayArtifact.id)
    }
  }, [displayArtifact?.id, displayArtifact?.content, displayArtifact?.filePath, ensureArtifactContent])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (revisionDropdownRef.current && !revisionDropdownRef.current.contains(event.target as Node)) {
        setRevisionDropdownOpen(false)
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

  const handleCaptureScreenshot = useCallback(async () => {
    const panel = panelRef.current
    if (!panel) return

    const rect = panel.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    try {
      const result = await window.jelico.window.captureArea({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }, {
        copyToClipboard: false,
      })

      if (!result.success || !result.data || !result.name || !result.mimeType) {
        console.error('Failed to capture artifact screenshot:', result.error)
        return
      }

      window.dispatchEvent(new CustomEvent('jelico:add-chat-attachment', {
        detail: {
          name: result.name,
          mimeType: result.mimeType,
          data: result.data,
        },
      }))
    } catch (error) {
      console.error('Failed to capture artifact screenshot:', error)
    }
  }, [])

  // Determine current viewing revision.
  // When no explicit revision is selected, reflect the currently displayed artifact.
  const currentRevision = selectedRevisionId
    ? revisions.find(r => r.id === selectedRevisionId)
    : displayArtifact

  const hasMultipleRevisions = revisions.length > 1

  return (
    <div
      ref={panelRef}
      className="w-full h-full bg-bg-surface flex flex-col overflow-hidden app-font-exempt"
      data-window-toggle="ignore"
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg-elevated flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Artifact selector */}
          <div className="flex items-center gap-2 relative min-w-0" ref={dropdownRef}>
            {displayArtifact && (
              <>
                {(() => {
                  const Icon = TYPE_ICONS[displayArtifact.type] || DEFAULT_TYPE_ICON
                  return <Icon className="w-5 h-5 text-accent flex-shrink-0" />
                })()}
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 hover:bg-bg-hover rounded px-2 py-1 transition-colors min-w-0"
                >
                  <div className="text-left min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {displayArtifact.title}
                    </h3>
                    <span className="text-xs text-text-muted">
                      {getFileTypeLabel(displayArtifact)}
                      {' • '}
                      {formatDateTime(new Date(displayArtifact.createdAt))}
                    </span>
                  </div>
                  {conversationArtifacts.length > 1 && (
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* Artifact dropdown picker */}
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
                            <div className="text-xs text-text-muted">{getFileTypeLabel(artifact)}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
            {!displayArtifact && (
              <span className="text-sm text-text-muted">No artifact selected</span>
            )}
          </div>

          {/* Revision selector - only show if multiple revisions exist */}
          {hasMultipleRevisions && displayArtifact && (
            <div className="relative flex-shrink-0" ref={revisionDropdownRef}>
              <button
                onClick={() => setRevisionDropdownOpen(!revisionDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-bg-elevated hover:bg-bg-hover rounded border border-border transition-colors"
                title="View revision history"
              >
                <History className="w-3 h-3 text-text-muted" />
                <span className="text-text-secondary">
                  v{currentRevision?.revision || displayArtifact.revision}
                </span>
                <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${revisionDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Revision dropdown */}
              {revisionDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-32 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {revisions.map((rev) => (
                    <button
                      key={rev.id}
                      onClick={() => {
                        // Select null for the currently displayed base selection.
                        selectRevision(rev.id === selectedArtifactId ? null : rev.id)
                        setRevisionDropdownOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg-hover transition-colors ${
                        (selectedRevisionId === rev.id || (!selectedRevisionId && rev.id === selectedArtifactId))
                          ? 'bg-bg-hover'
                          : ''
                      }`}
                    >
                      <span className="text-sm text-text-primary">v{rev.revision}</span>
                      {rev.id === revisions[revisions.length - 1].id && (
                        <span className="text-xs text-accent">latest</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

          {/* Artifact actions */}
          {displayArtifact && (
            <>
              <button
                onClick={handleCaptureScreenshot}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                title="Capture artifact screenshot and attach to chat"
              >
                <Camera className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  try {
                    await window.jelico.artifacts.reveal(displayArtifact.id)
                  } catch (error) {
                    console.error('Failed to reveal artifact:', error)
                  }
                }}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                title="Reveal in folder"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => selectedArtifact && removeArtifact(getBaseArtifactId(selectedArtifact))}
                className="p-1.5 text-text-muted hover:text-error hover:bg-bg-hover rounded transition-colors"
                title="Delete artifact"
              >
                <Trash2 className="w-4 h-4" />
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

      {/* Tab bar: open artifacts + Library toggle */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-bg-deep overflow-x-auto flex-shrink-0">
        {openArtifactIds.map((tabId) => {
          const tab = artifacts.find((a) => a.id === tabId)
          if (!tab) return null
          const TabIcon = TYPE_ICONS[tab.type] || DEFAULT_TYPE_ICON
          const isActive = tabId === selectedArtifactId && !libraryOpen
          return (
            <div
              key={tabId}
              className={`group flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs max-w-40 cursor-pointer transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-bg-elevated text-text-primary border border-border'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover border border-transparent'
              }`}
              onClick={() => {
                if (libraryOpen) toggleLibrary()
                selectArtifact(tabId)
              }}
            >
              <TabIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{tab.title}</span>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  closeArtifactTab(tabId)
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-deep transition-opacity"
                title="Close tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )
        })}
        <button
          onClick={toggleLibrary}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors flex-shrink-0 ml-auto ${
            libraryOpen
              ? 'bg-bg-elevated text-text-primary border border-border'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-hover border border-transparent'
          }`}
          title="Browse all artifacts"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>
      </div>

      {/* Content - overflow-hidden prevents scroll issues with Monaco editor. Individual viewers handle their own scrolling. */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {libraryOpen ? (
          <ArtifactLibrary onClose={toggleLibrary} />
        ) : displayArtifact ? (
          <ArtifactContent key={displayArtifact.id} artifact={displayArtifact} />
        ) : conversationArtifacts.length === 0 ? (
          <EmptyState />
        ) : null}
      </div>

    </div>
  )
}

function ArtifactLibrary({ onClose }: { onClose: () => void }) {
  const { artifacts, selectArtifact } = useArtifactStore()
  const { activeConversationId } = useChatStore()
  const [scope, setScope] = useState<'chat' | 'all'>('chat')

  const visibleArtifacts = scope === 'chat' && activeConversationId
    ? artifacts.filter((a) => a.conversationId === activeConversationId)
    : artifacts

  return (
    <div className="absolute inset-0 bg-bg-surface flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">Library</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setScope('chat')}
              className={`px-2 py-0.5 text-xs transition-colors ${scope === 'chat' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
            >
              This chat
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-2 py-0.5 text-xs transition-colors ${scope === 'all' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
            >
              All chats
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          title="Close library"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {visibleArtifacts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <p className="text-xs text-text-muted">
              {scope === 'chat' ? 'No artifacts in this conversation yet' : 'No artifacts yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleArtifacts.map((artifact) => {
              const Icon = TYPE_ICONS[artifact.type] || DEFAULT_TYPE_ICON
              return (
                <button
                  key={artifact.id}
                  onClick={() => {
                    selectArtifact(artifact.id)
                    onClose()
                  }}
                  className="flex flex-col items-start gap-2 p-3 rounded-lg border border-border bg-bg-deep hover:bg-bg-hover hover:border-border-strong transition-colors text-left"
                >
                  <Icon className="w-5 h-5 text-accent" />
                  <div className="min-w-0 w-full">
                    <div className="text-sm text-text-primary truncate">{artifact.title}</div>
                    <div className="text-xs text-text-muted">
                      {getFileTypeLabel(artifact)}
                      {' • '}
                      {formatDateTime(new Date(artifact.updatedAt))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ArtifactContent({ artifact }: { artifact: Artifact }) {
  const { updateArtifact } = useArtifactStore()

  const handleSave = useCallback(async (content: string) => {
    await updateArtifact(artifact.id, {
      conversationId: artifact.conversationId,
      content,
    })
  }, [updateArtifact, artifact.id, artifact.conversationId])

  if (!artifact.content || artifact.content.length === 0) {
    // File-backed artifact whose content is still loading lazily
    if (artifact.filePath) {
      return (
        <div className="h-full flex items-center justify-center p-8 text-center">
          <p className="text-xs text-text-muted">Loading artifact...</p>
        </div>
      )
    }
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-1">
            Artifact content unavailable
          </h3>
          <p className="text-xs text-text-muted max-w-72">
            This revision could not be loaded from disk. Select another revision or regenerate the artifact.
          </p>
        </div>
      </div>
    )
  }

  switch (artifact.type) {
    case 'code':
      return (
        <CodeViewer
          code={artifact.content}
          language={artifact.language || 'text'}
          title={artifact.title}
          onSave={handleSave}
        />
      )
    case 'document':
      return <DocumentViewer content={artifact.content} />
    case 'html':
      return <HtmlViewer html={artifact.content} onSave={handleSave} />
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
