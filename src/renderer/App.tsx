import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { kickApi } from './services/kickApi'
import { kickChat, type ModerationEvent } from './services/kickChat'
import { emoteService } from './services/emoteService'
import { getUsernameColor, parseEmotes, parseThirdPartyEmotes, buildEmoteMap } from './utils'
import type { KickChatMessage, ConnectedChannel } from './types'
import { EmotePicker } from './components/EmotePicker'
import { ModerationPanel } from './components/ModerationPanel'
import { SnowEffect } from './components/SnowEffect'
import { ConfirmModal } from './components/ConfirmModal'
import { ChatMessages } from './components/ChatMessages'
import { useMessageBatcher } from './hooks/useMessageBatcher'
import holidayLogo from './assets/HolidayChatarooGreenText.png'

function App() {
  const [channelInput, setChannelInput] = useState('')
  const [channels, setChannels] = useState<ConnectedChannel[]>([])
  const [activeChannelSlug, setActiveChannelSlug] = useState<string | null>(null)
  const [myChannel, setMyChannel] = useState<ConnectedChannel | null>(null)
  const [viewMode, setViewMode] = useState<'channels' | 'myChat'>('channels')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [viewerCountBlink, setViewerCountBlink] = useState(false)
  const [chatterCountBlink, setChatterCountBlink] = useState(false)
  const [followerCountBlink, setFollowerCountBlink] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [replyingTo, setReplyingTo] = useState<KickChatMessage | null>(null)
  const [showUsernameInput, setShowUsernameInput] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [showEmotePicker, setShowEmotePicker] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [globalEmojis, setGlobalEmojis] = useState<any[]>([])
  const [mySubEmotes, setMySubEmotes] = useState<any[]>([])
  const [thirdPartyEmotes, setThirdPartyEmotes] = useState<{
    seventvGlobal: any[]
    seventvChannel: any[]
    bttvGlobal: any[]
  }>({ seventvGlobal: [], seventvChannel: [], bttvGlobal: [] })
  const [supporting, setSupporting] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settings, setSettings] = useState<any>({
    theme: { mode: 'dark', accentColor: '#53fc18', rainbowFade: false, happyHolidays: true, customGradient: false, gradientColors: ['#53fc18', '#00bfff', '#ff6b6b'] },
    chat: { fontSize: 14, messageHistoryLimit: 1000, autoScroll: true, use12HourTime: false },
    moderation: { skipConfirmation: false },
    emotes: { enableSevenTV: true, enableBTTV: false },
    highlights: {
      mentions: { enabled: true, color: '#ff4444' },
      moderators: { enabled: true, color: '#ffdd00' },
      verified: { enabled: true, color: '#53fc18' },
      founder: { enabled: false, color: '#ffd700' },
      og: { enabled: false, color: '#ff6b35' },
      vip: { enabled: false, color: '#ff1493' },
      subscribers: { enabled: false, color: '#9b59b6' },
      subGifters: { enabled: false, color: '#5dade2' }
    }
  })
  const [currentAccentColor, setCurrentAccentColor] = useState('#53fc18')
  const [showUserCard, setShowUserCard] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userCardData, setUserCardData] = useState<any>(null)
  const [loadingUserCard, setLoadingUserCard] = useState(false)
  const [showModerationPanel, setShowModerationPanel] = useState(false)
  const [poppedOutChannels, setPoppedOutChannels] = useState<Set<string>>(new Set())
  const [draggedChannel, setDraggedChannel] = useState<string | null>(null)
  const [showGiveawayModal, setShowGiveawayModal] = useState(false)
  const [giveawayActive, setGiveawayActive] = useState(false)
  const [giveawayKeyword, setGiveawayKeyword] = useState('')
  const [giveawayEntries, setGiveawayEntries] = useState<Set<string>>(new Set())
  const [giveawayWinner, setGiveawayWinner] = useState<string | null>(null)
  const [isPickingWinner, setIsPickingWinner] = useState(false)
  const [spinningName, setSpinningName] = useState<string | null>(null)
  const [giveawaySubOnly, setGiveawaySubOnly] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [downloadingUpdate, setDownloadingUpdate] = useState(false)
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
  const [showWinnerChat, setShowWinnerChat] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLDivElement>(null)
  const previousViewerCount = useRef<number>(0)
  const previousChatterCount = useRef<number>(0)
  const previousFollowerCount = useRef<number>(0)

  const giveawayActiveRef = useRef(false)
  const giveawayKeywordRef = useRef('')
  const giveawaySubOnlyRef = useRef(false)
  useEffect(() => {
    giveawayActiveRef.current = giveawayActive
    giveawayKeywordRef.current = giveawayKeyword
    giveawaySubOnlyRef.current = giveawaySubOnly
  }, [giveawayActive, giveawayKeyword, giveawaySubOnly])

  useEffect(() => {
    if (window.chatarooAPI) {
      window.chatarooAPI.onUpdateAvailable((version: string) => {
        setUpdateAvailable(version)
      })

      window.chatarooAPI.onUpdateDownloaded(() => {
        setUpdateDownloaded(true)
        setDownloadingUpdate(false)
      })
    }
  }, [])

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

  const activeChannel = viewMode === 'myChat'
    ? myChannel
    : channels.find(c => c.slug === activeChannelSlug)

  const thirdPartyEmoteMap = useMemo(() => {
    return buildEmoteMap(
      thirdPartyEmotes,
      settings.emotes?.enableSevenTV ?? true,
      settings.emotes?.enableBTTV ?? true
    )
  }, [thirdPartyEmotes, settings.emotes?.enableSevenTV, settings.emotes?.enableBTTV])

  const handleBatchedMessages = useCallback((messages: Array<{ chatroomId: number; message: KickChatMessage }>) => {
    if (messages.length === 0) return

    setChannels(prev => {
      const messagesByRoom = new Map<number, KickChatMessage[]>()
      for (const { chatroomId, message } of messages) {
        if (!messagesByRoom.has(chatroomId)) {
          messagesByRoom.set(chatroomId, [])
        }
        messagesByRoom.get(chatroomId)!.push(message)
      }

      return prev.map(ch => {
        const newMessages = messagesByRoom.get(ch.chatroomId)
        if (!newMessages) return ch

        const limit = 500
        const allMessages = [...ch.messages, ...newMessages]
        const trimmedMessages = allMessages.length > limit
          ? allMessages.slice(-limit)
          : allMessages

        const newActiveChatters = new Map(ch.activeChatters)
        for (const msg of newMessages) {
          const username = msg.sender?.username
          if (username) {
            newActiveChatters.set(username, Date.now())
          }
        }

        const analytics = ch.analytics || {
          sessionStart: Date.now(),
          totalMessages: 0,
          chatterCounts: new Map<string, number>(),
          emoteCounts: new Map<string, { id: string; name: string; count: number }>()
        }

        const newChatterCounts = new Map(analytics.chatterCounts)
        const newEmoteCounts = new Map(analytics.emoteCounts)

        let nonBotMessageCount = 0
        for (const msg of newMessages) {
          const username = msg.sender?.username
          const badges = msg.sender?.identity?.badges || []
          const isBot = badges.some((badge: any) => badge.type === 'bot')

          if (username && !isBot) {
            newChatterCounts.set(username, (newChatterCounts.get(username) || 0) + 1)
            nonBotMessageCount++
          }

          const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g
          let match
          while ((match = emoteRegex.exec(msg.content || '')) !== null) {
            const emoteId = match[1]
            const emoteName = match[2]
            const key = `kick:${emoteId}:${emoteName}`
            const existing = newEmoteCounts.get(key)
            if (existing) {
              existing.count++
            } else {
              newEmoteCounts.set(key, { id: emoteId, name: emoteName, count: 1, source: 'kick' })
            }
          }



          if (thirdPartyEmoteMap.size > 0) {
            const words = (msg.content || '').split(/\s+/)
            for (const word of words) {
              const emote = thirdPartyEmoteMap.get(word)
              if (emote) {
                const key = `${emote.source}:${emote.id}:${emote.name}`
                const existing = newEmoteCounts.get(key)
                if (existing) {
                  existing.count++
                } else {
                  newEmoteCounts.set(key, { id: emote.id, name: emote.name, count: 1, source: emote.source })
                }
              }
            }
          }
        }

        const newAnalytics = {
          sessionStart: analytics.sessionStart,
          totalMessages: analytics.totalMessages + nonBotMessageCount,
          chatterCounts: newChatterCounts,
          emoteCounts: newEmoteCounts
        }

        return { ...ch, messages: trimmedMessages, activeChatters: newActiveChatters, analytics: newAnalytics }
      })
    })
  }, [thirdPartyEmoteMap])
  const addBatchedMessage = useMessageBatcher(handleBatchedMessages, {
    maxBatchSize: 50,  // Force flush after 50 messages
    maxWaitMs: 250     // Flush every 250ms (4fps) for smoother animations
  })
  const handleBatchedMyChannelMessages = useCallback((messages: KickChatMessage[]) => {
    if (messages.length === 0) return

    if (giveawayActiveRef.current && giveawayKeywordRef.current) {
      const keyword = giveawayKeywordRef.current.toLowerCase().trim()
      const newEntries: string[] = []

      for (const msg of messages) {
        const username = msg.sender?.username
        const content = msg.content?.toLowerCase().trim()



        if (username && content && content.includes(keyword)) {

          if (giveawaySubOnlyRef.current) {
            const badges = msg.sender?.identity?.badges || []
            const isSubscriber = badges.some((badge: any) => badge.type === 'subscriber')
            if (isSubscriber) {
              newEntries.push(username)
            }
          } else {
            newEntries.push(username)
          }
        }
      }

      if (newEntries.length > 0) {
        setGiveawayEntries(prev => {
          const updated = new Set(prev)
          newEntries.forEach(u => updated.add(u))
          return updated
        })
      }
    }

    setMyChannel(prev => {
      if (!prev) return prev



      const limit = 500
      const allMessages = [...prev.messages, ...messages]
      const trimmedMessages = allMessages.length > limit
        ? allMessages.slice(-limit)
        : allMessages

      const newActiveChatters = new Map(prev.activeChatters)
      for (const msg of messages) {
        const username = msg.sender?.username
        if (username) {
          newActiveChatters.set(username, Date.now())
        }
      }

      const analytics = prev.analytics || {
        sessionStart: Date.now(),
        totalMessages: 0,
        chatterCounts: new Map<string, number>(),
        emoteCounts: new Map<string, { id: string; name: string; count: number }>()
      }

      const newChatterCounts = new Map(analytics.chatterCounts)
      const newEmoteCounts = new Map(analytics.emoteCounts)

      let nonBotMessageCount = 0
      for (const msg of messages) {
        const username = msg.sender?.username
        const badges = msg.sender?.identity?.badges || []
        const isBot = badges.some((badge: any) => badge.type === 'bot')

        if (username && !isBot) {
          newChatterCounts.set(username, (newChatterCounts.get(username) || 0) + 1)
          nonBotMessageCount++
        }

        const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g
        let match
        while ((match = emoteRegex.exec(msg.content || '')) !== null) {
          const emoteId = match[1]
          const emoteName = match[2]
          const key = `kick:${emoteId}:${emoteName}`
          const existing = newEmoteCounts.get(key)
          if (existing) {
            existing.count++
          } else {
            newEmoteCounts.set(key, { id: emoteId, name: emoteName, count: 1, source: 'kick' })
          }
        }



        if (thirdPartyEmoteMap.size > 0) {
          const words = (msg.content || '').split(/\s+/)
          for (const word of words) {
            const emote = thirdPartyEmoteMap.get(word)
            if (emote) {
              const key = `${emote.source}:${emote.id}:${emote.name}`
              const existing = newEmoteCounts.get(key)
              if (existing) {
                existing.count++
              } else {
                newEmoteCounts.set(key, { id: emote.id, name: emote.name, count: 1, source: emote.source })
              }
            }
          }
        }
      }

      const newAnalytics = {
        sessionStart: analytics.sessionStart,
        totalMessages: analytics.totalMessages + nonBotMessageCount,
        chatterCounts: newChatterCounts,
        emoteCounts: newEmoteCounts
      }

      return { ...prev, messages: trimmedMessages, activeChatters: newActiveChatters, analytics: newAnalytics }
    })
  }, [thirdPartyEmoteMap])

  const addBatchedMyChannelMessage = useMessageBatcher(handleBatchedMyChannelMessages, {
    maxBatchSize: 50,
    maxWaitMs: 250  // Flush every 250ms for smoother animations
  })
  useEffect(() => {
    checkAuthStatus()
    loadSettings()
  }, [])
  useEffect(() => {
    if (isAuthenticated && userInfo) {
      loadSavedChannels()
    }
  }, [isAuthenticated, userInfo])
  const savedChannelsLoadedRef = useRef(false)
  const loadSavedChannels = async () => {
    if (savedChannelsLoadedRef.current) return
    savedChannelsLoadedRef.current = true

    try {
      const result = await (window.chatarooAPI as any).getSavedChannels()
      if (result.success && result.data && result.data.length > 0) {
        const connectedSlugs = new Set<string>()
        const newChannels: ConnectedChannel[] = []
        for (const channelSlug of result.data) {
          if (connectedSlugs.has(channelSlug)) continue

          try {
            const channelData = await kickApi.getChannel(channelSlug)
            if (!channelData || !channelData.chatroom) {
              console.error(`Channel ${channelSlug} not found`)
              continue
            }



            let isModerator = false
            if (userInfo?.username) {
              try {
                const userChannelStats = await kickApi.getUserChannelStats(channelSlug, userInfo.username)
                isModerator = userChannelStats.is_moderator || userChannelStats.is_channel_owner
              } catch (error) {
                console.error('Failed to fetch moderator status:', error)
              }
            }

            const newChannel: ConnectedChannel = {
              slug: channelSlug,
              chatroomId: channelData.chatroom.id,
              channelId: channelData.id,
              messages: [],
              profilePicture: channelData.user?.profile_pic,
              isLive: channelData.livestream?.is_live || false,
              viewerCount: channelData.livestream?.viewer_count || 0,
              userId: channelData.user_id,
              activeChatters: new Map(),
              isModerator
            }

            newChannels.push(newChannel)
            connectedSlugs.add(channelSlug)
            kickChat.subscribeToChannel(
              channelData.chatroom.id,
              (message) => {
                addBatchedMessage({ chatroomId: channelData.chatroom.id, message })
              },
              (event, type) => {
                const moderator = type === 'ban' ? event.banned_by?.username : event.unbanned_by?.username
                const systemMessage: KickChatMessage = {
                  id: `system-${type}-${event.id}-${Date.now()}`,
                  content: type === 'ban'
                    ? event.permanent
                      ? `${event.user.username} was permanently banned by ${moderator || 'a moderator'}`
                      : `${event.user.username} was timed out for ${event.duration} minute${event.duration === 1 ? '' : 's'} by ${moderator || 'a moderator'}`
                    : event.permanent
                      ? `${event.user.username} was unbanned by ${moderator || 'a moderator'}`
                      : `${event.user.username}'s timeout was removed by ${moderator || 'a moderator'}`,
                  sender: {
                    id: 0,
                    username: 'System',
                    slug: 'system',
                    is_verified: false,
                    identity: { badges: [] }
                  },
                  broadcaster: {
                    id: channelData.user_id,
                    username: channelSlug,
                    slug: channelSlug,
                    is_verified: false
                  },
                  created_at: new Date().toISOString(),
                  type: 'system',
                  metadata: {
                    moderation_target: {
                      id: event.user.id,
                      username: event.user.username,
                      slug: event.user.slug || event.user.username
                    }
                  }
                }
                setChannels(prev => prev.map(ch => {
                  if (ch.chatroomId !== channelData.chatroom.id) return ch



                  let updatedMessages = ch.messages
                  if (type === 'ban') {
                    const bannedUsername = event.user.username
                    updatedMessages = ch.messages.map(m =>
                      m.sender?.username === bannedUsername
                        ? { ...m, deleted: true }
                        : m
                    )
                  }

                  return { ...ch, messages: [...updatedMessages, systemMessage] }
                }))
              },
              (event) => {
                setChannels(prev => prev.map(ch =>
                  ch.chatroomId === channelData.chatroom.id
                    ? { ...ch, messages: ch.messages.map(m =>
                        (m.id || m.message_id) === event.message.id
                          ? { ...m, deleted: true }
                          : m
                      )}
                    : ch
                ))
              }
            )



            emoteService.fetchChannelEmotes(channelSlug).then(emotes => {
            }).catch(err => {
              console.error(`Failed to pre-fetch emotes for ${channelSlug}:`, err)
            })

          } catch (error) {
            console.error(`Failed to reconnect to ${channelSlug}:`, error)
          }
        }
        if (newChannels.length > 0) {
          setChannels(newChannels)
          setActiveChannelSlug(newChannels[0].slug)

          // Pre-fetch third-party emotes for the first channel
          const firstChannelSlug = newChannels[0].slug
          window.chatarooAPI.fetchThirdPartyEmotes(firstChannelSlug).then((result: any) => {
            if (result.success) {
              setThirdPartyEmotes(result.data)
            }
          }).catch((err: any) => {
            console.error(`Failed to pre-fetch third-party emotes for ${firstChannelSlug}:`, err)
          })
        }
      }
    } catch (error) {
      console.error('Failed to load saved channels:', error)
    }
  }
  useEffect(() => {
    if (isAuthenticated) {
      loadGlobalEmojis()
    }
  }, [isAuthenticated])
  useEffect(() => {
    if (isAuthenticated && userInfo) {
      loadMySubEmotes()
    } else {
      setMySubEmotes([]) // Clear if not authenticated
    }
  }, [isAuthenticated, userInfo])
  useEffect(() => {
    const api = window.chatarooAPI as any
    if (api?.onPopoutClosed) {
      api.onPopoutClosed((channelSlug: string) => {
        setPoppedOutChannels(prev => {
          const next = new Set(prev)
          next.delete(channelSlug)
          return next
        })
      })
    }
  }, [])

  const loadGlobalEmojis = async () => {
    try {
      const emotes = await emoteService.fetchGlobalEmotes()
      setGlobalEmojis(emotes)
    } catch (err) {
      console.error('Failed to load global emotes:', err)
    }
  }

  const loadMySubEmotes = async () => {
    if (!userInfo?.username && !userInfo?.slug) {
      return
    }

    try {
      const channelSlug = userInfo.username || userInfo.slug
      const allChannelEmotes = await emoteService.fetchChannelEmotes(channelSlug)
      const subEmotes = allChannelEmotes.filter(emote => emote.subscriber_only)
      setMySubEmotes(subEmotes)
    } catch (err) {
      console.error('Failed to load personal subscriber emotes:', err)
      setMySubEmotes([]) 
    }
  }

  const checkAuthStatus = async () => {
    try {
      const status = await window.chatarooAPI.getAuthStatus()
      setIsAuthenticated(status.isAuthenticated)
      setUserInfo(status.userInfo)
    } catch (error) {
      console.error('Failed to check auth status:', error)
    }
  }

  const loadSettings = async () => {
    try {
      const result = await window.chatarooAPI.getSettings()
      if (result.success && result.data) {
        const mergedSettings = {
          theme: {
            mode: result.data.theme?.mode || 'dark',
            accentColor: result.data.theme?.accentColor || '#53fc18',
            rainbowFade: result.data.theme?.rainbowFade || false,
            happyHolidays: result.data.theme?.happyHolidays !== undefined ? result.data.theme.happyHolidays : true,
            customGradient: result.data.theme?.customGradient || false,
            gradientColors: result.data.theme?.gradientColors || ['#53fc18', '#00bfff', '#ff6b6b']
          },
          chat: {
            fontSize: result.data.chat?.fontSize || 14,
            messageHistoryLimit: result.data.chat?.messageHistoryLimit || 1000,
            autoScroll: result.data.chat?.autoScroll !== undefined ? result.data.chat.autoScroll : true,
            use12HourTime: result.data.chat?.use12HourTime || false
          },
          emotes: {
            enableSevenTV: result.data.emotes?.enableSevenTV || false,
            enableBTTV: result.data.emotes?.enableBTTV || false
          },
          moderation: {
            skipConfirmation: result.data.moderation?.skipConfirmation || false
          },
          highlights: {
            mentions: {
              enabled: result.data.highlights?.mentions?.enabled !== undefined ? result.data.highlights.mentions.enabled : true,
              color: result.data.highlights?.mentions?.color || '#ff4444'
            },
            moderators: {
              enabled: result.data.highlights?.moderators?.enabled !== undefined ? result.data.highlights.moderators.enabled : true,
              color: result.data.highlights?.moderators?.color || '#ffdd00'
            },
            verified: {
              enabled: result.data.highlights?.verified?.enabled !== undefined ? result.data.highlights.verified.enabled : true,
              color: result.data.highlights?.verified?.color || '#53fc18'
            },
            founder: {
              enabled: result.data.highlights?.founder?.enabled || false,
              color: result.data.highlights?.founder?.color || '#ffd700'
            },
            vip: {
              enabled: result.data.highlights?.vip?.enabled || false,
              color: result.data.highlights?.vip?.color || '#ff1493'
            },
            subscribers: {
              enabled: result.data.highlights?.subscribers?.enabled || false,
              color: result.data.highlights?.subscribers?.color || '#9b59b6'
            },
            subGifters: {
              enabled: result.data.highlights?.subGifters?.enabled || false,
              color: result.data.highlights?.subGifters?.color || '#5dade2'
            }
          }
        }
        setSettings(mergedSettings)
        applySettings(mergedSettings)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const applySettings = (newSettings: any) => {
    document.documentElement.setAttribute('data-theme', 'dark')
    if (newSettings?.theme?.accentColor) {
      document.documentElement.style.setProperty('--accent-color', newSettings.theme.accentColor)
    }
    if (newSettings?.chat?.fontSize) {
      document.documentElement.style.setProperty('--chat-font-size', `${newSettings.chat.fontSize}px`)
    }
    if (newSettings?.highlights?.mentions?.color) {
      document.documentElement.style.setProperty('--highlight-mention-color', newSettings.highlights.mentions.color)
    }
    if (newSettings?.highlights?.moderators?.color) {
      document.documentElement.style.setProperty('--highlight-moderator-color', newSettings.highlights.moderators.color)
    }
    if (newSettings?.highlights?.verified?.color) {
      document.documentElement.style.setProperty('--highlight-verified-color', newSettings.highlights.verified.color)
    }
    if (newSettings?.highlights?.founder?.color) {
      document.documentElement.style.setProperty('--highlight-founder-color', newSettings.highlights.founder.color)
    }
    if (newSettings?.highlights?.og?.color) {
      document.documentElement.style.setProperty('--highlight-og-color', newSettings.highlights.og.color)
    }
    if (newSettings?.highlights?.vip?.color) {
      document.documentElement.style.setProperty('--highlight-vip-color', newSettings.highlights.vip.color)
    }
    if (newSettings?.highlights?.subscribers?.color) {
      document.documentElement.style.setProperty('--highlight-subscriber-color', newSettings.highlights.subscribers.color)
    }
    if (newSettings?.highlights?.subGifters?.color) {
      document.documentElement.style.setProperty('--highlight-subgifter-color', newSettings.highlights.subGifters.color)
    }
  }

  const handleSettingsChange = async (updates: any) => {
    try {
      const result = await window.chatarooAPI.updateSettings(updates)
      if (result.success && result.data) {
        setSettings(result.data)
        applySettings(result.data)
      }
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  }

  const handleLogin = async () => {
    try {
      const result = await window.chatarooAPI.login()
      if (result.success) {
        setIsAuthenticated(true)
        if (result.userInfo?.username) {
          try {
            const channelData = await kickApi.getChannel(result.userInfo.username)
            const fullUserInfo = {
              username: channelData.user?.username || channelData.slug || result.userInfo.username,
              slug: channelData.slug || result.userInfo.username,
              profile_pic: channelData.user?.profile_pic
            }
            setUserInfo(fullUserInfo)
          } catch (err) {
            console.error('Failed to fetch profile, using basic info:', err)
            setUserInfo(result.userInfo)
          }
        } else if (result.userInfo) {
          setUserInfo(result.userInfo)
        } else {
          setShowUsernameInput(true)
        }
      } else {
        setError(result.error || 'Login failed')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message || 'Failed to login')
    }
  }

  const handleSetUsername = async () => {
    if (!usernameInput.trim()) return

    const username = usernameInput.trim()
    try {
      const response = await fetch(`https://kick.com/api/v2/channels/${username}`)
      if (response.ok) {
        const data = await response.json()
        const newUserInfo = {
          username: data.user?.username || data.slug || username,
          slug: data.slug || username,
          profile_pic: data.user?.profile_pic
        }
        setUserInfo(newUserInfo)
        setShowUsernameInput(false)
      } else {
        setUserInfo({ username, slug: username })
        setShowUsernameInput(false)
      }
    } catch (err) {
      console.error('Failed to fetch user info:', err)
      setUserInfo({ username, slug: username })
      setShowUsernameInput(false)
    }
  }

  const handleLogout = async () => {
    try {
      const result = await window.chatarooAPI.logout()
      if (result.success) {
        if (myChannel) {
          kickChat.unsubscribeFromChannel(myChannel.chatroomId)
          setMyChannel(null)
        }
        setIsAuthenticated(false)
        setUserInfo(null)
        setShowUsernameInput(false)
        setUsernameInput('')
        setViewMode('channels')
      }
    } catch (error: any) {
      console.error('Logout error:', error)
    }
  }
  const getMessageContent = (): string => {
    if (!messageInputRef.current) return ''

    let content = ''
    const childNodes = messageInputRef.current.childNodes

    for (const node of Array.from(childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.textContent || ''
      } else if (node.nodeName === 'IMG') {
        const img = node as HTMLImageElement
        const emoteId = img.getAttribute('data-emote-id')
        const emoteName = img.getAttribute('data-emote-name')
        if (emoteId && emoteName) {
          content += `[emote:${emoteId}:${emoteName}]`
        }
      } else if (node.nodeName === 'BR') {
      } else {
        content += (node as HTMLElement).innerText || ''
      }
    }

    return content
  }

  const handleSendMessage = async () => {
    const content = getMessageContent().trim()
    if (!content || !activeChannel || sendingMessage || !isAuthenticated) return

    setSendingMessage(true)
    try {
      const result = await window.chatarooAPI.sendMessage({
        content: content,
        broadcasterUserId: activeChannel.userId,
        type: 'user',
        replyToMessageId: replyingTo?.id || replyingTo?.message_id
      })

      if (result.success) {
        if (messageInputRef.current) {
          messageInputRef.current.innerHTML = ''
        }
        setMessageInput('') // Clear input on success
        setReplyingTo(null) // Clear reply state
      } else {
        setError(result.error || 'Failed to send message')
      }
    } catch (error: any) {
      console.error('Send message error:', error)
      setError(error.message || 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleEmoteSelect = (emoteCode: string) => {
    setShowEmotePicker(false)

    if (!messageInputRef.current) return
    const match = emoteCode.match(/\[emote:(\d+):([^\]]+)\]/)
    if (!match) {
      messageInputRef.current.focus()

      const selection = window.getSelection()
      if (!selection) return

      let range: Range
      const anchorNode = selection.anchorNode

      if (anchorNode && messageInputRef.current.contains(anchorNode) && selection.rangeCount > 0) {
        range = selection.getRangeAt(0)
      } else {
        range = document.createRange()
        range.selectNodeContents(messageInputRef.current)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      range.deleteContents()
      const textNode = document.createTextNode(emoteCode + ' ')
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)

      
      setMessageInput(messageInputRef.current.innerText || 'x')
      return
    }

    const [, emoteId, emoteName] = match

    const img = document.createElement('img')
    img.src = `https://files.kick.com/emotes/${emoteId}/fullsize`
    img.alt = emoteName
    img.setAttribute('data-emote-id', emoteId)
    img.setAttribute('data-emote-name', emoteName)
    img.style.height = '24px'
    img.style.verticalAlign = 'middle'
    img.style.margin = '0 2px'
    img.contentEditable = 'false'
    img.draggable = false
    messageInputRef.current.focus()
    const selection = window.getSelection()
    if (!selection) return
    let range: Range
    const anchorNode = selection.anchorNode

    if (anchorNode && messageInputRef.current.contains(anchorNode) && selection.rangeCount > 0) {
      range = selection.getRangeAt(0)
    } else {
      range = document.createRange()
      range.selectNodeContents(messageInputRef.current)
      range.collapse(false) // Collapse to end
      selection.removeAllRanges()
      selection.addRange(range)
    }
    range.deleteContents()
    range.insertNode(document.createTextNode(' '))
    range.insertNode(img)
    range.setStartAfter(img)
    range.setEndAfter(img)
    selection.removeAllRanges()
    selection.addRange(range)

    setMessageInput(messageInputRef.current.innerText || 'x')
  }
  const renderMessagePreview = (text: string) => {
    if (!text.trim()) return null

    const emotePattern = /\[emote:(\d+):([^\]]+)\]/g
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let match

    while ((match = emotePattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      const emoteId = match[1]
      const emoteName = match[2]
      parts.push(
        <img
          key={`${emoteId}-${match.index}`}
          src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
          alt={emoteName}
          title={emoteName}
          style={{
            height: '24px',
            verticalAlign: 'middle',
            margin: '0 2px'
          }}
        />
      )

      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? parts : null
  }

  const toggleEmotePicker = () => {
    setShowEmotePicker(prev => !prev)
  }

  const handleShowSupport = async (emote: any) => {
    if (!isAuthenticated || channels.length === 0 || supporting) return

    setSupporting(true)
    setShowSupportModal(false)

    const emoteCode = `[emote:${emote.id}:${emote.name}]`
    const allChannels = channels
    for (let i = 0; i < allChannels.length; i++) {
      const channel = allChannels[i]

      try {
        await window.chatarooAPI.sendMessage({
          content: emoteCode,
          broadcasterUserId: channel.userId,
          type: 'user'
        })
        if (i < allChannels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1200))
        }
      } catch (err) {
        console.error(`❌ Failed to send to ${channel.slug}:`, err)
      }
    }

    setSupporting(false)
  }
  const handleStartGiveaway = () => {
    if (!giveawayKeyword.trim()) return
    setGiveawayActive(true)
    setGiveawayWinner(null)
    setGiveawayEntries(new Set())
  }

  const handleStopGiveaway = () => {
    setGiveawayActive(false)
  }

  const handleClearEntries = () => {
    setGiveawayEntries(new Set())
    setGiveawayWinner(null)
  }

  const handlePickWinner = () => {
    const entries = Array.from(giveawayEntries)
    if (entries.length === 0) return

    setIsPickingWinner(true)
    setGiveawayWinner(null)

    // Spin through names with increasing delay for dramatic effect
    let iterations = 0
    const totalIterations = 30 + Math.floor(Math.random() * 20) // 30-50 iterations
    const winnerIndex = Math.floor(Math.random() * entries.length)

    const spin = () => {
      iterations++
      const displayIndex = Math.floor(Math.random() * entries.length)
      setSpinningName(entries[displayIndex])

      if (iterations < totalIterations) {
        const progress = iterations / totalIterations
        const delay = 30 + (progress * progress * 400) // 30ms to 430ms
        setTimeout(spin, delay)
      } else {
        setSpinningName(null)
        setGiveawayWinner(entries[winnerIndex])
        setIsPickingWinner(false)
      }
    }

    spin()
  }
  const userPausedRef = useRef(false)
  const isAutoScrollingRef = useRef(false)
  useEffect(() => {
    setIsAtBottom(true)
    setShowJumpButton(false)
    setShowModerationPanel(false)
    userPausedRef.current = false
    const container = messagesContainerRef.current
    if (container) {
      isAutoScrollingRef.current = true
      container.scrollTop = 0
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false
      })
    }
  }, [activeChannelSlug, viewMode])
  useEffect(() => {
    if (!activeChannelSlug) return

    window.chatarooAPI.fetchThirdPartyEmotes(activeChannelSlug).then((result: any) => {
      if (result.success) {
        setThirdPartyEmotes(result.data)
      }
    }).catch((err: any) => {
      console.error(`Failed to fetch third-party emotes for ${activeChannelSlug}:`, err)
    })
  }, [activeChannelSlug])
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
  const handleReplyClick = useCallback((message: KickChatMessage) => {
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

    // Skip dialog if user disabled confirmations
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

    // Skip dialog if user disabled confirmations
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !userPausedRef.current) {
        const container = messagesContainerRef.current
        if (container) {
          container.scrollTop = 0
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
  useEffect(() => {
    kickChat.onConnectionChange(setConnected)

    return () => {
      kickChat.disconnect()
    }
  }, [])
  useEffect(() => {
    if (channels.length === 0 && !myChannel) return

    const updateViewerCounts = async () => {
      for (const channel of channels) {
        try {
          const channelData = await kickApi.getChannel(channel.slug)
          setChannels(prev => prev.map(ch =>
            ch.slug === channel.slug
              ? {
                  ...ch,
                  isLive: channelData.livestream?.is_live || false,
                  viewerCount: channelData.livestream?.viewer_count || 0
                }
              : ch
          ))
        } catch (err) {
          console.error(`Failed to update ${channel.slug}:`, err)
        }
      }
      if (myChannel) {
        try {
          const channelData = await kickApi.getChannel(myChannel.slug)
          setMyChannel(prev => prev ? {
            ...prev,
            isLive: channelData.livestream?.is_live || false,
            viewerCount: channelData.livestream?.viewer_count || 0
          } : null)
        } catch (err) {
          console.error(`Failed to update your chat:`, err)
        }
      }
    }
    updateViewerCounts()
    const interval = setInterval(updateViewerCounts, 30000)

    return () => clearInterval(interval)
  }, [channels.length, myChannel?.slug])

  const handleConnect = async () => {
    const channelSlug = channelInput.trim().toLowerCase()
    if (!channelSlug) return
    if (channels.find(c => c.slug === channelSlug)) {
      setError(`Already connected to ${channelSlug}`)
      return
    }

    setConnecting(true)
    setError('')

    try {


      const channelData = await kickApi.getChannel(channelSlug)



      let isModerator = false
      if (userInfo?.username) {
        try {
          const userChannelStats = await kickApi.getUserChannelStats(channelSlug, userInfo.username)


          isModerator = userChannelStats.is_moderator || userChannelStats.is_channel_owner
        } catch (error) {
          console.error('Failed to fetch moderator status:', error)


        }
      }

      const newChannel: ConnectedChannel = {
        slug: channelSlug,
        chatroomId: channelData.chatroom.id,
        channelId: channelData.id,
        messages: [],
        profilePicture: channelData.user?.profile_pic,
        isLive: channelData.livestream?.is_live || false,
        viewerCount: channelData.livestream?.viewer_count || 0,
        userId: channelData.user_id,
        activeChatters: new Map<string, number>(),
        isModerator,
        followerCount: channelData.followers_count || 0
      }

      
      setChannels(prev => [...prev, newChannel])

      setActiveChannelSlug(channelSlug)



      kickChat.subscribeToChannel(
        channelData.chatroom.id,
        (message) => {


          addBatchedMessage({ chatroomId: channelData.chatroom.id, message })
        },
        (event: ModerationEvent, type: 'ban' | 'unban') => {


          const moderator = type === 'ban' ? event.banned_by?.username : event.unbanned_by?.username
          const systemMessage: KickChatMessage = {
            id: `system-${type}-${event.id}-${Date.now()}`,
            content: type === 'ban'
              ? event.permanent
                ? `${event.user.username} was permanently banned by ${moderator || 'a moderator'}`
                : `${event.user.username} was timed out for ${event.duration} minute${event.duration === 1 ? '' : 's'} by ${moderator || 'a moderator'}`
              : event.permanent
                ? `${event.user.username} was unbanned by ${moderator || 'a moderator'}`
                : `${event.user.username}'s timeout was removed by ${moderator || 'a moderator'}`,
            sender: {
              id: 0,
              username: 'System',
              slug: 'system',
              is_verified: false,
              identity: { badges: [] }
            },
            broadcaster: {
              id: channelData.user_id,
              username: channelSlug,
              slug: channelSlug,
              is_verified: false
            },
            created_at: new Date().toISOString(),
            type: 'system',
            metadata: {
              moderation_target: {
                id: event.user.id,
                username: event.user.username,
                slug: event.user.slug || event.user.username
              }
            }
          }



          setChannels(prev => prev.map(ch => {
            if (ch.chatroomId !== channelData.chatroom.id) return ch



            let updatedMessages = ch.messages
            if (type === 'ban') {
              const bannedUsername = event.user.username
              updatedMessages = ch.messages.map(m =>
                m.sender?.username === bannedUsername
                  ? { ...m, deleted: true }
                  : m
              )
            }

            return { ...ch, messages: [...updatedMessages, systemMessage] }
          }))
        },
        (event) => {


          setChannels(prev => prev.map(ch =>
            ch.chatroomId === channelData.chatroom.id
              ? { ...ch, messages: ch.messages.map(m =>
                  (m.id || m.message_id) === event.message.id
                    ? { ...m, deleted: true }
                    : m
                )}
              : ch
          ))
        }
      )

      setChannelInput('')

      const updatedChannels = [...channels.map(c => c.slug), channelSlug]
      ;(window.chatarooAPI as any).saveChannels(updatedChannels)




      emoteService.fetchChannelEmotes(channelSlug).then(emotes => {
      }).catch(err => {
        console.error(`Failed to pre-fetch emotes for ${channelSlug}:`, err)
      })



      if (settings.emotes?.enableSevenTV || settings.emotes?.enableBTTV) {
        window.chatarooAPI.fetchThirdPartyEmotes(channelSlug).then((result: any) => {
          if (result.success) {
            setThirdPartyEmotes(result.data)
          }
        }).catch((err: any) => {
          console.error(`Failed to pre-fetch third-party emotes for ${channelSlug}:`, err)
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      console.error('Connection error:', err)
    } finally {
      setConnecting(false)
    }
  }

  const handleConnectToMyChat = async () => {
    if (!userInfo?.username && !userInfo?.slug) return
    if (myChannel) {
      setViewMode('myChat')
      return
    }

    const myUsername = userInfo.username || userInfo.slug
    const channelSlug = myUsername.toLowerCase()

    setConnecting(true)
    setError('')

    try {


      const channelData = await kickApi.getChannel(channelSlug)



      let isModerator = true // User is always a moderator/broadcaster in their own chat
      if (userInfo?.username) {
        try {
          const userChannelStats = await kickApi.getUserChannelStats(channelSlug, userInfo.username)


          isModerator = userChannelStats.is_moderator || userChannelStats.is_channel_owner
        } catch (error) {
          console.error('Failed to fetch moderator status for own chat:', error)


        }
      }



      const newMyChannel: ConnectedChannel = {
        slug: channelSlug,
        chatroomId: channelData.chatroom.id,
        channelId: channelData.id,
        messages: [],
        profilePicture: channelData.user?.profile_pic,
        isLive: channelData.livestream?.is_live || false,
        viewerCount: channelData.livestream?.viewer_count || 0,
        userId: channelData.user_id,
        activeChatters: new Map<string, number>(),
        isModerator,
        followerCount: channelData.followers_count || 0
      }



      setMyChannel(newMyChannel)

      setViewMode('myChat')



      emoteService.fetchChannelEmotes(channelSlug).then(emotes => {
      }).catch(err => {
        console.error(`Failed to pre-fetch emotes for your chat:`, err)
      })



      kickChat.subscribeToChannel(
        channelData.chatroom.id,
        (message) => {


          addBatchedMyChannelMessage(message)
        },
        (event: ModerationEvent, type: 'ban' | 'unban') => {


          const moderator = type === 'ban' ? event.banned_by?.username : event.unbanned_by?.username
          const systemMessage: KickChatMessage = {
            id: `system-${type}-${event.id}-${Date.now()}`,
            content: type === 'ban'
              ? event.permanent
                ? `${event.user.username} was permanently banned by ${moderator || 'a moderator'}`
                : `${event.user.username} was timed out for ${event.duration} minute${event.duration === 1 ? '' : 's'} by ${moderator || 'a moderator'}`
              : event.permanent
                ? `${event.user.username} was unbanned by ${moderator || 'a moderator'}`
                : `${event.user.username}'s timeout was removed by ${moderator || 'a moderator'}`,
            sender: {
              id: 0,
              username: 'System',
              slug: 'system',
              is_verified: false,
              identity: { badges: [] }
            },
            broadcaster: {
              id: channelData.user_id,
              username: channelSlug,
              slug: channelSlug,
              is_verified: false
            },
            created_at: new Date().toISOString(),
            type: 'system',
            metadata: {
              moderation_target: {
                id: event.user.id,
                username: event.user.username,
                slug: event.user.slug || event.user.username
              }
            }
          }



          setMyChannel(prev => {
            if (!prev) return prev



            let updatedMessages = prev.messages
            if (type === 'ban') {
              const bannedUsername = event.user.username
              updatedMessages = prev.messages.map(m =>
                m.sender?.username === bannedUsername
                  ? { ...m, deleted: true }
                  : m
              )
            }

            return { ...prev, messages: [...updatedMessages, systemMessage] }
          })
        },
        (event) => {


          setMyChannel(prev => prev ? {
            ...prev,
            messages: prev.messages.map(m =>
              (m.id || m.message_id) === event.message.id
                ? { ...m, deleted: true }
                : m
            )
          } : prev)
        }
      )

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to your chat')
      console.error('Connection error:', err)
    } finally {
      setConnecting(false)
    }
  }

  const handleRemoveChannel = (slug: string) => {
    const channel = channels.find(c => c.slug === slug)
    if (!channel) return

    kickChat.unsubscribeFromChannel(channel.chatroomId)

    
    setChannels(prev => prev.filter(c => c.slug !== slug))

    const updatedChannels = channels.filter(c => c.slug !== slug).map(c => c.slug)
    ;(window.chatarooAPI as any).saveChannels(updatedChannels)



    if (activeChannelSlug === slug) {
      const remainingChannels = channels.filter(c => c.slug !== slug)
      setActiveChannelSlug(remainingChannels.length > 0 ? remainingChannels[0].slug : null)
    }



    setPoppedOutChannels(prev => {
      const next = new Set(prev)
      next.delete(slug)
      return next
    })
  }
  const handleDragStart = (e: React.DragEvent, slug: string) => {
    setDraggedChannel(slug)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetSlug: string) => {
    e.preventDefault()
    if (!draggedChannel || draggedChannel === targetSlug) {
      setDraggedChannel(null)
      return
    }

    setChannels(prev => {
      const newChannels = [...prev]
      const draggedIndex = newChannels.findIndex(c => c.slug === draggedChannel)
      const targetIndex = newChannels.findIndex(c => c.slug === targetSlug)

      if (draggedIndex === -1 || targetIndex === -1) return prev
      const [draggedItem] = newChannels.splice(draggedIndex, 1)
      newChannels.splice(targetIndex, 0, draggedItem)

      return newChannels
    })

    setDraggedChannel(null)
  }

  const handleDragEnd = () => {
    setDraggedChannel(null)
  }

  const handlePopoutChannel = async (channel: ConnectedChannel) => {
    try {
      const channelData = {
        chatroomId: channel.chatroomId,
        channelSlug: channel.slug,
        channelName: channel.slug, // Use slug as display name
        profilePic: channel.profilePicture, // Field is profilePicture not profilePic
        userId: channel.userId,
        userSlug: userInfo?.username || userInfo?.slug || null, // Pass user info for sub emotes
        messages: channel.messages || [], // Pass existing message history
        isModerator: channel.isModerator // Pass moderator status for mod actions
      }

      const result = await (window.chatarooAPI as any).popoutChat(channelData)

      if (result.success && !result.alreadyExists) {
        setPoppedOutChannels(prev => new Set(prev).add(channel.slug))
      }
    } catch (error) {
      console.error('Failed to popout channel:', error)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const handleUsernameClick = async (username: string, message: KickChatMessage) => {
    setSelectedUser({
      username,
      badges: message.sender?.identity?.badges || [],
      sender: message.sender
    })
    setShowUserCard(true)
    setLoadingUserCard(true)
    setUserCardData(null)

    try {
      const channelData = await kickApi.getChannel(username)
      let userChannelStats = null
      if (activeChannel) {
        try {
          userChannelStats = await kickApi.getUserChannelStats(activeChannel.slug, username)
        } catch (error) {
          console.error('Failed to fetch user channel stats:', error)
        }
      }

      setUserCardData({ ...channelData, userChannelStats })
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      setUserCardData({ error: 'Failed to load user data' })
    } finally {
      setLoadingUserCard(false)
    }
  }
  const getActiveChatters = () => {
    if (!activeChannel || !activeChannel.activeChatters) return 0

    const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
    let activeCount = 0
    for (const [username, lastMessageTime] of activeChannel.activeChatters) {
      if (lastMessageTime > tenMinutesAgo) {
        activeCount++
      }
    }

    return activeCount
  }
  const getAnalyticsData = () => {
    if (!activeChannel) return null

    const messages = activeChannel.messages || []
    const analytics = activeChannel.analytics
    const now = Date.now()
    const messagesPerMinute: number[] = []
    for (let i = 4; i >= 0; i--) {
      const bucketStart = now - ((i + 1) * 60 * 1000)
      const bucketEnd = now - (i * 60 * 1000)
      const count = messages.filter(msg => {
        const msgTime = new Date(msg.created_at).getTime()
        return msgTime >= bucketStart && msgTime < bucketEnd
      }).length
      messagesPerMinute.push(count)
    }
    let topChatters: [string, number][]
    let topEmotes: { id: string; name: string; count: number }[]
    let totalMessages: number
    let uniqueChatters: number

    if (analytics) {
      topChatters = Array.from(analytics.chatterCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      topEmotes = Array.from(analytics.emoteCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      totalMessages = analytics.totalMessages
      uniqueChatters = analytics.chatterCounts.size
    } else {
      const chatterCounts = new Map<string, number>()
      messages.forEach(msg => {
        const username = msg.sender?.username || 'Unknown'
        chatterCounts.set(username, (chatterCounts.get(username) || 0) + 1)
      })
      topChatters = Array.from(chatterCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      const emoteCounts = new Map<string, { id: string; name: string; count: number }>()
      const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g
      messages.forEach(msg => {
        let match
        while ((match = emoteRegex.exec(msg.content || '')) !== null) {
          const emoteId = match[1]
          const emoteName = match[2]
          const key = `${emoteId}:${emoteName}`
          const existing = emoteCounts.get(key)
          if (existing) {
            existing.count++
          } else {
            emoteCounts.set(key, { id: emoteId, name: emoteName, count: 1 })
          }
        }
      })
      topEmotes = Array.from(emoteCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      totalMessages = messages.length
      uniqueChatters = chatterCounts.size
    }

    // Average message length (still calculated from buffer since we don't persist content length)
    const avgMessageLength = messages.length > 0
      ? Math.round(messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / messages.length)
      : 0
    const sessionDuration = analytics
      ? Math.floor((now - analytics.sessionStart) / 1000 / 60) // minutes
      : 0

    return {
      messagesPerMinute,
      topChatters,
      topEmotes,
      totalMessages,
      uniqueChatters,
      avgMessageLength,
      sessionDuration
    }
  }
  useEffect(() => {
    if (!activeChannel) return

    const currentCount = activeChannel.viewerCount
    if (previousViewerCount.current !== 0 && previousViewerCount.current !== currentCount) {
      setViewerCountBlink(true)
      setTimeout(() => setViewerCountBlink(false), 2000) // Blink for 2 seconds
    }
    previousViewerCount.current = currentCount
  }, [activeChannel?.viewerCount])

  // Detect chatter count changes and trigger blink
  useEffect(() => {
    if (!activeChannel) return

    const currentCount = getActiveChatters()
    if (previousChatterCount.current !== 0 && previousChatterCount.current !== currentCount) {
      setChatterCountBlink(true)
      setTimeout(() => setChatterCountBlink(false), 2000) // Blink for 2 seconds
    }
    previousChatterCount.current = currentCount
  }, [activeChannel?.messages?.length])

  // Detect follower count changes and trigger blink
  useEffect(() => {
    if (!activeChannel) return

    const currentCount = activeChannel.followerCount || 0
    if (previousFollowerCount.current !== 0 && previousFollowerCount.current !== currentCount) {
      setFollowerCountBlink(true)
      setTimeout(() => setFollowerCountBlink(false), 2000) // Blink for 2 seconds
    }
    previousFollowerCount.current = currentCount
  }, [activeChannel?.followerCount])

  // Cleanup old entries from activeChatters map every minute
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
      setChannels(prev => prev.map(ch => {
        const newActiveChatters = new Map(ch.activeChatters)
        let hasChanges = false

        for (const [username, lastMessageTime] of newActiveChatters) {
          if (lastMessageTime <= tenMinutesAgo) {
            newActiveChatters.delete(username)
            hasChanges = true
          }
        }

        return hasChanges ? { ...ch, activeChatters: newActiveChatters } : ch
      }))
      setMyChannel(prev => {
        if (!prev) return prev

        const newActiveChatters = new Map(prev.activeChatters)
        let hasChanges = false

        for (const [username, lastMessageTime] of newActiveChatters) {
          if (lastMessageTime <= tenMinutesAgo) {
            newActiveChatters.delete(username)
            hasChanges = true
          }
        }

        return hasChanges ? { ...prev, activeChatters: newActiveChatters } : prev
      })
    }, 60000) // Run every minute

    return () => clearInterval(cleanupInterval)
  }, [])

  // Rainbow fade effect
  useEffect(() => {
    // Smoothly blend between two colors
    const interpolateColor = (color1: string, color2: string, factor: number) => {
      const hex = (x: string) => parseInt(x, 16)
      const r1 = hex(color1.slice(1, 3))
      const g1 = hex(color1.slice(3, 5))
      const b1 = hex(color1.slice(5, 7))
      const r2 = hex(color2.slice(1, 3))
      const g2 = hex(color2.slice(3, 5))
      const b2 = hex(color2.slice(5, 7))

      const r = Math.round(r1 + (r2 - r1) * factor)
      const g = Math.round(g1 + (g2 - g1) * factor)
      const b = Math.round(b1 + (b2 - b1) * factor)

      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    // Custom gradient takes priority over rainbow fade
    if (settings.theme.customGradient && settings.theme.gradientColors?.length >= 2) {
      let progress = 0
      let frameCount = 0
      const colors = settings.theme.gradientColors

      const gradientInterval = setInterval(() => {
        progress = (progress + 0.005) % 1 // Cycle through 0-1

        // Find the two gradient colors to blend
        const totalSegments = colors.length
        const scaledProgress = progress * totalSegments
        const segmentIndex = Math.floor(scaledProgress) % totalSegments
        const segmentProgress = scaledProgress - Math.floor(scaledProgress)

        const color1 = colors[segmentIndex]
        const color2 = colors[(segmentIndex + 1) % totalSegments]
        const gradientColor = interpolateColor(color1, color2, segmentProgress)

        
        document.documentElement.style.setProperty('--accent-color', gradientColor)

        // Throttle React updates for performance
        frameCount++
        if (frameCount % 4 === 0) {
          setCurrentAccentColor(gradientColor)
        }
      }, 50)

      return () => {
        clearInterval(gradientInterval)
        setCurrentAccentColor(settings.theme.accentColor)
        document.documentElement.style.setProperty('--accent-color', settings.theme.accentColor)
      }
    }

    if (!settings.theme.rainbowFade) {
      // Use static accent color when animations are disabled
      setCurrentAccentColor(settings.theme.accentColor)
      document.documentElement.style.setProperty('--accent-color', settings.theme.accentColor)
      return
    }

    let hue = 0
    let frameCount = 0
    const rainbowInterval = setInterval(() => {
      hue = (hue + 1) % 360 // Cycle through 0-359 degrees
      const rainbowColor = `hsl(${hue}, 100%, 50%)`

      
      document.documentElement.style.setProperty('--accent-color', rainbowColor)

      // Throttle React updates for performance
      frameCount++
      if (frameCount % 4 === 0) {
        setCurrentAccentColor(rainbowColor)
      }
    }, 50) // Update every 50ms for smooth animation (completes full cycle in 18 seconds)

    return () => {
      clearInterval(rainbowInterval)
      
      setCurrentAccentColor(settings.theme.accentColor)
      document.documentElement.style.setProperty('--accent-color', settings.theme.accentColor)
    }
  }, [settings.theme.rainbowFade, settings.theme.accentColor, settings.theme.customGradient, settings.theme.gradientColors])

  const renderMessage = (message: KickChatMessage) => {
    // System messages get special formatting with clickable usernames
    if (message.type === 'system') {
      
      const renderSystemContent = () => {
        const content = message.content || ''
        const parts: (string | JSX.Element)[] = []

        
        
        const targetUserRegex = /^([a-zA-Z0-9_-]+)(?:'s| was)/
        
        const moderatorRegex = /by ([a-zA-Z0-9_-]+)$/

        let lastIndex = 0
        const matches: Array<{ username: string; index: number; length: number }> = []

        
        const targetMatch = content.match(targetUserRegex)
        if (targetMatch) {
          matches.push({
            username: targetMatch[1],
            index: 0,
            length: targetMatch[1].length
          })
        }

        
        const moderatorMatch = content.match(moderatorRegex)
        if (moderatorMatch) {
          const index = content.lastIndexOf('by ') + 3
          matches.push({
            username: moderatorMatch[1],
            index: index,
            length: moderatorMatch[1].length
          })
        }

        
        matches.forEach((m, i) => {
          
          if (m.index > lastIndex) {
            parts.push(content.substring(lastIndex, m.index))
          }

          
          
          const targetUser = message.metadata?.moderation_target
          const userId = targetUser?.username === m.username ? targetUser.id : 0
          const minimalMessage: KickChatMessage = {
            id: `system-lookup-${m.username}`,
            content: '',
            sender: {
              id: userId,
              username: m.username,
              slug: targetUser?.slug || m.username,
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
                handleUsernameClick(m.username, minimalMessage)
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
        <div key={message.id || message.message_id} className="message system-message">
          <span className="timestamp">{formatTimestamp(message.created_at)}</span>
          <span className="system-content">🛡️ {renderSystemContent()}</span>
        </div>
      )
    }

    
    const username = message.sender?.username || 'Unknown'
    const color = getUsernameColor(username)
    const badges = message.sender?.identity?.badges || []
    // First parse Kick native emotes [emote:id:name], then third-party text emotes
    const kickEmoteParts = parseEmotes(message.content || '')
    const contentParts = parseThirdPartyEmotes(kickEmoteParts, thirdPartyEmoteMap)

    // Determine highlight class based on message properties
    let highlightClass = ''

    // Check for mention (highest priority)
    if (settings?.highlights?.mentions?.enabled && userInfo?.username) {
      const messageContent = message.content || ''
      const mentionPattern = new RegExp(`@${userInfo.username}\\b`, 'i')
      if (mentionPattern.test(messageContent)) {
        highlightClass = 'message-highlight-mention'
      }
    }

    // Check for moderator badge (if no mention highlight)
    if (!highlightClass && settings?.highlights?.moderators?.enabled) {
      const isModerator = badges.some(badge => badge.type === 'moderator')
      if (isModerator) {
        highlightClass = 'message-highlight-moderator'
      }
    }

    // Check for verified badge (if no mention or moderator highlight)
    if (!highlightClass && settings?.highlights?.verified?.enabled) {
      const isVerified = badges.some(badge => badge.type === 'verified')
      if (isVerified) {
        highlightClass = 'message-highlight-verified'
      }
    }

    // Check for VIP badge
    if (!highlightClass && settings?.highlights?.vip?.enabled) {
      const isVip = badges.some(badge => badge.type === 'vip')
      if (isVip) {
        highlightClass = 'message-highlight-vip'
      }
    }

    // Check for subscriber badge
    if (!highlightClass && settings?.highlights?.subscribers?.enabled) {
      const isSubscriber = badges.some(badge => badge.type === 'subscriber')
      if (isSubscriber) {
        highlightClass = 'message-highlight-subscriber'
      }
    }

    // Check for founder badge
    if (!highlightClass && settings?.highlights?.founder?.enabled) {
      const isFounder = badges.some(badge => badge.type === 'founder')
      if (isFounder) {
        highlightClass = 'message-highlight-founder'
      }
    }

    // Check for OG badge
    if (!highlightClass && settings?.highlights?.og?.enabled) {
      const isOG = badges.some(badge => badge.type === 'og' || badge.type === 'OG')
      if (isOG) {
        highlightClass = 'message-highlight-og'
      }
    }

    // Check for sub gifter badge (lowest priority)
    if (!highlightClass && settings?.highlights?.subGifters?.enabled) {
      const isSubGifter = badges.some(badge =>
        badge.type === 'sub_gifter' ||
        badge.type === 'subgifter' ||
        badge.type === 'sub-gifter' ||
        badge.text?.toLowerCase().includes('gifter')
      )
      if (isSubGifter) {
        highlightClass = 'message-highlight-subgifter'
      }
    }

    return (
      <div key={message.id || message.message_id} className={`message ${highlightClass} ${message.deleted ? 'message-deleted' : ''}`} data-message-id={message.id || message.message_id}>
        {/* Reply preview */}
        {message.type === 'reply' && message.metadata?.original_sender && message.metadata?.original_message && (
          <div
            className="reply-preview"
            onClick={() => {
              // Scroll to original message if it exists
              const originalId = message.metadata?.original_message?.id
              if (originalId) {
                const element = document.querySelector(`[data-message-id="${originalId}"]`)
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  element.classList.add('message-flash')
                  setTimeout(() => element.classList.remove('message-flash'), 1500)
                }
              }
            }}
          >
            <span className="reply-icon">↩</span>
            <span className="reply-to">Replying to </span>
            <span
              className="reply-username"
              style={{ color: getUsernameColor(message.metadata.original_sender.username) }}
            >
              @{message.metadata.original_sender.username}
            </span>
            <span className="reply-text">: {(() => {
              // Parse emotes in reply preview
              const replyContent = message.metadata.original_message.content
              let parsedReply = parseEmotes(replyContent)
              parsedReply = parseThirdPartyEmotes(parsedReply, thirdPartyEmoteMap)
              return parsedReply
            })()}</span>
          </div>
        )}

        <div className="message-main">
          <span className="timestamp">{formatTimestamp(message.created_at)}</span>

          {badges.length > 0 && (
            <span className="badges">
              {badges.map((badge, i) => {
                // Show present icon for sub gifters instead of text
                const isSubGifter = badge.type === 'sub_gifter' ||
                                    badge.type === 'subgifter' ||
                                    badge.type === 'sub-gifter' ||
                                    badge.text?.toLowerCase().includes('gifter')

                return (
                  <span key={i} className={`badge badge-${badge.type}`} title={badge.text}>
                    {isSubGifter ? '🎁' : badge.text}
                  </span>
                )
              })}
            </span>
          )}

          <span
            className="username"
            style={{ color }}
            onClick={() => handleUsernameClick(username, message)}
          >
            {username}
          </span>

          <span className="separator">:</span>

          <span className="content">{contentParts}</span>

          {/* Deleted indicator */}
          {message.deleted && (
            <span className="deleted-indicator">(Deleted by a Moderator)</span>
          )}

          {/* Reply button */}
          {isAuthenticated && !message.deleted && (
            <button
              className="reply-btn"
              onClick={(e) => {
                e.stopPropagation()
                setReplyingTo(message)
                messageInputRef.current?.focus()
              }}
              title="Reply to this message"
            >
              ↩
            </button>
          )}

          {/* Quick mod actions */}
          {isAuthenticated && !message.deleted && activeChannel?.isModerator && message.sender?.id && userInfo?.id !== message.sender.id && (
            <>
              <button
                className="quick-mod-btn timeout-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmModal({
                    isOpen: true,
                    title: 'Timeout User',
                    message: `Timeout ${message.sender.username} for 5 minutes?`,
                    confirmText: 'Timeout',
                    confirmColor: '#ffa500',
                    onConfirm: async () => {
                      setConfirmModal(prev => ({ ...prev, isOpen: false }))
                      try {
                        const result = await window.chatarooAPI.timeoutUser({
                          broadcasterUserId: activeChannel.userId,
                          userId: message.sender.id,
                          durationMinutes: 5
                        })
                        if (!result.success) {
                          alert(result.error || 'Failed to timeout user')
                        }
                      } catch (err: any) {
                        alert(err.message || 'Failed to timeout user')
                      }
                    }
                  })
                }}
                title="Timeout 5 min"
              >
                ⏱
              </button>
              <button
                className="quick-mod-btn ban-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmModal({
                    isOpen: true,
                    title: 'Ban User',
                    message: `Permanently ban ${message.sender.username}? This action requires manual unbanning.`,
                    confirmText: 'Ban',
                    confirmColor: '#dc3545',
                    onConfirm: async () => {
                      setConfirmModal(prev => ({ ...prev, isOpen: false }))
                      try {
                        const result = await window.chatarooAPI.banUser({
                          broadcasterUserId: activeChannel.userId,
                          userId: message.sender.id
                        })
                        if (!result.success) {
                          alert(result.error || 'Failed to ban user')
                        }
                      } catch (err: any) {
                        alert(err.message || 'Failed to ban user')
                      }
                    }
                  })
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
  }

  return (
    <div className="app">
      {/* Snow effect for holidays */}
      {settings.theme?.happyHolidays && <SnowEffect />}

      {/* Update notification */}
      {updateAvailable && !updateDownloaded && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: currentAccentColor,
          color: '#000',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10000,
          fontWeight: 600
        }}>
          <span>New version {updateAvailable} available!</span>
          <button
            onClick={async () => {
              setDownloadingUpdate(true)
              await window.chatarooAPI.downloadUpdate()
            }}
            disabled={downloadingUpdate}
            style={{
              backgroundColor: '#000',
              color: currentAccentColor,
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: downloadingUpdate ? 'wait' : 'pointer',
              fontWeight: 600,
              opacity: downloadingUpdate ? 0.6 : 1
            }}
          >
            {downloadingUpdate ? 'Downloading...' : 'Download Update'}
          </button>
        </div>
      )}

      {updateDownloaded && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: currentAccentColor,
          color: '#000',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10000,
          fontWeight: 600
        }}>
          <span>Update downloaded! Restart to install.</span>
          <button
            onClick={() => window.chatarooAPI.installUpdate()}
            style={{
              backgroundColor: '#000',
              color: currentAccentColor,
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Restart Now
          </button>
        </div>
      )}

      <div className="sidebar">
        <div className="app-header">
          <img
            src={holidayLogo}
            alt="Chataroo"
            style={{
              height: '24px',
              marginBottom: '4px',
              marginLeft: '-4px'
            }}
          />
          <p className="subtitle">Kick Chat Client</p>
          {isAuthenticated ? (
            <div style={{ marginTop: '12px' }}>
              {showUsernameInput ? (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#0f0f0f',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  border: `1px solid ${currentAccentColor}`
                }}>
                  <div style={{
                    color: currentAccentColor,
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '8px'
                  }}>
                    Enter your Kick username
                  </div>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
                    placeholder="Your username..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #2a2a2a',
                      borderRadius: '4px',
                      color: '#efeff1',
                      fontSize: '13px',
                      marginBottom: '8px'
                    }}
                  />
                  <button
                    onClick={handleSetUsername}
                    disabled={!usernameInput.trim()}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: currentAccentColor,
                      border: 'none',
                      borderRadius: '4px',
                      color: '#000',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      opacity: usernameInput.trim() ? 1 : 0.5
                    }}
                  >
                    Set Username
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  backgroundColor: '#0f0f0f',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  border: `1px solid ${currentAccentColor}`
                }}>
                  {userInfo?.profile_pic ? (
                    <img
                      src={userInfo.profile_pic}
                      alt={userInfo.username || 'User'}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${currentAccentColor}`
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: currentAccentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#000'
                    }}>
                      ✓
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: currentAccentColor,
                      fontSize: '13px',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {userInfo?.username || userInfo?.slug || 'Authenticated'}
                    </div>
                    <div style={{
                      color: '#888',
                      fontSize: '10px'
                    }}>
                      Ready to send messages
                    </div>
                  </div>
                </div>
              )}
              <button
                className={`your-chat-button ${viewMode === 'myChat' ? 'active' : 'inactive'}`}
                onClick={handleConnectToMyChat}
                disabled={!userInfo?.username && !userInfo?.slug}
              >
                {viewMode === 'myChat' ? '● Your Chat' : '💬 Your Chat'}
              </button>
              <button
                className="show-support-button"
                onClick={() => setShowSupportModal(true)}
                disabled={channels.length === 0 || supporting}
                title={channels.length === 0 ? 'Add channels first' : 'Send a global emoji to all channels'}
                style={{ cursor: channels.length === 0 || supporting ? 'not-allowed' : 'pointer' }}
              >
                {supporting ? '💚 Supporting...' : '💚 Show Support'}
              </button>

              {/* Show Support Modal - positioned in sidebar */}
              {showSupportModal && (
                <div className="show-support-modal">
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{ margin: 0, color: currentAccentColor, fontSize: '13px', fontWeight: 600 }}>
                      💚 Show Support
                    </h3>
                    <button
                      onClick={() => setShowSupportModal(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        fontSize: '20px',
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <p style={{ color: '#888', fontSize: '10px', marginBottom: '8px', margin: 0 }}>
                    Sending emote to {channels.length} channel{channels.length > 1 ? 's' : ''}
                  </p>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {/* User's Sub Emotes Section */}
                    {mySubEmotes.length > 0 && (
                      <>
                        <p style={{ color: '#aaa', fontSize: '9px', margin: '0 0 4px 0', fontWeight: 600 }}>
                          Your Emotes
                        </p>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '4px',
                          marginBottom: '8px'
                        }}>
                          {mySubEmotes.map(emote => (
                            <button
                              key={`sub-${emote.id}`}
                              onClick={() => handleShowSupport(emote)}
                              style={{
                                background: '#2a2a2a',
                                border: '1px solid #444',
                                borderRadius: '3px',
                                padding: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = currentAccentColor
                                e.currentTarget.style.transform = 'scale(1.05)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#444'
                                e.currentTarget.style.transform = 'scale(1)'
                              }}
                              title={emote.name}
                            >
                              <img
                                src={`https://files.kick.com/emotes/${emote.id}/fullsize`}
                                alt={emote.name}
                                style={{ width: '24px', height: '24px' }}
                              />
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Global Emotes Section */}
                    <p style={{ color: '#aaa', fontSize: '9px', margin: '0 0 4px 0', fontWeight: 600 }}>
                      Global Emotes
                    </p>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '4px'
                    }}>
                      {globalEmojis.map(emoji => (
                        <button
                          key={emoji.id}
                          onClick={() => handleShowSupport(emoji)}
                          style={{
                            background: '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            padding: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = currentAccentColor
                            e.currentTarget.style.transform = 'scale(1.05)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#444'
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                          title={emoji.name}
                        >
                          <img
                            src={`https://files.kick.com/emotes/${emoji.id}/fullsize`}
                            alt={emoji.name}
                            style={{ width: '24px', height: '24px' }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowSettingsModal(true)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = currentAccentColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#444'}
              >
                <span style={{ fontSize: '16px' }}>⚙️</span> Settings
              </button>

              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#ff4444',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '10px',
                backgroundColor: currentAccentColor,
                border: 'none',
                borderRadius: '4px',
                color: '#000',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Login to Send Messages
            </button>
          )}
        </div>

        <div className="channel-input">
          <input
            type="text"
            placeholder="Enter channel name..."
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            disabled={connecting}
          />
          <button
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? 'Adding...' : 'Add Channel'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="channels-list">
          <h3>Channels ({channels.length})</h3>
          {channels.map(channel => (
            <div
              key={channel.slug}
              className={`channel-item ${viewMode === 'channels' && activeChannelSlug === channel.slug ? 'active' : ''} ${draggedChannel === channel.slug ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, channel.slug)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, channel.slug)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                setActiveChannelSlug(channel.slug)
                setViewMode('channels')
              }}
            >
              {channel.profilePicture && (
                <img
                  src={channel.profilePicture}
                  alt={channel.slug}
                  className="channel-avatar"
                />
              )}
              <div className="channel-info">
                <span className="channel-name">{channel.slug}</span>
                <span className="channel-viewers">
                  {channel.isLive && <span className="live-dot">●</span>}
                  {poppedOutChannels.has(channel.slug) && <span className="popout-indicator">⧉</span>}
                  {channel.viewerCount > 0 ? `${channel.viewerCount.toLocaleString()} viewers` : 'Offline'}
                </span>
              </div>
              <button
                className="popout-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePopoutChannel(channel)
                }}
                title={poppedOutChannels.has(channel.slug) ? "Already popped out" : "Pop out chat"}
                disabled={poppedOutChannels.has(channel.slug)}
              >
                ⧉
              </button>
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveChannel(channel.slug)
                }}
                title="Remove channel"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        {activeChannel && poppedOutChannels.has(activeChannel.slug) ? (
          <div className="popped-out-notice">
            <div className="popped-out-icon">⧉</div>
            <h3>Chat Popped Out</h3>
            <p>{activeChannel.slug}'s chat is currently in a separate window.</p>
            <p className="popped-out-hint">Close the pop-out window to return chat here.</p>
          </div>
        ) : activeChannel ? (
          <>
            <div className="chat-header">
              <div className="chat-header-info">
                {activeChannel.profilePicture && (
                  <img
                    src={activeChannel.profilePicture}
                    alt={activeChannel.slug}
                    className="chat-header-avatar"
                  />
                )}
                <div className="chat-header-text">
                  <h2>
                    {activeChannel.slug}
                    {viewMode === 'myChat' && <span style={{ color: currentAccentColor, fontSize: '14px', marginLeft: '8px' }}>(Your Chat)</span>}
                  </h2>
                  <div className="chat-header-stats">
                    <span className="stat">
                      <span className={`stat-blink-dot ${viewerCountBlink ? 'blinking' : ''}`}>●</span>
                      {activeChannel.viewerCount.toLocaleString()} viewers
                    </span>
                    <span className="stat-separator">•</span>
                    <span className="stat">
                      <span className={`stat-blink-dot ${chatterCountBlink ? 'blinking' : ''}`}>●</span>
                      {getActiveChatters()} active chatters
                    </span>
                    {activeChannel.followerCount !== undefined && (
                      <>
                        <span className="stat-separator">•</span>
                        <span className="stat">
                          <span className={`stat-blink-dot stat-blink-dot-green ${followerCountBlink ? 'blinking' : ''}`}>●</span>
                          {activeChannel.followerCount.toLocaleString()} followers
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
                  ● {connected ? 'Connected' : 'Connecting...'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {viewMode === 'myChat' && (
                    <button
                      onClick={() => setShowGiveawayModal(true)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: giveawayActive ? currentAccentColor : '#2a2a2a',
                        border: `1px solid ${currentAccentColor}`,
                        borderRadius: '4px',
                        color: giveawayActive ? '#000' : currentAccentColor,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!giveawayActive) {
                          e.currentTarget.style.backgroundColor = currentAccentColor
                          e.currentTarget.style.color = '#000'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!giveawayActive) {
                          e.currentTarget.style.backgroundColor = '#2a2a2a'
                          e.currentTarget.style.color = currentAccentColor
                        }
                      }}
                      title="Open Giveaway"
                    >
                      🎁 {giveawayActive ? `Live (${giveawayEntries.size})` : 'Giveaway'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowAnalytics(true)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#2a2a2a',
                      border: `1px solid ${currentAccentColor}`,
                      borderRadius: '4px',
                      color: currentAccentColor,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = currentAccentColor
                      e.currentTarget.style.color = '#000'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#2a2a2a'
                      e.currentTarget.style.color = currentAccentColor
                    }}
                    title="Chat Analytics"
                  >
                    📊 Analytics
                  </button>
                  <button
                    onClick={() => window.chatarooAPI.openExternal(`https://kick.com/${activeChannel.slug}`)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#2a2a2a',
                      border: `1px solid ${currentAccentColor}`,
                      borderRadius: '4px',
                      color: currentAccentColor,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = currentAccentColor
                      e.currentTarget.style.color = '#000'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#2a2a2a'
                      e.currentTarget.style.color = currentAccentColor
                    }}
                  >
                    🎬 Open Stream
                  </button>
                </div>
              </div>
            </div>

            <div className="chat-container">
              <ChatMessages
                messages={activeChannel.messages}
                channelSlug={activeChannel.slug}
                thirdPartyEmoteMap={thirdPartyEmoteMap}
                settings={settings}
                currentAccentColor={currentAccentColor}
                userInfo={userInfo}
                isAuthenticated={isAuthenticated}
                isModerator={activeChannel?.isModerator || false}
                activeChannelUserId={activeChannel.userId}
                onUsernameClick={handleUsernameClick}
                onReply={handleReplyClick}
                onTimeout={handleTimeoutClick}
                onBan={handleBanClick}
                onScrollStateChange={handleScrollStateChange}
                containerRef={messagesContainerRef}
              />

              {showJumpButton && (
                <button className="jump-to-bottom" onClick={jumpToBottom}>
                  <span>↓</span> New Messages
                </button>
              )}
            </div>

            <div className="chat-input">
              {/* Reply indicator */}
              {replyingTo && (
                <div className="reply-indicator">
                  <span className="reply-indicator-icon">↩</span>
                  <span className="reply-indicator-text">
                    Replying to <span style={{ color: getUsernameColor(replyingTo.sender.username), fontWeight: 600 }}>@{replyingTo.sender.username}</span>
                  </span>
                  <button
                    className="reply-indicator-cancel"
                    onClick={() => setReplyingTo(null)}
                    title="Cancel reply"
                  >
                    ×
                  </button>
                </div>
              )}
              {showEmotePicker && activeChannel && (
                <EmotePicker
                  channelSlug={activeChannel.slug}
                  onEmoteSelect={handleEmoteSelect}
                  onClose={() => setShowEmotePicker(false)}
                  mySubEmotes={mySubEmotes}
                  thirdPartyEmotes={thirdPartyEmotes}
                  enableSevenTV={settings.emotes?.enableSevenTV ?? true}
                  enableBTTV={settings.emotes?.enableBTTV ?? true}
                />
              )}
              <div
                ref={messageInputRef}
                contentEditable={isAuthenticated && !sendingMessage}
                onInput={(e) => {
                  const content = (e.target as HTMLDivElement).innerText
                  setMessageInput(content)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                data-placeholder={isAuthenticated ? "Send a message..." : "Login to send messages"}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '14px',
                  minHeight: '38px',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  outline: 'none',
                  cursor: isAuthenticated && !sendingMessage ? 'text' : 'not-allowed',
                  opacity: isAuthenticated && !sendingMessage ? 1 : 0.5
                }}
              />
              <button
                className="emote-button"
                onClick={toggleEmotePicker}
                disabled={!isAuthenticated}
                title="Emotes"
              >
                😊
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!isAuthenticated || sendingMessage || !messageInput.trim()}
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>Welcome to Chataroo!</h2>
            <p>Add a Kick channel to get started.</p>
            <p className="hint">
              Created with ❤️ by{' '}
              <span
                onClick={() => window.chatarooAPI.openExternal('https://kick.com/fevaa')}
                style={{
                  color: currentAccentColor,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
                onMouseEnter={(e) => {
                  const lighterColor = currentAccentColor === '#53fc18' ? '#6fff3d' : currentAccentColor
                  e.currentTarget.style.color = lighterColor
                }}
                onMouseLeave={(e) => e.currentTarget.style.color = currentAccentColor}
              >
                @Fevaa
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
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
            zIndex: 1000
          }}
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#fff' }}>Settings</h2>

            {/* Theme Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '12px' }}>Appearance</h3>

              {/* Accent Color */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
                  Accent Color
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={currentAccentColor}
                    onChange={(e) => handleSettingsChange({ theme: { accentColor: e.target.value } })}
                    style={{
                      width: '50px',
                      height: '38px',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: 'transparent'
                    }}
                  />
                  <input
                    type="text"
                    value={currentAccentColor}
                    onChange={(e) => handleSettingsChange({ theme: { accentColor: e.target.value } })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                    placeholder="#53fc18"
                  />
                  <button
                    onClick={() => handleSettingsChange({ theme: { accentColor: '#53fc18' } })}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Rainbow Fade Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>🌈 Rainbow Fade</span>
                  <div
                    onClick={() => handleSettingsChange({ theme: { rainbowFade: !settings.theme.rainbowFade, customGradient: false } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.theme.rainbowFade ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.theme.rainbowFade ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Smoothly cycle through rainbow colors
                </p>
              </div>

              {/* Custom Gradient Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>🎨 Custom Gradient</span>
                  <div
                    onClick={() => handleSettingsChange({ theme: { customGradient: !settings.theme.customGradient, rainbowFade: false } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.theme.customGradient ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.theme.customGradient ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Create your own color flow with custom colors
                </p>

                {/* Color Pickers - only show when custom gradient is enabled */}
                {settings.theme.customGradient && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      {(settings.theme.gradientColors || ['#53fc18', '#00bfff', '#ff6b6b']).map((color: string, index: number) => (
                        <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                              const newColors = [...(settings.theme.gradientColors || ['#53fc18', '#00bfff', '#ff6b6b'])]
                              newColors[index] = e.target.value
                              handleSettingsChange({ theme: { gradientColors: newColors } })
                            }}
                            style={{
                              width: '40px',
                              height: '40px',
                              border: '2px solid #444',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              backgroundColor: 'transparent'
                            }}
                          />
                          <span style={{ fontSize: '10px', color: '#666' }}>#{index + 1}</span>
                        </div>
                      ))}

                      {/* Add/Remove color buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(settings.theme.gradientColors || []).length < 5 && (
                            <button
                              onClick={() => {
                                const newColors = [...(settings.theme.gradientColors || ['#53fc18', '#00bfff', '#ff6b6b']), '#ffffff']
                                handleSettingsChange({ theme: { gradientColors: newColors } })
                              }}
                              style={{
                                width: '32px',
                                height: '40px',
                                border: '2px dashed #444',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Add color"
                            >
                              +
                            </button>
                          )}

                          {(settings.theme.gradientColors || []).length > 2 && (
                            <button
                              onClick={() => {
                                const newColors = [...(settings.theme.gradientColors || [])]
                                newColors.pop()
                                handleSettingsChange({ theme: { gradientColors: newColors } })
                              }}
                              style={{
                                width: '32px',
                                height: '40px',
                                border: '2px dashed #444',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Remove color"
                            >
                              −
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Happy Holidays Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>❄️ Happy Holidays</span>
                  <div
                    onClick={() => handleSettingsChange({ theme: { happyHolidays: !settings.theme.happyHolidays } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.theme.happyHolidays ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.theme.happyHolidays ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Festive snow effect on background
                </p>
              </div>
            </div>

            {/* Chat Display Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '12px' }}>Chat Display</h3>

              {/* Font Size */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Font Size</span>
                  <span style={{ color: '#fff' }}>{settings.chat.fontSize}px</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="20"
                  value={settings.chat.fontSize}
                  onChange={(e) => handleSettingsChange({ chat: { fontSize: parseInt(e.target.value) } })}
                  style={{
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>

              {/* Message History Limit */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Message History Limit</span>
                  <span style={{ color: '#fff' }}>{settings.chat.messageHistoryLimit}</span>
                </label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={settings.chat.messageHistoryLimit}
                  onChange={(e) => handleSettingsChange({ chat: { messageHistoryLimit: parseInt(e.target.value) } })}
                  style={{
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  <span>500</span>
                  <span>5000</span>
                </div>
              </div>

              {/* Auto-scroll Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Auto-scroll</span>
                  <div
                    onClick={() => handleSettingsChange({ chat: { autoScroll: !settings.chat.autoScroll } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.chat.autoScroll ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.chat.autoScroll ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Automatically scroll to new messages
                </p>
              </div>

              {/* 12-Hour Time Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>12-Hour Time Format</span>
                  <div
                    onClick={() => handleSettingsChange({ chat: { use12HourTime: !settings.chat.use12HourTime } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.chat.use12HourTime ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.chat.use12HourTime ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Use 12-hour format with AM/PM instead of 24-hour
                </p>
              </div>
            </div>

            {/* Emotes Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '12px' }}>Third-Party Emotes</h3>

              {/* 7TV Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>7TV Emotes</span>
                  <div
                    onClick={() => handleSettingsChange({ emotes: { enableSevenTV: !settings.emotes?.enableSevenTV } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.emotes?.enableSevenTV ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.emotes?.enableSevenTV ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Display 7TV global and channel emotes
                </p>
              </div>

              {/* BTTV Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>BetterTTV Emotes</span>
                  <div
                    onClick={() => handleSettingsChange({ emotes: { enableBTTV: !settings.emotes?.enableBTTV } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.emotes?.enableBTTV ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.emotes?.enableBTTV ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Display BTTV global emotes
                </p>
              </div>
            </div>

            {/* Moderation Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '12px' }}>Moderation</h3>

              {/* Skip Confirmation Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Quick Actions (No Confirmation)</span>
                  <div
                    onClick={() => handleSettingsChange({ moderation: { skipConfirmation: !settings.moderation?.skipConfirmation } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.moderation?.skipConfirmation ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.moderation?.skipConfirmation ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                  Skip confirmation dialogs for timeouts and bans
                </p>
              </div>
            </div>

            {/* Message Highlights Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '12px' }}>Message Highlights</h3>

              {/* Mention Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight Mentions (@{userInfo?.username || 'you'})</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { mentions: { enabled: !settings.highlights.mentions.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights.mentions.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights.mentions.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights.mentions.color}
                    onChange={(e) => handleSettingsChange({ highlights: { mentions: { color: e.target.value } } })}
                    style={{
                      width: '40px',
                      height: '32px',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: 'transparent'
                    }}
                  />
                  <input
                    type="text"
                    value={settings.highlights.mentions.color}
                    onChange={(e) => handleSettingsChange({ highlights: { mentions: { color: e.target.value } } })}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                    placeholder="#ff4444"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { mentions: { color: '#ff4444' } } })}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Moderator Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight Moderators</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { moderators: { enabled: !settings.highlights.moderators.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights.moderators.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights.moderators.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights.moderators.color}
                    onChange={(e) => handleSettingsChange({ highlights: { moderators: { color: e.target.value } } })}
                    style={{ width: '40px', height: '32px', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={settings.highlights.moderators.color}
                    onChange={(e) => handleSettingsChange({ highlights: { moderators: { color: e.target.value } } })}
                    style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                    placeholder="#ffdd00"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { moderators: { color: '#ffdd00' } } })}
                    style={{ padding: '6px 10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Verified Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight Verified Users</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { verified: { enabled: !settings.highlights.verified.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights.verified.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights.verified.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights.verified.color}
                    onChange={(e) => handleSettingsChange({ highlights: { verified: { color: e.target.value } } })}
                    style={{ width: '40px', height: '32px', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={settings.highlights.verified.color}
                    onChange={(e) => handleSettingsChange({ highlights: { verified: { color: e.target.value } } })}
                    style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                    placeholder="#53fc18"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { verified: { color: '#53fc18' } } })}
                    style={{ padding: '6px 10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Founder Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight Founders</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { founder: { enabled: !settings.highlights.founder.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights.founder.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights.founder.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights.founder.color}
                    onChange={(e) => handleSettingsChange({ highlights: { founder: { color: e.target.value } } })}
                    style={{ width: '40px', height: '32px', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={settings.highlights.founder.color}
                    onChange={(e) => handleSettingsChange({ highlights: { founder: { color: e.target.value } } })}
                    style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                    placeholder="#ffd700"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { founder: { color: '#ffd700' } } })}
                    style={{ padding: '6px 10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* OG Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight OGs</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { og: { enabled: !settings.highlights?.og?.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights?.og?.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights?.og?.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights?.og?.color || '#ff6b35'}
                    onChange={(e) => handleSettingsChange({ highlights: { og: { color: e.target.value } } })}
                    style={{ width: '40px', height: '32px', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={settings.highlights?.og?.color || '#ff6b35'}
                    onChange={(e) => handleSettingsChange({ highlights: { og: { color: e.target.value } } })}
                    style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                    placeholder="#ff6b35"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { og: { color: '#ff6b35' } } })}
                    style={{ padding: '6px 10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* VIP Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight VIPs</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { vip: { enabled: !settings.highlights.vip.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights.vip.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights.vip.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights.vip.color}
                    onChange={(e) => handleSettingsChange({ highlights: { vip: { color: e.target.value } } })}
                    style={{ width: '40px', height: '32px', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={settings.highlights.vip.color}
                    onChange={(e) => handleSettingsChange({ highlights: { vip: { color: e.target.value } } })}
                    style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                    placeholder="#ff1493"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { vip: { color: '#ff1493' } } })}
                    style={{ padding: '6px 10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Subscriber Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight Subscribers</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { subscribers: { enabled: !settings.highlights.subscribers.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights.subscribers.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights.subscribers.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights.subscribers.color}
                    onChange={(e) => handleSettingsChange({ highlights: { subscribers: { color: e.target.value } } })}
                    style={{ width: '40px', height: '32px', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={settings.highlights.subscribers.color}
                    onChange={(e) => handleSettingsChange({ highlights: { subscribers: { color: e.target.value } } })}
                    style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                    placeholder="#9b59b6"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { subscribers: { color: '#9b59b6' } } })}
                    style={{ padding: '6px 10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Sub Gifter Highlights */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>Highlight Sub Gifters</span>
                  <div
                    onClick={() => handleSettingsChange({ highlights: { subGifters: { enabled: !settings.highlights.subGifters.enabled } } })}
                    style={{
                      width: '44px',
                      height: '24px',
                      backgroundColor: settings.highlights.subGifters.enabled ? currentAccentColor : '#2a2a2a',
                      borderRadius: '12px',
                      position: 'relative',
                      border: '1px solid #444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: settings.highlights.subGifters.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }}
                    />
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="color"
                    value={settings.highlights.subGifters.color}
                    onChange={(e) => handleSettingsChange({ highlights: { subGifters: { color: e.target.value } } })}
                    style={{ width: '40px', height: '32px', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={settings.highlights.subGifters.color}
                    onChange={(e) => handleSettingsChange({ highlights: { subGifters: { color: e.target.value } } })}
                    style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                    placeholder="#5dade2"
                  />
                  <button
                    onClick={() => handleSettingsChange({ highlights: { subGifters: { color: '#5dade2' } } })}
                    style={{ padding: '6px 10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowSettingsModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: currentAccentColor,
                border: 'none',
                borderRadius: '4px',
                color: '#000',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Giveaway Modal */}
      {showGiveawayModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowGiveawayModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: `2px solid ${currentAccentColor}`,
              borderRadius: '12px',
              padding: '24px',
              width: '400px',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>🎁 Giveaway</h2>
              <button
                onClick={() => setShowGiveawayModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Keyword Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
                Keyword
              </label>
              <input
                type="text"
                value={giveawayKeyword}
                onChange={(e) => setGiveawayKeyword(e.target.value)}
                placeholder="Enter keyword (e.g., !enter)"
                disabled={giveawayActive}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: giveawayActive ? '#1a1a1a' : '#2a2a2a',
                  border: `1px solid ${giveawayActive ? currentAccentColor : '#444'}`,
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Sub Only Toggle */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: giveawayActive ? 'not-allowed' : 'pointer' }}>
                <span style={{ color: '#aaa', fontSize: '14px' }}>
                  Subscribers Only
                </span>
                <div
                  onClick={() => !giveawayActive && setGiveawaySubOnly(!giveawaySubOnly)}
                  style={{
                    width: '44px',
                    height: '24px',
                    backgroundColor: giveawaySubOnly ? currentAccentColor : '#2a2a2a',
                    borderRadius: '12px',
                    position: 'relative',
                    border: '1px solid #444',
                    cursor: giveawayActive ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    opacity: giveawayActive ? 0.5 : 1
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#fff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: giveawaySubOnly ? '22px' : '2px',
                      transition: 'left 0.2s'
                    }}
                  />
                </div>
              </label>
            </div>

            {/* Start/Stop Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {!giveawayActive ? (
                <button
                  onClick={handleStartGiveaway}
                  disabled={!giveawayKeyword.trim()}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: giveawayKeyword.trim() ? currentAccentColor : '#2a2a2a',
                    border: 'none',
                    borderRadius: '6px',
                    color: giveawayKeyword.trim() ? '#000' : '#666',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: giveawayKeyword.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Start Giveaway
                </button>
              ) : (
                <button
                  onClick={handleStopGiveaway}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#ff4444',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Stop Giveaway
                </button>
              )}
              <button
                onClick={handleClearEntries}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>

            {/* Entries Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#aaa', fontSize: '14px' }}>
                  Entries: <span style={{ color: currentAccentColor, fontWeight: 600 }}>{giveawayEntries.size}</span>
                </span>
                {giveawayActive && (
                  <span style={{ color: currentAccentColor, fontSize: '12px', animation: 'pulse 2s infinite' }}>
                    ● Live
                  </span>
                )}
              </div>

              {/* Entries List */}
              {giveawayEntries.size > 0 && (
                <div style={{
                  backgroundColor: '#2a2a2a',
                  borderRadius: '6px',
                  padding: '12px',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Array.from(giveawayEntries).map(username => (
                      <span
                        key={username}
                        style={{
                          backgroundColor: '#1a1a1a',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#fff'
                        }}
                      >
                        {username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Winner Display / Animation */}
            {(isPickingWinner || giveawayWinner) && (
              <div style={{
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                marginBottom: '20px',
                border: giveawayWinner ? `2px solid ${currentAccentColor}` : '2px solid transparent'
              }}>
                {isPickingWinner ? (
                  <>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                      Picking winner...
                    </div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 700,
                      color: '#fff',
                      animation: 'flash 0.1s infinite'
                    }}>
                      {spinningName || '...'}
                    </div>
                  </>
                ) : giveawayWinner && (
                  <>
                    <div style={{ fontSize: '12px', color: currentAccentColor, marginBottom: '8px' }}>
                      🎉 WINNER 🎉
                    </div>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: currentAccentColor,
                      textShadow: `0 0 20px ${currentAccentColor}40`,
                      animation: 'winner-reveal 0.5s ease-out',
                      marginBottom: '12px'
                    }}>
                      {giveawayWinner}
                    </div>
                    <button
                      onClick={() => setShowWinnerChat(true)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#2a2a2a',
                        border: `1px solid ${currentAccentColor}`,
                        borderRadius: '4px',
                        color: currentAccentColor,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = currentAccentColor
                        e.currentTarget.style.color = '#000'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#2a2a2a'
                        e.currentTarget.style.color = currentAccentColor
                      }}
                    >
                      💬 View Winner's Chat
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Pick Winner Button */}
            <button
              onClick={handlePickWinner}
              disabled={giveawayEntries.size === 0 || isPickingWinner}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: giveawayEntries.size > 0 && !isPickingWinner ? currentAccentColor : '#2a2a2a',
                border: 'none',
                borderRadius: '8px',
                color: giveawayEntries.size > 0 && !isPickingWinner ? '#000' : '#666',
                fontSize: '16px',
                fontWeight: 700,
                cursor: giveawayEntries.size > 0 && !isPickingWinner ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              {isPickingWinner ? '🎰 Spinning...' : '🎲 Pick Winner'}
            </button>
          </div>
        </div>
      )}

      {/* Winner Chat Modal */}
      {showWinnerChat && giveawayWinner && myChannel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1002
          }}
          onClick={() => setShowWinnerChat(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: `2px solid ${currentAccentColor}`,
              borderRadius: '12px',
              padding: '20px',
              width: '500px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>
                💬 {giveawayWinner}'s Messages
              </h2>
              <button
                onClick={() => setShowWinnerChat(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: '#0f0f0f',
              borderRadius: '8px',
              padding: '12px',
              minHeight: '300px',
              maxHeight: '500px'
            }}>
              {(() => {
                const winnerMessages = myChannel.messages.filter(
                  msg => msg.sender?.username?.toLowerCase() === giveawayWinner.toLowerCase()
                )

                if (winnerMessages.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
                      No messages from {giveawayWinner} yet.
                      <br />
                      <span style={{ fontSize: '12px' }}>Messages will appear here in real-time.</span>
                    </div>
                  )
                }

                return winnerMessages.map(msg => (
                  <div
                    key={msg.message_id}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid #2a2a2a',
                      animation: 'message-fade-in 0.3s ease-out'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        fontWeight: 600,
                        color: currentAccentColor,
                        fontSize: '13px'
                      }}>
                        {msg.sender?.username}
                      </span>
                      <span style={{ color: '#666', fontSize: '11px' }}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ color: '#fff', fontSize: '14px', wordBreak: 'break-word' }}>
                      {renderMessagePreview(msg.content || '')}
                    </div>
                  </div>
                ))
              })()}
            </div>

            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: '#666', fontSize: '11px' }}>
                Showing {myChannel.messages.filter(
                  msg => msg.sender?.username?.toLowerCase() === giveawayWinner.toLowerCase()
                ).length} message(s) from {giveawayWinner}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && activeChannel && (
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
          onClick={() => setShowAnalytics(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: `2px solid ${currentAccentColor}`,
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>
                📊 Chat Analytics - {activeChannel.slug}
              </h2>
              <button
                onClick={() => setShowAnalytics(false)}
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

            {(() => {
              const analytics = getAnalyticsData()
              if (!analytics) return <div style={{ color: '#888' }}>No data available</div>

              return (
                <>
                  {/* Quick Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ backgroundColor: '#2a2a2a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: currentAccentColor }}>
                        {analytics.totalMessages.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Total Messages</div>
                    </div>
                    <div style={{ backgroundColor: '#2a2a2a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: currentAccentColor }}>
                        {analytics.uniqueChatters.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Unique Chatters</div>
                    </div>
                    <div style={{ backgroundColor: '#2a2a2a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: currentAccentColor }}>
                        {analytics.sessionDuration}m
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Session Time</div>
                    </div>
                    <div style={{ backgroundColor: '#2a2a2a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: currentAccentColor }}>
                        {analytics.avgMessageLength}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Avg Length</div>
                    </div>
                  </div>

                  {/* Messages Per Minute Chart */}
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', textTransform: 'uppercase' }}>
                      Messages Per Minute (Last 5 min)
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px', padding: '8px', backgroundColor: '#0f0f0f', borderRadius: '6px' }}>
                      {analytics.messagesPerMinute.map((count, i) => {
                        const maxCount = Math.max(...analytics.messagesPerMinute, 1)
                        const height = (count / maxCount) * 100
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div
                              style={{
                                width: '100%',
                                height: `${height}%`,
                                minHeight: '4px',
                                backgroundColor: currentAccentColor,
                                borderRadius: '2px',
                                transition: 'height 0.3s ease'
                              }}
                              title={`${count} messages`}
                            />
                            <span style={{ fontSize: '10px', color: '#666' }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666' }}>5m ago</span>
                      <span style={{ fontSize: '10px', color: '#666' }}>now</span>
                    </div>
                  </div>

                  {/* Top Chatters */}
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', textTransform: 'uppercase' }}>
                      Top Chatters
                    </h3>
                    <div style={{ backgroundColor: '#0f0f0f', borderRadius: '6px', padding: '8px' }}>
                      {analytics.topChatters.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#666', padding: '12px' }}>No chatters yet</div>
                      ) : (
                        analytics.topChatters.map(([username, count], i) => (
                          <div
                            key={username}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderBottom: i < analytics.topChatters.length - 1 ? '1px solid #2a2a2a' : 'none'
                            }}
                          >
                            <span style={{ color: '#efeff1', fontSize: '13px' }}>
                              <span style={{ color: '#666', marginRight: '8px' }}>#{i + 1}</span>
                              {username}
                            </span>
                            <span style={{ color: currentAccentColor, fontWeight: 600, fontSize: '13px' }}>
                              {count}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Top Emotes */}
                  <div>
                    <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', textTransform: 'uppercase' }}>
                      Top Emotes
                    </h3>
                    <div style={{ backgroundColor: '#0f0f0f', borderRadius: '6px', padding: '8px' }}>
                      {analytics.topEmotes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#666', padding: '12px' }}>No emotes used yet</div>
                      ) : (
                        analytics.topEmotes.map((emote, i) => {
                          // Determine emote URL based on source
                          let emoteUrl: string
                          if (emote.source === '7tv') {
                            emoteUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`
                          } else if (emote.source === 'bttv') {
                            emoteUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`
                          } else {


                            emoteUrl = `https://files.kick.com/emotes/${emote.id}/fullsize`
                          }

                          return (
                            <div
                              key={`${emote.id}-${emote.name}`}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 8px',
                                borderBottom: i < analytics.topEmotes.length - 1 ? '1px solid #2a2a2a' : 'none'
                              }}
                            >
                              <span style={{ color: '#efeff1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#666' }}>#{i + 1}</span>
                                <img
                                  src={emoteUrl}
                                  alt={emote.name}
                                  style={{ height: '24px', width: 'auto' }}
                                />
                                {emote.name}
                              </span>
                              <span style={{ color: currentAccentColor, fontWeight: 600, fontSize: '13px' }}>
                                {emote.count}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* User Card Modal */}
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
              border: `2px solid ${currentAccentColor}`,
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with profile */}
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
                    border: `2px solid ${currentAccentColor}`
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: currentAccentColor,
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
                      // Show icon for sub gifters instead of text (same as in chat)
                      const isSubGifter = badge.type === 'sub_gifter' ||
                                          badge.type === 'subgifter' ||
                                          badge.type === 'sub-gifter' ||
                                          badge.text?.toLowerCase().includes('gifter')

                      return (
                        <span
                          key={i}
                          className={`badge badge-${badge.type}`}
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

            {/* Stats Section */}
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
                {/* Relationship to current channel */}
                {(() => {
                  // Check for sub gifter badge
                  const subGifterBadge = userCardData.userChannelStats?.badges?.find(
                    (badge: any) => badge.type === 'sub_gifter' && badge.active
                  )

                  // Show section if user has any relationship with the channel
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
                      border: `1px solid ${currentAccentColor}40`
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
                            color: currentAccentColor,
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

                {/* User's channel stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Their Followers</div>
                    <div style={{ fontSize: '16px', color: '#fff', fontWeight: 600 }}>
                      {userCardData.followers_count?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Their Status</div>
                    <div style={{ fontSize: '14px', color: userCardData.livestream?.is_live ? currentAccentColor : '#888' }}>
                      {userCardData.livestream?.is_live ? '🔴 Live' : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Recent Messages */}
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px', textTransform: 'uppercase' }}>
                Recent Messages
              </h3>
              <div
                style={{
                  backgroundColor: '#0f0f0f',
                  borderRadius: '6px',
                  padding: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
              >
                {activeChannel?.messages
                  .filter(msg => msg.sender?.username === selectedUser.username)
                  .slice(-10)
                  .map(msg => (
                    <div
                      key={msg.message_id}
                      style={{
                        fontSize: '12px',
                        padding: '4px 0',
                        color: '#efeff1',
                        borderBottom: '1px solid #2a2a2a'
                      }}
                    >
                      <span style={{ color: '#666', marginRight: '6px' }}>
                        {formatTimestamp(msg.created_at)}
                      </span>
                      <span>{renderMessagePreview(msg.content)}</span>
                    </div>
                  )) || (
                  <div style={{ textAlign: 'center', color: '#666', padding: '12px' }}>
                    No recent messages
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  window.chatarooAPI.openExternal(`https://kick.com/${selectedUser.username}`)
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🔗 View Profile
              </button>
              <button
                onClick={() => {
                  if (messageInputRef.current) {
                    const mention = `@${selectedUser.username} `
                    messageInputRef.current.innerText = mention
                    setMessageInput(mention)
                    messageInputRef.current.focus()
                  }
                  setShowUserCard(false)
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: currentAccentColor,
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
              {/* Show moderate button if authenticated, not viewing own profile, and user is a moderator or broadcaster */}
              {isAuthenticated && userInfo && selectedUser.username !== userInfo.username && activeChannel?.isModerator && (
                <button
                  onClick={() => setShowModerationPanel(!showModerationPanel)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: showModerationPanel ? '#dc3545' : '#ff6b35',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  🛡️ {showModerationPanel ? 'Close' : 'Moderate'}
                </button>
              )}
            </div>

            {/* Moderation Panel */}
            {showModerationPanel && activeChannel && activeChannel.isModerator && selectedUser && (
              <ModerationPanel
                userId={userCardData?.user_id || userCardData?.user?.id || selectedUser.sender?.id || 0}
                username={selectedUser.username}
                broadcasterUserId={activeChannel.userId}
                currentAccentColor={currentAccentColor}
                onClose={() => setShowModerationPanel(false)}
                onActionComplete={(action) => {

                  // Add system message to chat
                  if (activeChannel && selectedUser) {
                    const systemMessage: KickChatMessage = {
                      id: `system-${Date.now()}`,
                      content: `${selectedUser.username} was ${action === 'timeout' ? 'timed out' : action === 'ban' ? 'banned' : 'unbanned'}`,
                      sender: {
                        id: 0,
                        username: 'System',
                        slug: 'system',
                        is_verified: false,
                        identity: { badges: [] }
                      },
                      broadcaster: {
                        id: activeChannel.userId,
                        username: activeChannel.slug,
                        slug: activeChannel.slug,
                        is_verified: false
                      },
                      created_at: new Date().toISOString(),
                      type: 'system'
                    }

                    // Add to appropriate channel
                    if (viewMode === 'myChat' && myChannel) {
                      setMyChannel(prev => prev ? { ...prev, messages: [...prev.messages, systemMessage] } : prev)
                    } else {
                      setChannels(prev => prev.map(ch =>
                        ch.slug === activeChannel.slug
                          ? { ...ch, messages: [...ch.messages, systemMessage] }
                          : ch
                      ))
                    }
                  }

                  setShowModerationPanel(false)
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
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

export default App
