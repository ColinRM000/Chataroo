export interface KickUser {
  id: number
  username: string
  slug: string
  profile_picture?: string
  is_verified: boolean
}

export interface KickBadge {
  type: string
  text: string
  count?: number
}

export interface KickIdentity {
  username_color?: string
  badges?: KickBadge[]
}

export interface KickSender extends KickUser {
  identity: KickIdentity
  // Additional fields that may be present in chat messages
  is_subscribed?: boolean
  is_follower?: boolean
  months_subscribed?: number
  subscribed_for?: number // Subscription duration in months
  following_since?: string // ISO date string
}

export interface KickEmote {
  emote_id: string
  positions: [number, number][]
}

export interface KickChatMessage {
  id?: string // Pusher event field
  message_id?: string // Alternative field name (kept for backwards compatibility)
  content: string
  sender: KickSender
  broadcaster: KickUser
  emotes?: KickEmote[]
  replies_to?: string
  created_at: string
  type?: 'user' | 'system' | 'reply' // System messages for moderation actions, etc.
  deleted?: boolean // Message was deleted by mod/user
  metadata?: {
    original_sender?: {
      id: number
      username: string
      slug: string
    }
    original_message?: {
      id: string
      content: string
    }
    message_ref?: string
    moderation_target?: {
      id: number
      username: string
      slug: string
    }
  }
}

export interface KickChannel {
  id: number
  user_id: number
  slug: string
  user?: {
    id: number
    username: string
    profile_pic?: string
  }
  chatroom: {
    id: number
    channel_id: number
  }
  livestream?: {
    id: number
    is_live: boolean
    viewer_count: number
  }
}

export interface KickUserChannelStats {
  id: number
  username: string
  slug: string
  profile_pic: string | null
  is_staff: boolean
  is_channel_owner: boolean
  is_moderator: boolean
  badges: any[]
  following_since: string | null // ISO date string when user started following
  subscribed_for: number // Number of months subscribed
  banned: any | null
}

export interface ConnectedChannel {
  slug: string
  chatroomId: number
  channelId: number // Channel ID (different from userId)
  messages: KickChatMessage[]
  profilePicture?: string
  isLive: boolean
  viewerCount: number
  userId: number // Broadcaster user ID for sending messages
  activeChatters: Map<string, number> // Map of username -> last message timestamp (for 10-minute tracking)
  isModerator: boolean // Whether the current user is a moderator in this channel
  followerCount?: number // Number of followers for this channel
  followerCountChanged?: boolean // Flag to trigger blink animation when follower count changes
  // Persistent analytics (not affected by message buffer trimming)
  analytics?: {
    sessionStart: number // Timestamp when channel was connected
    totalMessages: number // Total messages received this session
    chatterCounts: Map<string, number> // Username -> message count
    emoteCounts: Map<string, { id: string; name: string; count: number; source?: 'kick' | '7tv' | 'bttv' }> // Emote tracking
  }
}
