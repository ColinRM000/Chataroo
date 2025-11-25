import { useState, useEffect, useRef } from 'react'
import { emoteService, EmoteData } from '../services/emoteService'

interface ThirdPartyEmote {
  id: string
  name: string
  url: string
  url2x: string
  source: '7tv' | 'bttv'
}

interface EmotePickerProps {
  channelSlug: string
  onEmoteSelect: (emoteCode: string) => void
  searchQuery?: string
  onClose: () => void
  mySubEmotes?: EmoteData[] // User's personal subscriber emotes
  thirdPartyEmotes?: {
    seventvGlobal: ThirdPartyEmote[]
    seventvChannel: ThirdPartyEmote[]
    bttvGlobal: ThirdPartyEmote[]
  }
  enableSevenTV?: boolean
  enableBTTV?: boolean
}

export function EmotePicker({
  channelSlug,
  onEmoteSelect,
  onClose,
  mySubEmotes = [],
  thirdPartyEmotes = { seventvGlobal: [], seventvChannel: [], bttvGlobal: [] },
  enableSevenTV = true,
  enableBTTV = true
}: EmotePickerProps) {
  const [globalEmotes, setGlobalEmotes] = useState<EmoteData[]>([])
  const [channelEmotes, setChannelEmotes] = useState<EmoteData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'global' | 'channel' | 'mySubEmotes' | '7tv' | 'bttv'>('global')
  const [loading, setLoading] = useState(true)
  const [displayLimit, setDisplayLimit] = useState(100) // Initial limit for performance
  const pickerRef = useRef<HTMLDivElement>(null)

  // Load emotes
  useEffect(() => {
    let mounted = true

    async function loadEmotes() {
      setLoading(true)
      const [global, channel] = await Promise.all([
        emoteService.fetchGlobalEmotes(),
        emoteService.fetchChannelEmotes(channelSlug)
      ])
      if (mounted) {
        setGlobalEmotes(global)
        setChannelEmotes(channel)
        setLoading(false)
      }
    }

    loadEmotes()
    return () => {
      mounted = false
    }
  }, [channelSlug])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Reset display limit when tab changes
  useEffect(() => {
    setDisplayLimit(100)
  }, [activeTab])

  function handleEmoteClick(emote: EmoteData) {
    const emoteCode = emoteService.formatEmoteForMessage(emote)
    onEmoteSelect(emoteCode)
  }

  function handleThirdPartyEmoteClick(emote: ThirdPartyEmote) {
    // Third-party emotes are sent as plain text (just the name)
    onEmoteSelect(emote.name)
  }

  // Get emotes to display based on active tab and search
  const getDisplayEmotes = (): EmoteData[] => {
    let emotes: EmoteData[] = []

    if (activeTab === 'global') {
      emotes = globalEmotes
    } else if (activeTab === 'channel') {
      emotes = channelEmotes
    } else if (activeTab === 'mySubEmotes') {
      emotes = mySubEmotes
    }

    if (searchQuery) {
      return emoteService.searchEmotes(emotes, searchQuery)
    }

    return emotes
  }

  // Get third-party emotes to display
  const getThirdPartyDisplayEmotes = (): ThirdPartyEmote[] => {
    let emotes: ThirdPartyEmote[] = []

    if (activeTab === '7tv') {
      // Combine 7TV channel and global emotes
      emotes = [...thirdPartyEmotes.seventvChannel, ...thirdPartyEmotes.seventvGlobal]
    } else if (activeTab === 'bttv') {
      emotes = thirdPartyEmotes.bttvGlobal
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return emotes.filter(e => e.name.toLowerCase().includes(query))
    }

    return emotes
  }

  const isThirdPartyTab = activeTab === '7tv' || activeTab === 'bttv'

  const displayEmotes = getDisplayEmotes()
  const thirdPartyDisplayEmotes = getThirdPartyDisplayEmotes()

  if (loading) {
    return (
      <div className="emote-picker" ref={pickerRef}>
        <div className="emote-picker-header">
          <div className="emote-search">
            <input
              type="text"
              placeholder="Search emotes"
              value=""
              disabled
            />
          </div>
          <button className="emote-close" onClick={onClose}>×</button>
        </div>
        <div className="emote-picker-loading">
          Loading emotes...
        </div>
      </div>
    )
  }

  return (
    <div className="emote-picker" ref={pickerRef}>
      <div className="emote-picker-header">
        <div className="emote-search">
          <input
            type="text"
            placeholder="Search emotes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="emote-close" onClick={onClose}>×</button>
      </div>

      <div className="emote-tabs">
        <button
          className={`emote-tab ${activeTab === 'global' ? 'active' : ''}`}
          onClick={() => setActiveTab('global')}
          title="Global Emotes"
        >
          🌍
        </button>
        <button
          className={`emote-tab ${activeTab === 'channel' ? 'active' : ''}`}
          onClick={() => setActiveTab('channel')}
          title={`${channelSlug} Emotes`}
        >
          📺
        </button>
        {mySubEmotes.length > 0 && (
          <button
            className={`emote-tab ${activeTab === 'mySubEmotes' ? 'active' : ''}`}
            onClick={() => setActiveTab('mySubEmotes')}
            title="Your Sub Emotes"
          >
            ⭐
          </button>
        )}
        {enableSevenTV && (thirdPartyEmotes.seventvGlobal.length > 0 || thirdPartyEmotes.seventvChannel.length > 0) && (
          <button
            className={`emote-tab ${activeTab === '7tv' ? 'active' : ''}`}
            onClick={() => setActiveTab('7tv')}
            title="7TV Emotes"
          >
            7TV
          </button>
        )}
        {enableBTTV && thirdPartyEmotes.bttvGlobal.length > 0 && (
          <button
            className={`emote-tab ${activeTab === 'bttv' ? 'active' : ''}`}
            onClick={() => setActiveTab('bttv')}
            title="BetterTTV Emotes"
          >
            BTTV
          </button>
        )}
      </div>

      <div className="emote-picker-content">
        {isThirdPartyTab ? (
          // Third-party emotes (7TV/BTTV)
          thirdPartyDisplayEmotes.length === 0 ? (
            <div className="emote-picker-empty">
              No emotes found
            </div>
          ) : (
            <div className="emote-section">
              <div className="emote-section-title">
                {activeTab === '7tv' ? '7TV Emotes' : 'BetterTTV Emotes'}
              </div>
              <div className="emote-grid">
                {thirdPartyDisplayEmotes.slice(0, displayLimit).map((emote) => (
                  <div
                    key={`${emote.source}-${emote.id}-${emote.name}`}
                    className="emote-grid-item"
                    onClick={() => handleThirdPartyEmoteClick(emote)}
                    title={emote.name}
                  >
                    <img
                      src={emote.url2x}
                      alt={emote.name}
                      className="emote-grid-image"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              {thirdPartyDisplayEmotes.length > displayLimit && (
                <button
                  className="emote-load-more"
                  onClick={() => setDisplayLimit(prev => prev + 100)}
                >
                  Load More ({thirdPartyDisplayEmotes.length - displayLimit} remaining)
                </button>
              )}
            </div>
          )
        ) : (
          // Kick emotes (global/channel/mySubEmotes)
          displayEmotes.length === 0 ? (
            <div className="emote-picker-empty">
              No emotes found
            </div>
          ) : (
            <div className="emote-section">
              <div className="emote-section-title">
                {activeTab === 'global'
                  ? 'Global Emotes'
                  : activeTab === 'mySubEmotes'
                  ? 'Your Sub Emotes'
                  : `${channelSlug} Emotes`}
              </div>
              <div className="emote-grid">
                {displayEmotes.slice(0, displayLimit).map((emote) => (
                  <div
                    key={`${emote.id}-${emote.name}`}
                    className="emote-grid-item"
                    onClick={() => handleEmoteClick(emote)}
                    title={emote.name}
                  >
                    <img
                      src={emote.image_url || `https://files.kick.com/emotes/${emote.id}/fullsize`}
                      alt={emote.name}
                      className="emote-grid-image"
                      loading="lazy"
                    />
                    {emote.subscriber_only && (
                      <span className="emote-sub-badge">SUB</span>
                    )}
                  </div>
                ))}
              </div>
              {displayEmotes.length > displayLimit && (
                <button
                  className="emote-load-more"
                  onClick={() => setDisplayLimit(prev => prev + 100)}
                >
                  Load More ({displayEmotes.length - displayLimit} remaining)
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
