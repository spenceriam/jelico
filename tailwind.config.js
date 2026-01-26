/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          void: '#08080a',
          deep: '#0d0d10',
          surface: '#141418',
          elevated: '#1a1a20',
          hover: '#222228',
        },
        text: {
          primary: '#f5f4f1',
          secondary: '#a8a5a0',
          muted: '#6b6860',
        },
        border: {
          DEFAULT: '#2a2a30',
          subtle: '#1f1f24',
        },
        accent: {
          DEFAULT: '#d97706',
          bright: '#f59e0b',
          dim: '#b8863d',
        },
        success: '#22c55e',
        error: '#ef4444',
        warning: '#eab308',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
