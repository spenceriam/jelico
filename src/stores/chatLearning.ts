export interface SoulLearningMessage {
  role: string
  content: string
}

export function buildSoulLearningMessages(
  updatedMessages: SoulLearningMessage[],
  assistantMessage: SoulLearningMessage,
  isRegenerate: boolean
): SoulLearningMessage[] {
  if (isRegenerate) {
    return []
  }

  const latestUserMessage = updatedMessages[updatedMessages.length - 1]
  if (!latestUserMessage || latestUserMessage.role !== 'user') {
    return []
  }

  const previousMessage = updatedMessages[updatedMessages.length - 2]
  const messagesForAnalysis = previousMessage?.role === 'assistant'
    ? [previousMessage, latestUserMessage]
    : [latestUserMessage]

  return [...messagesForAnalysis, assistantMessage]
}
