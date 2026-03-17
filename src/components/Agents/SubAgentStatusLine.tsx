/**
 * SubAgentStatusLine - Inline sub-agent status beneath main AI status
 *
 * Shows active sub-agents in a compact, indented format
 * similar to the main AI status line.
 */

import { Bot } from 'lucide-react'
import { useAgentStore } from '../../stores/agents'
import { useChatStore } from '../../stores/chat'
import { BrailleLoader } from '../StatusIndicators'

export function SubAgentStatusLine() {
  const { agents } = useAgentStore()
  const { activeConversationId } = useChatStore()

  // Only show running agents for the current conversation
  const runningAgents = agents.filter(
    (a) =>
      (a.status === 'running' || a.status === 'waiting_for_input') &&
      a.conversationId === activeConversationId
  )

  if (runningAgents.length === 0) return null

  return (
    <div className="ml-8 space-y-1">
      {runningAgents.map((agent) => {
        // Keep status line structured and predictable.
        // Do not show raw streamed model text (can leak API/protocol internals).
        let status = 'Thinking...'
        const latestMessage = sanitizeStatusMessage(agent.latestUpdate?.message)

        if (agent.toolCalls.length > 0) {
          // Prefer real tool activity over stale "Starting..." progress updates.
          const pendingTool = [...agent.toolCalls].reverse().find((tc) => tc.result === undefined)
          const lastTool = pendingTool ?? agent.toolCalls[agent.toolCalls.length - 1]
          status = getToolStatus(lastTool.name, lastTool.args, !!lastTool.result)
        } else if (latestMessage) {
          status = latestMessage.slice(0, 60)
        }

        return (
          <div
            key={agent.id}
            className="flex items-center gap-2 py-0.5 text-text-secondary"
          >
            <div className="flex items-center gap-1.5 text-accent/70">
              <Bot className="w-3 h-3" />
              <BrailleLoader className="text-sm" />
            </div>
            <span className="text-xs font-medium text-text-muted">
              {agent.displayName || agent.name}:
            </span>
            <span className="text-xs text-text-secondary truncate">
              {status}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function sanitizeStatusMessage(message?: string): string | null {
  if (!message) return null
  const trimmed = message.trim()
  if (!trimmed) return null

  // Avoid low-signal or protocol-like text in the compact status line.
  const isGenericStart = /^starting\b/i.test(trimmed)
  const hasApiProtocolNoise = /(input_schema|tool[_\s-]?call|function call|arguments schema|name`, `description`)/i.test(trimmed)
  if (isGenericStart || hasApiProtocolNoise) return null

  return trimmed
}

// Get a short status string for a tool call
function getToolStatus(
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
      case 'execute_command':
        return 'Command complete'
      case 'web_search':
        return 'Search complete'
      case 'web_fetch': {
        const url = String(args.url || '')
        try {
          const hostname = new URL(url).hostname
          return `Fetched ${hostname}`
        } catch {
          return 'Page fetched'
        }
      }
      default:
        return 'Done'
    }
  } else {
    switch (name) {
      case 'read_file':
        return args.path ? `Reading ${getShortPath(String(args.path))}` : 'Reading file...'
      case 'write_file':
        return args.path ? `Writing ${getShortPath(String(args.path))}` : 'Writing file...'
      case 'list_directory':
        return args.path ? `Exploring ${getShortPath(String(args.path))}` : 'Exploring directory...'
      case 'search_files':
        return args.pattern ? `Searching for "${args.pattern}"` : 'Searching files...'
      case 'execute_command': {
        const cmd = String(args.command || '')
        const shortCmd = cmd.length > 25 ? cmd.slice(0, 25) + '...' : cmd
        return shortCmd ? `Running: ${shortCmd}` : 'Running command...'
      }
      case 'web_search':
        return args.query ? `Searching: "${String(args.query).slice(0, 20)}"` : 'Searching the web...'
      case 'web_fetch': {
        const url = String(args.url || '')
        try {
          const hostname = new URL(url).hostname
          return `Fetching ${hostname}`
        } catch {
          return 'Fetching page...'
        }
      }
      case 'report_progress':
        return String(args.message || 'Updating status...').slice(0, 40)
      default:
        return 'Working...'
    }
  }
}
