import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import path from 'path'
import { execSync } from 'child_process'
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
import { registerBackupHandlers } from './ipc/backup'
import { registerSpeechHandlers } from './ipc/speech'
import { registerCompactionHandlers } from './ipc/compaction'

// Get version and git info
const packageJson = require('../package.json')
const APP_VERSION = packageJson.version

function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

function getGitRepoUrl(): string {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim()
    // Convert SSH URL to HTTPS if needed
    if (remoteUrl.startsWith('git@github.com:')) {
      return remoteUrl.replace('git@github.com:', 'https://github.com/').replace('.git', '')
    }
    return remoteUrl.replace('.git', '')
  } catch {
    return 'https://github.com/spenceriam/jelico'
  }
}

// The built directory structure
const DIST = path.join(__dirname, '../dist')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null

function createMenu() {
  const isMac = process.platform === 'darwin'
  const gitHash = getGitHash()
  const repoUrl = getGitRepoUrl()

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-chat')
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Jelico',
          click: () => {
            const commitUrl = `${repoUrl}/commit/${gitHash}`
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Jelico',
              message: 'Jelico',
              detail: `Version: ${APP_VERSION}\nCommit: ${gitHash}\n\nAI Productivity Desktop\nGet stuff done. Frictionlessly.`,
              buttons: ['OK', 'View on GitHub'],
            }).then(({ response }) => {
              if (response === 1) {
                shell.openExternal(commitUrl)
              }
            })
          },
        },
        { type: 'separator' },
        {
          label: 'View on GitHub',
          click: () => {
            shell.openExternal(repoUrl)
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal(`${repoUrl}/issues`)
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

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

  // Handle renderer crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer process crashed:', details.reason, details.exitCode)
    dialog.showErrorBox(
      'Renderer Crashed',
      `The renderer process crashed.\nReason: ${details.reason}\nExit code: ${details.exitCode}\n\nThe app will now reload.`
    )
    // Reload the window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload()
    }
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Main] Renderer became unresponsive')
  })

  mainWindow.webContents.on('responsive', () => {
    console.log('[Main] Renderer became responsive again')
  })
}

// Initialize app
app.whenReady().then(async () => {
  // Create application menu
  createMenu()

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
  registerBackupHandlers()
  registerSpeechHandlers()
  registerCompactionHandlers()

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
