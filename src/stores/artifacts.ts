import { create } from 'zustand'

export type ArtifactType = 'code' | 'document' | 'html' | 'svg' | 'mermaid'

export interface Artifact {
  id: string
  conversationId?: string
  type: ArtifactType
  title: string
  content: string
  language?: string
  filePath?: string
  createdAt: number
  updatedAt: number
  // Versioning
  baseArtifactId?: string  // null/undefined = this is the base version
  revision: number          // 1 for base, 2+ for revisions
}

// Database row format - must match electron/services/database.ts
interface ArtifactRow {
  id: string
  conversation_id: string | null
  type: string
  title: string
  content: string
  language: string | null
  file_path: string | null
  created_at: number
  updated_at: number
  // Versioning fields (may be undefined in older records)
  base_artifact_id?: string | null
  revision?: number
}

// Convert database row to store format
function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    conversationId: row.conversation_id || undefined,
    type: row.type as ArtifactType,
    title: row.title,
    content: row.content,
    language: row.language || undefined,
    filePath: row.file_path || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    baseArtifactId: row.base_artifact_id ?? undefined,
    revision: row.revision ?? 1,
  }
}

interface ArtifactStore {
  artifacts: Artifact[]
  selectedArtifactId: string | null
  selectedRevisionId: string | null  // Which revision to view (null = latest)
  openArtifactIds: string[]  // Tabs currently open in the Canvas panel
  canvasOpen: boolean
  libraryOpen: boolean  // Library browser overlay
  isLoading: boolean
  // Streaming preview - shown in Canvas while artifact is being generated
  streamingPreview: { type?: string; title?: string; content: string } | null
  // Track the title of the artifact we've already opened canvas for
  // Prevents reopening if user manually closed during generation
  streamingOpenedFor: string | null

