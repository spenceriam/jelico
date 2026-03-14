import type { ReasoningEffort } from './reasoning'

interface ResolveStreamReasoningEffortInput {
  activeConversationId: string | null
  targetConversationId: string
  activeReasoningEffort: ReasoningEffort | null
  targetConversationReasoningEffort?: ReasoningEffort | null
}

export function resolveStreamReasoningEffort({
  activeConversationId,
  targetConversationId,
  activeReasoningEffort,
  targetConversationReasoningEffort,
}: ResolveStreamReasoningEffortInput): ReasoningEffort | null {
  if (targetConversationId === activeConversationId) {
    return activeReasoningEffort ?? null
  }

  return targetConversationReasoningEffort ?? null
}
