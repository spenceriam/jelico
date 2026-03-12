const NEW_CHAT_QUEUE_PANEL_KEY = '__new__'

export interface QueuePanelMessageLike {
  conversationId?: string | null
}

export interface QueuePanelOrderedMessageLike extends QueuePanelMessageLike {
  id: string
}

export interface QueuePanelPriorityMessageLike extends QueuePanelOrderedMessageLike {
  sendNowRequestedAt?: number | null
}

export interface QueuePanelAttachmentLike {
  name?: string
}

export interface QueuePanelPreviewMessageLike {
  content?: string | null
  attachments?: QueuePanelAttachmentLike[]
}

export interface QueuePanelAnchor {
  previousId: string | null
  nextId: string | null
}

export interface QueuePanelPendingEdit<T extends QueuePanelOrderedMessageLike> {
  queuedMessage: T
  anchor: QueuePanelAnchor
}

export function getQueuePanelConversationKey(conversationId: string | null | undefined): string {
  return conversationId ?? NEW_CHAT_QUEUE_PANEL_KEY
}

export function getQueuedCountForConversation<T extends QueuePanelMessageLike>(
  messageQueue: T[],
  conversationId: string | null | undefined
): number {
  const targetKey = getQueuePanelConversationKey(conversationId)
  return messageQueue.reduce((count, message) => (
    getQueuePanelConversationKey(message.conversationId) === targetKey ? count + 1 : count
  ), 0)
}

export function getQueuePanelExpandedByConversation<T extends QueuePanelMessageLike>(
  messageQueue: T[]
): Record<string, boolean> {
  return messageQueue.reduce<Record<string, boolean>>((expandedByConversation, message) => {
    expandedByConversation[getQueuePanelConversationKey(message.conversationId)] = true
    return expandedByConversation
  }, {})
}

export function getQueuePanelAnchor<T extends QueuePanelOrderedMessageLike>(
  messageQueue: T[],
  targetId: string
): QueuePanelAnchor {
  const targetIndex = messageQueue.findIndex((message) => message.id === targetId)
  if (targetIndex === -1) {
    return { previousId: null, nextId: null }
  }

  return {
    previousId: targetIndex > 0 ? messageQueue[targetIndex - 1].id : null,
    nextId: targetIndex < messageQueue.length - 1 ? messageQueue[targetIndex + 1].id : null,
  }
}

export function insertQueuedMessageAtAnchor<T extends QueuePanelOrderedMessageLike>(
  messageQueue: T[],
  queuedMessage: T,
  anchor: QueuePanelAnchor
): T[] {
  const withoutMessage = messageQueue.filter((message) => message.id !== queuedMessage.id)

  if (anchor.nextId) {
    const nextIndex = withoutMessage.findIndex((message) => message.id === anchor.nextId)
    if (nextIndex !== -1) {
      return [
        ...withoutMessage.slice(0, nextIndex),
        queuedMessage,
        ...withoutMessage.slice(nextIndex),
      ]
    }
  }

  if (anchor.previousId) {
    const previousIndex = withoutMessage.findIndex((message) => message.id === anchor.previousId)
    if (previousIndex !== -1) {
      return [
        ...withoutMessage.slice(0, previousIndex + 1),
        queuedMessage,
        ...withoutMessage.slice(previousIndex + 1),
      ]
    }
  }

  return [...withoutMessage, queuedMessage]
}

export function markQueuedMessageAsPriority<T extends QueuePanelPriorityMessageLike>(
  messageQueue: T[],
  targetId: string,
  requestedAt: number
): T[] {
  if (!messageQueue.some((message) => message.id === targetId)) {
    return messageQueue
  }

  let changed = false

  const nextQueue = messageQueue.map((message) => {
    const isTarget = message.id === targetId
    const nextRequestedAt = isTarget ? requestedAt : undefined
    const currentRequestedAt = message.sendNowRequestedAt ?? undefined
    if (currentRequestedAt === nextRequestedAt) {
      return message
    }
    changed = true
    return {
      ...message,
      sendNowRequestedAt: nextRequestedAt,
    }
  })

  return changed ? nextQueue : messageQueue
}

