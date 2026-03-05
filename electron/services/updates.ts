import { app, dialog, shell, type BrowserWindow } from 'electron'
import https from 'https'
import path from 'path'
import { createWriteStream, promises as fs, readFileSync } from 'fs'

const OWNER = 'spenceriam'
const REPO = 'jelico'
const RELEASES_API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
const USER_AGENT = 'Jelico'
const LAST_DOWNLOADED_UPDATE_STATE_FILE = 'last-downloaded-update.json'

function getLastDownloadedUpdateStatePath(): string | null {
  try {
    return path.join(app.getPath('userData'), LAST_DOWNLOADED_UPDATE_STATE_FILE)
  } catch {
    return null
  }
}

async function readPersistedDownloadedUpdatePath(): Promise<string | null> {
  const statePath = getLastDownloadedUpdateStatePath()
  if (!statePath) return null

  try {
    const raw = await fs.readFile(statePath, 'utf-8')
    const parsed = JSON.parse(raw) as { path?: unknown } | null
    const savedPath = typeof parsed?.path === 'string' ? parsed.path.trim() : ''
    return savedPath.length > 0 ? savedPath : null
  } catch {
    return null
  }
}

async function persistDownloadedUpdatePath(filePath: string | null): Promise<void> {
  const statePath = getLastDownloadedUpdateStatePath()
  if (!statePath) return

  try {
    if (filePath) {
      await fs.writeFile(statePath, JSON.stringify({ path: filePath }), 'utf-8')
    } else {
      await fs.unlink(statePath)
    }
  } catch {
    // Ignore persistence failures; in-memory tracking still works for current session.
  }
}

async function clearDownloadedUpdatePathState(): Promise<void> {
  lastDownloadedUpdatePath = null
  downloadedUpdatePathLoadPromise = null
  hasLoadedDownloadedUpdatePath = true
  await persistDownloadedUpdatePath(null)
}

export async function clearDownloadedUpdateState(): Promise<void> {
  await clearDownloadedUpdatePathState()
}

let lastDownloadedUpdatePath: string | null = null
let hasLoadedDownloadedUpdatePath = false
let downloadedUpdatePathLoadPromise: Promise<string | null> | null = null

export interface UpdateAssetInfo {
  name: string
  url: string
  size: number
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  isUpdateAvailable: boolean
  releaseUrl: string
  publishedAt: string
  assets: UpdateAssetInfo[]
  recommendedAsset?: UpdateAssetInfo | null
}

export interface UpdateDownloadProgress {
  received: number
  total: number
  percent: number | null
}

export interface UpdateDownloadResult {
  canceled?: boolean
  savedTo?: string
  error?: string
}

export interface UpdateApplyResult {
  success: boolean
  launchedPath?: string
  error?: string
}

interface GitHubRelease {
  tag_name: string
  html_url: string
  published_at: string
  prerelease: boolean
  draft: boolean
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
  }>
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '')
}

function parseSemver(version: string): [number, number, number] {
  const cleaned = normalizeVersion(version)
  const main = cleaned.split('-')[0] || cleaned
  const parts = main.split('.')
  return [
    Number(parts[0]) || 0,
    Number(parts[1]) || 0,
    Number(parts[2]) || 0,
  ]
}

function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a)
  const [bMajor, bMinor, bPatch] = parseSemver(b)

  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1
  return 0
}

function pickAssetByExtension(
  assets: UpdateAssetInfo[],
  extensions: string[],
  archHints: string[],
  fallbackHints: string[] = []
): UpdateAssetInfo | null {
  const byExt = assets.filter((asset) =>
    extensions.some((ext) => asset.name.toLowerCase().endsWith(ext))
  )

  const byArch = byExt.filter((asset) =>
    archHints.some((hint) => asset.name.toLowerCase().includes(hint))
  )

  if (byArch.length > 0) return byArch[0]

  const byFallback = byExt.filter((asset) =>
    fallbackHints.some((hint) => asset.name.toLowerCase().includes(hint))
  )

  if (byFallback.length > 0) return byFallback[0]

  return byExt[0] || null
}

