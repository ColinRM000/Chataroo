import Pusher, { Channel } from 'pusher-js'
import type { KickChatMessage } from '../types'

const PUSHER_APP_KEY = '32cbd69e4b950bf97679'
const PUSHER_CLUSTER = 'us2'
const PUSHER_WS_HOST = 'ws-us2.pusher.com'
const CHAT_MESSAGE_EVENT = 'App\\Events\\ChatMessageEvent'
const USER_BANNED_EVENT = 'App\\Events\\UserBannedEvent'
const USER_UNBANNED_EVENT = 'App\\Events\\UserUnbannedEvent'
const MESSAGE_DELETED_EVENT = 'App\\Events\\MessageDeletedEvent'

export interface ModerationEvent {
  id: string
  user: {
    id: number
    username: string
    slug: string
  }
  banned_by?: {
    id: number
    username: string
    slug: string
  }
  unbanned_by?: {
    id: number
    username: string
    slug: string
  }
  permanent: boolean
  duration?: number // Minutes for timeout
  expires_at?: string
}

export interface MessageDeletedEvent {
  id: string
  message: {
    id: string
  }
  aiModerated: boolean
  violatedRules: string[]
}

export type MessageCallback = (message: KickChatMessage) => void
export type ModerationCallback = (event: ModerationEvent, type: 'ban' | 'unban') => void
export type MessageDeletedCallback = (event: MessageDeletedEvent) => void
export type ConnectionCallback = (connected: boolean) => void

export class KickChatService {
  private pusher: Pusher | null = null
  private channels: Map<number, Channel> = new Map()
  private messageCallbacks: Map<number, MessageCallback[]> = new Map()
  private moderationCallbacks: Map<number, ModerationCallback[]> = new Map()
  private messageDeletedCallbacks: Map<number, MessageDeletedCallback[]> = new Map()
  private connectionCallback: ConnectionCallback | null = null

  constructor() {
    this.initializePusher()
  }

  private initializePusher() {
    try {
      this.pusher = new Pusher(PUSHER_APP_KEY, {
        cluster: PUSHER_CLUSTER,
        wsHost: PUSHER_WS_HOST,
        wsPort: 443,
        wssPort: 443,
        forceTLS: true,
        disableStats: true,
        enabledTransports: ['ws', 'wss']
      })

      this.pusher.connection.bind('connected', () => {
        this.connectionCallback?.(true)
      })

      this.pusher.connection.bind('disconnected', () => {
        this.connectionCallback?.(false)
      })

      this.pusher.connection.bind('error', (error: any) => {
        console.error('Pusher connection error:', error)
        this.connectionCallback?.(false)
      })
    } catch (error) {
      console.error('Failed to initialize Pusher:', error)
      this.pusher = null
    }
  }

  subscribeToChannel(chatroomId: number, onMessage: MessageCallback, onModeration?: ModerationCallback, onMessageDeleted?: MessageDeletedCallback) {
    if (!this.pusher) {
      this.initializePusher()
    }

    if (!this.pusher) {
      throw new Error('Pusher not initialized')
    }

    if (this.channels.has(chatroomId)) {
      this.messageCallbacks.set(chatroomId, [onMessage])

      if (onModeration) {
        this.moderationCallbacks.set(chatroomId, [onModeration])
      }
      if (onMessageDeleted) {
        this.messageDeletedCallbacks.set(chatroomId, [onMessageDeleted])
      }
      return
    }

    const channelName = `chatrooms.${chatroomId}.v2`
    const channel = this.pusher.subscribe(channelName)
    this.channels.set(chatroomId, channel)

    this.messageCallbacks.set(chatroomId, [onMessage])
    if (onModeration) {
      this.moderationCallbacks.set(chatroomId, [onModeration])
    }
    if (onMessageDeleted) {
      this.messageDeletedCallbacks.set(chatroomId, [onMessageDeleted])
    }

    channel.bind(CHAT_MESSAGE_EVENT, (data: KickChatMessage) => {
      const callbacks = this.messageCallbacks.get(chatroomId) || []
      callbacks.forEach(cb => cb(data))
    })

    channel.bind(USER_BANNED_EVENT, (data: ModerationEvent) => {
      const callbacks = this.moderationCallbacks.get(chatroomId) || []
      callbacks.forEach(cb => cb(data, 'ban'))
    })

    channel.bind(USER_UNBANNED_EVENT, (data: ModerationEvent) => {
      const callbacks = this.moderationCallbacks.get(chatroomId) || []
      callbacks.forEach(cb => cb(data, 'unban'))
    })

    channel.bind(MESSAGE_DELETED_EVENT, (data: MessageDeletedEvent) => {
      const callbacks = this.messageDeletedCallbacks.get(chatroomId) || []
      callbacks.forEach(cb => cb(data))
    })

    channel.bind('pusher:subscription_error', (error: any) => {
      console.error(`Failed to subscribe to chatroom ${chatroomId}:`, error)
    })
  }

  unsubscribeFromChannel(chatroomId: number) {
    const channel = this.channels.get(chatroomId)
    if (channel) {
      channel.unbind_all()
      this.pusher?.unsubscribe(channel.name)
      this.channels.delete(chatroomId)
      this.messageCallbacks.delete(chatroomId)
      this.moderationCallbacks.delete(chatroomId)
      this.messageDeletedCallbacks.delete(chatroomId)
    }
  }

  onConnectionChange(callback: ConnectionCallback) {
    this.connectionCallback = callback
  }

  disconnect() {
    if (this.pusher) {
      this.channels.forEach((channel, chatroomId) => {
        this.unsubscribeFromChannel(chatroomId)
      })
      this.pusher.disconnect()
      this.pusher = null
    }
  }

  isConnected(): boolean {
    return this.pusher?.connection.state === 'connected'
  }
}

export const kickChat = new KickChatService()
