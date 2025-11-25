import { safeStorage } from 'electron'

const ElectronStore = require('electron-store')
const Store = ElectronStore.default || ElectronStore

interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
  tokenType: string
  scope: string
}

interface EncryptedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
  tokenType: string
  scope: string
}

interface UserInfo {
  id: number
  username: string
  email?: string
  slug: string
}

export class TokenStorage {
  private store: Store

  constructor() {
    this.store = new Store({
      name: 'chataroo-auth',
      encryptionKey: 'chataroo-secure-key-v1'
    })
  }

  saveTokens(tokens: Omit<StoredTokens, 'expiresAt'>): void {
    const expiresAt = Date.now() + (tokens.expiresIn * 1000)

    if (!safeStorage.isEncryptionAvailable()) {
      this.store.set('tokens', { ...tokens, expiresAt })
      return
    }

    const encrypted: EncryptedTokens = {
      accessToken: safeStorage.encryptString(tokens.accessToken).toString('base64'),
      refreshToken: safeStorage.encryptString(tokens.refreshToken).toString('base64'),
      expiresIn: tokens.expiresIn,
      expiresAt,
      tokenType: tokens.tokenType,
      scope: tokens.scope
    }

    this.store.set('tokens', encrypted)
  }

  getTokens(): StoredTokens | null {
    const encrypted = this.store.get('tokens') as EncryptedTokens | undefined
    if (!encrypted) return null

    if (!safeStorage.isEncryptionAvailable()) {
      return encrypted as unknown as StoredTokens
    }

    try {
      return {
        accessToken: safeStorage.decryptString(Buffer.from(encrypted.accessToken, 'base64')),
        refreshToken: safeStorage.decryptString(Buffer.from(encrypted.refreshToken, 'base64')),
        expiresIn: encrypted.expiresIn,
        expiresAt: encrypted.expiresAt,
        tokenType: encrypted.tokenType,
        scope: encrypted.scope
      }
    } catch (error) {
      console.error('Failed to decrypt tokens:', error)
      return null
    }
  }

  isTokenExpired(): boolean {
    const tokens = this.getTokens()
    if (!tokens || !tokens.expiresAt) return true

    const bufferTime = 5 * 60 * 1000
    return Date.now() >= (tokens.expiresAt - bufferTime)
  }

  clearTokens(): void {
    this.store.delete('tokens')
  }

  saveUserInfo(userInfo: UserInfo): void {
    this.store.set('userInfo', userInfo)
  }

  getUserInfo(): UserInfo | null {
    return this.store.get('userInfo') as UserInfo || null
  }

  clearUserInfo(): void {
    this.store.delete('userInfo')
  }

  saveChannels(channels: string[]): void {
    this.store.set('channels', channels)
  }

  getChannels(): string[] {
    return this.store.get('channels') as string[] || []
  }

  clearChannels(): void {
    this.store.delete('channels')
  }
}
