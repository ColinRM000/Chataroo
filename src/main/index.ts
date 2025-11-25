import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { OAuthManager } from './auth/OAuthManager'
import { OAUTH_CONFIG } from './auth/OAuthConfig'
import { TokenStorage } from './auth/TokenStorage'
import { ChatClient } from './api/ChatClient'
import { RateLimiter } from './api/RateLimiter'
import { EmoteService } from './api/EmoteService'
import { ThirdPartyEmoteService } from './api/ThirdPartyEmoteService'
import { ModerationService } from './api/ModerationService'
import { FollowService } from './api/FollowService'
import { SettingsStorage } from './settings/SettingsStorage'

app.setName('Chataroo')

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function createWindow() {
  const resourcePath = !process.env.NODE_ENV || process.env.NODE_ENV === 'production'
    ? process.resourcesPath
    : join(__dirname, '../../resources')

  const iconPath = process.platform === 'win32'
    ? join(resourcePath, 'Chataroo.ico')
    : join(resourcePath, 'Chataroo.png')

  const icon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Chataroo',
    backgroundColor: '#1a1a1a'
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('closed', () => {
    for (const [, data] of popoutWindows.entries()) {
      if (!data.window.isDestroyed()) {
        data.window.close()
      }
    }
    popoutWindows.clear()
    mainWindow = null
  })
}

let oauthManager: OAuthManager
let tokenStorage: TokenStorage
let chatClient: ChatClient
let rateLimiter: RateLimiter
let emoteService: EmoteService
let thirdPartyEmoteService: ThirdPartyEmoteService
let moderationService: ModerationService
let followService: FollowService
let settingsStorage: SettingsStorage

const popoutWindows = new Map<string, { window: BrowserWindow; channelData: any }>()
let mainWindow: BrowserWindow | null = null

function setupAuthServices() {
  oauthManager = new OAuthManager(OAUTH_CONFIG)
  tokenStorage = new TokenStorage()
  settingsStorage = new SettingsStorage()
  rateLimiter = new RateLimiter(1)
  chatClient = new ChatClient(tokenStorage, oauthManager)
  emoteService = new EmoteService()
  thirdPartyEmoteService = new ThirdPartyEmoteService()
  moderationService = new ModerationService(() => {
    const tokens = tokenStorage.getTokens()
    return tokens?.accessToken || null
  })
  followService = new FollowService(() => {
    const tokens = tokenStorage.getTokens()
    return tokens?.accessToken || null
  })

  const originalSendMessage = chatClient.sendMessage.bind(chatClient)
  chatClient.sendMessage = (options: any) => {
    return rateLimiter.execute(() => originalSendMessage(options))
  }
}

