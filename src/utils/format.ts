/**
 * Format elapsed time as seconds, minutes, or hours
 */
export function formatElapsedTime(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  const minutes = seconds / 60
  if (minutes < 60) {
    const mins = Math.floor(minutes)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)
  return `${hours}h ${mins}m`
}