function detectLinuxAssetPreferenceOrder(): string[] {
  try {
    const osRelease = readFileSync('/etc/os-release', 'utf-8').toLowerCase()
    const normalized = osRelease.replace(/"/g, '')

    if (/\bid(_like)?=.*(debian|ubuntu|mint|pop|elementary)\b/.test(normalized)) {
      return ['.deb', '.AppImage', '.rpm']
    }

    if (/\bid(_like)?=.*(fedora|rhel|centos|rocky|alma|suse|opensuse)\b/.test(normalized)) {
      return ['.rpm', '.AppImage', '.deb']
    }
  } catch {
    // Fall back to a universal default below.
  }

  return ['.AppImage', '.deb', '.rpm']
}

function getRecommendedAsset(assets: UpdateAssetInfo[]): UpdateAssetInfo | null {
  const platform = process.platform
  const arch = process.arch

  const archHints = arch === 'arm64'
    ? ['arm64', 'aarch64']
    : arch === 'x64'
      ? ['x64', 'amd64', 'x86_64']
      : [arch]

  if (platform === 'darwin') {
    return pickAssetByExtension(assets, ['.dmg', '.zip'], archHints, ['universal'])
  }

  if (platform === 'win32') {
    return pickAssetByExtension(assets, ['.exe', '.msi'], archHints)
  }

  const linuxExtensionPreference = detectLinuxAssetPreferenceOrder()
  return pickAssetByExtension(assets, linuxExtensionPreference, archHints)
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status})`)
  }

  return response.json() as Promise<GitHubRelease>
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()
  const release = await fetchLatestRelease()

  if (release.draft || release.prerelease) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      isUpdateAvailable: false,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      assets: [],
      recommendedAsset: null,
    }
  }

  const latestVersion = normalizeVersion(release.tag_name)
  const isUpdateAvailable = compareSemver(latestVersion, currentVersion) > 0
  const assets = release.assets.map((asset) => ({
    name: asset.name,
    url: asset.browser_download_url,
    size: asset.size,
  }))

  return {
    currentVersion,
    latestVersion,
    isUpdateAvailable,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
    assets,
    recommendedAsset: getRecommendedAsset(assets),
  }
}

async function downloadFile(
  url: string,
  destinationPath: string,
  onProgress?: (progress: UpdateDownloadProgress) => void
): Promise<void> {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true })

  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
      const statusCode = response.statusCode || 0

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        response.resume()
        downloadFile(response.headers.location, destinationPath, onProgress)
          .then(resolve)
          .catch(reject)
        return
      }

      if (statusCode !== 200) {
        response.resume()
        reject(new Error(`Download failed (${statusCode})`))
        return
      }

      const total = Number(response.headers['content-length'] || 0)
      let received = 0
      const fileStream = createWriteStream(destinationPath)

      response.on('data', (chunk) => {
        received += chunk.length
        onProgress?.({
          received,
          total,
          percent: total > 0 ? Math.round((received / total) * 100) : null,
        })
      })

      response.on('error', (error) => {
        fileStream.close()
        reject(error)
      })

      fileStream.on('error', (error) => {
        response.destroy()
        reject(error)
      })

      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })

      response.pipe(fileStream)
    })

    request.on('error', reject)
  })
}

export async function downloadLatestUpdate(
  window: BrowserWindow | null,
  onProgress?: (progress: UpdateDownloadProgress) => void
): Promise<UpdateDownloadResult> {
  const updateInfo = await checkForUpdates()

  if (!updateInfo.isUpdateAvailable || !updateInfo.recommendedAsset) {
    return { error: 'No compatible update asset found.' }
  }

  const defaultPath = path.join(app.getPath('downloads'), updateInfo.recommendedAsset.name)
  const result = await dialog.showSaveDialog(window ?? undefined, {
    title: 'Download Jelico Update',
    defaultPath,
    buttonLabel: 'Download',
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  try {
    await downloadFile(updateInfo.recommendedAsset.url, result.filePath, onProgress)
    lastDownloadedUpdatePath = result.filePath
    await persistDownloadedUpdatePath(result.filePath)
    return { savedTo: result.filePath }
  } catch (error) {
    try {
      await fs.unlink(result.filePath)
    } catch {
      // Ignore cleanup errors
    }
    return { error: error instanceof Error ? error.message : 'Download failed.' }
  }
}

async function getDownloadedUpdatePath(): Promise<string | null> {
  if (lastDownloadedUpdatePath) return lastDownloadedUpdatePath
  if (hasLoadedDownloadedUpdatePath) return null

  if (!downloadedUpdatePathLoadPromise) {
    downloadedUpdatePathLoadPromise = (async () => {
      const persisted = await readPersistedDownloadedUpdatePath()
      if (persisted) {
        lastDownloadedUpdatePath = persisted
      }
      hasLoadedDownloadedUpdatePath = true
      return lastDownloadedUpdatePath
    })().finally(() => {
      downloadedUpdatePathLoadPromise = null
    })
  }

  return downloadedUpdatePathLoadPromise
}

export async function applyDownloadedUpdate(): Promise<UpdateApplyResult> {
  const resolvedPath = await getDownloadedUpdatePath()
  if (!resolvedPath) {
    return { success: false, error: 'No downloaded update file is available.' }
  }

  let fileStats: Awaited<ReturnType<typeof fs.stat>>
  try {
    fileStats = await fs.stat(resolvedPath)
  } catch {
    await clearDownloadedUpdatePathState()
    return { success: false, error: 'Downloaded update file no longer exists.' }
  }

  if (!fileStats.isFile()) {
    await clearDownloadedUpdatePathState()
    return { success: false, error: 'Downloaded update target is not a file.' }
  }

  // Best-effort Linux helper: AppImage often needs executable bit to launch.
  if (process.platform === 'linux' && resolvedPath.toLowerCase().endsWith('.appimage')) {
    try {
      if ((fileStats.mode & 0o111) === 0) {
        await fs.chmod(resolvedPath, fileStats.mode | 0o755)
      }
    } catch {
      // Continue anyway; openPath may still succeed depending on permissions.
    }
  }

  const openError = await shell.openPath(resolvedPath)
  if (openError) {
    return { success: false, error: openError }
  }

  return { success: true, launchedPath: resolvedPath }
}
