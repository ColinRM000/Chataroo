import axios from 'axios'

export interface ModerationBanRequest {
  broadcaster_user_id: number
  user_id: number
  duration?: number // 1-10080 minutes, omit for permanent ban
  reason?: string   // Max 100 characters
}

export interface ModerationResponse {
  data: object
  message: string
}

export class ModerationService {
  private baseUrl = 'https://api.kick.com/public/v1'
  private getAccessToken: () => string | null

  constructor(getAccessToken: () => string | null) {
    this.getAccessToken = getAccessToken
  }

  async banUser(
    broadcasterUserId: number,
    userId: number,
    reason?: string
  ): Promise<ModerationResponse> {
    return this.createBan({
      broadcaster_user_id: broadcasterUserId,
      user_id: userId,
      reason
    })
  }

  async timeoutUser(
    broadcasterUserId: number,
    userId: number,
    durationMinutes: number,
    reason?: string
  ): Promise<ModerationResponse> {
    if (durationMinutes < 1 || durationMinutes > 10080) {
      throw new Error('Duration must be between 1 and 10080 minutes (7 days)')
    }

    return this.createBan({
      broadcaster_user_id: broadcasterUserId,
      user_id: userId,
      duration: durationMinutes,
      reason,
    })
  }

  async unbanUser(
    broadcasterUserId: number,
    userId: number
  ): Promise<ModerationResponse> {
    const accessToken = this.getAccessToken()
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    const response = await axios.delete(`${this.baseUrl}/moderation/bans`, {
      headers: this.getHeaders(accessToken),
      data: {
        broadcaster_user_id: broadcasterUserId,
        user_id: userId,
      },
    })

    return response.data
  }

  private async createBan(
    request: ModerationBanRequest
  ): Promise<ModerationResponse> {
    const accessToken = this.getAccessToken()
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    if (request.reason && request.reason.length > 100) {
      throw new Error('Reason must be 100 characters or less')
    }

    const response = await axios.post(
      `${this.baseUrl}/moderation/bans`,
      request,
      { headers: this.getHeaders(accessToken) }
    )

    return response.data
  }

  private getHeaders(accessToken: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  }
}
