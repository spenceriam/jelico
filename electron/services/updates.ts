import { spawn } from 'child_process'
import { app } from 'electron'
import https from 'https'
import os from 'os'
import path from 'path'
import { createWriteStream, promises as fs } from 'fs'

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

function setDownloadedUpdatePathState(filePath: string | null): void {
  downloadedUpdatePathRevision += 1
  lastDownloadedUpdatePath = filePath
  downloadedUpdatePathLoadPromise = null
  hasLoadedDownloadedUpdatePath = true
}

async function clearDownloadedUpdatePathState(): Promise<void> {
  setDownloadedUpdatePathState(null)
  await persistDownloadedUpdatePath(null)
}

export async function clearDownloadedUpdateState(): Promise<void> {
  await clearDownloadedUpdatePathState()
}

let lastDownloadedUpdatePath: string | null = null
let hasLoadedDownloadedUpdatePath = false
let downloadedUpdatePathLoadPromise: Promise<string | null> | null = null
let downloadedUpdatePathRevision = 0

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

const KNOWN_ARCH_HINTS = [
  'arm64',
  'aarch64',
  'x64',
  'amd64',
  'x86_64',
  'ia32',
  'x86',
  'armv7',
  'armhf',
]

function assetNameHasHint(assetName: string, hint: string): boolean {
  const escapedHint = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hintPattern = new RegExp(`(^|[^a-z0-9])${escapedHint}([^a-z0-9]|$)`, 'i')
  return hintPattern.test(assetName)
}

function pickAssetByExtension(
  assets: UpdateAssetInfo[],
  extensions: string[],
  archHints: string[],
  fallbackHints: string[] = []
): UpdateAssetInfo | null {
  for (const extension of extensions) {
    const byExt = assets.filter((asset) =>
      asset.name.toLowerCase().endsWith(extension.toLowerCase())
    )

    const byArch = byExt.filter((asset) =>
      archHints.some((hint) => assetNameHasHint(asset.name, hint))
    )

    if (byArch.length > 0) return byArch[0]

    const byFallback = byExt.filter((asset) =>
      fallbackHints.some((hint) => assetNameHasHint(asset.name, hint))
    )

    if (byFallback.length > 0) return byFallback[0]

    const genericAssets = byExt.filter((asset) =>
      !KNOWN_ARCH_HINTS.some((hint) => assetNameHasHint(asset.name, hint))
    )

    if (genericAssets.length > 0) return genericAssets[0]
  }

  return null
}

function isRunningFromAppImage(): boolean {
  const envPath = process.env.APPIMAGE?.trim()
  return Boolean(
    (envPath && envPath.toLowerCase().endsWith('.appimage'))
      || process.execPath.toLowerCase().endsWith('.appimage')
  )
}

