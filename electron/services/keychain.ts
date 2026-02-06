import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'

// Use Electron's safeStorage API for encrypting API keys
// Keys are stored in a JSON file but encrypted with OS-level encryption

function getKeysPath() {
  return path.join(app.getPath('userData'), 'keys.json')
}

interface KeyStore {
  [providerId: string]: string // encrypted base64 string
}

function isLikelyApiKey(value: string): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length < 12 || trimmed.length > 512) return false
  if (/\s/.test(trimmed)) return false
  // Restrict to printable ASCII to avoid returning decrypted garbage bytes.
  return /^[\x20-\x7E]+$/.test(trimmed)
}

function tryDecryptWithLegacyAppNames(buffer: Buffer): string | null {
  const originalName = app.getName()
  const legacyNames = ['Electron', 'jelico', 'Jelico'].filter((name) => name !== originalName)

  try {
    for (const legacyName of legacyNames) {
      try {
        app.setName(legacyName)
        const value = safeStorage.decryptString(buffer)
        if (isLikelyApiKey(value)) {
          return value
        }
      } catch {
        // Try next legacy name
      }
    }
  } finally {
    // Always restore current app name for consistent app behavior.
    app.setName(originalName)
  }

  return null
}

function loadKeys(): KeyStore {
  try {
    const keysPath = getKeysPath()
    if (fs.existsSync(keysPath)) {
      const content = fs.readFileSync(keysPath, 'utf-8')
      return JSON.parse(content)
    }
  } catch {
    // File doesn't exist or is corrupted
  }
  return {}
}

function saveKeys(keys: KeyStore): void {
  fs.writeFileSync(getKeysPath(), JSON.stringify(keys, null, 2))
}

export const keychainService = {
  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    const keys = loadKeys()

    // Check if encryption is available
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey)
      keys[providerId] = encrypted.toString('base64')
    } else {
      // Fallback: store as-is (not recommended for production)
      // In production, you should require encryption
      console.warn('Encryption not available, storing key in plain text')
      keys[providerId] = Buffer.from(apiKey).toString('base64')
    }

    saveKeys(keys)
  },

  async getApiKey(providerId: string): Promise<string | null> {
    const keys = loadKeys()
    const encrypted = keys[providerId]

    if (!encrypted) return null

    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encrypted, 'base64')
        let recoveredApiKey: string | null = null

        try {
          const currentValue = safeStorage.decryptString(buffer)
          if (isLikelyApiKey(currentValue)) {
            recoveredApiKey = currentValue
          }
        } catch {
          // Ignore and attempt compatibility fallbacks below.
        }

        // Compatibility fallback for legacy app-name encryption contexts.
        if (!recoveredApiKey) {
          recoveredApiKey = tryDecryptWithLegacyAppNames(buffer)
          if (recoveredApiKey) {
            // Migrate to current app identity for stable future decrypts.
            try {
              keys[providerId] = safeStorage.encryptString(recoveredApiKey).toString('base64')
              saveKeys(keys)
            } catch {
              // Keep using recovered key even if migration write fails.
            }
          }
        }

        // Legacy fallback: some historical runs stored plain base64 while
        // encryption availability changed across environments.
        if (!recoveredApiKey) {
          const legacyPlain = buffer.toString('utf-8')
          if (isLikelyApiKey(legacyPlain)) {
            recoveredApiKey = legacyPlain
            try {
              keys[providerId] = safeStorage.encryptString(legacyPlain).toString('base64')
              saveKeys(keys)
            } catch {
              // Keep using recovered key even if migration write fails.
            }
          }
        }

        return recoveredApiKey
      } else {
        // Fallback: decode base64
        const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
        return isLikelyApiKey(decoded) ? decoded : null
      }
    } catch {
      return null
    }
  },

  async deleteApiKey(providerId: string): Promise<boolean> {
    const keys = loadKeys()
    if (keys[providerId]) {
      delete keys[providerId]
      saveKeys(keys)
      return true
    }
    return false
  },

  async getAllProviderIds(): Promise<string[]> {
    const keys = loadKeys()
    return Object.keys(keys)
  },
}
