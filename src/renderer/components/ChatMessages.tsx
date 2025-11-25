import React, { memo, useLayoutEffect, useEffect, useRef, useCallback, useState } from 'react'
import { getUsernameColor, parseEmotes, parseThirdPartyEmotes } from '../utils'

interface KickChatMessage {
  id: string
  message_id?: string
  content: string
  type?: string
  sender: {
    id: number
    username: string
    slug: string
    is_verified?: boolean
    identity?: {
      color?: string
      badges?: Array<{
        type: string
        text: string
        count?: number
      }>
    }
  }
  broadcaster?: any
  created_at: string
  deleted?: boolean
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
  }
}

interface ChatMessagesProps {
  messages: KickChatMessage[]
  channelSlug: string
  thirdPartyEmoteMap: Map<string, any>
  settings: any
  currentAccentColor: string
  userInfo: any
  isAuthenticated: boolean
  isModerator: boolean
  activeChannelUserId: number
  onUsernameClick: (username: string, message: KickChatMessage) => void
  onReply: (message: KickChatMessage) => void
  onTimeout?: (userId: number, username: string, broadcasterUserId: number) => void
  onBan?: (userId: number, username: string, broadcasterUserId: number) => void
  onScrollStateChange: (showJumpButton: boolean) => void
  containerRef: React.RefObject<HTMLDivElement>
  variant?: 'main' | 'popout'
}

// Format timestamp helper
const formatTimestamp = (timestamp: string, use12Hour: boolean = false) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: use12Hour
  })
}

