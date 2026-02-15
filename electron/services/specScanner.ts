/**
 * Spec Scanner — detects project specification documents in a workspace
 * and provides context for spec-driven development.
 *
 * Scans workspace root and common documentation directories for planning
 * documents (specs, PRDs, architecture docs, etc.) and determines if the
 * workspace represents a new/empty project.
 */

import { readdir, readFile, stat } from 'fs/promises'
import { join, basename, relative, extname } from 'path'
import { existsSync } from 'fs'

// ── Types ──────────────────────────────────────────────────────────────

export interface SpecFile {
  path: string
  relativePath: string
  title: string
  content: string
  priority: 'high' | 'medium' | 'low'
}

export interface SpecScanResult {
  specs: SpecFile[]
  isNewProject: boolean
  projectName: string
}

// ── Constants ──────────────────────────────────────────────────────────

/** Directories to scan for spec/planning documents */
const SPEC_DIRS = ['docs', 'spec', 'specs', '.specs', 'planning', '.planning', 'doc', 'documentation']

/** Max content budget in characters for all injected spec content */
const CONTENT_BUDGET = 4000

/** Max size of a single file to read (bytes) — skip very large files */
const MAX_FILE_SIZE = 50_000

/** File extensions to consider */
const SPEC_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc'])

/** High-priority filename patterns (case-insensitive) */
const HIGH_PRIORITY_PATTERNS = [
  /spec/i, /prd/i, /requirement/i, /architect/i, /design[-_]doc/i,
]

/** Medium-priority filename patterns */
const MEDIUM_PRIORITY_PATTERNS = [
  /plan/i, /roadmap/i, /overview/i, /scope/i, /design/i,
]

/** Low-priority exact filenames */
const LOW_PRIORITY_NAMES = new Set([
  'readme.md', 'contributing.md', 'todo.md', 'changelog.md',
])

/** Code file extensions — used to detect "new project" vs established project */
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp',
  '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte',
])

// ── Priority detection ─────────────────────────────────────────────────

function getFilePriority(filename: string): 'high' | 'medium' | 'low' | null {
  const lower = filename.toLowerCase()

  for (const pattern of HIGH_PRIORITY_PATTERNS) {
    if (pattern.test(lower)) return 'high'
  }

  for (const pattern of MEDIUM_PRIORITY_PATTERNS) {
    if (pattern.test(lower)) return 'medium'
  }

  if (LOW_PRIORITY_NAMES.has(lower)) return 'low'

  // Generic markdown in spec directories still gets low priority
  if (SPEC_EXTENSIONS.has(extname(lower))) return 'low'

  return null
}

// ── Title extraction ───────────────────────────────────────────────────

/** Extract a title from a markdown file's first heading or filename */
function extractTitle(content: string, filename: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim()

  // Fall back to filename without extension
  return basename(filename, extname(filename))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── Directory scanning ─────────────────────────────────────────────────

/** Scan a single directory for spec files (non-recursive) */
async function scanDirectory(
  dirPath: string,
  workspacePath: string,
  isSpecDir: boolean,
): Promise<SpecFile[]> {
  const results: SpecFile[] = []

  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry)
    const ext = extname(entry).toLowerCase()

    if (!SPEC_EXTENSIONS.has(ext)) continue

    try {
      const fileStat = await stat(fullPath)
      if (!fileStat.isFile() || fileStat.size > MAX_FILE_SIZE || fileStat.size === 0) continue

      const priority = isSpecDir
        ? getFilePriority(entry) || 'medium' // Files in spec dirs default to medium
        : getFilePriority(entry)

      if (!priority) continue

      const content = await readFile(fullPath, 'utf-8')
      const title = extractTitle(content, entry)

      results.push({
        path: fullPath,
        relativePath: relative(workspacePath, fullPath),
        title,
        content,
        priority,
      })
    } catch {
      // Skip unreadable files
    }
  }

  return results
}

// ── New project detection ──────────────────────────────────────────────

