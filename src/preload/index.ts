import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
})

contextBridge.exposeInMainWorld('chatarooAPI', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),

  sendMessage: (options: any) => ipcRenderer.invoke('chat:send', options),

  fetchGlobalEmotes: () => ipcRenderer.invoke('emotes:fetchGlobal'),
  fetchChannelEmotes: (channelSlug: string) => ipcRenderer.invoke('emotes:fetchChannel', channelSlug),
  fetchThirdPartyEmotes: (channelSlug: string) => ipcRenderer.invoke('emotes:fetchThirdParty', channelSlug),

  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: any) => ipcRenderer.invoke('settings:set', updates),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),

  getSavedChannels: () => ipcRenderer.invoke('channels:get'),
  saveChannels: (channels: string[]) => ipcRenderer.invoke('channels:save', channels),

  timeoutUser: (data: { broadcasterUserId: number; userId: number; durationMinutes: number; reason?: string }) =>
    ipcRenderer.invoke('moderation:timeout', data),
  banUser: (data: { broadcasterUserId: number; userId: number; reason?: string }) =>
    ipcRenderer.invoke('moderation:ban', data),
  unbanUser: (data: { broadcasterUserId: number; userId: number }) =>
    ipcRenderer.invoke('moderation:unban', data),

  followChannel: (data: { channelSlug: string }) =>
    ipcRenderer.invoke('follow:follow', data),
  unfollowChannel: (data: { channelSlug: string }) =>
    ipcRenderer.invoke('follow:unfollow', data),
  checkFollowStatus: (data: { channelSlug: string }) =>
    ipcRenderer.invoke('follow:checkStatus', data),

  popoutChat: (channelData: any) => ipcRenderer.invoke('popout:create', channelData),
  closePopout: () => ipcRenderer.invoke('popout:close'),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('popout:setAlwaysOnTop', value),
  getPopoutData: () => ipcRenderer.invoke('popout:getData'),
  onPopoutClosed: (callback: (channelSlug: string) => void) => {
    ipcRenderer.on('popout:closed', (_event, channelSlug) => callback(channelSlug))
  },

  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update-available', (_event, version) => callback(version))
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', () => callback())
  }
})