  // Actions
  loadArtifacts: () => Promise<void>
  loadArtifactsForConversation: (conversationId: string) => Promise<void>
  ensureArtifactContent: (id: string) => Promise<void>
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt' | 'revision'>) => Promise<Artifact>
  updateArtifact: (id: string, updates: Partial<Omit<Artifact, 'id' | 'createdAt'>>) => Promise<void>
  removeArtifact: (id: string) => Promise<void>
  selectArtifact: (id: string | null) => void
  closeArtifactTab: (id: string) => void
  selectRevision: (revisionId: string | null) => void
  getRevisions: (baseArtifactId: string) => Promise<Artifact[]>
  openCanvas: () => void
  closeCanvas: () => void
  toggleCanvas: () => void
  toggleLibrary: () => void
  getArtifactsByConversation: (conversationId: string) => Artifact[]
  getBaseArtifactId: (artifact: Artifact) => string
  clearConversationArtifacts: (conversationId: string) => Promise<void>
  // Streaming preview methods
  setStreamingPreview: (preview: { type?: string; title?: string; content: string } | null) => void
  clearStreamingPreview: () => void
}

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  artifacts: [],
  selectedArtifactId: null,
  selectedRevisionId: null,
  openArtifactIds: [],
  canvasOpen: false,
  libraryOpen: false,
  isLoading: false,
  streamingPreview: null,
  streamingOpenedFor: null,

  loadArtifacts: async () => {
    set({ isLoading: true })
    try {
      // Metadata-only: artifact file contents load lazily via ensureArtifactContent
      const rows: ArtifactRow[] = await window.jelico.artifacts.listSummaries()
      set({ artifacts: rows.map(rowToArtifact), isLoading: false })
    } catch (error) {
      console.error('Failed to load artifacts:', error)
      set({ isLoading: false })
    }
  },

  loadArtifactsForConversation: async (conversationId) => {
    try {
      const rows: ArtifactRow[] = await window.jelico.artifacts.getSummariesByConversation(conversationId)
      const newArtifacts = rows.map(rowToArtifact)

      // Merge with existing artifacts, replacing any with same id.
      // Preserve already-loaded content when a summary replaces a hydrated row.
      set((state) => {
        const existingById = new Map(state.artifacts.map((a) => [a.id, a]))
        const merged = newArtifacts.map((a) => {
          const existing = existingById.get(a.id)
          return existing && existing.content && !a.content ? { ...a, content: existing.content } : a
        })
        const existingIds = new Set(merged.map((a) => a.id))
        const otherArtifacts = state.artifacts.filter((a) => !existingIds.has(a.id) && a.conversationId !== conversationId)
        return { artifacts: [...otherArtifacts, ...merged] }
      })
    } catch (error) {
      console.error('Failed to load artifacts for conversation:', error)
    }
  },

  ensureArtifactContent: async (id) => {
    const artifact = get().artifacts.find((a) => a.id === id)
    if (!artifact || artifact.content) return
    try {
      const row: ArtifactRow | null = await window.jelico.artifacts.get(id)
      if (!row) return
      const hydrated = rowToArtifact(row)
      set((state) => ({
        artifacts: state.artifacts.map((a) => (a.id === id ? { ...a, content: hydrated.content } : a)),
      }))
    } catch (error) {
      console.error('Failed to load artifact content:', error)
    }
  },

  addArtifact: async (artifact) => {
    try {
      const row: ArtifactRow = await window.jelico.artifacts.create({
        conversationId: artifact.conversationId,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        language: artifact.language,
        filePath: artifact.filePath,
      })

      const newArtifact = rowToArtifact(row)

      set((state) => ({
        artifacts: [...state.artifacts, newArtifact],
        selectedArtifactId: newArtifact.id,
        selectedRevisionId: null,
        canvasOpen: true,
        openArtifactIds: state.openArtifactIds.includes(newArtifact.id)
          ? state.openArtifactIds
          : [...state.openArtifactIds, newArtifact.id],
      }))

      return newArtifact
    } catch (error) {
      console.error('Failed to create artifact:', error)
      throw error
    }
  },

  updateArtifact: async (id, updates) => {
    try {
      const existingArtifact = get().artifacts.find((artifact) => artifact.id === id)
      const scopedConversationId = updates.conversationId ?? existingArtifact?.conversationId

      const row: ArtifactRow | null = await window.jelico.artifacts.update(id, {
        conversationId: scopedConversationId,
        type: updates.type,
        title: updates.title,
        content: updates.content,
        language: updates.language,
        filePath: updates.filePath,
      })

      if (row) {
        const updatedArtifact = rowToArtifact(row)
        const updatedBaseId = updatedArtifact.baseArtifactId || updatedArtifact.id
        set((state) => {
          const selectedArtifact = state.artifacts.find((artifact) => artifact.id === state.selectedArtifactId)
          const selectedBaseId = selectedArtifact ? (selectedArtifact.baseArtifactId || selectedArtifact.id) : null
          const shouldSelectUpdatedArtifact =
            state.selectedArtifactId === id ||
            state.selectedRevisionId === id ||
            selectedBaseId === updatedBaseId

          const remainingArtifacts = state.artifacts.filter((artifact) => {
            const artifactBaseId = artifact.baseArtifactId || artifact.id
            return artifact.id !== id && artifactBaseId !== updatedBaseId
          })

          return {
            artifacts: [...remainingArtifacts, updatedArtifact],
            selectedArtifactId: shouldSelectUpdatedArtifact ? updatedArtifact.id : state.selectedArtifactId,
            selectedRevisionId: shouldSelectUpdatedArtifact ? null : state.selectedRevisionId,
          }
        })
      }
    } catch (error) {
      console.error('Failed to update artifact:', error)
      throw error
    }
  },

  removeArtifact: async (id) => {
    try {
      await window.jelico.artifacts.delete(id)

      set((state) => {
        const removedBaseIds = new Set(
          state.artifacts
            .filter((a) => a.id === id || a.baseArtifactId === id)
            .map((a) => a.id)
        )
        const newArtifacts = state.artifacts.filter((a) => !removedBaseIds.has(a.id))
        const newOpenTabs = state.openArtifactIds.filter((tabId) => !removedBaseIds.has(tabId))
        return {
          artifacts: newArtifacts,
          openArtifactIds: newOpenTabs,
          selectedArtifactId:
            state.selectedArtifactId && removedBaseIds.has(state.selectedArtifactId)
              ? newArtifacts[newArtifacts.length - 1]?.id || null
              : state.selectedArtifactId,
        }
      })
    } catch (error) {
      console.error('Failed to delete artifact:', error)
      throw error
    }
  },

  selectArtifact: (id) => {
    set((state) => ({
      selectedArtifactId: id,
      selectedRevisionId: null,  // Reset to latest when selecting new artifact
      canvasOpen: id !== null ? true : state.canvasOpen,
      openArtifactIds:
        id !== null && !state.openArtifactIds.includes(id)
          ? [...state.openArtifactIds, id]
          : state.openArtifactIds,
    }))
  },

  closeArtifactTab: (id) => {
    set((state) => {
      const nextOpen = state.openArtifactIds.filter((openId) => openId !== id)
      const closingSelected = state.selectedArtifactId === id
      return {
        openArtifactIds: nextOpen,
        selectedArtifactId: closingSelected
          ? nextOpen[nextOpen.length - 1] ?? null
          : state.selectedArtifactId,
        selectedRevisionId: closingSelected ? null : state.selectedRevisionId,
      }
    })
  },

  selectRevision: (revisionId) => {
    set({ selectedRevisionId: revisionId })
  },

  getRevisions: async (baseArtifactId) => {
    try {
      const rows: ArtifactRow[] = await window.jelico.artifacts.getRevisions(baseArtifactId)
      return rows.map(rowToArtifact)
    } catch (error) {
      console.error('Failed to get revisions:', error)
      return []
    }
  },

  openCanvas: () => set({ canvasOpen: true }),
  closeCanvas: () => set({ canvasOpen: false }),
  toggleCanvas: () => set((state) => ({ canvasOpen: !state.canvasOpen })),
  toggleLibrary: () => set((state) => ({ libraryOpen: !state.libraryOpen })),

  getArtifactsByConversation: (conversationId) => {
    return get().artifacts.filter((a) => a.conversationId === conversationId)
  },

  getBaseArtifactId: (artifact) => {
    return artifact.baseArtifactId || artifact.id
  },

  clearConversationArtifacts: async (conversationId) => {
    try {
      await window.jelico.artifacts.deleteByConversation(conversationId)

      set((state) => ({
        artifacts: state.artifacts.filter((a) => a.conversationId !== conversationId),
      }))
    } catch (error) {
      console.error('Failed to clear conversation artifacts:', error)
      throw error
    }
  },

  // Streaming preview - opens Canvas for NEW artifacts, respects user closing during generation
  setStreamingPreview: (preview) => {
    const state = get()
    const previewTitle = preview?.title || ''
    const isNewArtifact = previewTitle !== state.streamingOpenedFor

    // Only auto-open canvas if this is a NEW artifact we haven't opened for yet
    // This prevents reopening if user manually closed the canvas during generation
    if (isNewArtifact && preview) {
      set({
        streamingPreview: preview,
        canvasOpen: true,
        selectedArtifactId: null,
        streamingOpenedFor: previewTitle, // Remember we've opened for this artifact
      })
    } else {
      // Same artifact, just update content without touching canvasOpen
      set({ streamingPreview: preview })
    }
  },

  clearStreamingPreview: () => {
    set({
      streamingPreview: null,
      streamingOpenedFor: null, // Reset so next artifact will open canvas
    })
  },
}))