export function getPriorityQueuedMessageIndex<T extends QueuePanelPriorityMessageLike>(
  messageQueue: T[]
): number {
  let selectedIndex = -1
  let selectedRequestedAt = -Infinity

  for (let index = 0; index < messageQueue.length; index += 1) {
    const requestedAt = messageQueue[index].sendNowRequestedAt
    if (typeof requestedAt !== 'number') continue
    if (requestedAt >= selectedRequestedAt) {
      selectedRequestedAt = requestedAt
      selectedIndex = index
    }
  }

  return selectedIndex
}

export function mergeHydratedQueuedMessages<T extends QueuePanelOrderedMessageLike>(
  persistedQueue: T[],
  inMemoryQueue: T[],
  removedIds: Iterable<string> = []
): T[] {
  const removedIdSet = new Set(removedIds)
  if (persistedQueue.length === 0) {
    return inMemoryQueue.filter((message) => !removedIdSet.has(message.id))
  }
  if (inMemoryQueue.length === 0) {
    return persistedQueue.filter((message) => !removedIdSet.has(message.id))
  }

  const inMemoryById = new Map(inMemoryQueue.map((message) => [message.id, message]))
  const mergedQueue = persistedQueue
    .filter((message) => !removedIdSet.has(message.id))
    .map((message) => inMemoryById.get(message.id) ?? message)
  const mergedIds = new Set(mergedQueue.map((message) => message.id))

  for (const message of inMemoryQueue) {
    if (!mergedIds.has(message.id) && !removedIdSet.has(message.id)) {
      mergedQueue.push(message)
      mergedIds.add(message.id)
    }
  }

  return mergedQueue
}

export function getPersistableQueuedMessages<T extends QueuePanelOrderedMessageLike>(
  messageQueue: T[],
  pendingEdit: QueuePanelPendingEdit<T> | null
): T[] {
  if (!pendingEdit) return messageQueue
  return insertQueuedMessageAtAnchor(messageQueue, pendingEdit.queuedMessage, pendingEdit.anchor)
}

export function getVisibleQueuedMessages<T extends QueuePanelOrderedMessageLike>(
  messageQueue: T[],
  pendingEdit: QueuePanelPendingEdit<T> | null
): T[] {
  if (!pendingEdit) return messageQueue
  return messageQueue.filter((message) => message.id !== pendingEdit.queuedMessage.id)
}

export function getNextProcessableQueuedMessageIndex<T extends QueuePanelPriorityMessageLike>(
  messageQueue: T[],
  blockedConversationIds: Set<string>
): number {
  const priorityIndex = getPriorityQueuedMessageIndex(messageQueue)
  if (priorityIndex !== -1) {
    const prioritizedMessage = messageQueue[priorityIndex]
    if (
      prioritizedMessage.conversationId != null &&
      blockedConversationIds.has(prioritizedMessage.conversationId)
    ) {
      return -1
    }

    return priorityIndex
  }

  return messageQueue.findIndex((message) => (
    message.conversationId == null || !blockedConversationIds.has(message.conversationId)
  ))
}

function formatSingleAttachmentLabel(attachment: QueuePanelAttachmentLike): string {
  const attachmentName = attachment.name?.trim()
  return attachmentName && attachmentName.length > 0 ? attachmentName : '1 attachment'
}

function formatAttachmentSummary(attachments: QueuePanelAttachmentLike[]): string | null {
  if (attachments.length === 0) return null
  if (attachments.length === 1) return formatSingleAttachmentLabel(attachments[0])
  return `${attachments.length} attachments`
}

export function getQueuedMessagePreview(message: QueuePanelPreviewMessageLike): {
  primaryText: string
  secondaryText: string | null
} {
  const content = message.content?.trim() || ''
  const attachments = message.attachments || []
  const attachmentSummary = formatAttachmentSummary(attachments)

  if (content) {
    return {
      primaryText: content,
      secondaryText: attachmentSummary ? `+ ${attachmentSummary}` : null,
    }
  }

  if (attachmentSummary) {
    return {
      primaryText: attachmentSummary,
      secondaryText: null,
    }
  }

  return {
    primaryText: 'Empty message',
    secondaryText: null,
  }
}
