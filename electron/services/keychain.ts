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
        return safeStorage.decryptString(buffer)
      } else {
        // Fallback: decode base64
        return Buffer.from(encrypted, 'base64').toString('utf-8')
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
