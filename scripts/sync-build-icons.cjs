const fs = require('fs')
const os = require('os')
const path = require('path')
const pngToIcoModule = require('png-to-ico')
const pngToIco = pngToIcoModule.default || pngToIcoModule
let sharp = null
let sharpLoadError = null

try {
  sharp = require('sharp')
} catch (error) {
  sharpLoadError = error
}

const ROOT = process.cwd()
const SOURCE_PNG = path.join(ROOT, 'src/assets/branding/jelico-icon.png')
const BUILD_DIR = path.join(ROOT, 'build')
const BUILD_ICON_PNG = path.join(BUILD_DIR, 'icon.png')
const BUILD_ICON_ICO = path.join(BUILD_DIR, 'icon.ico')
const LINUX_ICONS_DIR = path.join(BUILD_DIR, 'icons')

const LINUX_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true })
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function syncIcons() {
  if (!(await fileExists(SOURCE_PNG))) {
    throw new Error(`Source icon missing: ${SOURCE_PNG}`)
  }

  await ensureDir(BUILD_DIR)
  await ensureDir(LINUX_ICONS_DIR)

  // Canonical packaging PNG for macOS and shared build metadata.
  await fs.promises.copyFile(SOURCE_PNG, BUILD_ICON_PNG)

  if (!sharp) {
    const linuxIconPaths = LINUX_SIZES.map((size) => path.join(LINUX_ICONS_DIR, `${size}x${size}.png`))
    const linuxExistsFlags = await Promise.all(linuxIconPaths.map((iconPath) => fileExists(iconPath)))
    const hasAllLinuxIcons = linuxExistsFlags.every(Boolean)
    const hasIco = await fileExists(BUILD_ICON_ICO)

    if (!hasAllLinuxIcons || !hasIco) {
      const cause = sharpLoadError ? `\nCaused by: ${sharpLoadError.message || String(sharpLoadError)}` : ''
      throw new Error(
        'sharp runtime is unavailable and required build icons are missing.\n' +
        'Install sharp for this runtime (or regenerate icons once on a compatible runtime), then retry.' +
        cause
      )
    }

    console.warn('[sync-icons] sharp runtime unavailable - reusing existing build/icon.ico and build/icons/*.png')
    return
  }

  // Linux icon set (PNG sizes).
  await Promise.all(
    LINUX_SIZES.map((size) =>
      sharp(SOURCE_PNG)
        .resize(size, size, { fit: 'contain' })
        .png()
        .toFile(path.join(LINUX_ICONS_DIR, `${size}x${size}.png`))
    )
  )

  // Windows ICO from multiple PNG sizes.
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jelico-ico-'))
  try {
    const pngPaths = []
    for (const size of ICO_SIZES) {
      const pngPath = path.join(tmpDir, `${size}.png`)
      await sharp(SOURCE_PNG)
        .resize(size, size, { fit: 'contain' })
        .png()
        .toFile(pngPath)
      pngPaths.push(pngPath)
    }

    const icoBuffer = await pngToIco(pngPaths)
    await fs.promises.writeFile(BUILD_ICON_ICO, icoBuffer)
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  }
}

syncIcons()
  .then(() => {
    console.log('Synced build icons from src/assets/branding/jelico-icon.png')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
