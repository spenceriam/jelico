import { useEffect, useMemo, useState } from 'react'
import { X, RefreshCw, RotateCcw, GitCompare } from 'lucide-react'

interface Props {
  workspaceId: string
  workspaceName: string
  onClose: () => void
}

export function GitDiffReviewModal({ workspaceId, workspaceName, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<GitDiffPayload | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activePatch, setActivePatch] = useState<string>('')
  const [patchLoading, setPatchLoading] = useState(false)

  async function loadDiff() {
    setLoading(true)
    setError(null)
    try {
      const next = await window.jelico.workspaces.getGitDiff(workspaceId)
      setData(next)
      if (!activePath && next.files[0]) setActivePath(next.files[0].path)
      if (activePath && !next.files.find((f) => f.path === activePath)) {
        setActivePath(next.files[0]?.path ?? null)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load git diff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDiff()
  }, [workspaceId])

  const activeFile = useMemo(() => data?.files.find((file) => file.path === activePath) ?? null, [data, activePath])

  useEffect(() => {
    if (!activeFile) {
      setActivePatch('')
      return
    }

    let cancelled = false
    setPatchLoading(true)
    void window.jelico.workspaces.getGitFilePatch(workspaceId, activeFile.path)
      .then((patch) => {
        if (!cancelled) setActivePatch(patch)
      })
      .catch(() => {
        if (!cancelled) setActivePatch('Failed to load patch for this file.')
      })
      .finally(() => {
        if (!cancelled) setPatchLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, activeFile?.path])

  async function discardFile(filePath: string) {
    if (!confirm(`Discard local changes in ${filePath}?`)) return
    await window.jelico.workspaces.discardFileChanges(workspaceId, filePath)
    await loadDiff()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-border rounded-xl w-full max-w-6xl h-[80vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-accent" />
              Review Local Changes
            </h3>
            <p className="text-xs text-text-muted mt-1">{workspaceName}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadDiff()}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-4 text-sm text-error">{error}</div>
        ) : loading ? (
          <div className="p-4 text-sm text-text-muted">Loading changes...</div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr]">
            <aside className="border-r border-border overflow-auto">
              <div className="px-4 py-3 text-xs text-text-muted border-b border-border bg-bg-elevated">
                {data?.summary.filesChanged ?? 0} files · +{data?.summary.insertions ?? 0} / -{data?.summary.deletions ?? 0}
              </div>

              {(data?.files.length ?? 0) === 0 ? (
                <div className="p-4 text-sm text-text-muted">No local git changes.</div>
              ) : (
                <div className="p-2 space-y-1">
                  {data?.files.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setActivePath(file.path)}
                      className={`w-full text-left p-2 rounded-lg border transition-colors ${
                        activePath === file.path
                          ? 'border-accent bg-accent/10'
                          : 'border-transparent hover:border-border hover:bg-bg-hover'
                      }`}
                    >
                      <div className="text-sm text-text-primary truncate">{file.path}</div>
                      <div className="text-xs text-text-muted mt-1">{file.status} · +{file.added} / -{file.deleted}</div>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className="min-h-0 flex flex-col">
              <div className="px-4 py-2 border-b border-border bg-bg-elevated flex items-center justify-between">
                <div className="text-sm text-text-primary truncate">{activeFile?.path || 'No file selected'}</div>
                {activeFile && (
                  <button
                    onClick={() => void discardFile(activeFile.path)}
                    className="px-2.5 py-1 text-xs text-warning hover:text-warning/90 hover:bg-bg-hover rounded flex items-center gap-1"
                    title="Discard this file's local changes"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Discard File
                  </button>
                )}
              </div>
              <pre className="flex-1 overflow-auto m-0 p-4 text-xs leading-5 bg-bg-deep text-text-primary font-mono">
                {patchLoading ? 'Loading file patch...' : (activePatch || 'No patch to display.')}
              </pre>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
