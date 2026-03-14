import type { ReasoningEffort } from './reasoning'
import { sanitizeReasoningEffort } from './reasoning'

interface ResolveStreamReasoningEffortInput {
  activeConversationId: string | null
  targetConversationId: string
  providerType: string
  modelId: string | null
  activeReasoningEffort: ReasoningEffort | null
  targetProviderDefaultReasoningEffort?: ReasoningEffort | null
  targetConversationReasoningEffort?: ReasoningEffort | null
}

export function resolveStreamReasoningEffort({
  activeConversationId,
  targetConversationId,
  providerType,
  modelId,
  activeReasoningEffort,
  targetProviderDefaultReasoningEffort,
  targetConversationReasoningEffort,
}: ResolveStreamReasoningEffortInput): ReasoningEffort | null {
  const requestedEffort = targetConversationId === activeConversationId
    ? activeReasoningEffort
    : targetConversationReasoningEffort

  return sanitizeReasoningEffort(
    providerType,
    modelId,
    requestedEffort ?? targetProviderDefaultReasoningEffort ?? null
  )
}