// Individual message component - memoized to prevent unnecessary re-renders
const ChatMessage = memo(({
  message,
  thirdPartyEmoteMap,
  settings,
  currentAccentColor,
  userInfo,
  isAuthenticated,
  isModerator,
  activeChannelUserId,
  onUsernameClick,
  onReply,
  onTimeout,
  onBan,
  onJumpToMessage,
  variant = 'main'
}: {
  message: KickChatMessage
  thirdPartyEmoteMap: Map<string, any>
  settings: any
  currentAccentColor: string
  userInfo: any
  isAuthenticated: boolean
  isModerator: boolean
  activeChannelUserId: number
  onUsernameClick: (username: string, message: KickChatMessage) => void
  onReply: (message: KickChatMessage) => void
  onTimeout?: (userId: number, username: string, broadcasterUserId: number) => void
  onBan?: (userId: number, username: string, broadcasterUserId: number) => void
  onJumpToMessage: (messageId: string) => void
  variant?: 'main' | 'popout'
}) => {
  // Class name prefix based on variant
  const prefix = variant === 'popout' ? 'popout-' : ''
  // Handle system messages
  if (message.type === 'system') {
    // Parse system message content and make usernames clickable
    const renderSystemContent = () => {
      const content = message.content || ''
      const parts: (string | JSX.Element)[] = []

      // More specific patterns to match usernames in system messages
      const targetUserRegex = /^([a-zA-Z0-9_-]+)(?:'s| was)/
      const moderatorRegex = /by ([a-zA-Z0-9_-]+)$/

      let lastIndex = 0
      const matches: Array<{ username: string; index: number; length: number }> = []

      // Find target user (at the start of message)
      const targetMatch = content.match(targetUserRegex)
      if (targetMatch) {
        matches.push({
          username: targetMatch[1],
          index: 0,
          length: targetMatch[1].length
        })
      }

      // Find moderator (after "by")
      const moderatorMatch = content.match(moderatorRegex)
      if (moderatorMatch) {
        const index = content.lastIndexOf('by ') + 3
        matches.push({
          username: moderatorMatch[1],
          index: index,
          length: moderatorMatch[1].length
        })
      }

      // Build parts with clickable usernames
      matches.forEach((m, i) => {
        if (m.index > lastIndex) {
          parts.push(content.substring(lastIndex, m.index))
        }

        // Create minimal message for API lookup
        const minimalMessage: KickChatMessage = {
          id: `system-lookup-${m.username}`,
          content: '',
          sender: {
            id: 0,
            username: m.username,
            slug: m.username,
            is_verified: false,
            identity: { badges: [] }
          },
          broadcaster: message.broadcaster,
          created_at: message.created_at
        }

        parts.push(
          <span
            key={`username-${i}`}
            style={{
              color: getUsernameColor(m.username),
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'underline'
            }}
            onClick={(e) => {
              e.stopPropagation()
              onUsernameClick(m.username, minimalMessage)
            }}
            title="Click to view user info"
          >
            {m.username}
          </span>
        )

        lastIndex = m.index + m.length
      })

      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex))
      }

      return parts.length > 0 ? parts : content
    }

    return (
      <div className={`${prefix}message ${prefix}system-message`}>
        {variant === 'main' && <span className="timestamp">{formatTimestamp(message.created_at, settings?.chat?.use12HourTime)}</span>}
        <span className={`${prefix}system-content`}>🛡️ {renderSystemContent()}</span>
      </div>
    )
  }

  const username = message.sender?.username || 'Unknown'
  const color = getUsernameColor(username)
  const badges = message.sender?.identity?.badges || []

  // Parse emotes
  const kickEmoteParts = parseEmotes(message.content || '')
  const contentParts = parseThirdPartyEmotes(kickEmoteParts, thirdPartyEmoteMap)

  // Determine highlight class based on message properties
  let highlightClass = ''

  // Highlight prefix differs between main and popout
  const highlightPrefix = variant === 'popout' ? 'popout-highlight-' : 'message-highlight-'

  // Check for broadcaster badge (popout only)
  if (variant === 'popout' && badges.some(badge => badge.type === 'broadcaster')) {
    highlightClass = `${highlightPrefix}broadcaster`
  }

  // Check for mention (highest priority for main)
  if (!highlightClass && variant === 'main' && settings?.highlights?.mentions?.enabled && userInfo?.username) {
    const messageContent = message.content || ''
    const mentionPattern = new RegExp(`@${userInfo.username}\\b`, 'i')
    if (mentionPattern.test(messageContent)) {
      highlightClass = `${highlightPrefix}mention`
    }
  }

  // Check for moderator badge
  if (!highlightClass && settings?.highlights?.moderators?.enabled) {
    if (badges.some(badge => badge.type === 'moderator')) {
      highlightClass = `${highlightPrefix}moderator`
    }
  }

  // Check for verified badge
  if (!highlightClass && settings?.highlights?.verified?.enabled) {
    if (badges.some(badge => badge.type === 'verified')) {
      highlightClass = `${highlightPrefix}verified`
    }
  }

  // Check for VIP badge
  if (!highlightClass && settings?.highlights?.vip?.enabled) {
    if (badges.some(badge => badge.type === 'vip')) {
      highlightClass = `${highlightPrefix}vip`
    }
  }

  // Check for subscriber badge
  if (!highlightClass && settings?.highlights?.subscribers?.enabled) {
    if (badges.some(badge => badge.type === 'subscriber')) {
      highlightClass = `${highlightPrefix}subscriber`
    }
  }

  // Check for founder badge
  if (!highlightClass && settings?.highlights?.founder?.enabled) {
    if (badges.some(badge => badge.type === 'founder')) {
      highlightClass = `${highlightPrefix}founder`
    }
  }

  // Check for OG badge
  if (!highlightClass && settings?.highlights?.og?.enabled) {
    if (badges.some(badge => badge.type === 'og' || badge.type === 'OG')) {
      highlightClass = `${highlightPrefix}og`
    }
  }

  // Check for sub gifter badge (lowest priority)
  if (!highlightClass && settings?.highlights?.subGifters?.enabled) {
    if (badges.some(badge =>
      badge.type === 'sub_gifter' ||
      badge.type === 'subgifter' ||
      badge.type === 'sub-gifter' ||
      badge.text?.toLowerCase().includes('gifter')
    )) {
      highlightClass = `${highlightPrefix}subgifter`
    }
  }

  return (
    <div className={`${prefix}message ${highlightClass} ${message.deleted ? `${prefix}message-deleted` : ''}`} data-message-id={message.id || message.message_id}>
      {/* Reply preview */}
      {message.type === 'reply' && message.metadata?.original_sender && message.metadata?.original_message && (
        <div
          className={`${prefix}reply-preview`}
          onClick={() => onJumpToMessage(message.metadata!.original_message!.id)}
        >
          <span className={`${prefix}reply-icon`}>↩</span>
          <span className={`${prefix}reply-to`}>Replying to </span>
          <span
            className={`${prefix}reply-username`}
            style={{ color: getUsernameColor(message.metadata.original_sender.username) }}
          >
            @{message.metadata.original_sender.username}
          </span>
          <span className={`${prefix}reply-text`}>: {(() => {
            const replyContent = message.metadata!.original_message!.content
            let parsedReply = parseEmotes(replyContent)
            parsedReply = parseThirdPartyEmotes(parsedReply, thirdPartyEmoteMap)
            return parsedReply
          })()}</span>
        </div>
      )}

      <div className={`${prefix}message-main`}>
        {variant === 'main' && <span className="timestamp">{formatTimestamp(message.created_at, settings?.chat?.use12HourTime)}</span>}

        {badges.length > 0 && (
          <span className={`${prefix}badges`}>
            {badges.map((badge, i) => {
              const isSubGifter = badge.type === 'sub_gifter' ||
                badge.type === 'subgifter' ||
                badge.type === 'sub-gifter' ||
                badge.text?.toLowerCase().includes('gifter')

              return (
                <span key={i} className={`${prefix}badge ${prefix}badge-${badge.type}`} title={badge.text}>
                  {isSubGifter ? '🎁' : badge.text}
                </span>
              )
            })}
          </span>
        )}

        <span
          className={`${prefix}username`}
          style={{ color, cursor: variant === 'popout' ? 'pointer' : undefined }}
          onClick={() => onUsernameClick(username, message)}
        >
          {username}
        </span>

        <span className={`${prefix}separator`}>: </span>

        <span className={`${prefix}content`}>{contentParts}</span>

        {/* Deleted indicator */}
        {message.deleted && (
          <span className={`${prefix}deleted-indicator`}>(Deleted by a Moderator)</span>
        )}

        {/* Reply button */}
        {isAuthenticated && !message.deleted && (
          <button
            className={`${prefix}reply-btn`}
            onClick={(e) => {
              e.stopPropagation()
              onReply(message)
            }}
            title="Reply to this message"
          >
            ↩
          </button>
        )}

        {/* Quick mod actions */}
        {isAuthenticated && !message.deleted && isModerator && message.sender?.id && userInfo?.id !== message.sender.id && onTimeout && onBan && (
          <>
            <button
              className="quick-mod-btn timeout-btn"
              onClick={(e) => {
                e.stopPropagation()
                onTimeout(message.sender.id, message.sender.username, activeChannelUserId)
              }}
              title="Timeout 5 min"
            >
              ⏱
            </button>
            <button
              className="quick-mod-btn ban-btn"
              onClick={(e) => {
                e.stopPropagation()
                onBan(message.sender.id, message.sender.username, activeChannelUserId)
              }}
              title="Permanent ban"
            >
              🚫
            </button>
          </>
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if message itself changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.deleted === nextProps.message.deleted &&
    prevProps.settings === nextProps.settings &&
    prevProps.currentAccentColor === nextProps.currentAccentColor &&
    prevProps.isAuthenticated === nextProps.isAuthenticated &&
    prevProps.isModerator === nextProps.isModerator &&
    prevProps.userInfo === nextProps.userInfo
  )
})

