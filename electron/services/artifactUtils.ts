/**
 * Shared utilities for artifact handling
 */

/**
 * Extract partial artifact content from streaming JSON.
 * The JSON format is: {"type":"html","title":"...","content":"..."}
 * We try to extract the content field as it streams for live preview.
 */
export function extractPartialArtifactContent(partialJson: string): {
  type?: string
  title?: string
  content: string
} | null {
  try {
    // Try to extract type
    const typeMatch = partialJson.match(/"type"\s*:\s*"([^"]+)"/)
    const type = typeMatch?.[1]

    // Try to extract title
    const titleMatch = partialJson.match(/"title"\s*:\s*"([^"]+)"/)
    const title = titleMatch?.[1]

    // Find where content starts
    const contentStart = partialJson.search(/"content"\s*:\s*"/)
    if (contentStart === -1) {
      // No content field yet, but we might have type/title
      if (type || title) {
        return { type, title, content: '' }
      }
      return null
    }

    // Find the opening quote after "content":
    const afterContentKey = partialJson.indexOf('"', contentStart + 10) // Skip past "content":
    if (afterContentKey === -1) return null

    // Get everything after the opening quote
    let content = partialJson.slice(afterContentKey + 1)

    // If the content is properly closed (ends with "}), extract just the content
    // Otherwise, take everything we have (streaming in progress)
    const closingQuoteIdx = content.lastIndexOf('"}')
    if (closingQuoteIdx !== -1) {
      content = content.slice(0, closingQuoteIdx)
    } else {
      // Remove trailing incomplete escape sequences or quotes
      content = content.replace(/\\?$/, '')
    }

    // Unescape JSON string (handle \n, \", \\, etc.)
    try {
      content = JSON.parse(`"${content}"`)
    } catch {
      // If parsing fails, do basic unescaping
      content = content
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    }

    return { type, title, content }
  } catch {
    return null
  }
}