/** Check if workspace looks like a new/empty project */
async function detectNewProject(workspacePath: string): Promise<boolean> {
  let entries: string[]
  try {
    entries = await readdir(workspacePath)
  } catch {
    return false
  }

  // Filter out hidden files and common non-code entries
  const visibleEntries = entries.filter(e => !e.startsWith('.') && e !== 'node_modules')

  // Very few files = likely new project
  if (visibleEntries.length <= 3) return true

  // Check if there are any code files in the root
  const hasCodeFiles = visibleEntries.some(e => CODE_EXTENSIONS.has(extname(e).toLowerCase()))
  if (hasCodeFiles) return false

  // Check common source directories
  const srcDirs = ['src', 'lib', 'app', 'packages', 'components']
  for (const dir of srcDirs) {
    if (existsSync(join(workspacePath, dir))) return false
  }

  // No code files, no source directories — likely new
  return true
}

// ── Main scanner ───────────────────────────────────────────────────────

/**
 * Scan a workspace for spec/planning documents.
 * Returns detected specs and whether this appears to be a new project.
 */
export async function scanWorkspaceSpecs(workspacePath: string): Promise<SpecScanResult> {
  const projectName = basename(workspacePath)

  // Scan root directory for spec files (only match high/medium priority in root)
  const rootSpecs = await scanDirectory(workspacePath, workspacePath, false)

  // Scan known spec directories
  const dirSpecs: SpecFile[] = []
  for (const dir of SPEC_DIRS) {
    const dirPath = join(workspacePath, dir)
    if (existsSync(dirPath)) {
      const specs = await scanDirectory(dirPath, workspacePath, true)
      dirSpecs.push(...specs)
    }
  }

  // Combine and deduplicate by path
  const seen = new Set<string>()
  const allSpecs: SpecFile[] = []
  for (const spec of [...rootSpecs, ...dirSpecs]) {
    if (!seen.has(spec.path)) {
      seen.add(spec.path)
      allSpecs.push(spec)
    }
  }

  // Sort by priority: high → medium → low
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  allSpecs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  // Detect new project
  const isNewProject = allSpecs.length === 0 && await detectNewProject(workspacePath)

  return {
    specs: allSpecs,
    isNewProject,
    projectName,
  }
}

// ── Content formatting ─────────────────────────────────────────────────

/**
 * Format spec scan results into a system prompt section.
 * Respects the content budget by truncating lower-priority specs.
 *
 * @param mode - Current agent mode. The "new project" offer only appears in
 *   Plan mode so we don't push spec creation on users who are just researching
 *   or chatting in Auto mode.
 */
export function formatSpecContext(result: SpecScanResult, mode?: string): string | null {
  if (result.specs.length === 0 && !result.isNewProject) return null

  if (result.isNewProject) {
    // Only suggest spec creation in Plan mode — in Auto/other modes the user
    // may just be researching and we shouldn't push documentation on them.
    if (mode !== 'plan') return null

    return `## Project Specs
This workspace (**${result.projectName}**) appears to be a new or empty project with no existing specification documents.

If the user is starting a new project, offer to help create a project specification before diving into code. A good spec includes:
- **Overview**: What the project does and why
- **Requirements**: Key features and constraints
- **Architecture**: High-level technical approach
- **Milestones**: Phased implementation plan

Save specs to a \`specs/\` directory in the workspace. Use markdown format.`
  }

  // Format specs within budget
  let budget = CONTENT_BUDGET
  const sections: string[] = []

  sections.push(`## Project Specs
The following specification documents were found in **${result.projectName}**. Use these as your source of truth for project decisions:\n`)

  budget -= sections[0].length

  for (const spec of result.specs) {
    const header = `### ${spec.title} (\`${spec.relativePath}\`) [${spec.priority}]\n`
    const headerCost = header.length

    if (budget <= headerCost + 100) break // Not enough room for even a summary

    const availableForContent = budget - headerCost - 10 // padding
    let content = spec.content.trim()

    if (content.length > availableForContent) {
      content = content.slice(0, availableForContent) + '\n...(truncated)'
    }

    sections.push(header + content)
    budget -= (header.length + content.length)

    if (budget <= 200) break
  }

  sections.push(`\n**Follow these specs** when making implementation decisions. If the user's request conflicts with the spec, mention the discrepancy and ask how to proceed.`)

  return sections.join('\n')
}
