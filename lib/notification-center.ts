export type AnnouncementNotification = {
  id: string
  content: string
  author?: string | null
  timestamp: string
}

export type NotificationCenterItem = {
  id: string
  title: string
  preview: string
  content: string
  author: string
  timestamp: string
  read: boolean
}

type BuildInput = {
  announcements: AnnouncementNotification[]
  dismissedIds?: Set<string>
  readIds?: Set<string>
}

function cleanAnnouncementContent(content: string) {
  return String(content || '').replace(/^\s*\[notify\]\s*/i, '').trim()
}

export function buildNotificationCenterItems(input: BuildInput) {
  const readIds = input.readIds ?? new Set<string>()
  const items = input.announcements
    .map((announcement): NotificationCenterItem | null => {
      const id = String(announcement.id || '').trim()
      if (!id) return null
      const content = cleanAnnouncementContent(announcement.content)
      if (!content) return null
      return {
        id,
        title: 'Discord notification',
        preview: content.length > 96 ? `${content.slice(0, 93).trimEnd()}...` : content,
        content,
        author: announcement.author || 'Discord',
        timestamp: announcement.timestamp,
        read: readIds.has(id),
      }
    })
    .filter((item): item is NotificationCenterItem => Boolean(item))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))

  return {
    items,
    unreadCount: items.filter((item) => !item.read).length,
  }
}
