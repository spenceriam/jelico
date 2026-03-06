const INLINE_TOOL_PROTOCOL_START_TOKENS = [
  '<|tool_call_begin|>',
  '<|tool_call_argument_begin|>',
  '[tool_call]',
]

const INLINE_TOOL_PROTOCOL_END_TOKENS = [
  '<|tool_call_end|>',
  '[/tool_call]',
]

function getTrailingTokenOverlap(value: string, token: string): number {
  const max = Math.min(value.length, token.length - 1)
  for (let size = max; size > 0; size -= 1) {
    if (value.endsWith(token.slice(0, size))) {
      return size
    }
  }
  return 0
}

function getMaxTrailingTokenOverlap(value: string, tokens: string[]): number {
  return tokens.reduce((max, token) => Math.max(max, getTrailingTokenOverlap(value, token)), 0)
}

export function createInlineToolProtocolFilter() {
  const startTokens = INLINE_TOOL_PROTOCOL_START_TOKENS
  const endTokens = INLINE_TOOL_PROTOCOL_END_TOKENS
  let carry = ''
  let inProtocol = false

  const consume = (chunk: string): string => {
    if (!chunk) return ''

    const input = carry + chunk
    // Token markers are ASCII-only, so lowercasing preserves index alignment with `input`.
    const searchableInput = input.toLowerCase()
    carry = ''
    let output = ''
    let cursor = 0

    while (cursor < input.length) {
      if (inProtocol) {
        let nextEndIndex = -1
        let matchedEndToken = ''
        for (const token of endTokens) {
          const idx = searchableInput.indexOf(token, cursor)
          if (idx !== -1 && (nextEndIndex === -1 || idx < nextEndIndex)) {
            nextEndIndex = idx
            matchedEndToken = token
          }
        }

        if (nextEndIndex === -1) {
          const remaining = input.slice(cursor)
          const overlap = getMaxTrailingTokenOverlap(remaining.toLowerCase(), endTokens)
          carry = overlap > 0 ? remaining.slice(-overlap) : ''
          return output
        }

        cursor = nextEndIndex + matchedEndToken.length
        inProtocol = false
        continue
      }

      let nextStartIndex = -1
      let matchedStartToken = ''
      for (const token of startTokens) {
        const idx = searchableInput.indexOf(token, cursor)
        if (idx !== -1 && (nextStartIndex === -1 || idx < nextStartIndex)) {
          nextStartIndex = idx
          matchedStartToken = token
        }
      }

      if (nextStartIndex === -1) {
        const remaining = input.slice(cursor)
        const overlap = getMaxTrailingTokenOverlap(remaining.toLowerCase(), startTokens)
        if (overlap > 0) {
          output += remaining.slice(0, -overlap)
          carry = remaining.slice(-overlap)
        } else {
          output += remaining
        }
        return output
      }

      output += input.slice(cursor, nextStartIndex)
      cursor = nextStartIndex + matchedStartToken.length
      inProtocol = true
    }

    return output
  }

  const flush = (): string => {
    if (inProtocol) {
      inProtocol = false
      carry = ''
      return ''
    }

    const tail = carry
    carry = ''

    if (!tail) return ''
    const normalizedTail = tail.toLowerCase()
    if (startTokens.some(token => token.startsWith(normalizedTail))) return ''
    return tail
  }

  return { consume, flush }
}
