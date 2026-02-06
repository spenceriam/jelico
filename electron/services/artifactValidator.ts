/**
 * Artifact content validation for AI-generated code
 * Similar to OpenCode's LSP-based validation, but using native parsers
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate HTML content
 * Uses JSDOM-style parsing to catch structural issues
 */
function validateHtml(content: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let hasMalformedUndefinedAttribute = false

  try {
    // Check for basic HTML structure
    const trimmed = content.trim().toLowerCase()

    // Check for unclosed tags (basic check)
    const openTags: string[] = []
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
    let match

    while ((match = tagRegex.exec(content)) !== null) {
      const fullMatch = match[0]
      const tagName = match[1].toLowerCase()

      // Guard against malformed tool-call repairs that inject "undefined" into quoted attributes
      // Example bad pattern: id=undefinedgameCanvasundefined (expected id="gameCanvas")
      if (!hasMalformedUndefinedAttribute && /\s[a-zA-Z_:][\w:.-]*\s*=\s*undefined[^>\s]*undefined/i.test(fullMatch)) {
        hasMalformedUndefinedAttribute = true
      }

      // Skip self-closing tags and void elements
      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']
      if (voidElements.includes(tagName) || fullMatch.endsWith('/>')) {
        continue
      }

      if (fullMatch.startsWith('</')) {
        // Closing tag
        const lastOpen = openTags.pop()
        if (lastOpen !== tagName) {
          if (lastOpen) {
            errors.push(`Mismatched tags: expected </${lastOpen}>, found </${tagName}>`)
          } else {
            errors.push(`Unexpected closing tag: </${tagName}>`)
          }
        }
      } else {
        // Opening tag
        openTags.push(tagName)
      }
    }

    // Report unclosed tags
    if (openTags.length > 0) {
      errors.push(`Unclosed tags: ${openTags.map(t => `<${t}>`).join(', ')}`)
    }

    // Extract and validate JavaScript in script tags
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
    let scriptMatch
    while ((scriptMatch = scriptRegex.exec(content)) !== null) {
      const scriptContent = scriptMatch[1].trim()
      if (scriptContent) {
        const jsResult = validateJavaScript(scriptContent)
        errors.push(...jsResult.errors.map(e => `Script error: ${e}`))
        warnings.push(...jsResult.warnings.map(w => `Script warning: ${w}`))
      }
    }

    // Check for common issues
    if (content.includes('undefined') && content.includes('<script')) {
      warnings.push('Content contains "undefined" - possible uninitialized variable')
    }

    if (hasMalformedUndefinedAttribute) {
      errors.push('Malformed HTML attribute values detected (contains "undefined...undefined" around attribute values). Regenerate with proper quoted attributes.')
    }

  } catch (e: any) {
    errors.push(`HTML parsing error: ${e.message}`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate JavaScript content
 * Uses Function constructor to catch syntax errors
 */
function validateJavaScript(content: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // Try to parse as a function body to catch syntax errors
    new Function(content)
  } catch (e: any) {
    // Extract useful error info
    const message = e.message || 'Unknown syntax error'
    errors.push(message)
  }

  // Check for common issues
  if (content.includes('console.log') && !content.includes('// debug')) {
    warnings.push('Contains console.log statements')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate Mermaid diagram syntax
 * Basic structure validation
 */
function validateMermaid(content: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const trimmed = content.trim()

  // Check for valid diagram type declaration
  const validTypes = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
    'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap',
    'timeline', 'gitGraph', 'journey', 'quadrantChart',
    'requirementDiagram', 'C4Context', 'C4Container', 'C4Component', 'C4Dynamic'
  ]

  const firstLine = trimmed.split('\n')[0].trim()
  const diagramType = firstLine.split(/[\s\-]/)[0]

  if (!validTypes.some(t => diagramType.toLowerCase().startsWith(t.toLowerCase()))) {
    errors.push(`Invalid or missing diagram type. First line should start with one of: ${validTypes.slice(0, 5).join(', ')}...`)
  }

  // Check for empty content
  if (trimmed.split('\n').length < 2) {
    warnings.push('Diagram appears to have no content')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate SVG content
 */
function validateSvg(content: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const trimmed = content.trim()

  // Check for SVG root element
  if (!trimmed.toLowerCase().includes('<svg')) {
    errors.push('Missing <svg> element')
  }

  // Check for proper closing
  if (trimmed.includes('<svg') && !trimmed.includes('</svg>')) {
    errors.push('Unclosed <svg> tag')
  }

  // Check for xmlns attribute (recommended)
  if (trimmed.includes('<svg') && !trimmed.includes('xmlns')) {
    warnings.push('SVG missing xmlns attribute (recommended for compatibility)')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate code content based on language
 */
function validateCode(content: string, language?: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!language) {
    return { valid: true, errors, warnings }
  }

  const lang = language.toLowerCase()

  // JavaScript/TypeScript validation
  if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(lang)) {
    return validateJavaScript(content)
  }

  // JSON validation
  if (lang === 'json') {
    try {
      JSON.parse(content)
    } catch (e: any) {
      errors.push(`Invalid JSON: ${e.message}`)
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  // For other languages, just do basic checks
  // Could add more language-specific validators later

  return { valid: true, errors, warnings }
}

/**
 * Main validation function for artifacts
 */
export function validateArtifact(
  type: string,
  content: string,
  language?: string
): ValidationResult {
  switch (type) {
    case 'html':
      return validateHtml(content)
    case 'svg':
      return validateSvg(content)
    case 'mermaid':
      return validateMermaid(content)
    case 'code':
      return validateCode(content, language)
    case 'document':
      // Markdown is very permissive, just check it's not empty
      if (!content.trim()) {
        return { valid: false, errors: ['Document content is empty'], warnings: [] }
      }
      return { valid: true, errors: [], warnings: [] }
    default:
      return { valid: true, errors: [], warnings: [] }
  }
}
