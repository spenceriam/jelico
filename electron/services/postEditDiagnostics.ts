/**
 * Post-edit diagnostics
 *
 * Runs a fast, read-only syntax check on TypeScript/JavaScript files right
 * after the agent writes them, and returns findings to append to the tool
 * result so the model can fix issues before spending a turn on tests.
 *
 * Uses the project's bundled TypeScript compiler via dynamic import. When it
 * is unavailable (e.g. packaged builds without devDependencies), diagnostics
 * silently no-op. Syntax-level only; full type-checking needs a Program and
 * is intentionally out of scope here.
 */

let tsModule: typeof import('typescript') | null | undefined

async function loadTypescript(): Promise<typeof import('typescript') | null> {
  if (tsModule === undefined) {
    try {
      tsModule = await import('typescript')
    } catch {
      tsModule = null
    }
  }
  return tsModule
}

const CHECKABLE = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/i
const MAX_DIAGNOSTICS = 5

export async function diagnoseWrittenFile(
  filePath: string,
  content: string
): Promise<string | null> {
  if (!CHECKABLE.test(filePath)) return null

  const ts = await loadTypescript()
  if (!ts) return null

  try {
    const result = ts.transpileModule(content, {
      fileName: filePath,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.Preserve,
      },
    })

    const errors = (result.diagnostics || [])
      .filter((d) => d.category === ts.DiagnosticCategory.Error)
      .slice(0, MAX_DIAGNOSTICS)

    if (errors.length === 0) return null

    const lines = errors.map((d) => {
      const pos =
        typeof d.start === 'number' && d.file
          ? d.file.getLineAndCharacterOfPosition(d.start)
          : null
      const where = pos ? ` (line ${pos.line + 1})` : ''
      const text = ts.flattenDiagnosticMessageText(d.messageText, ' ')
      return `- TS${d.code}${where}: ${text}`
    })

    const suffix =
      (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length >
      MAX_DIAGNOSTICS
        ? `\n- ...and more (showing first ${MAX_DIAGNOSTICS})`
        : ''

    return `Post-edit syntax diagnostics:\n${lines.join('\n')}${suffix}`
  } catch {
    return null
  }
}
