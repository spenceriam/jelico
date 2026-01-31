/**
 * Manages artifact preview streaming when multiple agents create artifacts concurrently.
 *
 * - Only one artifact streams to Canvas at a time (first one wins)
 * - Others queue up and auto-switch when current finishes
 * - Tracks all in-progress artifacts for status display
 */

import { BrowserWindow } from 'electron'

interface ArtifactStream {
  streamId: string
  agentName: string
  title?: string
  type?: string
  startedAt: number
}

class ArtifactStreamManager {
  // Currently streaming to Canvas
  private activeStream: ArtifactStream | null = null

  // Queued streams waiting for preview slot
  private queue: ArtifactStream[] = []

  // All in-progress artifact creations (for status display)
  private inProgress: Map<string, ArtifactStream> = new Map()

  /**
   * Request to stream artifact preview to Canvas
   * Returns true if this stream gets the preview slot
   */
  requestPreview(streamId: string, agentName: string, title?: string, type?: string): boolean {
    const stream: ArtifactStream = {
      streamId,
      agentName,
      title,
      type,
      startedAt: Date.now(),
    }

    // Track as in-progress
    this.inProgress.set(streamId, stream)
    this.broadcastStatus()

    // If no active stream, this one gets the slot
    if (!this.activeStream) {
      this.activeStream = stream
      console.log(`[ArtifactStreamManager] ${agentName} acquired preview lock for "${title}"`)
      return true
    }

    // Otherwise queue it
    this.queue.push(stream)
    console.log(`[ArtifactStreamManager] ${agentName} queued for "${title}" (${this.queue.length} in queue)`)
    return false
  }

  /**
   * Release preview slot when artifact is complete
   * Auto-switches to next in queue if available
   */
  releasePreview(streamId: string): ArtifactStream | null {
    // Remove from in-progress
    this.inProgress.delete(streamId)

    // If this was the active stream, switch to next in queue
    if (this.activeStream?.streamId === streamId) {
      const completed = this.activeStream
      console.log(`[ArtifactStreamManager] ${completed.agentName} released preview lock`)

      // Get next from queue
      this.activeStream = this.queue.shift() || null

      if (this.activeStream) {
        console.log(`[ArtifactStreamManager] Auto-switching to ${this.activeStream.agentName} for "${this.activeStream.title}"`)
      }

      this.broadcastStatus()
      return this.activeStream // Return next stream to switch to
    }

    // Remove from queue if it was queued
    this.queue = this.queue.filter(s => s.streamId !== streamId)
    this.broadcastStatus()
    return null
  }

  /**
   * Check if a stream has the preview lock
   */
  hasPreviewLock(streamId: string): boolean {
    return this.activeStream?.streamId === streamId
  }

  /**
   * Get current active stream
   */
  getActiveStream(): ArtifactStream | null {
    return this.activeStream
  }

  /**
   * Get count of in-progress artifacts (for status display)
   */
  getInProgressCount(): number {
    return this.inProgress.size
  }

  /**
   * Get all in-progress artifact info
   */
  getInProgressInfo(): { count: number; titles: string[] } {
    const titles = Array.from(this.inProgress.values())
      .map(s => s.title || 'Untitled')
    return { count: this.inProgress.size, titles }
  }

  /**
   * Broadcast status update to renderer
   */
  private broadcastStatus(): void {
    const info = this.getInProgressInfo()
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]

    if (win) {
      win.webContents.send('artifact:status', {
        count: info.count,
        titles: info.titles,
        activeTitle: this.activeStream?.title,
      })
    }
  }

  /**
   * Send artifact preview to renderer
   */
  sendPreview(streamId: string, preview: { type?: string; title?: string; content: string }): void {
    if (!this.hasPreviewLock(streamId)) {
      return // Don't send if we don't have the lock
    }

    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (win) {
      // Use a generic channel for sub-agent previews
      win.webContents.send('ai:artifactPreview:subagent', preview)
    }
  }

  /**
   * Clear all state (for cleanup)
   */
  clear(): void {
    this.activeStream = null
    this.queue = []
    this.inProgress.clear()
  }
}

// Singleton instance
export const artifactStreamManager = new ArtifactStreamManager()
