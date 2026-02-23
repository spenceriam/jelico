import { create } from 'zustand'

type SettingsTab = 'profile' | 'appearance' | 'general' | 'providers' | 'permissions' | 'skills' | 'backup'

interface UIStore {
  sidebarCollapsed: boolean
  showContextText: boolean
  settingsOpen: boolean
  settingsTab: SettingsTab
  providerSetupOpen: boolean
  appFontPt: number
  chatFontPt: number
  artifactDocumentFontPt: number

  // Processing indicators
  isCompacting: boolean
  isProcessing: boolean
  processingMessage: string | null

  // Onboarding
  onboardingComplete: boolean
  onboardingStep: number

  toggleSidebar: () => void
  toggleContextText: () => void
  setShowContextText: (show: boolean) => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setSettingsTab: (tab: SettingsTab) => void
  openProviderSetup: () => void
  closeProviderSetup: () => void
  setAppFontPt: (pt: number) => void
  setChatFontPt: (pt: number) => void
  setArtifactDocumentFontPt: (pt: number) => void

  // Processing actions
  startCompacting: () => void
  stopCompacting: () => void
  startProcessing: (message?: string) => void
  stopProcessing: () => void

  // Onboarding actions
  completeOnboarding: () => void
  setOnboardingStep: (step: number) => void
  resetOnboarding: () => void
}

// Check localStorage for onboarding status
const getInitialOnboardingState = (): boolean => {
  const stored = localStorage.getItem('jelico:onboardingComplete')
  return stored === 'true'
}

const getInitialContextTextState = (): boolean => {
  const stored = localStorage.getItem('jelico:showContextText')
  return stored === 'true'
}

const roundToHalf = (value: number): number => Math.round(value * 2) / 2

const clampPointSize = (value: number): number => {
  const rounded = roundToHalf(value)
  return Math.min(20, Math.max(8, rounded))
}

const getInitialAppFontPt = (): number => {
  const storedPt = localStorage.getItem('jelico:appFontPt')
  const parsedPt = storedPt ? Number(storedPt) : NaN
  if (Number.isFinite(parsedPt)) {
    return clampPointSize(parsedPt)
  }
  // Default tuned preset.
  return 8.5
}

const getInitialChatFontPt = (): number => {
  const storedPt = localStorage.getItem('jelico:chatFontPt')
  const parsedPt = storedPt ? Number(storedPt) : NaN
  if (Number.isFinite(parsedPt)) {
    return clampPointSize(parsedPt)
  }

  // Backward compatibility for previous scale-based setting.
  const storedScale = localStorage.getItem('jelico:chatFontScale')
  const parsedScale = storedScale ? Number(storedScale) : NaN
  if (Number.isFinite(parsedScale) && parsedScale >= 0.85 && parsedScale <= 1.3) {
    // Legacy default used 14px body text (10.5pt).
    return clampPointSize(parsedScale * 10.5)
  }

  return 8.5
}

const getInitialArtifactDocumentFontPt = (): number => {
  const storedPt = localStorage.getItem('jelico:artifactDocumentFontPt')
  const parsedPt = storedPt ? Number(storedPt) : NaN
  if (Number.isFinite(parsedPt)) {
    return clampPointSize(parsedPt)
  }

  // Backward compatibility for previous offset-based setting.
  const storedOffset = localStorage.getItem('jelico:artifactDocumentFontOffset')
  const parsedOffset = storedOffset ? Number(storedOffset) : NaN
  if (Number.isFinite(parsedOffset) && parsedOffset >= -6 && parsedOffset <= 8) {
    // Legacy base paragraph size was 16px plus offset.
    // Convert px to pt using 1px = 0.75pt.
    return clampPointSize((16 + parsedOffset) * 0.75)
  }

  return 9
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  showContextText: getInitialContextTextState(),
  settingsOpen: false,
  settingsTab: 'profile',
  providerSetupOpen: false,
  appFontPt: getInitialAppFontPt(),
  chatFontPt: getInitialChatFontPt(),
  artifactDocumentFontPt: getInitialArtifactDocumentFontPt(),

  // Processing indicators
  isCompacting: false,
  isProcessing: false,
  processingMessage: null,

  // Onboarding
  onboardingComplete: getInitialOnboardingState(),
  onboardingStep: 0,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleContextText: () => set((state) => {
    const next = !state.showContextText
    localStorage.setItem('jelico:showContextText', String(next))
    return { showContextText: next }
  }),
  setShowContextText: (show) => {
    localStorage.setItem('jelico:showContextText', String(show))
    set({ showContextText: show })
  },

  openSettings: (tab = 'profile') => set({ settingsOpen: true, settingsTab: tab }),

  closeSettings: () => set({ settingsOpen: false }),

  setSettingsTab: (tab) => set({ settingsTab: tab }),

  openProviderSetup: () => set({ providerSetupOpen: true }),

  closeProviderSetup: () => set({ providerSetupOpen: false }),

  setAppFontPt: (pt) => {
    const clamped = clampPointSize(pt)
    localStorage.setItem('jelico:appFontPt', clamped.toString())
    set({ appFontPt: clamped })
  },

  setChatFontPt: (pt) => {
    const clamped = clampPointSize(pt)
    localStorage.setItem('jelico:chatFontPt', clamped.toString())
    set({ chatFontPt: clamped })
  },

  setArtifactDocumentFontPt: (pt) => {
    const clamped = clampPointSize(pt)
    localStorage.setItem('jelico:artifactDocumentFontPt', clamped.toString())
    set({ artifactDocumentFontPt: clamped })
  },

  // Processing actions
  startCompacting: () => set({ isCompacting: true, processingMessage: 'Compaction in progress...' }),

  stopCompacting: () => set({ isCompacting: false, processingMessage: null }),

  startProcessing: (message = 'Processing...') => set({ isProcessing: true, processingMessage: message }),

  stopProcessing: () => set({ isProcessing: false, processingMessage: null }),

  // Onboarding actions
  completeOnboarding: () => {
    localStorage.setItem('jelico:onboardingComplete', 'true')
    set({ onboardingComplete: true })
  },

  setOnboardingStep: (step) => set({ onboardingStep: step }),

  resetOnboarding: () => {
    localStorage.removeItem('jelico:onboardingComplete')
    set({ onboardingComplete: false, onboardingStep: 0 })
  },
}))
