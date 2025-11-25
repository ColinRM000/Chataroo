/**
 * Normalize username for Kick API calls
 * Kick uses dashes in slugs/URLs even when usernames display with underscores
 * Example: "wojtek_99pct" (display) -> "wojtek-99pct" (API slug)
 */
export function normalizeUsername(username: string): string {
  return username.replace(/_/g, '-')
}

/**
 * Generate a consistent color for a username using a simple hash
 * Same username always gets the same color
 */
export function getUsernameColor(username: string): string {
  // Hash the username to a number
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32-bit integer
  }

  // Generate HSL color with good saturation and lightness for readability
  const hue = Math.abs(hash % 360)
  const saturation = 65 + (Math.abs(hash) % 20) // 65-85%
  const lightness = 55 + (Math.abs(hash >> 8) % 15) // 55-70%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Parse message content and replace emote codes with image elements
 * Emotes are in format: [emote:ID:NAME]
 */
export function parseEmotes(content: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g
  let lastIndex = 0
  let match

  while ((match = emoteRegex.exec(content)) !== null) {
    const [fullMatch, emoteId, emoteName] = match
    const index = match.index

    // Add text before emote
    if (index > lastIndex) {
      parts.push(content.substring(lastIndex, index))
    }

    // Add emote image with data attributes for hover preview
    parts.push(
      <img
        key={`emote-${emoteId}-${index}`}
        src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
        alt={emoteName}
        className="emote"
        data-emote-id={emoteId}
        data-emote-name={emoteName}
        data-emote-src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
        style={{ height: '28px', verticalAlign: 'middle', margin: '0 2px' }}
      />
    )

    lastIndex = index + fullMatch.length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex))
  }

  return parts.length > 0 ? parts : [content]
}

/**
 * Third-party emote data structure
 */
interface ThirdPartyEmote {
  id: string
  name: string
  url: string
  url2x: string
  source: '7tv' | 'bttv'
}

/**
 * Build a lookup map from emote arrays for fast access
 */
export function buildEmoteMap(emotes: {
  seventvGlobal: ThirdPartyEmote[]
  seventvChannel: ThirdPartyEmote[]
  bttvGlobal: ThirdPartyEmote[]
}, enableSevenTV: boolean, enableBTTV: boolean): Map<string, ThirdPartyEmote> {
  const map = new Map<string, ThirdPartyEmote>()

  // Add in order of priority (later entries override earlier)
  // BTTV global -> 7TV global -> 7TV channel
  if (enableBTTV) {
    for (const emote of emotes.bttvGlobal) {
      map.set(emote.name, emote)
    }
  }

  if (enableSevenTV) {
    for (const emote of emotes.seventvGlobal) {
      map.set(emote.name, emote)
    }
    // Channel emotes have highest priority
    for (const emote of emotes.seventvChannel) {
      map.set(emote.name, emote)
    }
  }

  return map
}

/**
 * Parse text for third-party emotes and replace with images
 * Takes the result of parseEmotes and processes string parts for third-party emotes
 */
export function parseThirdPartyEmotes(
  parts: (string | JSX.Element)[],
  emoteMap: Map<string, ThirdPartyEmote>
): (string | JSX.Element)[] {
  if (emoteMap.size === 0) return parts

  const result: (string | JSX.Element)[] = []

  for (const part of parts) {
    // Only process string parts (skip existing emote images)
    if (typeof part !== 'string') {
      result.push(part)
      continue
    }

    // Split text by word boundaries while preserving whitespace
    const words = part.split(/(\s+)/)
    let hasEmote = false
    const processedWords: (string | JSX.Element)[] = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i]

      // Preserve whitespace
      if (/^\s+$/.test(word)) {
        processedWords.push(word)
        continue
      }

      // Check if word is an emote (case-sensitive)
      const emote = emoteMap.get(word)

      if (emote) {
        hasEmote = true
        processedWords.push(
          <img
            key={`${emote.source}-${emote.id}-${i}-${Math.random()}`}
            src={emote.url2x}
            alt={emote.name}
            className="emote"
            data-emote-id={emote.id}
            data-emote-name={emote.name}
            data-emote-src={emote.url2x}
            style={{ height: '28px', verticalAlign: 'middle', margin: '0 2px' }}
          />
        )
      } else {
        processedWords.push(word)
      }
    }

    // If we found emotes, add processed words; otherwise keep original string
    if (hasEmote) {
      result.push(...processedWords)
    } else {
      result.push(part)
    }
  }

  return result
}
