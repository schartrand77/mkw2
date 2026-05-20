import assert from 'node:assert/strict'
import test from 'node:test'

import { buildNotificationCenterItems } from '../lib/notification-center'

test('builds unread notification center items from Discord announcements', () => {
  const items = buildNotificationCenterItems({
    announcements: [
      {
        id: 'discord-2',
        content: '[notify] New upload waiting for review',
        author: 'Admin',
        timestamp: '2026-05-20T10:05:00.000Z',
      },
      {
        id: 'discord-1',
        content: '[notify] Checkout completed',
        author: 'Admin',
        timestamp: '2026-05-20T10:00:00.000Z',
      },
    ],
    dismissedIds: new Set(['discord-1']),
    readIds: new Set(),
  })

  assert.equal(items.unreadCount, 2)
  assert.equal(items.items.length, 2)
  assert.equal(items.items[0].id, 'discord-2')
  assert.equal(items.items[0].title, 'Discord notification')
  assert.equal(items.items[0].preview, 'New upload waiting for review')
  assert.equal(items.items[1].id, 'discord-1')
})
