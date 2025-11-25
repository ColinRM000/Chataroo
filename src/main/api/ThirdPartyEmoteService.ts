import axios from 'axios'

export interface ThirdPartyEmote {
  id: string
  name: string
  url: string
  url2x: string
  url4x: string
  animated: boolean
  source: '7tv' | 'bttv'
}

interface CacheEntry {
  emotes: ThirdPartyEmote[]
  timestamp: number
}

// 7TV: Full Kick support (global + channel)
// BTTV: Global emotes only (no Kick channel support)
export class ThirdPartyEmoteService {
  private globalCache: {
    seventv: CacheEntry | null
    bttv: CacheEntry | null
  } = { seventv: null, bttv: null }

  private channelCache: Map<string, CacheEntry> = new Map()

  private readonly CHANNEL_CACHE_TTL = 10 * 60 * 1000
  private readonly GLOBAL_CACHE_TTL = 30 * 60 * 1000

  async fetch7TVGlobal(): Promise<ThirdPartyEmote[]> {
    if (this.globalCache.seventv &&
        Date.now() - this.globalCache.seventv.timestamp < this.GLOBAL_CACHE_TTL) {
      return this.globalCache.seventv.emotes
    }

    try {
      const response = await axios.get('https://7tv.io/v3/emote-sets/global', {
        timeout: 10000
      })

      const emotes: ThirdPartyEmote[] = (response.data.emotes || []).map((emote: any) => ({
        id: emote.id,
        name: emote.name,
        url: `https://cdn.7tv.app/emote/${emote.id}/1x.webp`,
        url2x: `https://cdn.7tv.app/emote/${emote.id}/2x.webp`,
        url4x: `https://cdn.7tv.app/emote/${emote.id}/4x.webp`,
        animated: emote.data?.animated ?? false,
        source: '7tv' as const
      }))

      this.globalCache.seventv = { emotes, timestamp: Date.now() }
      return emotes
    } catch (error) {
      console.error('[ThirdPartyEmoteService] Failed to fetch 7TV global emotes:', error)
      return []
    }
  }

  async fetch7TVChannel(kickUsername: string): Promise<ThirdPartyEmote[]> {
    const cacheKey = `7tv:${kickUsername.toLowerCase()}`
    const cached = this.channelCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CHANNEL_CACHE_TTL) {
      return cached.emotes
    }

    const variations = [
      kickUsername.toLowerCase(),
      kickUsername,
      kickUsername.charAt(0).toUpperCase() + kickUsername.slice(1).toLowerCase()
    ]

    for (const username of variations) {
      try {
        const response = await axios.get(`https://7tv.io/v3/users/kick/${username}`, {
          timeout: 10000
        })

        if (!response.data.emote_set?.emotes) {
          continue
        }

        const emotes: ThirdPartyEmote[] = response.data.emote_set.emotes.map((emote: any) => ({
          id: emote.id,
          name: emote.name,
          url: `https://cdn.7tv.app/emote/${emote.id}/1x.webp`,
          url2x: `https://cdn.7tv.app/emote/${emote.id}/2x.webp`,
          url4x: `https://cdn.7tv.app/emote/${emote.id}/4x.webp`,
          animated: emote.data?.animated ?? false,
          source: '7tv' as const
        }))

        this.channelCache.set(cacheKey, { emotes, timestamp: Date.now() })
        return emotes
      } catch (error: any) {
        if (error.response?.status === 404) {
          continue
        } else {
          console.error(`[ThirdPartyEmoteService] Failed to fetch 7TV emotes for ${username}:`, error.message)
          break
        }
      }
    }

    try {
      const emotes = await this.fetch7TVChannelViaGQL(kickUsername)
      if (emotes.length > 0) {
        this.channelCache.set(cacheKey, { emotes, timestamp: Date.now() })
        return emotes
      }
    } catch (error: any) {
      console.error(`[ThirdPartyEmoteService] GQL search failed:`, error.message)
    }

    return []
  }

  private async fetch7TVChannelViaGQL(kickUsername: string): Promise<ThirdPartyEmote[]> {
    const query = `
      query SearchUsers($query: String!) {
        users(query: $query) {
          id
          username
          connections {
            platform
            username
            emote_set_id
          }
        }
      }
    `

    const response = await axios.post('https://7tv.io/v3/gql', {
      query,
      variables: { query: kickUsername }
    }, { timeout: 10000 })

    const users = response.data?.data?.users || []

    const user = users.find((u: any) =>
      u.connections?.some((c: any) =>
        c.platform === 'KICK' &&
        c.username.toLowerCase() === kickUsername.toLowerCase()
      )
    )

    if (!user) {
      return []
    }

    const kickConnection = user.connections.find((c: any) => c.platform === 'KICK')
    if (!kickConnection?.emote_set_id) {
      return []
    }

    const emoteSetResponse = await axios.get(`https://7tv.io/v3/emote-sets/${kickConnection.emote_set_id}`, {
      timeout: 10000
    })

    const emotes: ThirdPartyEmote[] = (emoteSetResponse.data.emotes || []).map((emote: any) => ({
      id: emote.id,
      name: emote.name,
      url: `https://cdn.7tv.app/emote/${emote.id}/1x.webp`,
      url2x: `https://cdn.7tv.app/emote/${emote.id}/2x.webp`,
      url4x: `https://cdn.7tv.app/emote/${emote.id}/4x.webp`,
      animated: emote.data?.animated ?? false,
      source: '7tv' as const
    }))

    return emotes
  }

  async fetchBTTVGlobal(): Promise<ThirdPartyEmote[]> {
    if (this.globalCache.bttv &&
        Date.now() - this.globalCache.bttv.timestamp < this.GLOBAL_CACHE_TTL) {
      return this.globalCache.bttv.emotes
    }

    try {
      const response = await axios.get('https://api.betterttv.net/3/cached/emotes/global', {
        timeout: 10000
      })

      const emotes: ThirdPartyEmote[] = (response.data || []).map((emote: any) => ({
        id: emote.id,
        name: emote.code,
        url: `https://cdn.betterttv.net/emote/${emote.id}/1x`,
        url2x: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
        url4x: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
        animated: emote.animated ?? emote.imageType === 'gif',
        source: 'bttv' as const
      }))

      this.globalCache.bttv = { emotes, timestamp: Date.now() }
      return emotes
    } catch (error) {
      console.error('[ThirdPartyEmoteService] Failed to fetch BTTV global emotes:', error)
      return []
    }
  }

  async fetchAllForChannel(kickUsername: string): Promise<{
    seventvGlobal: ThirdPartyEmote[]
    seventvChannel: ThirdPartyEmote[]
    bttvGlobal: ThirdPartyEmote[]
  }> {
    const [seventvGlobal, seventvChannel, bttvGlobal] = await Promise.all([
      this.fetch7TVGlobal(),
      this.fetch7TVChannel(kickUsername),
      this.fetchBTTVGlobal()
    ])

    return { seventvGlobal, seventvChannel, bttvGlobal }
  }

  clearCache(): void {
    this.globalCache = { seventv: null, bttv: null }
    this.channelCache.clear()
  }
}
