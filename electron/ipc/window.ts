import { ipcMain, BrowserWindow } from 'electron'

interface WindowDragState {
  offsetX: number
  offsetY: number
}

const dragStateByWebContents = new Map<number, WindowDragState>()

export function registerWindowHandlers() {
  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      return { success: false, error: 'No window' }
    }

    if (win.isFullScreen()) {
      win.setFullScreen(false)
      return { success: true, state: 'restored' }
    }

    if (win.isMaximized()) {
      win.unmaximize()
      return { success: true, state: 'restored' }
    }

    win.maximize()
    return { success: true, state: 'maximized' }
  })

  ipcMain.handle('window:startDrag', (event, mouseScreenX: number, mouseScreenY: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      return { success: false, error: 'No window' }
    }

    // Keep native maximize/fullscreen behavior predictable.
    if (win.isMaximized() || win.isFullScreen()) {
      return { success: false, error: 'Window is not movable in current state' }
    }

    const [winX, winY] = win.getPosition()
    dragStateByWebContents.set(event.sender.id, {
      offsetX: Math.round(mouseScreenX) - winX,
      offsetY: Math.round(mouseScreenY) - winY,
    })

    return { success: true }
  })

  ipcMain.handle('window:updateDrag', (event, mouseScreenX: number, mouseScreenY: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      return { success: false, error: 'No window' }
    }

    const dragState = dragStateByWebContents.get(event.sender.id)
    if (!dragState) {
      return { success: false, error: 'No active drag state' }
    }

    const nextX = Math.round(mouseScreenX) - dragState.offsetX
    const nextY = Math.round(mouseScreenY) - dragState.offsetY
    win.setPosition(nextX, nextY)

    return { success: true }
  })

  ipcMain.handle('window:endDrag', (event) => {
    dragStateByWebContents.delete(event.sender.id)
    return { success: true }
  })
}
