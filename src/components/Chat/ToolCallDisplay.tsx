import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  ExternalLink,
  X,
} from 'lucide-react'
import { DiffViewer } from '../Canvas/DiffViewer'
import type { ToolCall, ToolResult } from '../../stores/chat'
import { useChatStore } from '../../stores/chat'
import { useAgentStore, type SubAgent } from '../../stores/agents'
import { useArtifactStore } from '../../stores/artifacts'

interface ToolCallDisplayProps {
  toolCalls: ToolCall[]
  toolResults?: ToolResult[]
  isStreaming?: boolean
}

const TOOL_LABELS: Record<string, string> = {
  // File operations
  read_file: 'Read File',
  write_file: 'Write File',
  list_directory: 'List Directory',
  search_files: 'Search Files',
  search_content: 'Search Content',
  // Execution
  execute_command: 'Execute Command',
  // Web
  web_search: 'Web Search',
  web_fetch: 'Fetch URL',
  // Artifacts
  create_artifact: 'Create Artifact',
  update_artifact: 'Update Artifact',
  artifact_test: 'Test Artifact',
  // Sub-agents - spawn_agent handled specially below
  spawn_agent: 'Sub-agent',
  get_agent_status: 'Check Agent',
  wait_for_agent: 'Wait for Agent',
  continue_agent: 'Continue Agent',
  dismiss_agent: 'Dismiss Agent',
  get_agents_summary: 'Agents Summary',
}

// Tools that are "plumbing" and shouldn't be shown in the UI
// These are internal operations that happen automatically or have dedicated UI
export const HIDDEN_TOOLS = new Set([
  'wait_for_agent',      // Waiting is implicit - sub-agent panel shows status
  'get_agent_status',    // Internal polling
  'get_agents_summary',  // Internal status check
  'ask_user_question',   // Has dedicated ClarificationPanel UI
  'todo_write',          // Has dedicated TodoPanel UI
  'todo_read',           // Internal status check
  'todo_check',          // Internal status check
])

const INTERNAL_WEB_GATE_RESULT_TYPES = new Set(['deferred_to_subagents', 'direct_limit_reached'])

function isPreviewUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.startsWith('data:') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('file:')
  )
}

function resolveArtifactImageSource(
  result: Record<string, unknown> | null,
  options: {
    dataUrlKey: string
    base64Key: string
    mimeKey: string
    defaultMimeType: string
  }
): string | null {
  if (!result) return null

  const explicitDataUrl = typeof result[options.dataUrlKey] === 'string'
    ? String(result[options.dataUrlKey]).trim()
    : ''
  if (explicitDataUrl && isPreviewUrl(explicitDataUrl)) {
    return explicitDataUrl
  }

  const rawPayload = typeof result[options.base64Key] === 'string'
    ? String(result[options.base64Key]).trim()
    : ''
  if (!rawPayload) return null

  if (isPreviewUrl(rawPayload)) {
    return rawPayload
  }

  const compactBase64 = rawPayload.replace(/\s+/g, '')
  if (!compactBase64) return null

  let mimeType = typeof result[options.mimeKey] === 'string'
    ? String(result[options.mimeKey]).trim().toLowerCase()
    : options.defaultMimeType

  if (mimeType.startsWith('data:')) {
    if (mimeType.includes(',')) {
      return mimeType
    }
    return `${mimeType},${compactBase64}`
  }

  mimeType = mimeType.replace(/;base64$/i, '').replace(/;$/, '')
  if (!mimeType.includes('/')) {
    mimeType = options.defaultMimeType
  }

  return `data:${mimeType};base64,${compactBase64}`
}

function resolveArtifactThumbnailSource(result: Record<string, unknown> | null): string | null {
  return resolveArtifactImageSource(result, {
    dataUrlKey: 'thumbnailDataUrl',
    base64Key: 'thumbnailBase64',
    mimeKey: 'thumbnailMimeType',
    defaultMimeType: 'image/jpeg',
  })
}

function resolveArtifactPreviewSource(result: Record<string, unknown> | null): string | null {
  return resolveArtifactImageSource(result, {
    dataUrlKey: 'previewDataUrl',
    base64Key: 'previewBase64',
    mimeKey: 'previewMimeType',
    defaultMimeType: 'image/png',
  })
}

function isInternalWebGateResultPayload(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const payload = result as Record<string, unknown>
  if (payload.success !== true) return false
  const results = payload.results as Record<string, unknown> | undefined
  const resultType = typeof results?.type === 'string' ? results.type : ''
  return INTERNAL_WEB_GATE_RESULT_TYPES.has(resultType)
}

export function isHiddenToolCall(toolCall: ToolCall, toolResult?: ToolResult): boolean {
  if (HIDDEN_TOOLS.has(toolCall.name)) return true
  if ((toolCall.name === 'web_search' || toolCall.name === 'web_fetch') && toolResult) {
    return isInternalWebGateResultPayload(toolResult.result)
  }
  return false
}

