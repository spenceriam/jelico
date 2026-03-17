export function normalizeTaskTypes(taskTypes: unknown): string[] {
  if (!Array.isArray(taskTypes)) return []
  return [...new Set(taskTypes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
}

export function mergeTaskTypes(existingTaskTypes: unknown, nextTaskTypes: unknown): string[] {
  return [...new Set([
    ...normalizeTaskTypes(existingTaskTypes),
    ...normalizeTaskTypes(nextTaskTypes),
  ])]
}
