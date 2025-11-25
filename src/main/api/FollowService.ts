import axios from 'axios'

export interface FollowResponse {
  data?: object
  message?: string
}

export interface FollowedChannel {
  id: number
  slug: string
  user?: {
    id: number
    username: string
  }
}

export class FollowService {
  private baseUrl = 'https://kick.com/api/v2'
  private getAccessToken: () => string | null

  constructor(getAccessToken: () => string | null) {
    this.getAccessToken = getAccessToken
  }

  async followChannel(channelSlug: string): Promise<FollowResponse> {
    const accessToken = this.getAccessToken()
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/channels/${channelSlug}/follow`,
        {},
        { headers: this.getHeaders(accessToken) }
      )

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Channel '${channelSlug}' not found`)
        }
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please re-authenticate.')
        }
        throw new Error(`Failed to follow channel: ${error.message}`)
      }
      throw error
    }
  }

  async unfollowChannel(channelSlug: string): Promise<FollowResponse> {
    const accessToken = this.getAccessToken()
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.delete(
        `${this.baseUrl}/channels/${channelSlug}/follow`,
        { headers: this.getHeaders(accessToken) }
      )

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Channel '${channelSlug}' not found or not following`)
        }
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please re-authenticate.')
        }
        throw new Error(`Failed to unfollow channel: ${error.message}`)
      }
      throw error
    }
  }

  async getFollowedChannels(): Promise<FollowedChannel[]> {
    const accessToken = this.getAccessToken()
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/channels/followed`,
        { headers: this.getHeaders(accessToken) }
      )

      return response.data.data || response.data || []
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please re-authenticate.')
        }
        throw new Error(`Failed to fetch followed channels: ${error.message}`)
      }
      throw error
    }
  }

  async checkFollowStatus(channelSlug: string): Promise<{ isFollowing: boolean }> {
    try {
      const followedChannels = await this.getFollowedChannels()
      const isFollowing = followedChannels.some(
        (channel) => channel.slug.toLowerCase() === channelSlug.toLowerCase()
      )
      return { isFollowing }
    } catch (error) {
      console.error('Error checking follow status:', error)
      return { isFollowing: false }
    }
  }

  private getHeaders(accessToken: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }
}
