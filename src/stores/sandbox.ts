import { create } from 'zustand'

export interface SandboxFile {
  name: string
  type: 'file' | 'directory'
  path: string
  relativePath: string
  children?: SandboxFile[]
}

interface SandboxStore {
  sandboxPath: string | null
  files: Record<string, SandboxFile[]> // conversationId -> files
  isLoading: boolean

  // Actions
  loadSandboxPath: () => Promise<void>
  loadFiles: (conversationId: string) => Promise<void>
  writeFile: (conversationId: string, relativePath: string, content: string) => Promise<string>
  readFile: (conversationId: string, relativePath: string) => Promise<string | null>
  deleteFile: (conversationId: string, relativePath: string) => Promise<boolean>
  clearSandbox: (conversationId: string) => Promise<void>
  exportSandbox: (conversationId: string) => Promise<{ success: boolean; filesCopied?: number }>
}

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  sandboxPath: null,
  files: {},
  isLoading: false,

  loadSandboxPath: async () => {
    try {
      const path = await window.jelico.sandbox.getPath()
      set({ sandboxPath: path })
    } catch (error) {
      console.error('Failed to load sandbox path:', error)
    }
  },

  loadFiles: async (conversationId) => {
    set({ isLoading: true })
    try {
      const structure = await window.jelico.sandbox.getStructure(conversationId)
      set((state) => ({
        files: { ...state.files, [conversationId]: structure },
        isLoading: false,
      }))
    } catch (error) {
      console.error('Failed to load sandbox files:', error)
      set({ isLoading: false })
    }
  },

  writeFile: async (conversationId, relativePath, content) => {
    try {
      const fullPath = await window.jelico.sandbox.writeFile(conversationId, relativePath, content)
      // Reload files to reflect changes
      await get().loadFiles(conversationId)
      return fullPath
    } catch (error) {
      console.error('Failed to write sandbox file:', error)
      throw error
    }
  },

  readFile: async (conversationId, relativePath) => {
    try {
      return await window.jelico.sandbox.readFile(conversationId, relativePath)
    } catch (error) {
      console.error('Failed to read sandbox file:', error)
      return null
    }
  },

  deleteFile: async (conversationId, relativePath) => {
    try {
      const result = await window.jelico.sandbox.deleteFile(conversationId, relativePath)
      if (result) {
        await get().loadFiles(conversationId)
      }
      return result
    } catch (error) {
      console.error('Failed to delete sandbox file:', error)
      return false
    }
  },

  clearSandbox: async (conversationId) => {
    try {
      await window.jelico.sandbox.clear(conversationId)
      set((state) => {
        const newFiles = { ...state.files }
        delete newFiles[conversationId]
        return { files: newFiles }
      })
    } catch (error) {
      console.error('Failed to clear sandbox:', error)
    }
  },

  exportSandbox: async (conversationId) => {
    try {
      return await window.jelico.sandbox.export(conversationId)
    } catch (error) {
      console.error('Failed to export sandbox:', error)
      return { success: false }
    }
  },
}))
