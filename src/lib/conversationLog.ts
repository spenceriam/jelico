import type { Artifact } from '../stores/artifacts'
import type { Message } from '../stores/chat'

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(sk-[A-Za-z0-9_-]{12,})/g, '[REDACTED_OPENAI_KEY]'],
  [/(xox[baprs]-[A-Za-z0-9-]{12,})/g, '[REDACTED_SLACK_TOKEN]'],
  [/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)[^\s`'"]+/gi, '$1[REDACTED]'],
]

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((next, [pattern, replacement]) => next.replace(pattern, replacement), value)
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function clamp(value: string, limit = 12000): string {
  const redacted = redact(value)
  if (redacted.length <= limit) return redacted
  return `${redacted.slice(0, limit)}\n\n[truncated ${redacted.length - limit} characters]`
}

function formatTimestamp(value?: number): string {
  return value ? new Date(value).toISOString() : 'unknown'
}

export function buildConversationLog(input: {
  conversation: {
    id: string
    title: string
    providerId?: string
    model?: string
    mode?: string
    createdAt?: number
    updatedAt?: number
    messages?: Message[]
  }
  artifacts: Artifact[]
}): string {
  const { conversation, artifacts } = input
  const messages = conversation.messages || []
  const lines: string[] = [
    `# Jelico Conversation Log: ${conversation.title || 'Untitled chat'}`,
    '',
    '## Metadata',
    `- Conversation ID: ${conversation.id}`,
    `- Provider ID: ${conversation.providerId || 'unknown'}`,
    `- Model: ${conversation.model || 'unknown'}`,
    `- Mode: ${conversation.mode || 'unknown'}`,
    `- Created: ${formatTimestamp(conversation.createdAt)}`,
    `- Updated: ${formatTimestamp(conversation.updatedAt)}`,
    `- Messages: ${messages.length}`,
    `- Artifacts: ${artifacts.length}`,
    '',
    '## Messages',
  ]

  for (const message of messages) {
    lines.push('', `### ${message.role.toUpperCase()} - ${formatTimestamp(message.createdAt)}`, '')
    lines.push(clamp(message.content || '[no text content]'))

    if (message.attachments?.length) {
      lines.push('', 'Attachments:')
      for (const attachment of message.attachments) {
        lines.push(`- ${attachment.name} (${attachment.type}, ${attachment.mimeType})`)
      }
    }

    if (message.toolCalls?.length) {
      lines.push('', 'Tool calls:')
      for (const call of message.toolCalls) {
        lines.push(`- ${call.name} (${call.status || 'unknown'})`)
        lines.push('```json')
        lines.push(clamp(stringify(call.args), 6000))
        lines.push('```')
      }
    }

    if (message.toolResults?.length) {
      lines.push('', 'Tool results:')
      for (const result of message.toolResults) {
        lines.push(`- ${result.toolCallId}${result.error ? ` error: ${result.error}` : ''}`)
        lines.push('```json')
        lines.push(clamp(stringify(result.result), 6000))
        lines.push('```')
      }
    }
  }

  lines.push('', '## Artifacts')
  if (artifacts.length === 0) {
    lines.push('', 'No artifacts.')
  } else {
    for (const artifact of artifacts) {
      lines.push(
        '',
        `### ${artifact.title}`,
        `- ID: ${artifact.id}`,
        `- Type: ${artifact.type}`,
        `- Language: ${artifact.language || 'n/a'}`,
        `- Revision: ${artifact.revision}`,
        `- Created: ${formatTimestamp(artifact.createdAt)}`,
        `- Updated: ${formatTimestamp(artifact.updatedAt)}`,
        '',
        '```',
        clamp(artifact.content, 12000),
        '```'
      )
    }
  }

  return lines.join('\n')
}
