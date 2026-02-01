/**
 * Format elapsed time as seconds, minutes, or hours (no milliseconds/decimals)
 */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) {
    const secs = totalSeconds % 60
    return `${minutes}m ${secs}s`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}
