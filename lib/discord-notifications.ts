export type DiscordNotificationMessage = {
  id?: string | null
  content?: string | null
  author?: { username?: string | null } | null
  timestamp?: string | null
}

export type DiscordNotificationItem = {
  id: string
  content: string
  author: string
  timestamp: string
}

export function buildDiscordNotificationItems(messages: DiscordNotificationMessage[]) {
  return messages
    .map((message): DiscordNotificationItem | null => {
      const id = String(message.id || '').trim()
      const content = String(message.content || '').trim()
      const timestamp = String(message.timestamp || '').trim()
      if (!id || !content || !timestamp) return null
      return {
        id,
        content,
        author: String(message.author?.username || '').trim() || 'Discord',
        timestamp,
      }
    })
    .filter((item): item is DiscordNotificationItem => Boolean(item))
}
