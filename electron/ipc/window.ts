import { ipcMain, BrowserWindow, clipboard } from 'electron'

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

  ipcMain.handle('window:captureArea', async (event, request: {
    x: number
    y: number
    width: number
    height: number
    copyToClipboard?: boolean
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      return { success: false, error: 'No window' }
    }

    const width = Math.max(1, Math.floor(request.width || 0))
    const height = Math.max(1, Math.floor(request.height || 0))
    const x = Math.max(0, Math.floor(request.x || 0))
    const y = Math.max(0, Math.floor(request.y || 0))
    const copyToClipboard = request.copyToClipboard === true

    if (width <= 0 || height <= 0) {
      return { success: false, error: 'Invalid capture area' }
    }

    try {
      const image = await win.capturePage({ x, y, width, height })
      if (image.isEmpty()) {
        return { success: false, error: 'Capture returned empty image' }
      }

      if (copyToClipboard) {
        clipboard.writeImage(image)
      }
      const pngBuffer = image.toPNG()
      const randomSuffix = Math.random().toString(36).slice(2, 8)
      const fileName = `Screenshot-${randomSuffix}.png`

      return {
        success: true,
        name: fileName,
        mimeType: 'image/png',
        data: pngBuffer.toString('base64'),
        width: image.getSize().width,
        height: image.getSize().height,
      }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Capture failed' }
    }
  })
}
