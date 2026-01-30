import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'better-sqlite3',
                'keytar',
                '@xenova/transformers',
                'onnxruntime-node',
                'onnxruntime-web',
                'sharp',
              ],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub Node.js modules for browser/worker context (used by @xenova/transformers)
      'fs': path.resolve(__dirname, './src/lib/stubs/fs.ts'),
      'path': path.resolve(__dirname, './src/lib/stubs/path.ts'),
    },
  },
  // Worker configuration - ensure Node.js modules are stubbed
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  // Optimize deps to handle transformers.js
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
})
