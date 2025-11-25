export interface EmoteData {
  id: number
  name: string
  channel_id?: number | null
  subscriber_only?: boolean
  image_url?: string
}

declare global {
  interface Window {
    chatarooAPI: {
      login: () => Promise<any>
      logout: () => Promise<any>
      getAuthStatus: () => Promise<any>
      sendMessage: (options: any) => Promise<any>
      fetchGlobalEmotes: () => Promise<{ success: boolean; data: any[]; error?: string }>
      fetchChannelEmotes: (channelSlug: string) => Promise<{ success: boolean; data: any[]; error?: string }>
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
      getSettings: () => Promise<{ success: boolean; data: any; error?: string }>
      updateSettings: (updates: any) => Promise<{ success: boolean; data: any; error?: string }>
      resetSettings: () => Promise<{ success: boolean; data: any; error?: string }>
    }
  }
}

export class EmoteService {
  private globalEmotes: EmoteData[] = []
  private channelEmotes: Map<string, EmoteData[]> = new Map()

  async fetchGlobalEmotes(): Promise<EmoteData[]> {
    if (this.globalEmotes.length > 0) {
      return this.globalEmotes
    }

    try {
      const response = await window.chatarooAPI.fetchGlobalEmotes()

      if (response.success && Array.isArray(response.data)) {
        this.globalEmotes = response.data.map((emote: any) => ({
          id: emote.id,
          name: emote.name || emote.code,
          channel_id: null,
          subscriber_only: false,
          image_url: `https://files.kick.com/emotes/${emote.id}/fullsize`
        }))
      }

      return this.globalEmotes
    } catch (error) {
      console.error('[EmoteService] Failed to fetch global emotes:', error)
      return []
    }
  }

  async fetchChannelEmotes(channelSlug: string): Promise<EmoteData[]> {
    if (this.channelEmotes.has(channelSlug)) {
      return this.channelEmotes.get(channelSlug)!
    }

    try {
      const response = await window.chatarooAPI.fetchChannelEmotes(channelSlug)

      let emotes: EmoteData[] = []
      if (response.success && Array.isArray(response.data)) {
        emotes = response.data.map((emote: any) => ({
          id: emote.id,
          name: emote.name || emote.code,
          channel_id: emote.channel_id,
          subscriber_only: emote.subscribers_only || emote.subscriber_only || false,
          image_url: `https://files.kick.com/emotes/${emote.id}/fullsize`
        }))
      }

      this.channelEmotes.set(channelSlug, emotes)
      return emotes
    } catch (error) {
      console.error(`[EmoteService] Failed to fetch emotes for channel ${channelSlug}:`, error)
      return []
    }
  }

  async getAllEmotesForChannel(channelSlug: string): Promise<EmoteData[]> {
    const [global, channel] = await Promise.all([
      this.fetchGlobalEmotes(),
      this.fetchChannelEmotes(channelSlug)
    ])

    return [...global, ...channel]
  }

  searchEmotes(emotes: EmoteData[], query: string): EmoteData[] {
    const lowerQuery = query.toLowerCase()
    return emotes.filter(emote =>
      emote.name.toLowerCase().includes(lowerQuery)
    )
  }

  formatEmoteForMessage(emote: EmoteData): string {
    return `[emote:${emote.id}:${emote.name}]`
  }
}

export const emoteService = new EmoteService()
