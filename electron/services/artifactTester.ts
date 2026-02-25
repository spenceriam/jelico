import { BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { artifactDb } from './database.js'

const DEFAULT_VIEWPORT = { width: 1280, height: 800 }
const MAX_SESSIONS = 8

interface ArtifactTestSession {
  id: string
  win: BrowserWindow
  createdAt: number
  lastUsedAt: number
  artifactId?: string
  artifactTitle?: string
}

const sessions = new Map<string, ArtifactTestSession>()

function createSessionId(): string {
  return `artifact-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function loadUrlAndWaitForLoad(win: BrowserWindow, url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out while loading artifact preview'))
    }, 10000)

    const onLoad = () => {
      cleanup()
      resolve()
    }

    const onFail = (_: unknown, code: number, description: string) => {
      cleanup()
      reject(new Error(`Failed to load artifact preview (${code}): ${description}`))
    }

    const onLoadError = (error: unknown) => {
      cleanup()
      reject(new Error(`Failed to load artifact preview: ${asErrorMessage(error)}`))
    }

    const cleanup = () => {
      clearTimeout(timeout)
      win.webContents.removeListener('did-finish-load', onLoad)
      win.webContents.removeListener('did-fail-load', onFail)
    }

    // Register listeners BEFORE starting navigation to avoid missing did-finish-load.
    win.webContents.once('did-finish-load', onLoad)
    win.webContents.once('did-fail-load', onFail)
    void win.loadURL(url).catch(onLoadError)
  })
}

async function executeInSession<T = unknown>(session: ArtifactTestSession, script: string): Promise<T> {
  session.lastUsedAt = Date.now()
  return session.win.webContents.executeJavaScript(script, true) as Promise<T>
}

function getSession(sessionId: string): ArtifactTestSession | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (session.win.isDestroyed()) {
    sessions.delete(sessionId)
    return null
  }
  return session
}

async function closeOldestSessionIfNeeded() {
  if (sessions.size < MAX_SESSIONS) return

  let oldest: ArtifactTestSession | null = null
  for (const session of sessions.values()) {
    if (!oldest || session.lastUsedAt < oldest.lastUsedAt) {
      oldest = session
    }
  }
  if (!oldest) return

  try {
    oldest.win.destroy()
  } catch {
    // Ignore
  }
  sessions.delete(oldest.id)
}

async function resolveHtmlFromArtifact(artifactId: string): Promise<{
  html: string
  artifactId: string
  artifactTitle: string
  revision: number
}> {
  const identifier = artifactId.trim()
  let artifact = artifactDb.get(identifier)
  if (!artifact) {
    // Some models pass artifact title instead of ID. Accept that as a fallback.
    const htmlArtifacts = artifactDb.list().filter((row) => row.type === 'html')
    artifact =
      htmlArtifacts.find((row) => row.title === identifier) ||
      htmlArtifacts.find((row) => row.title.toLowerCase() === identifier.toLowerCase()) ||
      null
  }

  if (!artifact) {
    throw new Error(`Artifact not found: ${artifactId}. Provide artifact ID or exact HTML title.`)
  }

  const baseId = artifact.base_artifact_id || artifact.id
  const latest = artifactDb.getLatestRevision(baseId) || artifact

  if (latest.type !== 'html') {
    throw new Error(`Artifact "${latest.title}" is type "${latest.type}", expected "html"`)
  }

  return {
    html: latest.content || '',
    artifactId: latest.id,
    artifactTitle: latest.title,
    revision: latest.revision || 1,
  }
}

export async function openArtifactTestSession(input: {
  artifactId?: string
  html?: string
  width?: number
  height?: number
}) {
  await closeOldestSessionIfNeeded()

  const width = Math.max(320, Math.min(2560, input.width || DEFAULT_VIEWPORT.width))
  const height = Math.max(240, Math.min(1600, input.height || DEFAULT_VIEWPORT.height))

  let html = input.html || ''
  let artifactMeta: { artifactId?: string; artifactTitle?: string; revision?: number } = {}

  if (input.artifactId) {
    const resolved = await resolveHtmlFromArtifact(input.artifactId)
    html = resolved.html
    artifactMeta = {
      artifactId: resolved.artifactId,
      artifactTitle: resolved.artifactTitle,
      revision: resolved.revision,
    }
  }

  if (!html || !html.trim()) {
    throw new Error('No HTML content available to open')
  }

  const win = new BrowserWindow({
    show: false,
    width,
    height,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const sessionId = createSessionId()
  const session: ArtifactTestSession = {
    id: sessionId,
    win,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    artifactId: artifactMeta.artifactId,
    artifactTitle: artifactMeta.artifactTitle,
  }

  sessions.set(sessionId, session)
  win.on('closed', () => {
    sessions.delete(sessionId)
  })

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  await loadUrlAndWaitForLoad(win, dataUrl)

  return {
    sessionId,
    viewport: { width, height },
    artifactId: artifactMeta.artifactId,
    artifactTitle: artifactMeta.artifactTitle,
    revision: artifactMeta.revision,
  }
}

export async function closeArtifactTestSession(sessionId: string) {
  const session = getSession(sessionId)
  if (!session) {
    return { success: false, error: `Session not found: ${sessionId}` }
  }
  try {
    session.win.destroy()
  } catch {
    // Ignore
  }
  sessions.delete(sessionId)
  return { success: true }
}

export function listArtifactTestSessions() {
  const result: Array<{
    sessionId: string
    artifactId?: string
    artifactTitle?: string
    createdAt: number
    lastUsedAt: number
  }> = []

  for (const [id, session] of sessions.entries()) {
    if (session.win.isDestroyed()) {
      sessions.delete(id)
      continue
    }
    result.push({
      sessionId: id,
      artifactId: session.artifactId,
      artifactTitle: session.artifactTitle,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
    })
  }

  return result.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

export async function artifactTestClick(
  sessionId: string,
  selector: string,
  expectChange = true,
  waitAfterMs = 300
) {
  const session = getSession(sessionId)
  if (!session) return { success: false, error: `Session not found: ${sessionId}` }

  const payload = JSON.stringify(selector)
  const expectChangeJson = JSON.stringify(expectChange)
  const waitAfterMsJson = JSON.stringify(Math.max(0, Math.min(5000, waitAfterMs)))
  const result = await executeInSession(session, `
(() => {
  const selector = ${payload}
  const expectChange = ${expectChangeJson}
  const waitAfterMs = ${waitAfterMsJson}
  const el = document.querySelector(selector)
  if (!el) return { success: false, error: \`Selector not found: \${selector}\` }

  const hashText = (text) => {
    let hash = 2166136261
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i)
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return (hash >>> 0).toString(16)
  }

  const canvasSignature = () => {
    const canvas = document.querySelector('canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return null
    try {
      const sampleSize = 32
      const sampleCanvas = document.createElement('canvas')
      sampleCanvas.width = sampleSize
      sampleCanvas.height = sampleSize
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })
      if (!sampleCtx) return null
      sampleCtx.clearRect(0, 0, sampleSize, sampleSize)
      sampleCtx.drawImage(canvas, 0, 0, sampleSize, sampleSize)
      const data = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data
      let checksum = 0
      for (let i = 0; i < data.length; i += 8) {
        checksum = (checksum + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) % 1000000007
      }
      return sampleSize + 'x' + sampleSize + ':' + checksum
    } catch {
      return null
    }
  }

  const snapshot = () => {
    const text = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 4000)
    return {
      readyState: document.readyState,
      textHash: hashText(text),
      textLength: text.length,
      canvasSignature: canvasSignature(),
    }
  }

  const before = snapshot()

  const rect = el.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const eventOpts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }
  el.dispatchEvent(new MouseEvent('mouseover', eventOpts))
  el.dispatchEvent(new MouseEvent('mousedown', eventOpts))
  el.dispatchEvent(new MouseEvent('mouseup', eventOpts))
  el.dispatchEvent(new MouseEvent('click', eventOpts))
  if (typeof el.click === 'function') {
    el.click()
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      const after = snapshot()
      const textChanged = before.textHash !== after.textHash
      const canvasChanged = before.canvasSignature !== after.canvasSignature
      const changed = textChanged || canvasChanged

      if (expectChange && !changed) {
        resolve({
          success: false,
          error: 'Click produced no observable UI change (text/canvas unchanged)',
          tagName: el.tagName,
          text: (el.textContent || '').trim().slice(0, 160),
          observed: {
            textChanged,
            canvasChanged,
            before,
            after,
          },
        })
        return
      }

      resolve({
        success: true,
        tagName: el.tagName,
        text: (el.textContent || '').trim().slice(0, 160),
        observed: {
          textChanged,
          canvasChanged,
          changed,
          before,
          after,
        },
      })
    }, waitAfterMs)
  })
})()
`)

  return result
}

export async function artifactTestType(
  sessionId: string,
  selector: string,
  text: string,
  append = false
) {
  const session = getSession(sessionId)
  if (!session) return { success: false, error: `Session not found: ${sessionId}` }

  const selectorJson = JSON.stringify(selector)
  const textJson = JSON.stringify(text)
  const appendJson = JSON.stringify(append)

  const result = await executeInSession(session, `
(() => {
  const selector = ${selectorJson}
  const text = ${textJson}
  const append = ${appendJson}
  const el = document.querySelector(selector)
  if (!el) return { success: false, error: \`Selector not found: \${selector}\` }

  const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
  const isEditable = el instanceof HTMLElement && el.isContentEditable

  if (!isInput && !isEditable) {
    return { success: false, error: 'Target is not an input, textarea, or contenteditable element' }
  }

  if (isInput) {
    const target = el
    target.focus()
    target.value = append ? (target.value + text) : text
    target.dispatchEvent(new Event('input', { bubbles: true }))
    target.dispatchEvent(new Event('change', { bubbles: true }))
    return { success: true, valueLength: target.value.length }
  }

  el.focus()
  el.textContent = append ? ((el.textContent || '') + text) : text
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return { success: true, valueLength: (el.textContent || '').length }
})()
`)

  return result
}

export async function artifactTestEvaluate(sessionId: string, expression: string) {
  const session = getSession(sessionId)
  if (!session) return { success: false, error: `Session not found: ${sessionId}` }

  try {
    const expressionJson = JSON.stringify(expression)
    const wrapped = await executeInSession<{
      success: boolean
      value?: unknown
      error?: string
      stack?: string
    }>(session, `
(() => {
  const expression = ${expressionJson}
  try {
    const value = (0, eval)(expression)
    return { success: true, value }
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'Error'
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
    const stack = error && typeof error === 'object' && 'stack' in error
      ? String(error.stack || '').split('\\n').slice(0, 4).join('\\n')
      : undefined
    return { success: false, error: name + ': ' + message, stack }
  }
})()
`)

    if (!wrapped?.success) {
      return {
        success: false,
        error: wrapped?.error || 'Evaluation failed',
        stack: wrapped?.stack,
      }
    }

    const rawValue = wrapped.value
    const valueType =
      rawValue === undefined
        ? 'undefined'
        : rawValue === null
          ? 'null'
          : Array.isArray(rawValue)
            ? 'array'
            : typeof rawValue

    return {
      success: true,
      value: rawValue === undefined ? null : rawValue,
      valueType,
    }
  } catch (error) {
    return { success: false, error: asErrorMessage(error) }
  }
}

export async function artifactTestExtract(sessionId: string, selector?: string) {
  const session = getSession(sessionId)
  if (!session) return { success: false, error: `Session not found: ${sessionId}` }

  const selectorJson = JSON.stringify(selector || '')
  const result = await executeInSession(session, `
(() => {
  const selector = ${selectorJson}
  const target = selector ? document.querySelector(selector) : document.body
  if (!target) return { success: false, error: \`Selector not found: \${selector}\` }

  return {
    success: true,
    text: (target.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 4000),
    html: (target instanceof Element ? target.outerHTML : document.documentElement.outerHTML).slice(0, 8000),
  }
})()
`)

  return result
}

export async function artifactTestWaitFor(input: {
  sessionId: string
  text?: string
  selector?: string
  timeoutMs?: number
}) {
  const session = getSession(input.sessionId)
  if (!session) return { success: false, error: `Session not found: ${input.sessionId}` }

  if (!input.text && !input.selector) {
    return { success: false, error: 'Provide text, selector, or both for wait_for' }
  }

  const timeoutMs = Math.max(250, Math.min(60000, input.timeoutMs || 10000))
  const start = Date.now()

  let lastState: unknown = null
  while (Date.now() - start < timeoutMs) {
    const textJson = JSON.stringify(input.text || '')
    const selectorJson = JSON.stringify(input.selector || '')
    const state = await executeInSession(session, `
(() => {
  const expectedText = ${textJson}
  const selector = ${selectorJson}
  const bodyText = (document.body?.textContent || '')
  const textMatched = expectedText ? bodyText.includes(expectedText) : true
  const selectorMatched = selector ? !!document.querySelector(selector) : true
  return {
    matched: textMatched && selectorMatched,
    textMatched,
    selectorMatched,
    readyState: document.readyState,
  }
})()
`)
    lastState = state
    if ((state as any)?.matched) {
      return {
        success: true,
        elapsedMs: Date.now() - start,
        state,
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return {
    success: false,
    error: `Timeout waiting for expected state after ${timeoutMs}ms`,
    elapsedMs: Date.now() - start,
    lastState,
  }
}

interface ArtifactTestScreenshotOptions {
  thumbWidth?: number
  waitMs?: number
}

interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

async function getPreferredCaptureRect(session: ArtifactTestSession): Promise<CaptureRect | null> {
  try {
    const rect = await executeInSession<CaptureRect | null>(session, `
(() => {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  if (!viewportWidth || !viewportHeight) return null

  const minArea = Math.max(120 * 120, Math.floor(viewportWidth * viewportHeight * 0.08))

  const toNumber = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const isVisible = (el) => {
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (toNumber(style.opacity) === 0) return false
    return true
  }

  const clampRect = (rect) => {
    const left = Math.max(0, Math.floor(rect.left))
    const top = Math.max(0, Math.floor(rect.top))
    const right = Math.min(viewportWidth, Math.ceil(rect.right))
    const bottom = Math.min(viewportHeight, Math.ceil(rect.bottom))
    const width = right - left
    const height = bottom - top
    if (width < 80 || height < 80) return null
    return { x: left, y: top, width, height }
  }

  const canvases = Array.from(document.querySelectorAll('canvas'))
  let best = null

  for (const canvas of canvases) {
    if (!(canvas instanceof Element)) continue
    if (!isVisible(canvas)) continue

    const clamped = clampRect(canvas.getBoundingClientRect())
    if (!clamped) continue

    const area = clamped.width * clamped.height
    if (area < minArea) continue

    if (!best || area > best.area) {
      best = { ...clamped, area }
    }
  }

  if (!best) return null

  const pad = 12
  const x = Math.max(0, best.x - pad)
  const y = Math.max(0, best.y - pad)
  const right = Math.min(viewportWidth, best.x + best.width + pad)
  const bottom = Math.min(viewportHeight, best.y + best.height + pad)

  const width = Math.max(1, right - x)
  const height = Math.max(1, bottom - y)
  return { x, y, width, height }
})()
`)

    if (!rect) return null
    if (rect.width <= 0 || rect.height <= 0) return null
    return rect
  } catch {
    return null
  }
}

export async function artifactTestScreenshot(sessionId: string, options: ArtifactTestScreenshotOptions = {}) {
  const session = getSession(sessionId)
  if (!session) return { success: false, error: `Session not found: ${sessionId}` }

  // Let the page settle before capture so dynamic UIs are fully painted.
  const requestedWaitMs = Math.round(options.waitMs ?? 1200)
  const waitMs = Math.max(0, Math.min(5000, Number.isFinite(requestedWaitMs) ? requestedWaitMs : 1200))
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  const preferredRect = await getPreferredCaptureRect(session)
  const image = preferredRect
    ? await session.win.webContents.capturePage(preferredRect)
    : await session.win.webContents.capturePage()
  const png = image.toPNG()
  const outputPath = path.join(app.getPath('temp'), `jelico-artifact-test-${sessionId}-${Date.now()}.png`)
  await fs.writeFile(outputPath, png)

  const requestedThumbWidth = Math.round(options.thumbWidth ?? 300)
  const thumbWidth = Math.max(1, Number.isFinite(requestedThumbWidth) ? requestedThumbWidth : 300)
  const thumbnail = image.resize({ width: thumbWidth, quality: 'best' })
  const thumbnailJpeg = thumbnail.toJPEG(80).toString('base64')

  const size = image.getSize()
  const thumbnailSize = thumbnail.getSize()
  return {
    success: true,
    path: outputPath,
    width: size.width,
    height: size.height,
    previewBase64: png.toString('base64'),
    previewMimeType: 'image/png',
    previewWidth: size.width,
    previewHeight: size.height,
    thumbnailBase64: thumbnailJpeg,
    thumbnailMimeType: 'image/jpeg',
    thumbnailWidth: thumbnailSize.width,
    thumbnailHeight: thumbnailSize.height,
  }
}
