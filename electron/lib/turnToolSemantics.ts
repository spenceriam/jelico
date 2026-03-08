const NON_USER_VISIBLE_TURN_TOOLS = new Set([
  'wait_for_agent',
  'get_agent_status',
  'get_agents_summary',
  'ask_user_question',
  'todo_write',
  'todo_read',
  'todo_check',
])

const INTERNAL_WEB_GATE_RESULT_TYPES = new Set(['deferred_to_subagents', 'direct_limit_reached'])

export interface IncompleteToolStart {
  id: string
  name: string
  sawToolCall: boolean
  nameIsKnown: boolean
}

function isInternalWebGateResultPayload(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const payload = result as Record<string, unknown>
  if (payload.success !== true) return false
  const results = payload.results as Record<string, unknown> | undefined
  const resultType = typeof results?.type === 'string' ? results.type : ''
  return INTERNAL_WEB_GATE_RESULT_TYPES.has(resultType)
}

export function isMeaningfulTurnToolName(toolName: string): boolean {
  return !NON_USER_VISIBLE_TURN_TOOLS.has(toolName)
}

export function isMeaningfulTurnToolResult(toolName: string, result: unknown): boolean {
  if (!isMeaningfulTurnToolName(toolName)) return false
  if ((toolName === 'web_search' || toolName === 'web_fetch') && isInternalWebGateResultPayload(result)) {
    return false
  }
  return true
}

export function hasInterruptedMeaningfulMutationTool(
  unresolvedIncompleteToolStarts: IncompleteToolStart[],
  options: { expectedArtifactMutation: boolean; expectedFileMutation: boolean }
): boolean {
  const isMutationTurn = options.expectedArtifactMutation || options.expectedFileMutation
  if (!isMutationTurn) return false

  return unresolvedIncompleteToolStarts.some((entry) =>
    entry.nameIsKnown && isMeaningfulTurnToolName(entry.name)
  )
}