function setupIpcHandlers() {
  ipcMain.handle('auth:login', async () => {
    try {
      const tokens = await oauthManager.authenticate()
      tokenStorage.saveTokens(tokens)

      if (tokens.username) {
        const userInfo = { username: tokens.username, slug: tokens.username }
        tokenStorage.saveUserInfo(userInfo)
        return { success: true, userInfo }
      }

      return { success: true, userInfo: null }
    } catch (error: any) {
      console.error('Login error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      const tokens = tokenStorage.getTokens()
      if (tokens && tokens.accessToken) {
        await oauthManager.revokeToken(tokens.accessToken)
      }
      tokenStorage.clearTokens()
      tokenStorage.clearUserInfo()
      return { success: true }
    } catch (error: any) {
      console.error('Logout error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auth:status', async () => {
    const tokens = tokenStorage.getTokens()
    const userInfo = tokenStorage.getUserInfo()
    return {
      isAuthenticated: !!tokens && !tokenStorage.isTokenExpired(),
      userInfo,
      accessToken: tokens?.accessToken || null
    }
  })

  ipcMain.handle('chat:send', async (_event, options) => {
    try {
      const result = await chatClient.sendMessage(options)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('Send message error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('emotes:fetchGlobal', async () => {
    try {
      const emotes = await emoteService.fetchGlobalEmotes()
      return { success: true, data: emotes }
    } catch (error: any) {
      console.error('[Main] Failed to fetch global emotes:', error)
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('emotes:fetchChannel', async (_event, channelSlug) => {
    try {
      const emotes = await emoteService.fetchChannelEmotes(channelSlug)
      return { success: true, data: emotes }
    } catch (error: any) {
      console.error(`[Main] Failed to fetch emotes for ${channelSlug}:`, error)
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('emotes:fetchThirdParty', async (_event, channelSlug) => {
    try {
      const result = await thirdPartyEmoteService.fetchAllForChannel(channelSlug)
      return { success: true, data: result }
    } catch (error: any) {
      console.error(`[Main] Failed to fetch third-party emotes for ${channelSlug}:`, error)
      return { success: false, error: error.message, data: { seventvGlobal: [], seventvChannel: [], bttvGlobal: [] } }
    }
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error: any) {
      console.error('[Main] Failed to open external URL:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('settings:get', async () => {
    try {
      const settings = settingsStorage.getSettings()
      return { success: true, data: settings }
    } catch (error: any) {
      console.error('[Main] Failed to get settings:', error)
      return { success: false, error: error.message, data: null }
    }
  })

  ipcMain.handle('settings:set', async (_event, updates) => {
    try {
      const settings = settingsStorage.updateSettings(updates)
      return { success: true, data: settings }
    } catch (error: any) {
      console.error('[Main] Failed to update settings:', error)
      return { success: false, error: error.message, data: null }
    }
  })

  ipcMain.handle('settings:reset', async () => {
    try {
      const settings = settingsStorage.resetSettings()
      return { success: true, data: settings }
    } catch (error: any) {
      console.error('[Main] Failed to reset settings:', error)
      return { success: false, error: error.message, data: null }
    }
  })

  ipcMain.handle('channels:get', async () => {
    try {
      const channels = tokenStorage.getChannels()
      return { success: true, data: channels }
    } catch (error: any) {
      console.error('[Main] Failed to get channels:', error)
      return { success: false, error: error.message, data: [] }
    }
  })

  ipcMain.handle('channels:save', async (_event, channels: string[]) => {
    try {
      tokenStorage.saveChannels(channels)
      return { success: true }
    } catch (error: any) {
      console.error('[Main] Failed to save channels:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('moderation:timeout', async (_event, data) => {
    try {
      const { broadcasterUserId, userId, durationMinutes, reason } = data

      const result = await moderationService.timeoutUser(
        broadcasterUserId,
        userId,
        durationMinutes,
        reason
      )

      return { success: true, data: result }
    } catch (error: any) {
      console.error('[Main] Failed to timeout user:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('moderation:ban', async (_event, data) => {
    try {
      const { broadcasterUserId, userId, reason } = data

      const result = await moderationService.banUser(
        broadcasterUserId,
        userId,
        reason
      )

      return { success: true, data: result }
    } catch (error: any) {
      console.error('[Main] Failed to ban user:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('moderation:unban', async (_event, data) => {
    try {
      const { broadcasterUserId, userId } = data

      const result = await moderationService.unbanUser(
        broadcasterUserId,
        userId
      )

      return { success: true, data: result }
    } catch (error: any) {
      console.error('[Main] Failed to unban user:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('follow:follow', async (_event, data) => {
    try {
      const { channelSlug } = data
      const result = await followService.followChannel(channelSlug)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('[Main] Failed to follow channel:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('follow:unfollow', async (_event, data) => {
    try {
      const { channelSlug } = data
      const result = await followService.unfollowChannel(channelSlug)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('[Main] Failed to unfollow channel:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('follow:checkStatus', async (_event, data) => {
    try {
      const { channelSlug } = data
      const result = await followService.checkFollowStatus(channelSlug)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('[Main] Failed to check follow status:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('popout:create', async (_event, channelData) => {
    try {
      const { channelSlug } = channelData

      if (popoutWindows.has(channelSlug)) {
        const existing = popoutWindows.get(channelSlug)!
        existing.window.focus()
        return { success: true, alreadyExists: true }
      }

      const resourcePath = !process.env.NODE_ENV || process.env.NODE_ENV === 'production'
        ? process.resourcesPath
        : join(__dirname, '../../resources')

      const iconPath = process.platform === 'win32'
        ? join(resourcePath, 'Chataroo.ico')
        : join(resourcePath, 'Chataroo.png')

      const icon = nativeImage.createFromPath(iconPath)

      const popoutWindow = new BrowserWindow({
        width: 380,
        height: 550,
        minWidth: 300,
        minHeight: 400,
        frame: false,
        transparent: false,
        icon: icon,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false
        },
        title: `${channelData.channelName || channelSlug} - Chat`,
        backgroundColor: '#0e0e10'
      })

      popoutWindows.set(channelSlug, { window: popoutWindow, channelData })

      if (process.env.NODE_ENV === 'development') {
        popoutWindow.loadURL('http://localhost:5173/popout.html')
      } else {
        popoutWindow.loadFile(join(__dirname, '../renderer/popout.html'))
      }

      popoutWindow.on('closed', () => {
        popoutWindows.delete(channelSlug)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('popout:closed', channelSlug)
        }
      })

      return { success: true }
    } catch (error: any) {
      console.error('[Main] Failed to create popout window:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('popout:close', async (event) => {
    try {
      // Find which popout window sent this event
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      if (!senderWindow) return { success: false, error: 'Window not found' }

      // Find the channel slug for this window
      for (const [channelSlug, data] of popoutWindows.entries()) {
        if (data.window === senderWindow) {
          senderWindow.close()
          return { success: true, channelSlug }
        }
      }

      return { success: false, error: 'Popout window not found in registry' }
    } catch (error: any) {
      console.error('[Main] Failed to close popout window:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('popout:setAlwaysOnTop', async (event, value: boolean) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      if (senderWindow) {
        senderWindow.setAlwaysOnTop(value)
        return { success: true }
      }
      return { success: false, error: 'Window not found' }
    } catch (error: any) {
      console.error('[Main] Failed to set always on top:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('popout:getData', async (event) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      if (!senderWindow) {
        console.error('[Main] popout:getData - Could not find sender window')
        return null
      }

      const senderId = senderWindow.id

      for (const [channelSlug, data] of popoutWindows.entries()) {
        if (data.window.id === senderId) {
          return data.channelData
        }
      }

      console.error(`[Main] No channel data found for window ${senderId}`)
      return null
    } catch (error: any) {
      console.error('[Main] Failed to get popout data:', error)
      return null
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      console.error('Failed to download update:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })
}

function setupAutoUpdater() {
  if (process.env.NODE_ENV === 'development') {
    return
  }

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info.version)
    }
  })

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded')
    }
  })

  autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error)
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates()
  }, 3000)
}

app.whenReady().then(() => {
  setupAuthServices()
  setupIpcHandlers()
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  tokenStorage.clearTokens()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
