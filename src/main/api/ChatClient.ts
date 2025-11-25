import axios from 'axios'
import { TokenStorage } from '../auth/TokenStorage'
import { OAuthManager } from '../auth/OAuthManager'

interface SendMessageOptions {
  content: string
  broadcasterUserId: number
  replyToMessageId?: string
  type?: 'user' | 'bot'
}

interface SendMessageResult {
  success: boolean
  messageId?: string
  message: string
}

export class ChatClient {
  private tokenStorage: TokenStorage
  private oauthManager: OAuthManager
  private baseUrl = 'https://api.kick.com/public/v1'

  constructor(tokenStorage: TokenStorage, oauthManager: OAuthManager) {
    this.tokenStorage = tokenStorage
    this.oauthManager = oauthManager
  }

  private async getValidAccessToken(): Promise<string> {
    if (this.tokenStorage.isTokenExpired()) {
      const tokens = this.tokenStorage.getTokens()

      if (!tokens || !tokens.refreshToken) {
        throw new Error('No refresh token available - re-authentication required')
      }

      const newTokens = await this.oauthManager.refreshAccessToken(tokens.refreshToken)
      this.tokenStorage.saveTokens(newTokens)
      return newTokens.accessToken
    }

    const tokens = this.tokenStorage.getTokens()
    if (!tokens) {
      throw new Error('No access token available - authentication required')
    }
    return tokens.accessToken
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const { content, broadcasterUserId, replyToMessageId, type = 'user' } = options

    if (!content || content.length === 0) {
      throw new Error('Message content cannot be empty')
    }
    if (content.length > 500) {
      throw new Error('Message content exceeds 500 character limit')
    }

    const accessToken = await this.getValidAccessToken()

    const requestBody: any = {
      content,
      type
    }

    if (type === 'user') {
      requestBody.broadcaster_user_id = broadcasterUserId
    }

    if (replyToMessageId) {
      requestBody.reply_to_message_id = replyToMessageId
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return {
        success: response.data.data?.is_sent || true,
        messageId: response.data.data?.message_id,
        message: response.data.message || 'Message sent successfully'
      }
    } catch (error: any) {
      if (error.response) {
        switch (error.response.status) {
          case 400:
            throw new Error(`Bad request: ${error.response.data.message || 'Invalid parameters'}`)
          case 401:
            throw new Error('Unauthorized - token may be invalid or expired')
          case 403:
            throw new Error('Forbidden - you may not have permission to send messages to this channel')
          case 429:
            throw new Error('Rate limited - too many messages sent too quickly')
          case 500:
            throw new Error('Kick server error - please try again later')
          default:
            throw new Error(`API error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`)
        }
      }
      throw error
    }
  }

  async getUserInfo(): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken()

      try {
        const meResponse = await axios.get(
          'https://kick.com/api/v2/me',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        )

        if (meResponse.data) {
          return {
            username: meResponse.data.username || meResponse.data.slug,
            slug: meResponse.data.slug,
            profile_pic: meResponse.data.profile_pic || meResponse.data.profilepic
          }
        }
      } catch (meError: any) {
        // Fall through to v1 attempt
      }

      try {
        const userResponse = await axios.get(
          'https://kick.com/api/v1/user',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        )
        return userResponse.data
      } catch (v1Error: any) {
        // Fall through
      }

      return null
    } catch (error: any) {
      console.error('Failed to get user info:', error)
      return null
    }
  }
}
