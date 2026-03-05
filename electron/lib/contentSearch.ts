import { glob } from 'glob'
import path from 'path'
import fs from 'fs/promises'
import { spawn } from 'node:child_process'

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

function canMatchZeroLength(regex: RegExp): boolean {
  const samples = ['', 'a\nb']
  for (const sample of samples) {
    regex.lastIndex = 0
    const match = regex.exec(sample)
    if (match && (match[0] || '').length === 0) {
      regex.lastIndex = 0
      return true
    }
  }
  regex.lastIndex = 0
  return false
}

function stripTrailingNewline(text: string): string {
  return text.replace(/\r?\n$/, '')
}

function normalizeResultPath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

async function searchWithRipgrep(options: {
  rootDir: string
  pattern: string
  includeGlobs: string[]
  excludeGlobs: string[]
  caseSensitive?: boolean
  multiline?: boolean
  maxResults: number
  contextLines: number
  maxFileBytes: number
}): Promise<{ matches: ContentSearchMatch[]; truncated: boolean; scannedFiles: number } | null> {
  return new Promise((resolve) => {
    const args = [
      '--json',
      '--line-number',
      '--column',
      '--hidden',
      '--no-messages',
      '--max-filesize',
      String(options.maxFileBytes),
      '--max-count',
      String(options.maxResults),
    ]

    if (!options.caseSensitive) args.push('-i')
    if (options.multiline) {
      args.push('--multiline')
      args.push('--multiline-dotall')
    }
    if (options.contextLines > 0) {
      args.push('-C', String(options.contextLines))
    }

    for (const include of options.includeGlobs) {
      args.push('-g', include)
    }

    for (const exclude of options.excludeGlobs) {
      const normalized = exclude.startsWith('!') ? exclude : `!${exclude}`
      args.push('-g', normalized)
    }

    args.push('--', options.pattern, '.')

    let buffer = ''
    const fileContext = new Map<string, Map<number, string>>()
    const scannedPaths = new Set<string>()
    const rawMatches: Array<{ path: string; line: number; column: number }> = []

    const appendLineContext = (filePath: string, line: number, text: string) => {
      const normalizedPath = normalizeResultPath(filePath)
      const byLine = fileContext.get(normalizedPath) || new Map<number, string>()
      byLine.set(line, stripTrailingNewline(text))
      fileContext.set(normalizedPath, byLine)
    }

    const child = spawn('rg', args, {
      cwd: options.rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    const parseLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return

      let parsed: any
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        return
      }

      const type = parsed?.type
      const data = parsed?.data
      const filePath = data?.path?.text

      if (type === 'begin') {
        if (typeof filePath === 'string' && filePath.length > 0) {
          scannedPaths.add(normalizeResultPath(filePath))
        }
        return
      }

      const lineNumber = Number(data?.line_number || 0)
      const lineText = typeof data?.lines?.text === 'string' ? data.lines.text : ''
      if (!filePath || !lineNumber || !lineText) return

      if (type === 'context') {
        appendLineContext(filePath, lineNumber, lineText)
        return
      }

      if (type !== 'match') return

      appendLineContext(filePath, lineNumber, lineText)
      const firstSubmatch = Array.isArray(data?.submatches) && data.submatches.length > 0
        ? data.submatches[0]
        : null
      const column = Number.isFinite(firstSubmatch?.start)
        ? Number(firstSubmatch.start) + 1
        : 1

      rawMatches.push({
        path: normalizeResultPath(filePath),
        line: lineNumber,
        column,
      })
    }

    child.stdout.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString()
      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex >= 0) {
        parseLine(buffer.slice(0, newlineIndex))
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf('\n')
      }
    })

    child.on('error', () => {
      resolve(null)
    })

    child.on('close', (code) => {
      if (buffer.trim()) parseLine(buffer)

      // 0 = matches, 1 = no matches, 2 = partial/inaccessible paths.
      if (code !== 0 && code !== 1 && code !== 2) {
        resolve(null)
        return
      }

      const truncated = rawMatches.length > options.maxResults
      const selected = rawMatches.slice(0, options.maxResults)
      const matches = selected.map((entry) => {
        const byLine = fileContext.get(entry.path)
        const start = Math.max(1, entry.line - options.contextLines)
        const end = entry.line + options.contextLines
        const snippetLines: string[] = []

        for (let ln = start; ln <= end; ln += 1) {
          const text = byLine?.get(ln)
          if (typeof text === 'string') snippetLines.push(text)
        }

        const fallbackLine = byLine?.get(entry.line) || ''
        return {
          path: entry.path,
          line: entry.line,
          column: entry.column,
          snippet: snippetLines.length > 0 ? snippetLines.join('\n') : fallbackLine,
        }
      })

      if (code === 2 && matches.length === 0) {
        resolve(null)
        return
      }

      resolve({ matches, truncated, scannedFiles: scannedPaths.size })
    })
  })
}

async function searchWithNodeScanner(options: {
  rootDir: string
  files: string[]
  regex: RegExp
  maxResults: number
  contextLines: number
  maxFileBytes: number
}): Promise<{ matches: ContentSearchMatch[]; truncated: boolean }> {
  const matches: ContentSearchMatch[] = []
  let truncated = false

  for (const relFile of options.files) {
    const filePath = path.join(options.rootDir, relFile)

    try {
      const stat = await fs.stat(filePath)
      if (stat.size > options.maxFileBytes) continue
      const content = await fs.readFile(filePath, 'utf-8')
      if (!content || isProbablyBinary(content)) continue

      options.regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = options.regex.exec(content)) !== null) {
        const matchText = match[0] || ''
        if (matchText.length === 0) {
          options.regex.lastIndex += 1
          continue
        }

        const { line, column } = computeLineColumn(content, match.index)
        matches.push({
          path: relFile.replace(/\\/g, '/'),
          line,
          column,
          snippet: buildSnippet(content, line, options.contextLines),
        })

        if (matches.length >= options.maxResults) {
          truncated = true
          return { matches, truncated }
        }
      }
    } catch {
      // Skip unreadable or non-text files.
    }
  }

  return { matches, truncated }
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
    dot: true,
  })
  const scannedFiles = files.length

  if (files.length === 0) {
    return { matches: [], scannedFiles, truncated: false }
  }

  // Zero-length matches are intentionally ignored by the existing scanner behavior.
  // Keep that behavior deterministic by staying on the Node scanner for these patterns.
  const zeroLengthPattern = canMatchZeroLength(regex)

  if (!zeroLengthPattern) {
    const ripgrepResult = await searchWithRipgrep({
      rootDir: options.rootDir,
      pattern: options.pattern,
      includeGlobs,
      excludeGlobs,
      caseSensitive: options.caseSensitive,
      multiline: options.multiline,
      maxResults,
      contextLines,
      maxFileBytes,
    })

    if (ripgrepResult) {
      return {
        matches: ripgrepResult.matches,
        scannedFiles: ripgrepResult.scannedFiles,
        truncated: ripgrepResult.truncated,
      }
    }
  }

  const fallback = await searchWithNodeScanner({
    rootDir: options.rootDir,
    files,
    regex,
    maxResults,
    contextLines,
    maxFileBytes,
  })

  return {
    matches: fallback.matches,
    scannedFiles,
    truncated: fallback.truncated,
  }
}
