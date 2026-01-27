import { create } from 'zustand'

type SettingsTab = 'providers' | 'skills' | 'general'

interface UIStore {
  sidebarCollapsed: boolean
  settingsOpen: boolean
  settingsTab: SettingsTab
  providerSetupOpen: boolean

  // Processing indicators
  isCompacting: boolean
  isProcessing: boolean
  processingMessage: string | null

  toggleSidebar: () => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setSettingsTab: (tab: SettingsTab) => void
  openProviderSetup: () => void
  closeProviderSetup: () => void

  // Processing actions
  startCompacting: () => void
  stopCompacting: () => void
  startProcessing: (message?: string) => void
  stopProcessing: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  settingsOpen: false,
  settingsTab: 'providers',
  providerSetupOpen: false,

  // Processing indicators
  isCompacting: false,
  isProcessing: false,
  processingMessage: null,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  openSettings: (tab = 'providers') => set({ settingsOpen: true, settingsTab: tab }),

  closeSettings: () => set({ settingsOpen: false }),

  setSettingsTab: (tab) => set({ settingsTab: tab }),

  openProviderSetup: () => set({ providerSetupOpen: true }),

  closeProviderSetup: () => set({ providerSetupOpen: false }),

  // Processing actions
  startCompacting: () => set({ isCompacting: true, processingMessage: 'Compaction in progress...' }),

  stopCompacting: () => set({ isCompacting: false, processingMessage: null }),

  startProcessing: (message = 'Processing...') => set({ isProcessing: true, processingMessage: message }),

  stopProcessing: () => set({ isProcessing: false, processingMessage: null }),
}))