// Set up global listeners for sub-agent artifacts
// Call this once when the app initializes
let listenersInitialized = false

export function initArtifactListeners() {
  if (listenersInitialized) return
  listenersInitialized = true

  // Load ALL artifacts from database on startup so sidebar can show them immediately
  useArtifactStore.getState().loadArtifacts()

  // Listen for sub-agent artifact creation
  window.jelico.ai.onSubAgentArtifact(async (artifact) => {
    console.log(`[Artifacts] Received artifact from sub-agent ${artifact.agentName}: "${artifact.title}"`)

    // Prefer explicit conversation routing from the sub-agent event.
    // Fallback to active conversation for backwards compatibility.
    const { useChatStore } = await import('./chat')
    const conversationId = artifact.conversationId || useChatStore.getState().activeConversationId

    if (!conversationId) {
      console.warn('[Artifacts] No active conversation for sub-agent artifact')
      return
    }

    // Add the artifact to the store
    await useArtifactStore.getState().addArtifact({
      conversationId,
      type: artifact.type as any,
      title: artifact.title,
      content: artifact.content,
      language: artifact.language,
    })

    // Clear streaming preview since artifact is now complete
    useArtifactStore.getState().clearStreamingPreview()
  })

  // Disabled: Don't stream artifact preview - wait until complete
  // The streaming was causing Monaco editor issues and confusing UX
  // window.jelico.ai.onSubAgentArtifactPreview((preview) => {
  //   useArtifactStore.getState().setStreamingPreview(preview)
  // })

  // Listen for artifact status updates (multiple artifacts generating)
  window.jelico.ai.onArtifactStatus((status) => {
    // Could update a status indicator in the store if needed
    console.log(`[Artifacts] Status: ${status.count} artifacts generating`, status.titles)
  })

  console.log('[Artifacts] Global listeners initialized')
}
