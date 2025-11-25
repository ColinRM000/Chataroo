import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface KickEmote {
  id: number
  channel_id: number | null
  name: string
  subscribers_only?: boolean
}

// Kick API is protected by Cloudflare - must use browser context to bypass
export class EmoteService {
  private globalEmotesCache: KickEmote[] | null = null
  private channelEmotesCache: Map<string, KickEmote[]> = new Map()

  private async fetchWithBrowserContext<T>(url: string, channelSlug?: string): Promise<T> {
    const hiddenWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    hiddenWindow.webContents.setAudioMuted(true)

    try {
      const pageUrl = channelSlug ? `https://kick.com/${channelSlug}` : 'https://kick.com'
      await hiddenWindow.loadURL(pageUrl)
      await new Promise(resolve => setTimeout(resolve, 2000))
      const result = await hiddenWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            const response = await fetch('${url}', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });

            if (!response.ok) {
              throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
            }

            const data = await response.json();
            return { success: true, data };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })()
      `)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    } finally {
      hiddenWindow.close()
    }
  }

  async fetchGlobalEmotes(): Promise<KickEmote[]> {
    if (this.globalEmotesCache && this.globalEmotesCache.length > 0) {
      return this.globalEmotesCache
    }

    try {
      const globalEmotesPath = path.join(process.cwd(), 'GlobalEmotes.json')

      if (!fs.existsSync(globalEmotesPath)) {
        console.error('[EmoteService] GlobalEmotes.json not found at:', globalEmotesPath)
        return []
      }

      const fileContent = fs.readFileSync(globalEmotesPath, 'utf-8')
      const emoteSections = JSON.parse(fileContent)

      let allGlobalEmotes: KickEmote[] = []

      for (const section of emoteSections) {
        if (section.emotes && Array.isArray(section.emotes)) {
          const sectionEmotes = section.emotes.map((emote: any) => ({
            id: emote.id,
            name: emote.name,
            channel_id: emote.channel_id || null,
            subscribers_only: emote.subscribers_only || false
          }))
          allGlobalEmotes.push(...sectionEmotes)
        }
      }

      this.globalEmotesCache = allGlobalEmotes
      return allGlobalEmotes
    } catch (error) {
      console.error('[EmoteService] Failed to load global emotes:', error)
      throw new Error(`Failed to load global emotes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async fetchChannelEmotes(channelSlug: string): Promise<KickEmote[]> {
    if (this.channelEmotesCache.has(channelSlug)) {
      return this.channelEmotesCache.get(channelSlug)!
    }

    try {
      const emotesData = await this.fetchWithBrowserContext<any>(
        `https://kick.com/emotes/${channelSlug}`,
        channelSlug
      )

      const globalEmotes = await this.fetchGlobalEmotes()
      const globalEmoteIds = new Set(globalEmotes.map(e => e.id))

      let allEmotes: KickEmote[] = []

      if (Array.isArray(emotesData)) {
        for (const section of emotesData) {
          if (section.id === 'Global' || section.id === 'Emoji') {
            continue
          }

          if (section.emotes && Array.isArray(section.emotes)) {
            allEmotes = section.emotes.map((emote: any) => ({
              id: emote.id,
              name: emote.name,
              channel_id: emote.channel_id,
              subscribers_only: emote.subscribers_only || false
            }))
            break
          }
        }
      } else if (emotesData && Array.isArray(emotesData.emotes)) {
        allEmotes = emotesData.emotes
      } else if (emotesData && Array.isArray(emotesData.data)) {
        allEmotes = emotesData.data
      }

      const channelEmotes = allEmotes.filter(emote => !globalEmoteIds.has(emote.id))
      this.channelEmotesCache.set(channelSlug, channelEmotes)

      return channelEmotes
    } catch (error) {
      console.error(`[EmoteService] Failed to fetch emotes for ${channelSlug}:`, error)
      return []
    }
  }

  async fetchAllEmotes(channelSlug: string): Promise<{ global: KickEmote[]; channel: KickEmote[] }> {
    try {
      const [global, channel] = await Promise.all([
        this.fetchGlobalEmotes(),
        this.fetchChannelEmotes(channelSlug)
      ])

      return { global, channel }
    } catch (error) {
      console.error('[EmoteService] Failed to fetch all emotes:', error)
      throw error
    }
  }
}
