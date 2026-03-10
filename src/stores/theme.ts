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
      accent: '#9f740f',
      accentBright: '#b58411',
      accentDim: '#7d5a0c',
      accentGlow: 'rgba(159, 116, 15, 0.18)',
      bgVoid: '#f7f2ea',
      bgDeep: '#d7cab7',
      bgSurface: '#e7dccb',
      bgElevated: '#f3ede2',
      bgHover: '#ddd1be',
      bgActive: '#cfbfaa',
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
      accent: '#1d4ed8',
      accentBright: '#2563eb',
      accentDim: '#1e40af',
      accentGlow: 'rgba(29, 78, 216, 0.18)',
      bgVoid: '#f6f9fc',
      bgDeep: '#cfdce8',
      bgSurface: '#dfe8f2',
      bgElevated: '#eef4fa',
      bgHover: '#d4e0eb',
      bgActive: '#c5d3e2',
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
      accent: '#047857',
      accentBright: '#059669',
      accentDim: '#065f46',
      accentGlow: 'rgba(4, 120, 87, 0.18)',
      bgVoid: '#f5f8f4',
      bgDeep: '#cfdccf',
      bgSurface: '#dde8dc',
      bgElevated: '#eef4ed',
      bgHover: '#d3dfd2',
      bgActive: '#c4d3c3',
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
      accent: '#6d28d9',
      accentBright: '#7c3aed',
      accentDim: '#5b21b6',
      accentGlow: 'rgba(109, 40, 217, 0.18)',
      bgVoid: '#f7f4fb',
      bgDeep: '#d6cee8',
      bgSurface: '#e6def1',
      bgElevated: '#f1ecf8',
      bgHover: '#dbd2eb',
      bgActive: '#cdc2df',
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
      accent: '#be185d',
      accentBright: '#db2777',
      accentDim: '#9d174d',
      accentGlow: 'rgba(190, 24, 93, 0.18)',
      bgVoid: '#fcf4f7',
      bgDeep: '#e7d1da',
      bgSurface: '#f0dde6',
      bgElevated: '#f7edf2',
      bgHover: '#e8d4de',
      bgActive: '#dac3cd',
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
    root.style.setProperty('--accent-foreground', effectiveMode === 'light' ? '#fffdf8' : '#0d0d10')

    // Apply background colors
    root.style.setProperty('--bg-void', colors.bgVoid)
    root.style.setProperty('--bg-deep', colors.bgDeep)
    root.style.setProperty('--bg-surface', colors.bgSurface)
    root.style.setProperty('--bg-elevated', colors.bgElevated)
    root.style.setProperty('--bg-hover', colors.bgHover)
    root.style.setProperty('--bg-active', colors.bgActive)

    // Update text and border colors based on mode
    if (effectiveMode === 'light') {
      root.style.setProperty('--text-primary', '#191612')
      root.style.setProperty('--text-secondary', '#4e473f')
      root.style.setProperty('--text-muted', '#70675c')
      root.style.setProperty('--text-faint', '#9b9186')
      root.style.setProperty('--border', '#c8b79f')
      root.style.setProperty('--border-subtle', '#d9cab7')
      root.style.setProperty('--border-strong', '#9f896d')
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
