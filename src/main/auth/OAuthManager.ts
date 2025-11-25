import { BrowserWindow } from 'electron'
import { join } from 'path'
import axios from 'axios'
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce'

interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  scope: string
  username?: string
}

export class OAuthManager {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private authorizationEndpoint = 'https://id.kick.com/oauth/authorize'
  private tokenEndpoint = 'https://id.kick.com/oauth/token'
  private revokeEndpoint = 'https://id.kick.com/oauth/revoke'
  private codeVerifier: string | null = null
  private state: string | null = null

  constructor(config: OAuthConfig) {
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.redirectUri = config.redirectUri
  }

  async authenticate(scopes: string[] = [
    'user:read',
    'channel:read',
    'channel:write',
    'chat:write',
    'moderation:ban',
    'events:subscribe'
  ]): Promise<TokenResponse> {
    this.codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(this.codeVerifier)
    this.state = generateState()

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: this.state
    })

    const authUrl = `${this.authorizationEndpoint}?${params.toString()}`

    return new Promise((resolve, reject) => {
      const iconPath = process.platform === 'win32'
        ? join(__dirname, '../../resources/Chataroo.ico')
        : join(__dirname, '../../resources/Chataroo.png')

      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        icon: iconPath,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        },
        title: 'Chataroo - Login to Kick'
      })

      authWindow.loadURL(authUrl)

      let extractedUsername: string | null = null

      authWindow.webContents.on('did-finish-load', async () => {
        try {
          const username = await authWindow.webContents.executeJavaScript(`
            (function() {
              const bodyText = document.body.innerText;
              const match = bodyText.match(/Logged in as ([a-zA-Z0-9_-]+)/i);
              return match ? match[1] : null;
            })();
          `)
          if (username) {
            extractedUsername = username
          }
        } catch (err) {
          // Username extraction failed, will try other methods
        }
      })

      // Listen for navigation
      authWindow.webContents.on('will-redirect', async (_event, url) => {
        await this.handleCallback(url, authWindow, resolve, reject, extractedUsername)
      })

      authWindow.webContents.on('did-navigate', async (_event, url) => {
        await this.handleCallback(url, authWindow, resolve, reject, extractedUsername)
      })

      authWindow.on('closed', () => {
        reject(new Error('Authentication window was closed by user'))
      })
    })
  }

  private async handleCallback(
    url: string,
    authWindow: BrowserWindow,
    resolve: (value: TokenResponse) => void,
    reject: (reason: Error) => void,
    extractedUsername?: string | null
  ): Promise<void> {
    if (url.startsWith(this.redirectUri)) {
      try {
        const urlParams = new URL(url)
        const code = urlParams.searchParams.get('code')
        const returnedState = urlParams.searchParams.get('state')

        if (returnedState !== this.state) {
          throw new Error('State mismatch - possible CSRF attack')
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        const tokens = await this.exchangeCodeForTokens(code, extractedUsername)

        authWindow.close()
        resolve(tokens)
      } catch (error) {
        authWindow.close()
        reject(error instanceof Error ? error : new Error('Unknown error'))
      }
    }
  }

  private decodeJwtToken(token: string): { username?: string; userId?: number } | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return null
      }

      const payload = parts[1]
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
      const decoded = Buffer.from(padded, 'base64').toString('utf8')
      const data = JSON.parse(decoded)

      const username = data.username || data.preferred_username || data.name ||
                       data.sub_name || data.user_name || data.login || data.nick
      const userId = data.sub || data.user_id || data.id

      if (username) {
        return { username, userId }
      }

      if (data.sub && typeof data.sub === 'string' && isNaN(Number(data.sub))) {
        return { username: data.sub, userId }
      }

      return { userId }
    } catch (error: any) {
      return null
    }
  }

  private async fetchUserInfo(accessToken: string): Promise<string | null> {
    try {
      const response = await axios.get('https://api.kick.com/public/v1/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.data && response.data.data && response.data.data[0]) {
        const userData = response.data.data[0]
        if (userData.name) {
          return userData.name
        }
        if (userData.username) {
          return userData.username
        }
      }

      return null
    } catch (error: any) {
      return null
    }
  }

  private async exchangeCodeForTokens(code: string, username?: string | null): Promise<TokenResponse> {
    if (!this.codeVerifier) {
      throw new Error('Code verifier not found')
    }

    try {
      const response = await axios.post(
        this.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code_verifier: this.codeVerifier
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      const accessToken = response.data.access_token
      let finalUsername: string | null = null

      finalUsername = await this.fetchUserInfo(accessToken)

      if (!finalUsername) {
        const jwtData = this.decodeJwtToken(accessToken)
        if (jwtData?.username) {
          finalUsername = jwtData.username
        }
      }

      if (!finalUsername && username) {
        finalUsername = username
      }

      return {
        accessToken: accessToken,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
        scope: response.data.scope,
        username: finalUsername || undefined
      }
    } catch (error: any) {
      throw new Error(`Token exchange failed: ${error.response?.data?.message || error.message}`)
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const response = await axios.post(
        this.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
        scope: response.data.scope
      }
    } catch (error: any) {
      throw new Error(`Token refresh failed: ${error.response?.data?.message || error.message}`)
    }
  }

  async revokeToken(token: string, tokenType: string = 'access_token'): Promise<boolean> {
    try {
      await axios.post(
        `${this.revokeEndpoint}?token=${token}&token_hint_type=${tokenType}`
      )
      return true
    } catch (error: any) {
      throw new Error(`Token revocation failed: ${error.response?.data?.message || error.message}`)
    }
  }
}
