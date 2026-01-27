/** @type {import('tailwindcss').Config} */
module.exports = {
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
          active: '#2a2a32',
        },
        text: {
          primary: '#f5f4f1',
          secondary: '#a8a5a0',
          muted: '#6b6860',
          faint: '#3d3b38',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          subtle: 'rgba(255, 255, 255, 0.06)',
          strong: 'rgba(255, 255, 255, 0.15)',
        },
        accent: {
          DEFAULT: '#e8a84c',
          bright: '#f4c171',
          dim: '#b8863d',
          glow: 'rgba(232, 168, 76, 0.15)',
        },
        success: '#5cb97b',
        error: '#e85c5c',
        warning: '#e8a84c',
        info: '#5c9ee8',
      },
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease',
        'slide-in': 'slideIn 0.3s ease',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(232, 168, 76, 0.15)',
        'glow-lg': '0 8px 32px rgba(232, 168, 76, 0.2)',
      },
    },
  },
  plugins: [],
}