async function detectLinuxAssetPreferenceOrder(): Promise<string[]> {
  if (isRunningFromAppImage()) {
    return ['.AppImage', '.deb', '.rpm']
  }

  try {
    const osRelease = (await fs.readFile('/etc/os-release', 'utf-8')).toLowerCase()
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

async function getUniqueDownloadPath(preferredPath: string): Promise<string> {
  const parsed = path.parse(preferredPath)
  let candidatePath = preferredPath
  let suffix = 1

  while (true) {
    try {
      await fs.access(candidatePath)
      candidatePath = path.join(parsed.dir, `${parsed.name} (${suffix})${parsed.ext}`)
      suffix += 1
    } catch {
      return candidatePath
    }
  }
}

async function removeFileIfExists(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return

  try {
    await fs.unlink(filePath)
  } catch {
    // Ignore cleanup failures.
  }
}

async function getRecommendedAsset(assets: UpdateAssetInfo[]): Promise<UpdateAssetInfo | null> {
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

  const linuxExtensionPreference = await detectLinuxAssetPreferenceOrder()
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
    recommendedAsset: await getRecommendedAsset(assets),
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
  onProgress?: (progress: UpdateDownloadProgress) => void
): Promise<UpdateDownloadResult> {
  const updateInfo = await checkForUpdates()

  if (!updateInfo.isUpdateAvailable || !updateInfo.recommendedAsset) {
    return { error: 'No compatible update asset found.' }
  }

  const defaultPath = path.join(app.getPath('downloads'), updateInfo.recommendedAsset.name)
  const destinationPath = await getUniqueDownloadPath(defaultPath)

  try {
    const previousPath = await getDownloadedUpdatePath()
    await downloadFile(updateInfo.recommendedAsset.url, destinationPath, onProgress)
    if (previousPath && previousPath !== destinationPath) {
      await removeFileIfExists(previousPath)
    }
    setDownloadedUpdatePathState(destinationPath)
    await persistDownloadedUpdatePath(destinationPath)
    return { savedTo: destinationPath }
  } catch (error) {
    try {
      await fs.unlink(destinationPath)
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
    const loadRevision = downloadedUpdatePathRevision
    const pendingLoad = (async () => {
      const persisted = await readPersistedDownloadedUpdatePath()
      if (loadRevision !== downloadedUpdatePathRevision) {
        return lastDownloadedUpdatePath
      }

      hasLoadedDownloadedUpdatePath = true
      lastDownloadedUpdatePath = persisted
      return lastDownloadedUpdatePath
    })()

    const trackedLoad = pendingLoad.finally(() => {
      if (downloadedUpdatePathLoadPromise === trackedLoad) {
        downloadedUpdatePathLoadPromise = null
      }
    })

    downloadedUpdatePathLoadPromise = trackedLoad
  }

  return downloadedUpdatePathLoadPromise
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

async function writeUpdaterScript(fileExtension: '.sh' | '.ps1', contents: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jelico-update-'))
  const scriptPath = path.join(tempDir, `apply-update${fileExtension}`)
  await fs.writeFile(scriptPath, contents, { encoding: 'utf-8', mode: 0o700 })
  return scriptPath
}

function getCurrentMacAppBundlePath(): string | null {
  const execPath = process.execPath
  const markerIndex = execPath.toLowerCase().lastIndexOf('.app/')
  if (markerIndex === -1) return null
  return execPath.slice(0, markerIndex + 4)
}

function getLinuxAppImageTargetPath(): string {
  const envPath = process.env.APPIMAGE?.trim()
  if (envPath) return envPath
  if (process.execPath.toLowerCase().endsWith('.appimage')) return process.execPath
  return path.join(app.getPath('home'), '.local', 'bin', `${app.getName()}.AppImage`)
}

async function spawnMacApplyHelper(downloadedPath: string): Promise<void> {
  const fallbackAppPath = getCurrentMacAppBundlePath() ?? ''
  const statePath = getLastDownloadedUpdateStatePath() ?? ''
  const script = `#!/bin/sh
set -eu

APP_PID=${process.pid}
DOWNLOADED_PATH=${shellSingleQuote(downloadedPath)}
STATE_PATH=${shellSingleQuote(statePath)}
FALLBACK_APP=${shellSingleQuote(fallbackAppPath)}
SCRIPT_PATH="$0"
MOUNT_DIR=""
EXTRACT_DIR=""
STAGE_DIR=""
BACKUP_APP=""
TARGET_APP=""

wait_for_exit() {
  while kill -0 "$APP_PID" 2>/dev/null; do
    sleep 1
  done
}

relaunch_fallback() {
  if [ -n "$FALLBACK_APP" ] && [ -e "$FALLBACK_APP" ]; then
    open "$FALLBACK_APP" >/dev/null 2>&1 || true
    return
  fi
  if [ -n "$BACKUP_APP" ] && [ -e "$BACKUP_APP" ]; then
    open "$BACKUP_APP" >/dev/null 2>&1 || true
  fi
}

cleanup_mount() {
  if [ -n "$MOUNT_DIR" ] && mount | grep "on $MOUNT_DIR " >/dev/null 2>&1; then
    hdiutil detach "$MOUNT_DIR" -quiet >/dev/null 2>&1 || hdiutil detach "$MOUNT_DIR" -force -quiet >/dev/null 2>&1 || true
  fi
}

cleanup_temp() {
  if [ -n "$EXTRACT_DIR" ]; then
    rm -rf "$EXTRACT_DIR" >/dev/null 2>&1 || true
  fi
  if [ -n "$MOUNT_DIR" ]; then
    rm -rf "$MOUNT_DIR" >/dev/null 2>&1 || true
  fi
  if [ -n "$STAGE_DIR" ]; then
    rm -rf "$STAGE_DIR" >/dev/null 2>&1 || true
  fi
}

cleanup_script() {
  rm -f "$SCRIPT_PATH" >/dev/null 2>&1 || true
  rmdir "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 || true
}

restore_backup() {
  if [ -n "$BACKUP_APP" ] && [ -n "$TARGET_APP" ] && [ -e "$BACKUP_APP" ] && [ ! -e "$TARGET_APP" ]; then
    mv "$BACKUP_APP" "$TARGET_APP" >/dev/null 2>&1 || true
  fi
}

apply_update() {
  case "$DOWNLOADED_PATH" in
    *.zip)
      EXTRACT_DIR="$(mktemp -d /tmp/jelico-update-extract.XXXXXX)" || return 1
      ditto -x -k "$DOWNLOADED_PATH" "$EXTRACT_DIR" || return 1
      SOURCE_ROOT="$EXTRACT_DIR"
      ;;
    *)
      MOUNT_DIR="$(mktemp -d /tmp/jelico-update-mount.XXXXXX)" || return 1
      hdiutil attach "$DOWNLOADED_PATH" -nobrowse -quiet -mountpoint "$MOUNT_DIR" >/dev/null || return 1
      SOURCE_ROOT="$MOUNT_DIR"
      ;;
  esac

  SOURCE_APP="$(find "$SOURCE_ROOT" -maxdepth 1 -type d -name '*.app' | head -n 1)"
  if [ -z "$SOURCE_APP" ]; then
    return 1
  fi

  TARGET_APP="/Applications/$(basename "$SOURCE_APP")"
  STAGE_DIR="$(mktemp -d /Applications/.jelico-update-stage.XXXXXX)" || return 1
  STAGED_APP="$STAGE_DIR/$(basename "$SOURCE_APP")"
  BACKUP_APP="/Applications/.$(basename "$SOURCE_APP" .app).jelico-backup-$APP_PID.app"

  ditto "$SOURCE_APP" "$STAGED_APP" || return 1

  if [ -e "$TARGET_APP" ]; then
    rm -rf "$BACKUP_APP" >/dev/null 2>&1 || true
    mv "$TARGET_APP" "$BACKUP_APP" || return 1
  fi

  if ! mv "$STAGED_APP" "$TARGET_APP"; then
    restore_backup
    return 1
  fi

  if [ -e "$BACKUP_APP" ]; then
    rm -rf "$BACKUP_APP" >/dev/null 2>&1 || true
  fi
  BACKUP_APP=""
  rmdir "$STAGE_DIR" >/dev/null 2>&1 || true
  STAGE_DIR=""

  cleanup_mount
  if [ -n "$STATE_PATH" ]; then
    rm -f "$STATE_PATH" >/dev/null 2>&1 || true
  fi
  rm -f "$DOWNLOADED_PATH" >/dev/null 2>&1 || true
  cleanup_temp
  cleanup_script
  open "$TARGET_APP" >/dev/null 2>&1 &
  return 0
}

wait_for_exit

if ! apply_update; then
  restore_backup
  cleanup_mount
  cleanup_temp
  cleanup_script
  relaunch_fallback
fi
`

  const scriptPath = await writeUpdaterScript('.sh', script)
  const child = spawn('/bin/sh', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

async function spawnWindowsApplyHelper(downloadedPath: string): Promise<void> {
  const installerExtension = path.extname(downloadedPath).toLowerCase()
  const installDir = path.dirname(process.execPath)
  const currentExePath = process.execPath
  const statePath = getLastDownloadedUpdateStatePath() ?? ''
  const script = `$ErrorActionPreference = 'Stop'
$AppPid = ${process.pid}
$InstallerPath = '${escapePowerShellLiteral(downloadedPath)}'
$InstallerExtension = '${escapePowerShellLiteral(installerExtension)}'
$InstallDir = '${escapePowerShellLiteral(installDir)}'
$AppExePath = '${escapePowerShellLiteral(currentExePath)}'
$FallbackExePath = '${escapePowerShellLiteral(currentExePath)}'
$StatePath = '${escapePowerShellLiteral(statePath)}'

function Start-Fallback {
  if (Test-Path -LiteralPath $FallbackExePath) {
    Start-Process -FilePath $FallbackExePath | Out-Null
  }
}

try {
  while (Get-Process -Id $AppPid -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 750
  }

  if ($InstallerExtension -eq '.msi') {
    $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', $InstallerPath, '/qn', '/norestart') -Wait -WindowStyle Hidden -PassThru
  } else {
    $arguments = @('/S')
    if ($InstallDir) {
      $arguments += ('/D=' + $InstallDir)
    }
    $process = Start-Process -FilePath $InstallerPath -ArgumentList $arguments -Wait -WindowStyle Hidden -PassThru
  }

  if ($process.ExitCode -ne 0) {
    throw "Installer exited with code $($process.ExitCode)."
  }

  Remove-Item -LiteralPath $InstallerPath -Force -ErrorAction SilentlyContinue
  if ($StatePath) {
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path -LiteralPath $AppExePath) {
    Start-Process -FilePath $AppExePath | Out-Null
  } else {
    Start-Fallback
  }
} catch {
  Start-Fallback
} finally {
  $scriptPath = $PSCommandPath
  $scriptDir = Split-Path -LiteralPath $scriptPath -Parent
  Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $scriptDir -Force -ErrorAction SilentlyContinue
}
`

  const scriptPath = await writeUpdaterScript('.ps1', script)
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

async function spawnLinuxApplyHelper(downloadedPath: string): Promise<void> {
  const statePath = getLastDownloadedUpdateStatePath() ?? ''
  const appExecPath = process.execPath
  const appImageTargetPath = getLinuxAppImageTargetPath()
  const script = `#!/bin/sh
set -eu

APP_PID=${process.pid}
DOWNLOADED_PATH=${shellSingleQuote(downloadedPath)}
APPIMAGE_TARGET=${shellSingleQuote(appImageTargetPath)}
APP_EXEC=${shellSingleQuote(appExecPath)}
FALLBACK_EXEC=${shellSingleQuote(appExecPath)}
STATE_PATH=${shellSingleQuote(statePath)}
SCRIPT_PATH="$0"

wait_for_exit() {
  while kill -0 "$APP_PID" 2>/dev/null; do
    sleep 1
  done
}

cleanup_script() {
  rm -f "$SCRIPT_PATH" >/dev/null 2>&1 || true
  rmdir "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 || true
}

start_fallback() {
  if [ -n "$FALLBACK_EXEC" ] && [ -e "$FALLBACK_EXEC" ]; then
    "$FALLBACK_EXEC" >/dev/null 2>&1 &
  fi
}

apply_update() {
  case "$DOWNLOADED_PATH" in
    *.AppImage|*.appimage)
      TARGET_PATH="$APPIMAGE_TARGET"
      if [ -n "$TARGET_PATH" ]; then
        mkdir -p "$(dirname "$TARGET_PATH")" || return 1
      else
        TARGET_PATH="$DOWNLOADED_PATH"
      fi

      if [ "$DOWNLOADED_PATH" != "$TARGET_PATH" ]; then
        mv -f "$DOWNLOADED_PATH" "$TARGET_PATH" || return 1
      fi

      chmod +x "$TARGET_PATH" || return 1
      if [ -n "$STATE_PATH" ]; then
        rm -f "$STATE_PATH" >/dev/null 2>&1 || true
      fi
      "$TARGET_PATH" >/dev/null 2>&1 &
      return 0
      ;;
    *.deb)
      if command -v pkexec >/dev/null 2>&1; then
        pkexec dpkg -i "$DOWNLOADED_PATH" || return 1
        rm -f "$DOWNLOADED_PATH" >/dev/null 2>&1 || true
        if [ -n "$STATE_PATH" ]; then
          rm -f "$STATE_PATH" >/dev/null 2>&1 || true
        fi
        "$APP_EXEC" >/dev/null 2>&1 &
        return 0
      fi

      xdg-open "$DOWNLOADED_PATH" >/dev/null 2>&1 || true
      return 1
      ;;
    *.rpm)
      if command -v pkexec >/dev/null 2>&1; then
        pkexec rpm -Uvh --replacepkgs "$DOWNLOADED_PATH" || return 1
        rm -f "$DOWNLOADED_PATH" >/dev/null 2>&1 || true
        if [ -n "$STATE_PATH" ]; then
          rm -f "$STATE_PATH" >/dev/null 2>&1 || true
        fi
        "$APP_EXEC" >/dev/null 2>&1 &
        return 0
      fi

      xdg-open "$DOWNLOADED_PATH" >/dev/null 2>&1 || true
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

wait_for_exit

if ! apply_update; then
  start_fallback
fi

cleanup_script
`

  const scriptPath = await writeUpdaterScript('.sh', script)
  const child = spawn('/bin/sh', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

async function spawnApplyHelper(downloadedPath: string): Promise<void> {
  if (process.platform === 'darwin') {
    await spawnMacApplyHelper(downloadedPath)
    return
  }

  if (process.platform === 'win32') {
    await spawnWindowsApplyHelper(downloadedPath)
    return
  }

  await spawnLinuxApplyHelper(downloadedPath)
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

  if (!app.isPackaged) {
    return { success: false, error: 'Automatic updates can only be applied from packaged builds.' }
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

  try {
    await spawnApplyHelper(resolvedPath)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule the downloaded update.',
    }
  }

  setTimeout(() => {
    app.quit()
  }, 150)

  return { success: true, launchedPath: resolvedPath }
}
