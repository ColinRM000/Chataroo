const ElectronStore = require('electron-store')
const Store = ElectronStore.default || ElectronStore

export interface AppSettings {
  theme: {
    mode: 'dark' | 'light'
    accentColor: string
    rainbowFade: boolean
    happyHolidays: boolean
  }
  chat: {
    fontSize: number // in pixels
    messageHistoryLimit: number
    autoScroll: boolean
    use12HourTime: boolean
  }
  emotes: {
    enableSevenTV: boolean
    enableBTTV: boolean
  }
  moderation: {
    skipConfirmation: boolean
  }
  highlights: {
    mentions: {
      enabled: boolean
      color: string
    }
    moderators: {
      enabled: boolean
      color: string
    }
    verified: {
      enabled: boolean
      color: string
    }
    founder: {
      enabled: boolean
      color: string
    }
    vip: {
      enabled: boolean
      color: string
    }
    subscribers: {
      enabled: boolean
      color: string
    }
    subGifters: {
      enabled: boolean
      color: string
    }
  }
}

const defaultSettings: AppSettings = {
  theme: {
    mode: 'dark',
    accentColor: '#53fc18', // Kick green
    rainbowFade: false,
    happyHolidays: true
  },
  chat: {
    fontSize: 14,
    messageHistoryLimit: 1000,
    autoScroll: true,
    use12HourTime: false
  },
  emotes: {
    enableSevenTV: false,
    enableBTTV: false
  },
  moderation: {
    skipConfirmation: false
  },
  highlights: {
    mentions: {
      enabled: true,
      color: '#ff4444' // Red
    },
    moderators: {
      enabled: true,
      color: '#ffdd00' // Yellow
    },
    verified: {
      enabled: false,
      color: '#53fc18' // Green
    },
    founder: {
      enabled: false,
      color: '#ffd700' // Gold
    },
    vip: {
      enabled: false,
      color: '#ff1493' // Deep Pink
    },
    subscribers: {
      enabled: false,
      color: '#9b59b6' // Purple
    },
    subGifters: {
      enabled: false,
      color: '#5dade2' // Blue
    }
  }
}

export class SettingsStorage {
  private store: any

  constructor() {
    this.store = new Store({
      name: 'chataroo-settings',
      defaults: {
        settings: defaultSettings
      }
    })
  }

  getSettings(): AppSettings {
    const stored = this.store.get('settings', defaultSettings)

    const migrateHighlight = (storedValue: any, defaultValue: { enabled: boolean; color: string }) => {
      if (typeof storedValue === 'boolean') {
        return { enabled: storedValue, color: defaultValue.color }
      }
      if (typeof storedValue === 'object' && storedValue !== null) {
        return { ...defaultValue, ...storedValue }
      }
      return defaultValue
    }

    return {
      theme: {
        ...defaultSettings.theme,
        ...(stored.theme || {})
      },
      chat: {
        ...defaultSettings.chat,
        ...(stored.chat || {})
      },
      emotes: {
        ...defaultSettings.emotes,
        ...(stored.emotes || {})
      },
      moderation: {
        ...defaultSettings.moderation,
        ...(stored.moderation || {})
      },
      highlights: {
        mentions: migrateHighlight(stored.highlights?.mentions, defaultSettings.highlights.mentions),
        moderators: migrateHighlight(stored.highlights?.moderators, defaultSettings.highlights.moderators),
        verified: migrateHighlight(stored.highlights?.verified, defaultSettings.highlights.verified),
        founder: migrateHighlight(stored.highlights?.founder, defaultSettings.highlights.founder),
        vip: migrateHighlight(stored.highlights?.vip, defaultSettings.highlights.vip),
        subscribers: migrateHighlight(stored.highlights?.subscribers, defaultSettings.highlights.subscribers),
        subGifters: migrateHighlight(stored.highlights?.subGifters, defaultSettings.highlights.subGifters)
      }
    }
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    const currentSettings = this.getSettings()

    const newSettings: AppSettings = {
      theme: {
        ...currentSettings.theme,
        ...(updates.theme || {})
      },
      chat: {
        ...currentSettings.chat,
        ...(updates.chat || {})
      },
      emotes: {
        ...currentSettings.emotes,
        ...(updates.emotes || {})
      },
      moderation: {
        ...currentSettings.moderation,
        ...(updates.moderation || {})
      },
      highlights: {
        ...currentSettings.highlights,
        ...(updates.highlights || {})
      }
    }

    this.store.set('settings', newSettings)
    return newSettings
  }

  resetSettings(): AppSettings {
    this.store.set('settings', defaultSettings)
    return defaultSettings
  }

  getSetting<K extends keyof AppSettings>(category: K, key: keyof AppSettings[K]): any {
    const settings = this.getSettings()
    return settings[category][key]
  }

  setSetting<K extends keyof AppSettings>(
    category: K,
    key: keyof AppSettings[K],
    value: any
  ): AppSettings {
    const settings = this.getSettings()
    settings[category][key] = value
    this.store.set('settings', settings)
    return settings
  }
}
