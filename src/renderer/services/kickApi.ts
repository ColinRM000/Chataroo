import axios from 'axios'
import type { KickChannel, KickUserChannelStats } from '../types'

const KICK_API_BASE = 'https://kick.com/api'

interface FollowResponse {
  message?: string
  data?: any
}

export class KickApiService {
  private accessToken: string | null = null

  setAccessToken(token: string | null) {
    this.accessToken = token
  }

  async getChannel(channelSlug: string): Promise<KickChannel> {
    try {
      const response = await axios.get<KickChannel>(
        `${KICK_API_BASE}/v2/channels/${channelSlug}`
      )
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        if (channelSlug.includes('_')) {
          const normalizedSlug = channelSlug.replace(/_/g, '-')

          try {
            const response = await axios.get<KickChannel>(
              `${KICK_API_BASE}/v2/channels/${normalizedSlug}`
            )
            return response.data
          } catch (retryError) {
            if (axios.isAxiosError(retryError)) {
              throw new Error(`Channel '${channelSlug}' (tried as '${normalizedSlug}') not found`)
            }
            throw retryError
          }
        }
        throw new Error(`Channel '${channelSlug}' not found`)
      }

      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch channel: ${error.message}`)
      }
      throw error
    }
  }

  async getChatroomId(channelSlug: string): Promise<number> {
    const channel = await this.getChannel(channelSlug)
    return channel.chatroom.id
  }

  async getUserChannelStats(channelSlug: string, username: string): Promise<KickUserChannelStats> {
    try {
      const response = await axios.get<KickUserChannelStats>(
        `${KICK_API_BASE}/v2/channels/${channelSlug}/users/${username}`
      )
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        if (username.includes('_')) {
          const normalizedUsername = username.replace(/_/g, '-')

          try {
            const response = await axios.get<KickUserChannelStats>(
              `${KICK_API_BASE}/v2/channels/${channelSlug}/users/${normalizedUsername}`
            )
            return response.data
          } catch (retryError) {
            if (axios.isAxiosError(retryError)) {
              throw new Error(`User '${username}' (tried as '${normalizedUsername}') not found in channel '${channelSlug}'`)
            }
            throw retryError
          }
        }
        throw new Error(`User '${username}' not found in channel '${channelSlug}'`)
      }

      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch user channel stats: ${error.message}`)
      }
      throw error
    }
  }

  async followChannel(channelSlug: string): Promise<FollowResponse> {
    if (!this.accessToken) {
      throw new Error('Not authenticated - please log in first')
    }

    try {
      const response = await fetch(
        `${KICK_API_BASE}/v2/channels/${channelSlug}/follow`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include'
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to follow channel (${response.status}): ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to follow channel: ${error.message}`)
      }
      throw error
    }
  }

  async unfollowChannel(channelSlug: string): Promise<FollowResponse> {
    if (!this.accessToken) {
      throw new Error('Not authenticated - please log in first')
    }

    try {
      const response = await fetch(
        `${KICK_API_BASE}/v2/channels/${channelSlug}/follow`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json'
          },
          credentials: 'include'
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to unfollow channel (${response.status}): ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to unfollow channel: ${error.message}`)
      }
      throw error
    }
  }

  async checkFollowStatus(channelSlug: string): Promise<{ isFollowing: boolean }> {
    if (!this.accessToken) {
      return { isFollowing: false }
    }

    try {
      const response = await fetch(
        `${KICK_API_BASE}/v2/channels/followed`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json'
          },
          credentials: 'include'
        }
      )

      if (!response.ok) {
        console.error('Failed to fetch followed channels:', response.status)
        return { isFollowing: false }
      }

      const data = await response.json()
      const followedChannels = data.data || data || []

      const isFollowing = followedChannels.some(
        (channel: any) => channel.slug?.toLowerCase() === channelSlug.toLowerCase()
      )

      return { isFollowing }
    } catch (error) {
      console.error('Error checking follow status:', error)
      return { isFollowing: false }
    }
  }
}

export const kickApi = new KickApiService()
