import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import Pusher from 'pusher-js'
import { parseEmotes, getUsernameColor, buildEmoteMap, parseThirdPartyEmotes } from './utils'
import { kickApi } from './services/kickApi'
import { emoteService } from './services/emoteService'
import { EmotePicker } from './components/EmotePicker'
import { ChatMessages } from './components/ChatMessages'
import { ConfirmModal } from './components/ConfirmModal'
import './PopoutChat.css'

interface Message {
  id: string
  content: string
  type?: string
  sender: {
    id: number
    username: string
    slug: string
    identity?: {
      color?: string
      badges?: Array<{
        type: string
        text: string
        count?: number
      }>
    }
  }
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
    message_ref?: string
  }
}

interface ChannelData {
  chatroomId: number
  channelSlug: string
  channelName: string
  profilePic?: string
  userId: number
  userSlug?: string
  messages?: Message[]
  isModerator?: boolean
}

declare global {
  interface Window {
    chatarooAPI: {
      sendMessage: (options: { content: string; broadcasterUserId: number; type: string; replyToMessageId?: string }) => Promise<any>
      getSettings: () => Promise<any>
      fetchGlobalEmotes: () => Promise<any>
      fetchChannelEmotes: (channelSlug: string) => Promise<any>
      fetchThirdPartyEmotes: (channelSlug: string) => Promise<any>
      onPopoutClose: (callback: () => void) => void
      closePopout: () => void
      setAlwaysOnTop: (value: boolean) => Promise<void>
      getPopoutData: () => Promise<ChannelData>
      timeoutUser: (options: { broadcasterUserId: number; userId: number; durationMinutes: number }) => Promise<any>
      banUser: (options: { broadcasterUserId: number; userId: number }) => Promise<any>
    }
  }
}