function sanitizeSubAgentText(text?: string): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  // Suppress API/protocol leakage from provider internals
  if (/(input_schema|tool[_\s-]?call|function call|arguments schema|name`, `description`)/i.test(trimmed)) {
    return null
  }

  return trimmed
}

function getSubAgentStateLabel(status: string): string {
  switch (status) {
    case 'running':
      return 'Running'
    case 'pending':
      return 'Starting'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
    case 'canceled':
      return 'Cancelled'
    default:
      return status
  }
}

function formatSubAgentToolStatus(
  name: string,
  args: Record<string, unknown>,
  isComplete: boolean
): string {
  const getShortPath = (p: string) => {
    const parts = p.split('/')
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p
  }

  if (isComplete) {
    switch (name) {
      case 'read_file':
        return args.path ? `Read ${getShortPath(String(args.path))}` : 'File read'
      case 'write_file':
        return args.path ? `Wrote ${getShortPath(String(args.path))}` : 'File written'
      case 'list_directory':
        return args.path ? `Explored ${getShortPath(String(args.path))}` : 'Directory explored'
      case 'search_files':
        return 'Search complete'
      case 'search_content':
        return 'Content search complete'
      case 'execute_command':
        return 'Command complete'
      case 'web_search':
        return 'Search complete'
      case 'web_fetch':
        return 'Page fetched'
      case 'report_progress':
        return 'Status updated'
      default:
        return 'Tool complete'
    }
  }

  switch (name) {
    case 'read_file':
      return args.path ? `Reading ${getShortPath(String(args.path))}` : 'Reading file...'
    case 'write_file':
      return args.path ? `Writing ${getShortPath(String(args.path))}` : 'Writing file...'
    case 'list_directory':
      return args.path ? `Exploring ${getShortPath(String(args.path))}` : 'Exploring directory...'
    case 'search_files':
      return args.pattern ? `Searching for "${args.pattern}"` : 'Searching files...'
    case 'search_content':
      return args.pattern ? `Searching content for "${String(args.pattern).slice(0, 32)}"` : 'Searching file contents...'
    case 'execute_command':
      return 'Running command...'
    case 'web_search':
      return args.query ? `Searching: "${String(args.query).slice(0, 32)}"` : 'Searching the web...'
    case 'web_fetch':
      return 'Fetching page...'
    case 'report_progress':
      return String(args.message || 'Updating status...').slice(0, 80)
    default:
      return 'Working...'
  }
}

type ToolCancellationReason =
  | 'user_stop'
  | 'stream_end_incomplete'
  | 'timeout'
  | 'provider_abort'
  | 'provider_stream_interrupted'
  | 'unknown'
  | null

function getToolCancellationReason(result: unknown): ToolCancellationReason {
  if (!result || typeof result !== 'object') return null
  const payload = result as Record<string, unknown>
  const explicitReason = typeof payload.cancellationReason === 'string'
    ? payload.cancellationReason
    : null
  if (
    explicitReason === 'user_stop' ||
    explicitReason === 'stream_end_incomplete' ||
    explicitReason === 'timeout' ||
    explicitReason === 'provider_abort' ||
    explicitReason === 'provider_stream_interrupted'
  ) {
    return explicitReason
  }

  const canceled = payload.canceled === true || payload.cancelled === true
  const error = String(payload.error || '').toLowerCase()
  if (!canceled && !error) return null
  if (error.includes('stream stopped by user')) return 'user_stop'
  if (error.includes('before returning a final result')) return 'stream_end_incomplete'
  if (error.includes('timed out') || error.includes('timeout')) return 'timeout'
  if (error.includes('provider aborted') || error.includes('abort')) return 'provider_abort'
  if (canceled) return 'unknown'
  return null
}

function isCanceledResultPayload(result: unknown): boolean {
  return getToolCancellationReason(result) !== null
}

function getCanceledResultLabel(result: unknown): string {
  const reason = getToolCancellationReason(result)
  switch (reason) {
    case 'user_stop':
      return 'Canceled by user'
    case 'stream_end_incomplete':
      return 'Interrupted before tool finished'
    case 'timeout':
      return 'Interrupted due to timeout'
    case 'provider_abort':
      return 'Interrupted by provider'
    case 'provider_stream_interrupted':
      return 'Provider ended stream before tool execution'
    case 'unknown':
      return 'Canceled'
    default:
      return 'Canceled'
  }
}

function getSpawnedAgentId(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const agentId = (result as Record<string, unknown>).agent_id
  return typeof agentId === 'string' && agentId.length > 0 ? agentId : null
}

function resolveToolCallState(
  toolCall: ToolCall,
  toolResult: ToolResult | undefined,
  isStreaming?: boolean
): {
  status: string
  hasResult: boolean
  isInProgress: boolean
  isCanceled: boolean
} {
  const hasResult = toolResult !== undefined
  const inferredStatus = toolCall.status || (hasResult ? 'complete' : (isStreaming ? 'executing' : 'complete'))
  const status = (!isStreaming && !hasResult && (inferredStatus === 'starting' || inferredStatus === 'executing'))
    ? 'canceled'
    : inferredStatus
  const isInProgress = status === 'starting' || status === 'executing'
  const isCanceled = status === 'canceled' || status === 'cancelled' || isCanceledResultPayload(toolResult?.result)

  return {
    status,
    hasResult,
    isInProgress,
    isCanceled,
  }
}

export function buildProcessingToneByToolCallId({
  toolCalls,
  toolResults = [],
  agents,
  isStreaming,
}: {
  toolCalls: ToolCall[]
  toolResults?: ToolResult[]
  agents: SubAgent[]
  isStreaming?: boolean
}): Map<string, number> {
  const tones = new Map<string, number>()
  if (toolCalls.length === 0) return tones

  const resultsMap = new Map(toolResults.map((result) => [result.toolCallId, result]))
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]))
  let nextTone = 0

  for (const toolCall of toolCalls) {
    const toolResult = resultsMap.get(toolCall.id)
    const { isInProgress } = resolveToolCallState(toolCall, toolResult, isStreaming)

    let isProcessing = isInProgress
    if (toolCall.name === 'spawn_agent') {
      const subAgent = agentMap.get(getSpawnedAgentId(toolResult?.result) || '')
      if (subAgent?.status === 'running' || subAgent?.status === 'pending') {
        isProcessing = true
      }
    }

    if (isProcessing) {
      tones.set(toolCall.id, nextTone % 4)
      nextTone += 1
    }
  }

  return tones
}

function formatToolResult(result: unknown): { content: string; isError: boolean } {
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>

    // Handle errors
    if (obj.success === false) {
      if (isCanceledResultPayload(obj)) {
        return {
          content: getCanceledResultLabel(obj),
          isError: false,
        }
      }
      return {
        content: String(obj.error || 'Unknown error'),
        isError: true
      }
    }

    // File content
    if (obj.content) {
      return { content: String(obj.content), isError: false }
    }

    // Directory listing
    if (obj.items && Array.isArray(obj.items)) {
      return {
        content: obj.items.map((i: any) => `${i.type === 'directory' ? '[dir]' : '[file]'} ${i.name}`).join('\n'),
        isError: false
      }
    }

    // File search results
    if (obj.files && Array.isArray(obj.files)) {
      return { content: obj.files.join('\n'), isError: false }
    }

    // Command output
    if (obj.stdout !== undefined || obj.stderr !== undefined) {
      const out = String(obj.stdout || '')
      const err = String(obj.stderr || '')
      return {
        content: out + (err ? `\n---\nstderr:\n${err}` : ''),
        isError: obj.success === false
      }
    }

    // Agent spawn result
    if (obj.agent_id) {
      return {
        content: `Agent ID: ${obj.agent_id}\n${obj.message || ''}`,
        isError: false
      }
    }

    // Agent status result
    if (obj.status !== undefined && obj.is_complete !== undefined) {
      let statusInfo = `Status: ${obj.status}`
      if (obj.has_question) {
        statusInfo += `\n[Question] ${obj.question || 'Waiting for input'}`
        if (obj.question_context) statusInfo += `\nContext: ${obj.question_context}`
      }
      if (obj.result) statusInfo += `\n\nResult:\n${typeof obj.result === 'string' ? obj.result : JSON.stringify(obj.result, null, 2)}`
      if (obj.progress) statusInfo += `\n\nProgress:\n${obj.progress}`
      return { content: statusInfo, isError: false }
    }

    // Agents summary
    if (obj.agent_count !== undefined) {
      return {
        content: `Total: ${obj.agent_count} | Running: ${obj.running || 0} | Completed: ${obj.completed || 0} | Failed: ${obj.failed || 0}\n\n${obj.summary || ''}`,
        isError: false
      }
    }

    // Web search results
    if (obj.results && typeof obj.results === 'object') {
      const r = obj.results as any
      let searchInfo = ''
      if (r.abstract) searchInfo += `${r.abstract}\n\nSource: ${r.abstractSource || 'Unknown'}\n`
      if (r.answer) searchInfo += `Answer: ${r.answer}\n`
      if (r.relatedTopics?.length) {
        searchInfo += '\nRelated:\n' + r.relatedTopics.map((t: any) => `• ${t.text}`).join('\n')
      }
      if (r.message) searchInfo = r.message
      return { content: searchInfo || JSON.stringify(r, null, 2), isError: false }
    }

    // Artifact created/updated
    if (obj.message && String(obj.message).includes('Artifact')) {
      return { content: String(obj.message), isError: false }
    }

    // Artifact test sessions list
    if (obj.sessions && Array.isArray(obj.sessions)) {
      if (obj.sessions.length === 0) {
        return { content: 'No active artifact test sessions', isError: false }
      }
      const content = obj.sessions
        .map((session: any) => {
          const title = session.artifactTitle || session.artifactId || 'Untitled'
          return `• ${session.sessionId} (${title})`
        })
        .join('\n')
      return { content, isError: false }
    }

    // Artifact test open/screenshot summaries
    if (obj.sessionId || (obj.path && obj.width && obj.height)) {
      const lines: string[] = []
      if (obj.sessionId) lines.push(`Session: ${obj.sessionId}`)
      if (obj.artifactTitle) lines.push(`Artifact: ${obj.artifactTitle}`)
      if (obj.revision) lines.push(`Revision: v${obj.revision}`)
      if (obj.path) lines.push(`Screenshot: ${obj.path}`)
      if (obj.width && obj.height) lines.push(`Viewport: ${obj.width}x${obj.height}`)
      if (obj.value !== undefined) lines.push(`Value: ${JSON.stringify(obj.value)}`)
      return { content: lines.join('\n') || JSON.stringify(obj, null, 2), isError: false }
    }

    // Default: pretty JSON
    return { content: JSON.stringify(result, null, 2), isError: false }
  }
  return { content: String(result), isError: false }
}

function pickStringValue(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') return value
  }
  return null
}

function getToolCallDiffPreview(toolCall: ToolCall, toolResult?: ToolResult): { original: string; modified: string } | null {
  if (toolCall.name !== 'write_file' && toolCall.name !== 'edit_file') {
    return null
  }

  const args = toolCall.args || {}
  const resultObj = (toolResult?.result && typeof toolResult.result === 'object')
    ? (toolResult.result as Record<string, unknown>)
    : {}

  if (toolCall.name === 'write_file') {
    const modified = pickStringValue(args, ['content'])
      ?? pickStringValue(resultObj, ['newContent', 'modifiedContent', 'updatedContent', 'content'])
    if (modified === null) return null
    const original = pickStringValue(resultObj, ['originalContent', 'previousContent', 'oldContent', 'existingContent', 'beforeContent'])
      ?? pickStringValue(args as Record<string, unknown>, ['originalContent', 'oldContent', 'beforeContent'])
      ?? ''
    return { original, modified }
  }

  const original = pickStringValue(args as Record<string, unknown>, ['original', 'originalContent', 'oldContent', 'beforeContent', 'old_string', 'oldText', 'search'])
    ?? pickStringValue(resultObj, ['original', 'originalContent', 'previousContent', 'oldContent', 'beforeContent'])
  const modified = pickStringValue(args as Record<string, unknown>, ['modified', 'modifiedContent', 'newContent', 'content', 'afterContent', 'new_string', 'newText', 'replace'])
    ?? pickStringValue(resultObj, ['modified', 'modifiedContent', 'newContent', 'updatedContent', 'content', 'afterContent'])
  if (original === null || modified === null) return null
  return { original, modified }
}

// Single tool call display - exported for use in interleaved message segments
export function SingleToolCallDisplay({
  toolCall,
  toolResult,
  isStreaming,
  processingTone,
}: {
  toolCall: ToolCall
  toolResult?: ToolResult
  isStreaming?: boolean
  processingTone?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [isThumbnailOpen, setIsThumbnailOpen] = useState(false)
  const [isThumbnailFailed, setIsThumbnailFailed] = useState(false)
  const [isPreviewFailed, setIsPreviewFailed] = useState(false)

  const { agents } = useAgentStore()
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const { selectArtifact, openCanvas, artifacts } = useArtifactStore()

  // Get sub-agent info first for reference in useEffect
  const agentId = toolCall.name === 'spawn_agent'
    ? getSpawnedAgentId(toolResult?.result)
    : null
  const subAgent = agentId ? agents.find(a => a.id === agentId) : null
  const safeLatestUpdate = sanitizeSubAgentText(subAgent?.latestUpdate?.message)
  const safeProgressPreview = sanitizeSubAgentText(subAgent?.progress)
  const progressPreview = safeProgressPreview
    ? safeProgressPreview.slice(0, 420)
    : null
  const lastAgentTool = subAgent?.toolCalls?.length
    ? subAgent.toolCalls[subAgent.toolCalls.length - 1]
    : null
  const agentToolStatus = lastAgentTool
    ? formatSubAgentToolStatus(lastAgentTool.name, lastAgentTool.args, !!lastAgentTool.result)
    : null


  // Build label with resource name included (e.g., "Write File: bunfig.toml")
  const label: string = (() => {
    if (toolCall.name === 'spawn_agent') {
      // Prefer displayName from agent store (has friendly first name)
      if (subAgent?.displayName) {
        return subAgent.displayName
      }
      // Fallback while agent is being spawned (before we have the agent_id)
      return 'Starting sub-agent...'
    }

    const baseName = TOOL_LABELS[toolCall.name] || toolCall.name
    const args = toolCall.args || {}

    // Extract resource name based on tool type
    const getShortPath = (p: string) => {
      const parts = p.split('/')
      return parts.length > 2 ? parts.slice(-2).join('/') : parts.slice(-1)[0] || p
    }

    switch (toolCall.name) {
      case 'read_file':
      case 'write_file':
        if (args.path) return `${baseName}: ${getShortPath(String(args.path))}`
        break
      case 'list_directory':
        if (args.path) return `${baseName}: ${getShortPath(String(args.path))}`
        break
      case 'search_files':
        if (args.pattern) return `${baseName}: "${args.pattern}"`
        break
      case 'search_content':
        if (args.pattern) return `${baseName}: "${String(args.pattern).slice(0, 30)}"`
        break
      case 'execute_command': {
        const cmd = String(args.command || '')
        const shortCmd = cmd.length > 30 ? cmd.slice(0, 30) + '...' : cmd
        if (shortCmd) return `Command: ${shortCmd}`
        break
      }
      case 'web_search':
        if (args.query) return `${baseName}: "${String(args.query).slice(0, 25)}"`
        break
      case 'web_fetch': {
        const url = String(args.url || '')
        try {
          const hostname = new URL(url).hostname
          return `${baseName}: ${hostname}`
        } catch {}
        break
      }
      case 'create_artifact':
      case 'update_artifact':
        if (args.title) return `${baseName}: ${String(args.title).slice(0, 30)}`
        break
      case 'artifact_test': {
        const action = args.action ? String(args.action).replace(/_/g, ' ') : ''
        if (action === 'click' && args.selector) {
          return `${baseName}: click ${String(args.selector).slice(0, 30)}`
        }
        if (action === 'type' && args.selector) {
          return `${baseName}: type ${String(args.selector).slice(0, 30)}`
        }
        if (action === 'wait for' && (args.selector || args.text)) {
          return `${baseName}: wait for`
        }
        if (action === 'open' && args.artifact_id) {
          return `${baseName}: open ${String(args.artifact_id).slice(0, 12)}`
        }
        if (action) {
          return `${baseName}: ${action}`
        }
        break
      }
    }

    return baseName
  })()

  const { status, hasResult, isInProgress, isCanceled } = resolveToolCallState(toolCall, toolResult, isStreaming)
  const formattedResult = hasResult && toolResult ? formatToolResult(toolResult.result) : null
  const diffPreview = getToolCallDiffPreview(toolCall, toolResult)
  const hasError = !isCanceled && ((hasResult && formattedResult?.isError) || status === 'error')

  const formatArtifactType = () => {
    const rawType = String(toolCall.args?.type || '').toLowerCase()
    const rawLang = String(toolCall.args?.language || '').toLowerCase()
    const rawTitle = String(toolCall.args?.title || '').toLowerCase()
    const rawContent = typeof toolCall.args?.content === 'string'
      ? toolCall.args.content.slice(0, 240).toLowerCase()
      : ''
    const capitalize = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value

    switch (rawType) {
      case 'html':
        return 'HTML page'
      case 'svg':
        return 'SVG graphic'
      case 'mermaid':
        return 'diagram'
      case 'document':
        return 'document'
      case 'code':
        return rawLang ? `${capitalize(rawLang)} code` : 'code'
      default:
        if (rawTitle.endsWith('.html') || rawTitle.endsWith('.htm') || rawContent.includes('<html')) {
          return 'HTML page'
        }
        if (rawTitle.endsWith('.svg') || rawContent.includes('<svg')) {
          return 'SVG graphic'
        }
        if (
          rawTitle.endsWith('.mmd') ||
          rawContent.includes('graph ') ||
          rawContent.includes('flowchart') ||
          rawContent.includes('sequencediagram')
        ) {
          return 'diagram'
        }
        if (rawTitle.endsWith('.md') || rawTitle.endsWith('.markdown')) {
          return 'markdown document'
        }
        if (rawTitle.endsWith('.txt')) {
          return 'text document'
        }
        if (rawLang) {
          return `${capitalize(rawLang)} code`
        }
        return rawType ? rawType : 'artifact'
    }
  }

  const isSubAgentInProgress = toolCall.name === 'spawn_agent' &&
    !!subAgent &&
    (subAgent.status === 'running' || subAgent.status === 'pending')
  const isProcessing = toolCall.name === 'spawn_agent'
    ? (isInProgress || isSubAgentInProgress)
    : isInProgress
  const processingToneClass = isProcessing
    ? `tool-call-pill-processing tool-call-pill-processing-tone-${(processingTone ?? 0) % 4}`
    : ''

  const isCreateArtifactTool = toolCall.name === 'create_artifact'
  const isUpdateArtifactTool = toolCall.name === 'update_artifact'
  const isArtifactMutationTool = isCreateArtifactTool || isUpdateArtifactTool

  const isExpandable = (() => {
    if (isArtifactMutationTool && !hasResult && !formattedResult?.isError) {
      return false
    }
    return true
  })()

  // Get artifact info if this is a create/update artifact call
  const artifactTitle = typeof toolCall.args?.title === 'string'
    ? String(toolCall.args.title)
    : null
  const artifactType = typeof toolCall.args?.type === 'string'
    ? String(toolCall.args.type).toLowerCase()
    : null
  const expectsHtmlThumbnail = artifactType === 'html'
  const updateArtifactId = isUpdateArtifactTool && typeof toolCall.args?.id === 'string'
    ? String(toolCall.args.id)
    : null

  const linkedArtifact = (() => {
    if (isCreateArtifactTool && artifactTitle) {
      const matches = artifacts
        .filter((artifact) => {
          const titleMatches = artifact.title === artifactTitle
          const conversationMatches = activeConversationId
            ? artifact.conversationId === activeConversationId
            : true
          const typeMatches = artifactType
            ? artifact.type.toLowerCase() === artifactType
            : true
          return titleMatches && conversationMatches && typeMatches
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
      return matches[0] || null
    }

    if (isUpdateArtifactTool && updateArtifactId) {
      const matches = artifacts
        .filter((artifact) => {
          const conversationMatches = activeConversationId
            ? artifact.conversationId === activeConversationId
            : true
          if (!conversationMatches) return false
          return artifact.id === updateArtifactId || artifact.baseArtifactId === updateArtifactId
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
      return matches[0] || null
    }

    return null
  })()

  const artifactMutationResult = isArtifactMutationTool && toolResult?.result && typeof toolResult.result === 'object'
    ? toolResult.result as Record<string, unknown>
    : null
  const thumbnailDataUrl = resolveArtifactThumbnailSource(artifactMutationResult)
  const previewDataUrl = resolveArtifactPreviewSource(artifactMutationResult) || thumbnailDataUrl
  const expandedPreviewUrl = (isPreviewFailed ? thumbnailDataUrl : previewDataUrl) || thumbnailDataUrl
  const artifactLinkLabel = isCreateArtifactTool && linkedArtifact
    ? linkedArtifact.title
    : 'Open current artifact'

  const handleArtifactClick = () => {
    if (linkedArtifact) {
      selectArtifact(linkedArtifact.id)
      openCanvas()
    }
  }

  useEffect(() => {
    if (!isThumbnailOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsThumbnailOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isThumbnailOpen])

  useEffect(() => {
    setIsThumbnailOpen(false)
    setIsThumbnailFailed(false)
    setIsPreviewFailed(false)
  }, [toolCall.id])

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-deep">
      {/* Header */}
      <button
        onClick={isExpandable ? () => setExpanded(!expanded) : undefined}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
          isExpandable ? 'hover:bg-bg-hover transition-colors' : ''
        } ${processingToneClass}`}
      >
        {isExpandable ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          )
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        <span className="text-sm font-medium text-accent flex-1 truncate">{label}</span>

        {/* Status indicator - for spawn_agent, show sub-agent status instead of tool completion */}
        {toolCall.name === 'spawn_agent' && subAgent ? (
          // Show sub-agent status
          subAgent.status === 'completed' ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : subAgent.status === 'failed' ? (
            <XCircle className="w-4 h-4 text-error flex-shrink-0" />
          ) : subAgent.status === 'cancelled' ? (
            <XCircle className="w-4 h-4 text-text-muted flex-shrink-0" />
          ) : null
        ) : (
          // Normal tool status
          <>
            {isCanceled && (
              <XCircle className="w-4 h-4 text-text-muted flex-shrink-0" />
            )}
            {hasResult && !formattedResult?.isError && !isCanceled && (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
            {hasError ? (
              <XCircle className="w-4 h-4 text-error flex-shrink-0" />
            ) : null}
          </>
        )}
      </button>

      {/* Artifact create/update in progress - simple indicator, no streaming preview */}
      {isArtifactMutationTool && !hasResult && (
        <div className="px-3 py-2 border-t border-border bg-bg-surface">
          <span className="text-xs text-text-muted">
            {isCreateArtifactTool ? 'Creating ' : 'Updating '}
            {formatArtifactType()}...
          </span>
        </div>
      )}

      {/* Artifact link - shown inline when create/update completes */}
      {isArtifactMutationTool && hasResult && !formattedResult?.isError && linkedArtifact && (
        <div className="px-3 py-2 border-t border-border bg-bg-surface">
          <button
            onClick={handleArtifactClick}
            className="flex items-center gap-2 text-xs text-accent hover:text-accent-bright transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="underline">{artifactLinkLabel}</span>
          </button>
        </div>
      )}
      {isArtifactMutationTool && expectsHtmlThumbnail && hasResult && !formattedResult?.isError && thumbnailDataUrl && !isThumbnailFailed && (
        <div className="px-3 pb-3 border-t border-border bg-bg-surface">
          <button
            onClick={() => {
              setIsPreviewFailed(false)
              setIsThumbnailOpen(true)
            }}
            className="mt-2 rounded border border-border overflow-hidden hover:border-accent/70 transition-colors"
            aria-label="Open artifact thumbnail preview"
          >
            <img
              src={thumbnailDataUrl}
              alt={isCreateArtifactTool ? 'HTML artifact thumbnail snapshot at creation' : 'HTML artifact thumbnail snapshot after update'}
              className="block w-full max-w-[150px] h-auto"
              onError={() => setIsThumbnailFailed(true)}
            />
          </button>
        </div>
      )}
      {isArtifactMutationTool && expectsHtmlThumbnail && hasResult && !formattedResult?.isError && (!thumbnailDataUrl || isThumbnailFailed) && (
        <div className="px-3 pb-3 border-t border-border bg-bg-surface">
          <div className="mt-2 rounded border border-border bg-bg-deep px-2.5 py-2 text-xs text-text-muted">
            Thumbnail preview unavailable.
          </div>
        </div>
      )}

      {/* Sub-agent error - only show errors inline (not a full panel) */}
      {toolCall.name === 'spawn_agent' && subAgent?.status === 'failed' && subAgent.error && (
        <div className="px-3 py-2 border-t border-border bg-bg-surface flex items-start gap-2">
          <XCircle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" />
          <div className="text-xs text-error">{subAgent.error}</div>
        </div>
      )}

      {/* Expanded content - collapsible sections */}
      {expanded && isExpandable && (
        <div className="border-t border-border bg-bg-surface">
          {/* Sub-agent details are shown per tool card (single source of truth) */}
          {toolCall.name === 'spawn_agent' && subAgent && (
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className={`w-2 h-2 rounded-full ${
                  subAgent.status === 'running' || subAgent.status === 'pending'
                    ? 'bg-accent animate-pulse'
                    : subAgent.status === 'completed'
                      ? 'bg-green-500'
                      : 'bg-error'
                }`} />
                <span>{getSubAgentStateLabel(subAgent.status)}</span>
                {subAgent.latestUpdate?.phase && (
                  <span className="text-accent">[{subAgent.latestUpdate.phase}]</span>
                )}
              </div>

              {(safeLatestUpdate || agentToolStatus) && (
                <div className="ml-4 text-xs text-text-secondary">
                  {safeLatestUpdate || agentToolStatus}
                </div>
              )}

              {progressPreview && (
                <div className="ml-4 rounded bg-bg-deep px-2.5 py-2 text-xs text-text-secondary whitespace-pre-wrap break-words">
                  {progressPreview}
                </div>
              )}
            </div>
          )}

          {/* Result - shown directly when expanded (not shown for spawn_agent) */}
          {diffPreview && toolCall.name !== 'spawn_agent' && (
            <div className="px-3 py-2">
              <div className="text-xs text-text-muted mb-2">Changes preview</div>
              <DiffViewer
                original={diffPreview.original}
                modified={diffPreview.modified}
                className="rounded border border-border bg-bg-deep max-h-80 overflow-auto"
              />
            </div>
          )}

          {formattedResult && toolCall.name !== 'spawn_agent' && (
            <div className="px-3 py-2">
              <pre className={`text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto rounded p-2 ${
                formattedResult.isError ? 'text-error bg-error/10' : 'text-text-secondary bg-bg-deep'
              }`}>
                {formattedResult.content}
              </pre>
            </div>
          )}

          {/* In progress indicator - for non-spawn_agent tools */}
          {isInProgress && toolCall.name !== 'spawn_agent' && (
            <div className="px-3 py-2 border-t border-border/50">
              <div className="text-xs text-text-muted">
                {status === 'starting' ? 'Starting...' : 'Running...'}
              </div>
            </div>
          )}
        </div>
      )}

      {isThumbnailOpen && expandedPreviewUrl && !isThumbnailFailed && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsThumbnailOpen(false)}
        >
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsThumbnailOpen(false)}
              className="absolute -top-3 -right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={expandedPreviewUrl}
              alt="Expanded HTML artifact thumbnail preview"
              className="max-w-[90vw] max-h-[85vh] object-contain rounded shadow-2xl"
              onError={() => {
                if (!isPreviewFailed && previewDataUrl && thumbnailDataUrl && previewDataUrl !== thumbnailDataUrl) {
                  setIsPreviewFailed(true)
                  return
                }
                setIsThumbnailFailed(true)
                setIsThumbnailOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function ToolCallDisplay({ toolCalls, toolResults = [], isStreaming }: ToolCallDisplayProps) {
  const { agents } = useAgentStore()
  const resultsMap = new Map(toolResults.map(r => [r.toolCallId, r]))
  // Filter out plumbing + internal deferred/direct-limit web gate events
  const visibleToolCalls = toolCalls.filter(tc => !isHiddenToolCall(tc, resultsMap.get(tc.id)))

  if (visibleToolCalls.length === 0) return null

  const processingToneByToolCallId = buildProcessingToneByToolCallId({
    toolCalls: visibleToolCalls,
    toolResults,
    agents,
    isStreaming,
  })
  const renderEntries = buildToolRenderEntries(visibleToolCalls)

  return (
    <div className="space-y-3 my-4">
      {renderEntries.map((entry, index) => {
        if (entry.type === 'single') {
          const { toolCall } = entry
          return (
            <SingleToolCallDisplay
              key={toolCall.id || `tool-${index}`}
              toolCall={toolCall}
              toolResult={resultsMap.get(toolCall.id)}
              isStreaming={isStreaming}
              processingTone={processingToneByToolCallId.get(toolCall.id)}
            />
          )
        }

        return (
          <ConsolidatedToolCallGroup
            key={`group-${entry.toolName}-${index}`}
            toolName={entry.toolName}
            toolCalls={entry.toolCalls}
            resultsMap={resultsMap}
            isStreaming={isStreaming}
            processingToneByToolCallId={processingToneByToolCallId}
          />
        )
      })}
    </div>
  )
}

export type ToolRenderEntry =
  | { type: 'single'; toolCall: ToolCall }
  | { type: 'group'; toolName: string; toolCalls: ToolCall[] }

const MINIMUM_GROUP_SIZE_BY_TOOL_NAME: Record<string, number> = {
  artifact_test: 2, // Keep artifact testing condensed even on shorter chains.
}

export function buildToolRenderEntries(toolCalls: ToolCall[]): ToolRenderEntry[] {
  const renderEntries: ToolRenderEntry[] = []
  let cursor = 0

  while (cursor < toolCalls.length) {
    const current = toolCalls[cursor]
    let next = cursor + 1
    while (next < toolCalls.length && toolCalls[next].name === current.name) {
      next += 1
    }

    const run = toolCalls.slice(cursor, next)
    const threshold = MINIMUM_GROUP_SIZE_BY_TOOL_NAME[current.name] || 3
    const shouldGroup = current.name !== 'spawn_agent' && run.length >= threshold

    if (shouldGroup) {
      renderEntries.push({
        type: 'group',
        toolName: current.name,
        toolCalls: run,
      })
    } else {
      for (const toolCall of run) {
        renderEntries.push({
          type: 'single',
          toolCall,
        })
      }
    }

    cursor = next
  }

  return renderEntries
}

export function ConsolidatedToolCallGroup({
  toolName,
  toolCalls,
  resultsMap,
  isStreaming,
  processingToneByToolCallId,
}: {
  toolName: string
  toolCalls: ToolCall[]
  resultsMap: Map<string, ToolResult>
  isStreaming?: boolean
  processingToneByToolCallId: Map<string, number>
}) {
  const [expanded, setExpanded] = useState(false)
  const label = TOOL_LABELS[toolName] || toolName.replace(/_/g, ' ')

  let inProgressCount = 0
  let completedCount = 0
  let errorCount = 0

  for (const toolCall of toolCalls) {
    const toolResult = resultsMap.get(toolCall.id)
    const { isInProgress, isCanceled } = resolveToolCallState(toolCall, toolResult, isStreaming)
    if (isInProgress) inProgressCount += 1

    if (toolResult) {
      const formattedResult = formatToolResult(toolResult.result)
      if (formattedResult.isError) {
        errorCount += 1
      } else if (!isCanceled) {
        completedCount += 1
      }
    }
  }

  const statusLabel = inProgressCount > 0
    ? `${toolCalls.length} calls · ${inProgressCount} running`
    : errorCount > 0
      ? `${toolCalls.length} calls · ${errorCount} failed`
      : `${toolCalls.length} calls`

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-deep">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-accent flex-1 truncate">
          {label}
        </span>
        <span className="text-xs text-text-muted">{statusLabel}</span>
        {errorCount > 0 ? (
          <XCircle className="w-4 h-4 text-error flex-shrink-0" />
        ) : inProgressCount === 0 && completedCount > 0 ? (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : null}
      </button>

      {expanded && (
        <div className="border-t border-border bg-bg-surface p-2 space-y-2">
          {toolCalls.map((toolCall, index) => (
            <div key={toolCall.id || `grouped-tool-${index}`} className="space-y-1">
              <div className="px-1 text-[11px] text-text-faint uppercase tracking-wide">
                Call {index + 1}
              </div>
              <SingleToolCallDisplay
                toolCall={toolCall}
                toolResult={resultsMap.get(toolCall.id)}
                isStreaming={isStreaming}
                processingTone={processingToneByToolCallId.get(toolCall.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