// Main ChatMessages component - handles scroll logic
export const ChatMessages = memo(({
  messages,
  channelSlug,
  thirdPartyEmoteMap,
  settings,
  currentAccentColor,
  userInfo,
  isAuthenticated,
  isModerator,
  activeChannelUserId,
  onUsernameClick,
  onReply,
  onTimeout,
  onBan,
  onScrollStateChange,
  containerRef,
  variant = 'main'
}: ChatMessagesProps) => {
  const userPausedRef = useRef(false)
  const isAutoScrollingRef = useRef(false)

  const handleJumpToMessage = useCallback((messageId: string) => {
    const element = document.querySelector(`[data-message-id="${messageId}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('message-flash')
      setTimeout(() => element.classList.remove('message-flash'), 1500)
    }
  }, [])

  // Auto-scroll when messages change
  useLayoutEffect(() => {
    if (messages.length === 0) return

    const container = containerRef.current
    if (!container) return

    if (!userPausedRef.current) {
      isAutoScrollingRef.current = true
      container.scrollTop = 0
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false
      })
    }
  }, [messages, containerRef])

  // Scroll detection
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (isAutoScrollingRef.current) return

      const scrollPos = Math.abs(container.scrollTop)

      if (scrollPos > 150) {
        if (!userPausedRef.current) {
          userPausedRef.current = true
          onScrollStateChange(true)
        }
      } else if (scrollPos < 50) {
        if (userPausedRef.current) {
          userPausedRef.current = false
          onScrollStateChange(false)
        }
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef, onScrollStateChange])

  const containerClass = variant === 'popout' ? 'popout-messages' : 'chat-messages'

  return (
    <div className={containerClass} ref={containerRef}>
      {messages.length === 0 ? (
        <div className={variant === 'popout' ? 'popout-welcome-message' : 'welcome-message'}>
          Connected to {channelSlug}'s chat! Waiting for messages...
        </div>
      ) : (
        [...messages].reverse().map((message) => (
          <ChatMessage
            key={message.id || message.message_id}
            message={message}
            thirdPartyEmoteMap={thirdPartyEmoteMap}
            settings={settings}
            currentAccentColor={currentAccentColor}
            userInfo={userInfo}
            isAuthenticated={isAuthenticated}
            isModerator={isModerator}
            activeChannelUserId={activeChannelUserId}
            onUsernameClick={onUsernameClick}
            onReply={onReply}
            onTimeout={onTimeout}
            onBan={onBan}
            onJumpToMessage={handleJumpToMessage}
            variant={variant}
          />
        ))
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Only re-render if these specific props changed
  return (
    prevProps.messages === nextProps.messages &&
    prevProps.settings === nextProps.settings &&
    prevProps.currentAccentColor === nextProps.currentAccentColor &&
    prevProps.thirdPartyEmoteMap === nextProps.thirdPartyEmoteMap &&
    prevProps.isAuthenticated === nextProps.isAuthenticated &&
    prevProps.isModerator === nextProps.isModerator &&
    prevProps.userInfo === nextProps.userInfo &&
    prevProps.channelSlug === nextProps.channelSlug
  )
})

export default ChatMessages
