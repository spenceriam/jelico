import { AlertTriangle, Layers, RefreshCw, Sparkles } from 'lucide-react'
import { useArtifactStore } from '../../stores/artifacts'

export type SystemMessageType =
  | 'compaction_warning'
  | 'compaction_complete'
  | 'model_changed'
  | 'artifacts_created'
  | 'info'

interface ArtifactLink {
  id: string
  title: string
  type: string
}

interface SystemMessageProps {
  type: SystemMessageType
  message?: string
  artifacts?: ArtifactLink[]
  modelName?: string
}

export function SystemMessage({ type, message, artifacts, modelName }: SystemMessageProps) {
  const { selectArtifact, openCanvas } = useArtifactStore()

  const handleArtifactClick = (artifactId: string) => {
    selectArtifact(artifactId)
    openCanvas()
  }

  const getIcon = () => {
    switch (type) {
      case 'compaction_warning':
        return <AlertTriangle className="w-3.5 h-3.5" />
      case 'compaction_complete':
        return <RefreshCw className="w-3.5 h-3.5" />
      case 'model_changed':
        return <Sparkles className="w-3.5 h-3.5" />
      case 'artifacts_created':
        return <Layers className="w-3.5 h-3.5" />
      default:
        return null
    }
  }

  const getContent = () => {
    switch (type) {
      case 'compaction_warning':
        return 'Conversation will compact soon'
      case 'compaction_complete':
        return 'Conversation compacted'
      case 'model_changed':
        return `Switched to ${modelName || 'new model'}`
      case 'artifacts_created':
        if (artifacts && artifacts.length > 0) {
          return (
            <span className="flex items-center gap-1 flex-wrap">
              <span>Created:</span>
              {artifacts.map((artifact, index) => (
                <span key={artifact.id}>
                  <button
                    onClick={() => handleArtifactClick(artifact.id)}
                    className="underline hover:text-accent-bright transition-colors"
                  >
                    {artifact.title}
                  </button>
                  {index < artifacts.length - 1 && ', '}
                </span>
              ))}
            </span>
          )
        }
        return message || 'Artifacts created'
      case 'info':
        return message
      default:
        return message
    }
  }

  return (
    <div className="flex justify-center my-3">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium italic text-accent">
        {getIcon()}
        <span>{getContent()}</span>
      </div>
    </div>
  )
}

// Compact inline version for use within message flow
interface InlineSystemNoteProps {
  children: React.ReactNode
}

export function InlineSystemNote({ children }: InlineSystemNoteProps) {
  return (
    <div className="flex justify-center my-2">
      <span className="text-xs font-medium italic text-accent">
        {children}
      </span>
    </div>
  )
}
