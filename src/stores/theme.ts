import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light' | 'system'

export interface ColorTheme {
  id: string
  name: string
  // Colors are CSS custom property values
  dark: {
    accent: string
    accentBright: string
    bgVoid: string
    bgDeep: string
    bgSurface: string
    bgElevated: string
  }
  light: {
    accent: string
    accentBright: string
    bgVoid: string
    bgDeep: string
    bgSurface: string
    bgElevated: string
  }
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'default',
    name: 'Gold',
    dark: {
      accent: '#d4a574',
      accentBright: '#e8c49a',
      bgVoid: '#08080a',
      bgDeep: '#0d0d10',
      bgSurface: '#131318',
      bgElevated: '#1a1a21',
    },
    light: {
      accent: '#b8860b',
      accentBright: '#daa520',
      bgVoid: '#f5f5f5',
      bgDeep: '#ebebeb',
      bgSurface: '#ffffff',
      bgElevated: '#fafafa',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    dark: {
      accent: '#6b9bd2',
      accentBright: '#8fb5e6',
      bgVoid: '#080a0d',
      bgDeep: '#0d1017',
      bgSurface: '#131820',
      bgElevated: '#1a2130',
    },
    light: {
      accent: '#2563eb',
      accentBright: '#3b82f6',
      bgVoid: '#f0f4f8',
      bgDeep: '#e8eef4',
      bgSurface: '#ffffff',
      bgElevated: '#f8fafc',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    dark: {
      accent: '#6ba574',
      accentBright: '#8bc49a',
      bgVoid: '#080a08',
      bgDeep: '#0d100d',
      bgSurface: '#131813',
      bgElevated: '#1a211a',
    },
    light: {
      accent: '#059669',
      accentBright: '#10b981',
      bgVoid: '#f0f5f0',
      bgDeep: '#e8f0e8',
      bgSurface: '#ffffff',
      bgElevated: '#f8faf8',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    dark: {
      accent: '#a78bfa',
      accentBright: '#c4b5fd',
      bgVoid: '#0a080d',
      bgDeep: '#100d17',
      bgSurface: '#181320',
      bgElevated: '#211a30',
    },
    light: {
      accent: '#7c3aed',
      accentBright: '#8b5cf6',
      bgVoid: '#f5f0fa',
      bgDeep: '#ede8f4',
      bgSurface: '#ffffff',
      bgElevated: '#faf8fc',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    dark: {
      accent: '#f472b6',
      accentBright: '#f9a8d4',
      bgVoid: '#0d080a',
      bgDeep: '#170d13',
      bgSurface: '#201318',
      bgElevated: '#301a24',
    },
    light: {
      accent: '#db2777',
      accentBright: '#ec4899',
      bgVoid: '#fdf2f8',
      bgDeep: '#fce7f3',
      bgSurface: '#ffffff',
      bgElevated: '#fefafc',
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

    // Apply colors as CSS custom properties
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--accent-bright', colors.accentBright)
    root.style.setProperty('--bg-void', colors.bgVoid)
    root.style.setProperty('--bg-deep', colors.bgDeep)
    root.style.setProperty('--bg-surface', colors.bgSurface)
    root.style.setProperty('--bg-elevated', colors.bgElevated)

    // Update text colors based on mode
    if (effectiveMode === 'light') {
      root.style.setProperty('--text-primary', '#1a1a1a')
      root.style.setProperty('--text-secondary', '#4a4a4a')
      root.style.setProperty('--text-muted', '#6a6a6a')
      root.style.setProperty('--text-faint', '#9a9a9a')
      root.style.setProperty('--border', '#e0e0e0')
      root.style.setProperty('--border-subtle', '#f0f0f0')
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.style.setProperty('--text-primary', '#e8e6e3')
      root.style.setProperty('--text-secondary', '#a09a92')
      root.style.setProperty('--text-muted', '#6b6660')
      root.style.setProperty('--text-faint', '#4a4540')
      root.style.setProperty('--border', '#2a2926')
      root.style.setProperty('--border-subtle', '#1f1e1c')
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
