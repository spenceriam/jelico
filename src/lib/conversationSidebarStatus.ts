export type ConversationSidebarStatus = 'in_progress' | 'waiting' | 'error' | 'done'

export interface ConversationSidebarStatusInput {
  isStreaming: boolean
  hasRunningAgent: boolean
  hasPendingAgent: boolean
  hasClarificationRequest: boolean
  hasInterruptedStream: boolean
  hasFailedAgent: boolean
  hasConversationError: boolean
}

export interface ConversationSidebarStatusMeta {
  status: ConversationSidebarStatus
  label: string
  sectionLabel: string
}

export const CONVERSATION_SIDEBAR_STATUS_ORDER: ConversationSidebarStatus[] = [
  'in_progress',
  'waiting',
  'error',
  'done',
]

export function getConversationSidebarStatus(
  input: ConversationSidebarStatusInput
): ConversationSidebarStatus {
  if (input.isStreaming || input.hasRunningAgent || input.hasPendingAgent) {
    return 'in_progress'
  }

  if (input.hasClarificationRequest) {
    return 'waiting'
  }

  if (input.hasInterruptedStream || input.hasFailedAgent || input.hasConversationError) {
    return 'error'
  }

  return 'done'
}

export function getConversationSidebarStatusMeta(
  status: ConversationSidebarStatus
): ConversationSidebarStatusMeta {
  switch (status) {
    case 'in_progress':
      return {
        status,
        label: 'In progress',
        sectionLabel: 'In Progress',
      }
    case 'waiting':
      return {
        status,
        label: 'Waiting for input',
        sectionLabel: 'Waiting for Input',
      }
    case 'error':
      return {
        status,
        label: 'Needs attention',
        sectionLabel: 'Needs Attention',
      }
    case 'done':
    default:
      return {
        status: 'done',
        label: 'Done',
        sectionLabel: 'Done',
      }
  }
}
