import { create } from 'zustand'

type SettingsTab = 'providers' | 'skills' | 'general'

interface UIStore {
  sidebarCollapsed: boolean
  settingsOpen: boolean
  settingsTab: SettingsTab
  providerSetupOpen: boolean

  toggleSidebar: () => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setSettingsTab: (tab: SettingsTab) => void
  openProviderSetup: () => void
  closeProviderSetup: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  settingsOpen: false,
  settingsTab: 'providers',
  providerSetupOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  openSettings: (tab = 'providers') => set({ settingsOpen: true, settingsTab: tab }),

  closeSettings: () => set({ settingsOpen: false }),

  setSettingsTab: (tab) => set({ settingsTab: tab }),

  openProviderSetup: () => set({ providerSetupOpen: true }),

  closeProviderSetup: () => set({ providerSetupOpen: false }),
}))
