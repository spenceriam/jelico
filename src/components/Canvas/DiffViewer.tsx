import { useMemo } from 'react'
import * as Diff from 'diff'

interface DiffViewerProps {
  original: string
  modified: string
  className?: string
}

export function DiffViewer({ original, modified, className = '' }: DiffViewerProps) {
  const diffLines = useMemo(() => {
    const changes = Diff.diffLines(original, modified)
    const lines: Array<{
      type: 'unchanged' | 'added' | 'removed'
      content: string
      oldLineNum?: number
      newLineNum?: number
    }> = []

    let oldLine = 1
    let newLine = 1

    for (const change of changes) {
      const changeLines = change.value.split('\n')
      // Remove empty last element if string ends with newline
      if (changeLines[changeLines.length - 1] === '') {
        changeLines.pop()
      }

      for (const line of changeLines) {
        if (change.added) {
          lines.push({
            type: 'added',
            content: line,
            newLineNum: newLine++,
          })
        } else if (change.removed) {
          lines.push({
            type: 'removed',
            content: line,
            oldLineNum: oldLine++,
          })
        } else {
          lines.push({
            type: 'unchanged',
            content: line,
            oldLineNum: oldLine++,
            newLineNum: newLine++,
          })
        }
      }
    }

    return lines
  }, [original, modified])

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length
    const removed = diffLines.filter(l => l.type === 'removed').length
    return { added, removed }
  }, [diffLines])

  if (stats.added === 0 && stats.removed === 0) {
    return (
      <div className={`p-4 text-center text-text-muted ${className}`}>
        No changes
      </div>
    )
  }

  return (
    <div className={`font-mono text-sm ${className}`}>
      {/* Stats header */}
      <div className="px-4 py-2 bg-bg-elevated border-b border-border flex items-center gap-4 text-xs">
        <span className="text-text-muted">Changes:</span>
        {stats.added > 0 && (
          <span className="text-green-400">+{stats.added} added</span>
        )}
        {stats.removed > 0 && (
          <span className="text-red-400">-{stats.removed} removed</span>
        )}
      </div>

      {/* Diff content */}
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, idx) => (
              <tr
                key={idx}
                className={
                  line.type === 'added'
                    ? 'bg-green-500/10'
                    : line.type === 'removed'
                    ? 'bg-red-500/10'
                    : ''
                }
              >
                {/* Old line number */}
                <td className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/50">
                  {line.oldLineNum || ''}
                </td>
                {/* New line number */}
                <td className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/50">
                  {line.newLineNum || ''}
                </td>
                {/* Change indicator */}
                <td className="w-6 px-1 py-0.5 text-center select-none">
                  {line.type === 'added' && (
                    <span className="text-green-400">+</span>
                  )}
                  {line.type === 'removed' && (
                    <span className="text-red-400">-</span>
                  )}
                </td>
                {/* Content */}
                <td className="px-2 py-0.5 whitespace-pre">
                  <span
                    className={
                      line.type === 'added'
                        ? 'text-green-300'
                        : line.type === 'removed'
                        ? 'text-red-300'
                        : 'text-text-secondary'
                    }
                  >
                    {line.content || ' '}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
