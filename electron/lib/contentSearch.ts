import { glob } from 'glob'
import path from 'path'
import fs from 'fs/promises'

export interface ContentSearchMatch {
  path: string
  line: number
  column: number
  snippet: string
}

export interface ContentSearchOptions {
  rootDir: string
  pattern: string
  includeGlobs?: string[]
  excludeGlobs?: string[]
  caseSensitive?: boolean
  multiline?: boolean
  maxResults?: number
  contextLines?: number
  maxFileBytes?: number
}

export interface ContentSearchResult {
  matches: ContentSearchMatch[]
  scannedFiles: number
  truncated: boolean
}

const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/.idea/**',
  '**/.vscode/**',
]

function clampPositiveInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

function computeLineColumn(content: string, index: number): { line: number; column: number } {
  const safeIndex = Math.max(0, Math.min(index, content.length))
  const before = content.slice(0, safeIndex)
  const lines = before.split('\n')
  const line = lines.length
  const column = (lines[lines.length - 1] || '').length + 1
  return { line, column }
}

function buildSnippet(content: string, line: number, contextLines: number): string {
  const lines = content.split('\n')
  const current = Math.max(0, line - 1)
  const start = Math.max(0, current - contextLines)
  const end = Math.min(lines.length - 1, current + contextLines)
  return lines.slice(start, end + 1).join('\n')
}

function isProbablyBinary(content: string): boolean {
  return content.includes('\u0000')
}

export async function searchFileContents(options: ContentSearchOptions): Promise<ContentSearchResult> {
  const includeGlobs = options.includeGlobs && options.includeGlobs.length > 0
    ? options.includeGlobs
    : ['**/*']
  const excludeGlobs = [...DEFAULT_EXCLUDES, ...(options.excludeGlobs || [])]

  const maxResults = clampPositiveInt(options.maxResults, 200, 2000)
  const contextLines = clampPositiveInt(options.contextLines, 1, 8)
  const maxFileBytes = clampPositiveInt(options.maxFileBytes, 2 * 1024 * 1024, 10 * 1024 * 1024)

  let flags = 'g'
  flags += options.caseSensitive ? '' : 'i'
  flags += 'm'
  if (options.multiline) flags += 's'

  let regex: RegExp
  try {
    regex = new RegExp(options.pattern, flags)
  } catch (error: any) {
    throw new Error(`Invalid regex pattern: ${error?.message || 'unknown error'}`)
  }

  const files = await glob(includeGlobs, {
    cwd: options.rootDir,
    ignore: excludeGlobs,
    nodir: true,
    dot: false,
  })

  const matches: ContentSearchMatch[] = []
  let scannedFiles = 0
  let truncated = false

  for (const relFile of files) {
    const filePath = path.join(options.rootDir, relFile)
    scannedFiles += 1

    try {
      const stat = await fs.stat(filePath)
      if (stat.size > maxFileBytes) continue
      const content = await fs.readFile(filePath, 'utf-8')
      if (!content || isProbablyBinary(content)) continue

      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(content)) !== null) {
        const matchText = match[0] || ''
        if (matchText.length === 0) {
          regex.lastIndex += 1
          continue
        }

        const { line, column } = computeLineColumn(content, match.index)
        matches.push({
          path: relFile.replace(/\\/g, '/'),
          line,
          column,
          snippet: buildSnippet(content, line, contextLines),
        })

        if (matches.length >= maxResults) {
          truncated = true
          return { matches, scannedFiles, truncated }
        }
      }
    } catch {
      // Skip unreadable or non-text files.
    }
  }

  return { matches, scannedFiles, truncated }
}

