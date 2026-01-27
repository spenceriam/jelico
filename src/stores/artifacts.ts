import { create } from 'zustand'

export type ArtifactType = 'code' | 'document' | 'html' | 'svg' | 'mermaid'

export interface Artifact {
  id: string
  conversationId?: string
  type: ArtifactType
  title: string
  content: string
  language?: string // For code artifacts
  createdAt: number
  updatedAt: number
}

interface ArtifactStore {
  artifacts: Artifact[]
  selectedArtifactId: string | null
  canvasOpen: boolean

  // Actions
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt'>) => Artifact
  updateArtifact: (id: string, updates: Partial<Omit<Artifact, 'id' | 'createdAt'>>) => void
  removeArtifact: (id: string) => void
  selectArtifact: (id: string | null) => void
  openCanvas: () => void
  closeCanvas: () => void
  toggleCanvas: () => void
  getArtifactsByConversation: (conversationId: string) => Artifact[]
  clearConversationArtifacts: (conversationId: string) => void
}

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  artifacts: [],
  selectedArtifactId: null,
  canvasOpen: false,

  addArtifact: (artifact) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    set((state) => ({
      artifacts: [...state.artifacts, newArtifact],
      selectedArtifactId: newArtifact.id,
      canvasOpen: true,
    }))

    return newArtifact
  },

  updateArtifact: (id, updates) => {
    set((state) => ({
      artifacts: state.artifacts.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
      ),
    }))
  },

  removeArtifact: (id) => {
    set((state) => {
      const newArtifacts = state.artifacts.filter((a) => a.id !== id)
      return {
        artifacts: newArtifacts,
        selectedArtifactId:
          state.selectedArtifactId === id
            ? newArtifacts[newArtifacts.length - 1]?.id || null
            : state.selectedArtifactId,
      }
    })
  },

  selectArtifact: (id) => {
    set({
      selectedArtifactId: id,
      canvasOpen: id !== null,
    })
  },

  openCanvas: () => set({ canvasOpen: true }),
  closeCanvas: () => set({ canvasOpen: false }),
  toggleCanvas: () => set((state) => ({ canvasOpen: !state.canvasOpen })),

  getArtifactsByConversation: (conversationId) => {
    return get().artifacts.filter((a) => a.conversationId === conversationId)
  },

  clearConversationArtifacts: (conversationId) => {
    set((state) => ({
      artifacts: state.artifacts.filter((a) => a.conversationId !== conversationId),
    }))
  },
}))
