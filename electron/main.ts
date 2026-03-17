import { app, BrowserWindow, Menu, shell, dialog, clipboard, nativeImage } from 'electron'
import { existsSync } from 'fs'
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
import { registerQueueHandlers } from './ipc/queue'
import { registerTodoHandlers } from './ipc/todos'
import { registerSoulHandlers } from './ipc/soul'
import { registerBackupHandlers } from './ipc/backup'
import { registerSkillHandlers } from './ipc/skills'
import { registerSpeechHandlers } from './ipc/speech'
import { registerCompactionHandlers } from './ipc/compaction'
import { registerUpdateHandlers } from './ipc/updates'
import { registerWindowHandlers } from './ipc/window'
import { closeAllArtifactTestSessions } from './services/artifactTester'

const APP_DISPLAY_NAME = 'Jelico'

// Get version and git info
const packageJson = require('../package.json')
const APP_VERSION = packageJson.version

// Ensure OS-level app naming is consistent in dev and production.
// keychainService handles legacy app-name decryption for compatibility.
app.setName(APP_DISPLAY_NAME)
if (process.platform === 'win32') {
  app.setAppUserModelId('com.jelico.app')
}

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
let lastAlreadyRunningNoticeAt = 0
let isAppQuitting = false

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      mainWindow.focus()

      const now = Date.now()
      if (now - lastAlreadyRunningNoticeAt > 2000) {
        lastAlreadyRunningNoticeAt = now
        void dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Already Running',
          message: 'Jelico is already running.',
          detail: 'Brought the existing Jelico window to the front.',
          buttons: ['OK'],
          noLink: true,
        }).catch(() => {
          // Ignore popup failures.
        })
      }
      return
    }

    createWindow()
  })
}

function createMenu() {
  const isMac = process.platform === 'darwin'
  const gitHash = getGitHash()
  const repoUrl = getGitRepoUrl()

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: APP_DISPLAY_NAME,
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
  const windowIconPath = process.platform === 'win32'
    ? path.join(app.getAppPath(), 'build', 'icon.ico')
    : path.join(app.getAppPath(), 'build', 'icon.png')
  const windowIcon = existsSync(windowIconPath) ? windowIconPath : undefined

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: APP_DISPLAY_NAME,
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: process.platform === 'darwin' ? undefined : windowIcon,
    backgroundColor: '#08080a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for some Node APIs
      backgroundThrottling: false, // Keep streaming active when window loses focus
      spellcheck: true, // Enable native Chrome spellcheck
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

    // Hidden artifact test windows can keep the process alive after the main
    // window closes. Force a full exit on non-macOS for predictable shutdown.
    if (process.platform !== 'darwin' && !isAppQuitting) {
      closeAllArtifactTestSessions()
      app.quit()
    }
  })

  // Ensure links from chat/messages open in the user's default browser instead
  // of spawning an in-app window that can break authenticated sessions.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL() || ''
    if (url === currentUrl) return
    if (!isHttpUrl(url)) return
    event.preventDefault()
    void shell.openExternal(url)
  })

  // Handle renderer crashes silently - log and reload
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer crashed:', details.reason, `(exit code: ${details.exitCode})`)
    // Silently reload
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload()
    }
  })

  // Enable right-click context menu with spellcheck and all standard editing options
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { isEditable, selectionText, editFlags, misspelledWord, dictionarySuggestions, linkURL } = params

    const menuItems: Electron.MenuItemConstructorOptions[] = []

    // Spellcheck suggestions for misspelled words (top of menu like Chrome)
    if (misspelledWord && dictionarySuggestions.length > 0) {
      for (const suggestion of dictionarySuggestions.slice(0, 5)) {
        menuItems.push({
          label: suggestion,
          click: () => mainWindow?.webContents.replaceMisspelling(suggestion)
        })
      }
      if (dictionarySuggestions.length === 0) {
        menuItems.push({ label: 'No suggestions', enabled: false })
      }
      menuItems.push({ type: 'separator' })
      menuItems.push({
        label: 'Add to Dictionary',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(misspelledWord)
      })
      menuItems.push({ type: 'separator' })
    }

    // Link options
    if (linkURL) {
      menuItems.push({
        label: 'Open Link in Browser',
        click: () => shell.openExternal(linkURL)
      })
      menuItems.push({
        label: 'Copy Link Address',
        click: () => clipboard.writeText(linkURL)
      })
      menuItems.push({ type: 'separator' })
    }

    // Standard editing options
    if (isEditable) {
      menuItems.push(
        { label: 'Undo', role: 'undo', enabled: editFlags.canUndo },
        { label: 'Redo', role: 'redo', enabled: editFlags.canRedo },
        { type: 'separator' },
        { label: 'Cut', role: 'cut', enabled: editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: editFlags.canPaste },
        { label: 'Delete', role: 'delete', enabled: editFlags.canDelete },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll', enabled: editFlags.canSelectAll }
      )
    } else if (selectionText) {
      // Non-editable but has selection (e.g., reading messages, code blocks)
      menuItems.push(
        { label: 'Copy', role: 'copy' },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll' }
      )
    }

    if (menuItems.length > 0) {
      Menu.buildFromTemplate(menuItems).popup()
    }
  })
}

function setDockIcon() {
  if (process.platform !== 'darwin') return
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.png')
  if (!existsSync(iconPath)) {
    console.warn('[Main] Dock icon not found at', iconPath)
    return
  }
  const icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon)
  }
}

if (gotSingleInstanceLock) {
  // Initialize app
  app.whenReady().then(async () => {
    // Create application menu
    createMenu()
    setDockIcon()

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
    registerQueueHandlers()
    registerTodoHandlers()
    registerSoulHandlers()
    registerBackupHandlers()
    registerSkillHandlers()
    registerSpeechHandlers()
    registerCompactionHandlers()
    registerUpdateHandlers()
    registerWindowHandlers()

    // Create window
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('before-quit', () => {
    isAppQuitting = true
    closeAllArtifactTestSessions()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
