import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light' | 'system'

export interface ColorTheme {
  id: string
  name: string
  dark: {
    accent: string
    accentBright: string
    accentDim: string
    accentGlow: string
    bgVoid: string
    bgDeep: string
    bgSurface: string
    bgElevated: string
    bgHover: string
    bgActive: string
  }
  light: {
    accent: string
    accentBright: string
    accentDim: string
    accentGlow: string
    bgVoid: string
    bgDeep: string
    bgSurface: string
    bgElevated: string
    bgHover: string
    bgActive: string
  }
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'default',
    name: 'Gold',
    dark: {
      accent: '#d4a574',
      accentBright: '#e8c49a',
      accentDim: '#b8863d',
      accentGlow: 'rgba(212, 165, 116, 0.15)',
      bgVoid: '#08080a',
      bgDeep: '#0d0d10',
      bgSurface: '#131318',
      bgElevated: '#1a1a21',
      bgHover: '#222228',
      bgActive: '#2a2a32',
    },
    light: {
      accent: '#b8860b',
      accentBright: '#daa520',
      accentDim: '#8b6914',
      accentGlow: 'rgba(184, 134, 11, 0.15)',
      bgVoid: '#f5f5f5',
      bgDeep: '#ebebeb',
      bgSurface: '#ffffff',
      bgElevated: '#fafafa',
      bgHover: '#f0f0f0',
      bgActive: '#e5e5e5',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    dark: {
      accent: '#6b9bd2',
      accentBright: '#8fb5e6',
      accentDim: '#4a7ab8',
      accentGlow: 'rgba(107, 155, 210, 0.15)',
      bgVoid: '#080a0d',
      bgDeep: '#0d1017',
      bgSurface: '#131820',
      bgElevated: '#1a2130',
      bgHover: '#222a3a',
      bgActive: '#2a3344',
    },
    light: {
      accent: '#2563eb',
      accentBright: '#3b82f6',
      accentDim: '#1d4ed8',
      accentGlow: 'rgba(37, 99, 235, 0.15)',
      bgVoid: '#f0f4f8',
      bgDeep: '#e8eef4',
      bgSurface: '#ffffff',
      bgElevated: '#f8fafc',
      bgHover: '#f1f5f9',
      bgActive: '#e2e8f0',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    dark: {
      accent: '#6ba574',
      accentBright: '#8bc49a',
      accentDim: '#4a8456',
      accentGlow: 'rgba(107, 165, 116, 0.15)',
      bgVoid: '#080a08',
      bgDeep: '#0d100d',
      bgSurface: '#131813',
      bgElevated: '#1a211a',
      bgHover: '#222a22',
      bgActive: '#2a332a',
    },
    light: {
      accent: '#059669',
      accentBright: '#10b981',
      accentDim: '#047857',
      accentGlow: 'rgba(5, 150, 105, 0.15)',
      bgVoid: '#f0f5f0',
      bgDeep: '#e8f0e8',
      bgSurface: '#ffffff',
      bgElevated: '#f8faf8',
      bgHover: '#f0f5f0',
      bgActive: '#e0ebe0',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    dark: {
      accent: '#a78bfa',
      accentBright: '#c4b5fd',
      accentDim: '#8b5cf6',
      accentGlow: 'rgba(167, 139, 250, 0.15)',
      bgVoid: '#0a080d',
      bgDeep: '#100d17',
      bgSurface: '#181320',
      bgElevated: '#211a30',
      bgHover: '#2a2240',
      bgActive: '#332a4a',
    },
    light: {
      accent: '#7c3aed',
      accentBright: '#8b5cf6',
      accentDim: '#6d28d9',
      accentGlow: 'rgba(124, 58, 237, 0.15)',
      bgVoid: '#f5f0fa',
      bgDeep: '#ede8f4',
      bgSurface: '#ffffff',
      bgElevated: '#faf8fc',
      bgHover: '#f3f0f8',
      bgActive: '#e8e0f0',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    dark: {
      accent: '#f472b6',
      accentBright: '#f9a8d4',
      accentDim: '#ec4899',
      accentGlow: 'rgba(244, 114, 182, 0.15)',
      bgVoid: '#0d080a',
      bgDeep: '#170d13',
      bgSurface: '#201318',
      bgElevated: '#301a24',
      bgHover: '#3a222e',
      bgActive: '#442a38',
    },
    light: {
      accent: '#db2777',
      accentBright: '#ec4899',
      accentDim: '#be185d',
      accentGlow: 'rgba(219, 39, 119, 0.15)',
      bgVoid: '#fdf2f8',
      bgDeep: '#fce7f3',
      bgSurface: '#ffffff',
      bgElevated: '#fefafc',
      bgHover: '#fdf4f8',
      bgActive: '#fce8f0',
    },
  },
]

interface ThemeStore {
  mode: ThemeMode
  colorThemeId: string

  // Computed
  effectiveMode: 'dark' | 'light'
  activeTheme: ColorTheme

  // Actions
  setMode: (mode: ThemeMode) => void
  setColorTheme: (themeId: string) => void
  applyTheme: () => void
  loadFromStorage: () => void
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: 'dark',
  colorThemeId: 'default',

  get effectiveMode() {
    const { mode } = get()
    if (mode === 'system') {
      return getSystemTheme()
    }
    return mode
  },

  get activeTheme() {
    const { colorThemeId } = get()
    return COLOR_THEMES.find(t => t.id === colorThemeId) || COLOR_THEMES[0]
  },

  setMode: (mode) => {
    set({ mode })
    localStorage.setItem('jelico-theme-mode', mode)
    get().applyTheme()
  },

  setColorTheme: (themeId) => {
    set({ colorThemeId: themeId })
    localStorage.setItem('jelico-color-theme', themeId)
    get().applyTheme()
  },

  applyTheme: () => {
    const { mode, colorThemeId } = get()
    const effectiveMode = mode === 'system' ? getSystemTheme() : mode
    const theme = COLOR_THEMES.find(t => t.id === colorThemeId) || COLOR_THEMES[0]
    const colors = effectiveMode === 'dark' ? theme.dark : theme.light

    const root = document.documentElement

    // Apply accent colors
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--accent-bright', colors.accentBright)
    root.style.setProperty('--accent-dim', colors.accentDim)
    root.style.setProperty('--accent-glow', colors.accentGlow)

    // Apply background colors
    root.style.setProperty('--bg-void', colors.bgVoid)
    root.style.setProperty('--bg-deep', colors.bgDeep)
    root.style.setProperty('--bg-surface', colors.bgSurface)
    root.style.setProperty('--bg-elevated', colors.bgElevated)
    root.style.setProperty('--bg-hover', colors.bgHover)
    root.style.setProperty('--bg-active', colors.bgActive)

    // Update text and border colors based on mode
    if (effectiveMode === 'light') {
      root.style.setProperty('--text-primary', '#1a1a1a')
      root.style.setProperty('--text-secondary', '#4a4a4a')
      root.style.setProperty('--text-muted', '#6a6a6a')
      root.style.setProperty('--text-faint', '#9a9a9a')
      root.style.setProperty('--border', '#e0e0e0')
      root.style.setProperty('--border-subtle', '#f0f0f0')
      root.style.setProperty('--border-strong', '#d0d0d0')
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.style.setProperty('--text-primary', '#e8e6e3')
      root.style.setProperty('--text-secondary', '#a09a92')
      root.style.setProperty('--text-muted', '#6b6660')
      root.style.setProperty('--text-faint', '#4a4540')
      root.style.setProperty('--border', '#2a2926')
      root.style.setProperty('--border-subtle', '#1f1e1c')
      root.style.setProperty('--border-strong', 'rgba(255, 255, 255, 0.15)')
      root.classList.remove('light')
      root.classList.add('dark')
    }
  },

  loadFromStorage: () => {
    const savedMode = localStorage.getItem('jelico-theme-mode') as ThemeMode | null
    const savedTheme = localStorage.getItem('jelico-color-theme')

    if (savedMode) {
      set({ mode: savedMode })
    }
    if (savedTheme) {
      set({ colorThemeId: savedTheme })
    }

    get().applyTheme()

    // Listen for system theme changes
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (get().mode === 'system') {
          get().applyTheme()
        }
      })
    }
  },
}))
