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
const SOURCE_ICO = path.join(ROOT, 'src/assets/branding/jelico-icon.ico')
const BUILD_DIR = path.join(ROOT, 'build')
const BUILD_ICON_PNG = path.join(BUILD_DIR, 'icon.png')
const BUILD_ICON_ICO = path.join(BUILD_DIR, 'icon.ico')
const LINUX_ICONS_DIR = path.join(BUILD_DIR, 'icons')

const LINUX_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const REQUIRED_ICO_SIZE = 256

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

async function hasRequiredIcoEntry(filePath, minSize = REQUIRED_ICO_SIZE) {
  if (!(await fileExists(filePath))) return false

  try {
    const buffer = await fs.promises.readFile(filePath)
    if (buffer.length < 6) return false

    const count = buffer.readUInt16LE(4)
    if (count < 1) return false

    for (let i = 0; i < count; i += 1) {
      const offset = 6 + i * 16
      if (offset + 16 > buffer.length) break
      let width = buffer[offset]
      let height = buffer[offset + 1]
      if (width === 0) width = 256
      if (height === 0) height = 256
      if (width >= minSize && height >= minSize) return true
    }
  } catch {
    return false
  }

  return false
}

async function writeIcoFromPngSources(pngSources, destinationPath) {
  const icoBuffer = await pngToIco(pngSources)
  await fs.promises.writeFile(destinationPath, icoBuffer)
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
    const sourceIcoHasRequiredSize = await hasRequiredIcoEntry(SOURCE_ICO)
    if (sourceIcoHasRequiredSize) {
      await fs.promises.copyFile(SOURCE_ICO, BUILD_ICON_ICO)
    } else {
      // Even without sharp, we can generate a compliant ICO directly from the source PNG.
      await writeIcoFromPngSources([SOURCE_PNG], BUILD_ICON_ICO)
    }

    const linuxIconPaths = LINUX_SIZES.map((size) => path.join(LINUX_ICONS_DIR, `${size}x${size}.png`))
    const linuxExistsFlags = await Promise.all(linuxIconPaths.map((iconPath) => fileExists(iconPath)))
    const hasAllLinuxIcons = linuxExistsFlags.every(Boolean)
    const hasIco = await hasRequiredIcoEntry(BUILD_ICON_ICO)

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

  // Windows ICO: use explicit source ICO only when it contains at least 256x256.
  if (await hasRequiredIcoEntry(SOURCE_ICO)) {
    await fs.promises.copyFile(SOURCE_ICO, BUILD_ICON_ICO)
  } else {
    // Fallback: generate ICO from PNG sizes.
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

      await writeIcoFromPngSources(pngPaths, BUILD_ICON_ICO)
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true })
    }
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