export const PopoutChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [channelData, setChannelData] = useState<ChannelData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [settings, setSettings] = useState<any>(null)
  const [channelEmotes, setChannelEmotes] = useState<any[]>([])
  const [thirdPartyEmotes, setThirdPartyEmotes] = useState<any>({
    seventvGlobal: [],
    seventvChannel: [],
    bttvGlobal: []
  })
  const [globalEmotes, setGlobalEmotes] = useState<any[]>([])
  const [showEmotePicker, setShowEmotePicker] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [activeChatters, setActiveChatters] = useState<Map<string, number>>(new Map())
  const [mySubEmotes, setMySubEmotes] = useState<any[]>([])
  const [showUserCard, setShowUserCard] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userCardData, setUserCardData] = useState<any>(null)
  const [loadingUserCard, setLoadingUserCard] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    confirmColor?: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLDivElement>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const channelRef = useRef<any>(null)

  const thirdPartyEmoteMap = React.useMemo(() => {
    return buildEmoteMap(
      thirdPartyEmotes,
      settings?.emotes?.enableSevenTV ?? false,
      settings?.emotes?.enableBTTV ?? false
    )
  }, [thirdPartyEmotes, settings?.emotes])

  // With column-reverse layout, scrollTop=0 means we're at the bottom
  const userPausedRef = useRef(false)
  const isAutoScrollingRef = useRef(false)

  const jumpToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      isAutoScrollingRef.current = true
      container.scrollTop = 0
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false
      })
    }
    userPausedRef.current = false
    setIsAtBottom(true)
    setShowJumpButton(false)
  }, [])

  const handleScrollStateChange = useCallback((showButton: boolean) => {
    setShowJumpButton(showButton)
    setIsAtBottom(!showButton)
  }, [])

  const handleReplyClick = useCallback((message: Message) => {
    setReplyingTo(message)
    messageInputRef.current?.focus()
  }, [])

  const handleTimeoutClick = useCallback(async (userId: number, username: string, broadcasterUserId: number) => {
    const performTimeout = async () => {
      try {
        const result = await window.chatarooAPI.timeoutUser({
          broadcasterUserId,
          userId,
          durationMinutes: 5
        })
        if (!result.success) {
          alert(result.error || 'Failed to timeout user')
        }
      } catch (err: any) {
        alert(err.message || 'Failed to timeout user')
      }
    }

    if (settings?.moderation?.skipConfirmation) {
      await performTimeout()
      return
    }

    setConfirmModal({
      isOpen: true,
      title: 'Timeout User',
      message: `Timeout ${username} for 5 minutes?`,
      confirmText: 'Timeout',
      confirmColor: '#ffa500',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        await performTimeout()
      }
    })
  }, [settings?.moderation?.skipConfirmation])

  const handleBanClick = useCallback(async (userId: number, username: string, broadcasterUserId: number) => {
    const performBan = async () => {
      try {
        const result = await window.chatarooAPI.banUser({
          broadcasterUserId,
          userId
        })
        if (!result.success) {
          alert(result.error || 'Failed to ban user')
        }
      } catch (err: any) {
        alert(err.message || 'Failed to ban user')
      }
    }

    if (settings?.moderation?.skipConfirmation) {
      await performBan()
      return
    }

    setConfirmModal({
      isOpen: true,
      title: 'Ban User',
      message: `Permanently ban ${username}? This action requires manual unbanning.`,
      confirmText: 'Ban',
      confirmColor: '#dc3545',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        await performBan()
      }
    })
  }, [settings?.moderation?.skipConfirmation])

  useEffect(() => {
    let previewElement: HTMLDivElement | null = null
    let hideTimeout: NodeJS.Timeout | null = null

    const showPreview = (emoteImg: HTMLImageElement) => {
      const emoteName = emoteImg.getAttribute('data-emote-name')
      const emoteSrc = emoteImg.getAttribute('data-emote-src')

      if (!emoteName || !emoteSrc) return

      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }

      if (previewElement) {
        previewElement.remove()
      }

      previewElement = document.createElement('div')
      previewElement.className = 'emote-hover-preview'
      previewElement.innerHTML = `
        <img src="${emoteSrc}" alt="${emoteName}" />
        <span class="emote-name">${emoteName}</span>
      `

      document.body.appendChild(previewElement)

      const rect = emoteImg.getBoundingClientRect()
      const previewRect = previewElement.getBoundingClientRect()

      let left = rect.left + (rect.width / 2) - (previewRect.width / 2)
      let top = rect.top - previewRect.height - 8

      if (left < 8) left = 8
      if (left + previewRect.width > window.innerWidth - 8) {
        left = window.innerWidth - previewRect.width - 8
      }
      if (top < 8) {
        top = rect.bottom + 8
      }

      previewElement.style.left = `${left}px`
      previewElement.style.top = `${top}px`
    }

    const hidePreview = () => {
      hideTimeout = setTimeout(() => {
        if (previewElement) {
          previewElement.remove()
          previewElement = null
        }
      }, 100)
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('emote') && target.tagName === 'IMG') {
        showPreview(target as HTMLImageElement)
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('emote') && target.tagName === 'IMG') {
        hidePreview()
      }
    }

    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('mouseout', handleMouseOut)

    return () => {
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      if (previewElement) {
        previewElement.remove()
      }
      if (hideTimeout) {
        clearTimeout(hideTimeout)
      }
    }
  }, [])

  const handleUsernameClick = async (username: string, message: Message) => {
    setSelectedUser({
      username,
      badges: message.sender?.identity?.badges || [],
      sender: message.sender
    })
    setShowUserCard(true)
    setLoadingUserCard(true)
    setUserCardData(null)

    try {
      const userData = await kickApi.getChannel(username)

      let userChannelStats = null
      if (channelData) {
        try {
          userChannelStats = await kickApi.getUserChannelStats(channelData.channelSlug, username)
        } catch (error) {
          console.error('Failed to fetch user channel stats:', error)
        }
      }

      setUserCardData({ ...userData, userChannelStats })
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      setUserCardData({ error: 'Failed to load user data' })
    } finally {
      setLoadingUserCard(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const data = await window.chatarooAPI.getPopoutData()

        if (!data) {
          console.error('[Popout] No channel data received!')
          return
        }

        setChannelData(data)

        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
        }

        const settingsData = await window.chatarooAPI.getSettings()
        setSettings(settingsData?.data || settingsData)

        const [channelEmotesResult, thirdPartyResult] = await Promise.all([
          window.chatarooAPI.fetchChannelEmotes(data.channelSlug),
          window.chatarooAPI.fetchThirdPartyEmotes(data.channelSlug)
        ])

        if (channelEmotesResult.success) {
          setChannelEmotes(channelEmotesResult.data || [])
        }
        if (thirdPartyResult.success) {
          setThirdPartyEmotes(thirdPartyResult.data)
        }

        try {
          const globalResult = await window.chatarooAPI.fetchGlobalEmotes()
          if (globalResult.success) {
            setGlobalEmotes(globalResult.data || [])
          }
        } catch (err) {
          console.error('[Popout] Failed to fetch global emotes:', err)
        }

        if (data.userSlug) {
          try {
            const allEmotes = await emoteService.fetchChannelEmotes(data.userSlug)
            const subEmotes = allEmotes.filter((emote: any) => emote.subscriber_only)
            setMySubEmotes(subEmotes)
          } catch (err) {
            console.error('[Popout] Failed to fetch user sub emotes:', err)
          }
        }

        try {
          const channelInfo = await kickApi.getChannel(data.channelSlug)
          if (channelInfo?.livestream?.viewer_count !== undefined) {
            setViewerCount(channelInfo.livestream.viewer_count)
          }
        } catch (err) {
          console.error('[Popout] Failed to fetch viewer count:', err)
        }

        connectToPusher(data.chatroomId)
      } catch (error) {
        console.error('[Popout] Failed to initialize:', error)
      }
    }

    init()

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all()
        channelRef.current.unsubscribe()
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect()
      }
    }
  }, [])

  const connectToPusher = (chatroomId: number) => {
    // Clean up any existing connection (handles React StrictMode re-renders)
    if (pusherRef.current) {
      pusherRef.current.disconnect()
      pusherRef.current = null
    }
    if (channelRef.current) {
      channelRef.current = null
    }

    const pusher = new Pusher('32cbd69e4b950bf97679', {
      cluster: 'us2',
      wsHost: 'ws-us2.pusher.com',
      enabledTransports: ['ws', 'wss']
    })

    pusherRef.current = pusher

    const channelName = `chatrooms.${chatroomId}.v2`
    const channel = pusher.subscribe(channelName)
    channelRef.current = channel

    channel.bind('App\\Events\\ChatMessageEvent', (data: any) => {
      const message = data.message || data
      if (message && message.id) {
        if (message.sender?.username) {
          setActiveChatters(prev => {
            const next = new Map(prev)
            next.set(message.sender.username, Date.now())
            return next
          })
        }

        setMessages(prev => {
          const newMessages = [...prev, message]
          if (newMessages.length > 500) {
            return newMessages.slice(-500)
          }
          return newMessages
        })
      }
    })

    channel.bind('App\\Events\\UserBannedEvent', (data: any) => {
      const moderator = data.banned_by?.username || 'a moderator'
      const content = data.permanent
        ? `${data.user.username} was permanently banned by ${moderator}`
        : `${data.user.username} was timed out for ${data.duration} minute${data.duration === 1 ? '' : 's'} by ${moderator}`

      const systemMessage: Message = {
        id: `system-ban-${data.id}`,
        content,
        type: 'system',
        sender: {
          id: 0,
          username: 'System',
          slug: 'system'
        },
        created_at: new Date().toISOString()
      }

      setMessages(prev => {
        const newMessages = [...prev, systemMessage]
        if (newMessages.length > 500) {
          return newMessages.slice(-500)
        }
        return newMessages
      })
    })

    channel.bind('App\\Events\\UserUnbannedEvent', (data: any) => {
      const moderator = data.unbanned_by?.username || 'a moderator'
      const content = `${data.user.username} was unbanned by ${moderator}`

      const systemMessage: Message = {
        id: `system-unban-${data.id}`,
        content,
        type: 'system',
        sender: {
          id: 0,
          username: 'System',
          slug: 'system'
        },
        created_at: new Date().toISOString()
      }

      setMessages(prev => {
        const newMessages = [...prev, systemMessage]
        if (newMessages.length > 500) {
          return newMessages.slice(-500)
        }
        return newMessages
      })
    })

    channel.bind('App\\Events\\MessageDeletedEvent', (data: any) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message.id ? { ...m, deleted: true } : m
      ))
    })

    channel.bind('pusher:subscription_succeeded', () => {
      setIsConnected(true)
    })

    channel.bind('pusher:subscription_error', (error: any) => {
      console.error('[Popout] Pusher subscription error:', error)
      setIsConnected(false)
    })
  }

  const handleSendMessage = async () => {
    if (!messageInputRef.current || !channelData) return

    const content = getMessageContent()
    if (!content.trim()) return

    setSendingMessage(true)
    try {
      await window.chatarooAPI.sendMessage({
        content: content.trim(),
        broadcasterUserId: channelData.userId,
        type: 'user',
        replyToMessageId: replyingTo?.id
      })

      if (messageInputRef.current) {
        messageInputRef.current.innerHTML = ''
        setMessageInput('')
      }
      setReplyingTo(null)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSendingMessage(false)
    }
  }

  const getMessageContent = (): string => {
    if (!messageInputRef.current) return ''

    let content = ''
    messageInputRef.current.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.textContent
      } else if (node.nodeName === 'IMG') {
        const img = node as HTMLImageElement
        const emoteId = img.getAttribute('data-emote-id')
        const emoteName = img.getAttribute('data-emote-name')
        if (emoteId && emoteName) {
          content += `[emote:${emoteId}:${emoteName}]`
        }
      }
    })
    return content
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleAlwaysOnTop = async () => {
    const newValue = !alwaysOnTop
    setAlwaysOnTop(newValue)
    await window.chatarooAPI.setAlwaysOnTop(newValue)
  }

  const handleClose = () => {
    window.chatarooAPI.closePopout()
  }

  const handleEmoteSelect = (emote: any) => {
    setShowEmotePicker(false)
    if (!messageInputRef.current) return

    messageInputRef.current.focus()

    const img = document.createElement('img')
    img.src = `https://files.kick.com/emotes/${emote.id}/fullsize`
    img.alt = emote.name
    img.setAttribute('data-emote-id', emote.id)
    img.setAttribute('data-emote-name', emote.name)
    img.style.height = '1.2em'
    img.style.verticalAlign = 'middle'
    img.style.margin = '0 2px'

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(img)
      range.setStartAfter(img)
      range.setEndAfter(img)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      messageInputRef.current.appendChild(img)
    }

    // Use 'x' as fallback since innerText won't include images
    setMessageInput(messageInputRef.current.innerText || 'x')
  }

  const allEmotes = useMemo(() => {
    return [...channelEmotes, ...globalEmotes]
  }, [channelEmotes, globalEmotes])

  const activeChatterCount = useMemo(() => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000
    let count = 0
    activeChatters.forEach(timestamp => {
      if (timestamp > tenMinutesAgo) count++
    })
    return count
  }, [activeChatters])

  return (
    <div className="popout-container">
      <div className="popout-titlebar">
        <div className="popout-drag-region">
          {channelData?.profilePic && (
            <img
              src={channelData.profilePic}
              alt=""
              className="popout-channel-pic"
            />
          )}
          <div className="popout-header-info">
            <div className="popout-name-row">
              <span className="popout-channel-name">
                {channelData?.channelName || 'Loading...'}
              </span>
              {isConnected && <span className="popout-status-dot" />}
            </div>
            <span className="popout-stats">
              {viewerCount > 0 && <span>{viewerCount.toLocaleString()} viewers</span>}
              {viewerCount > 0 && activeChatterCount > 0 && <span className="popout-stat-sep">•</span>}
              {activeChatterCount > 0 && <span>{activeChatterCount} chatters</span>}
            </span>
          </div>
        </div>
        <div className="popout-controls">
          <button
            className={`popout-btn popout-pin ${alwaysOnTop ? 'active' : ''}`}
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? 'Unpin from top' : 'Pin to top'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/>
            </svg>
          </button>
          <button
            className="popout-btn popout-close"
            onClick={handleClose}
            title="Return to main app"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="popout-messages-wrapper">
        <ChatMessages
          messages={messages}
          channelSlug={channelData?.channelSlug || ''}
          thirdPartyEmoteMap={thirdPartyEmoteMap}
          settings={settings}
          currentAccentColor="#53fc18"
          userInfo={null}
          isAuthenticated={true}
          isModerator={channelData?.isModerator || false}
          activeChannelUserId={channelData?.userId || 0}
          onUsernameClick={handleUsernameClick}
          onReply={handleReplyClick}
          onTimeout={handleTimeoutClick}
          onBan={handleBanClick}
          onScrollStateChange={handleScrollStateChange}
          containerRef={messagesContainerRef}
          variant="popout"
        />

        {showJumpButton && (
          <button className="popout-jump-to-bottom" onClick={jumpToBottom}>
            ↓ New Messages
          </button>
        )}
      </div>

      {showEmotePicker && channelData && (
        <div className="popout-emote-picker-wrapper">
          <EmotePicker
            channelSlug={channelData.channelSlug}
            onEmoteSelect={(emoteCode) => {
              const match = emoteCode.match(/\[emote:(\d+):([^\]]+)\]/)
              if (match) {
                handleEmoteSelect({ id: match[1], name: match[2] })
              }
            }}
            onClose={() => setShowEmotePicker(false)}
            mySubEmotes={mySubEmotes}
            thirdPartyEmotes={thirdPartyEmotes}
            enableSevenTV={settings?.emotes?.enableSevenTV}
            enableBTTV={settings?.emotes?.enableBTTV}
          />
        </div>
      )}

      {replyingTo && (
        <div className="popout-reply-indicator">
          <span className="popout-reply-indicator-icon">↩</span>
          <span className="popout-reply-indicator-text">
            Replying to <span style={{ color: getUsernameColor(replyingTo.sender.username), fontWeight: 600 }}>@{replyingTo.sender.username}</span>
          </span>
          <button
            className="popout-reply-indicator-cancel"
            onClick={() => setReplyingTo(null)}
            title="Cancel reply"
          >
            ×
          </button>
        </div>
      )}

      <div className="chat-input popout-input-container">
        <button
          className="emote-button"
          onClick={() => setShowEmotePicker(!showEmotePicker)}
          title="Emotes"
        >
          😊
        </button>
        <div
          ref={messageInputRef}
          className="popout-input"
          contentEditable={!sendingMessage}
          onInput={(e) => setMessageInput((e.target as HTMLDivElement).innerText)}
          onKeyDown={handleKeyDown}
          data-placeholder="Send a message..."
        />
        <button
          onClick={handleSendMessage}
          disabled={sendingMessage || !messageInput.trim()}
        >
          {sendingMessage ? 'Sending...' : 'Send'}
        </button>
      </div>

      {showUserCard && selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001
          }}
          onClick={() => setShowUserCard(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid #53fc18',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {userCardData?.user?.profile_pic ? (
                <img
                  src={userCardData.user.profile_pic}
                  alt={selectedUser.username}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #53fc18'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#53fc18',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#000'
                  }}
                >
                  {selectedUser.username[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>{selectedUser.username}</h2>
                {selectedUser.badges.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {selectedUser.badges.map((badge: any, i: number) => {
                      const isSubGifter = badge.type === 'sub_gifter' ||
                                          badge.type === 'subgifter' ||
                                          badge.type === 'sub-gifter' ||
                                          badge.text?.toLowerCase().includes('gifter')

                      return (
                        <span
                          key={i}
                          style={{
                            backgroundColor: '#2a2a2a',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            color: '#fff'
                          }}
                          title={badge.text}
                        >
                          {isSubGifter ? '🎁' : badge.text}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowUserCard(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {loadingUserCard ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                Loading user info...
              </div>
            ) : userCardData?.error ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#ff4444' }}>
                {userCardData.error}
              </div>
            ) : userCardData ? (
              <div style={{ marginBottom: '16px' }}>
                {(() => {
                  const subGifterBadge = userCardData.userChannelStats?.badges?.find(
                    (badge: any) => badge.type === 'sub_gifter' && badge.active
                  )

                  const hasRelationship = userCardData.userChannelStats && (
                    userCardData.userChannelStats.following_since ||
                    userCardData.userChannelStats.subscribed_for > 0 ||
                    subGifterBadge
                  )

                  if (!hasRelationship) return null

                  return (
                    <div style={{
                      backgroundColor: '#2a2a2a',
                      padding: '12px',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      border: '1px solid rgba(83, 252, 24, 0.25)'
                    }}>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>
                        In this channel
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {userCardData.userChannelStats.following_since && (
                          <div style={{
                            backgroundColor: '#1a1a1a',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#53fc18',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ❤️ Follower
                            <span style={{ color: '#888', marginLeft: '4px' }}>
                              (since {new Date(userCardData.userChannelStats.following_since).toLocaleDateString()})
                            </span>
                          </div>
                        )}
                        {userCardData.userChannelStats.subscribed_for > 0 && (
                          <div style={{
                            backgroundColor: '#1a1a1a',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#9b59b6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ⭐ Subscriber
                            <span style={{ color: '#888', marginLeft: '4px' }}>
                              ({userCardData.userChannelStats.subscribed_for} {userCardData.userChannelStats.subscribed_for === 1 ? 'month' : 'months'})
                            </span>
                          </div>
                        )}
                        {subGifterBadge && (
                          <div style={{
                            backgroundColor: '#1a1a1a',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#5dade2',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            🎁 Sub Gifter
                            <span style={{ color: '#888', marginLeft: '4px' }}>
                              ({subGifterBadge.count} {subGifterBadge.count === 1 ? 'gift' : 'gifts'})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Their Followers</div>
                    <div style={{ fontSize: '16px', color: '#fff', fontWeight: 600 }}>
                      {userCardData.followers_count?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Their Status</div>
                    <div style={{ fontSize: '14px', color: userCardData.livestream?.is_live ? '#53fc18' : '#888' }}>
                      {userCardData.livestream?.is_live ? '🔴 Live' : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px', textTransform: 'uppercase' }}>
                Recent Messages
              </h3>
              <div
                style={{
                  backgroundColor: '#0f0f0f',
                  borderRadius: '6px',
                  padding: '8px',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}
              >
                {messages
                  .filter(msg => msg.sender?.username === selectedUser.username)
                  .slice(-10)
                  .map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        fontSize: '12px',
                        padding: '4px 0',
                        color: '#efeff1',
                        borderBottom: '1px solid #2a2a2a'
                      }}
                    >
                      {parseThirdPartyEmotes(parseEmotes(msg.content), thirdPartyEmoteMap)}
                    </div>
                  ))}
                {messages.filter(msg => msg.sender?.username === selectedUser.username).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#666', padding: '12px' }}>
                    No recent messages
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setMessageInput(`@${selectedUser.username} `)
                  if (messageInputRef.current) {
                    messageInputRef.current.innerText = `@${selectedUser.username} `
                    messageInputRef.current.focus()
                  }
                  setShowUserCard(false)
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#53fc18',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                @ Mention
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

export default PopoutChat
