import { app, BrowserWindow } from 'electron'
import path from 'path'
import { initDatabase } from './services/database'
import { registerProviderHandlers } from './ipc/providers'
import { registerConversationHandlers } from './ipc/conversations'
import { registerAIHandlers } from './ipc/ai'
import { registerWorkspaceHandlers } from './ipc/workspaces'
import { registerArtifactHandlers } from './ipc/artifacts'
import { registerSandboxHandlers } from './ipc/sandbox'
import { registerMemoryHandlers } from './ipc/memory'
import { registerPermissionHandlers } from './ipc/permissions'
import { registerSoulHandlers } from './ipc/soul'

// The built directory structure
const DIST = path.join(__dirname, '../dist')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#08080a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for some Node APIs
    },
  })

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // DevTools can be opened manually with Ctrl+Shift+I
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Initialize app
app.whenReady().then(async () => {
  // Initialize database (async)
  await initDatabase()

  // Register IPC handlers
  registerProviderHandlers()
  registerConversationHandlers()
  registerAIHandlers()
  registerWorkspaceHandlers()
  registerArtifactHandlers()
  registerSandboxHandlers()
  registerMemoryHandlers()
  registerPermissionHandlers()
  registerSoulHandlers()

  // Create window
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
