import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDiscordNotificationItems } from '../lib/discord-notifications'

test('keeps normal admin Discord messages in the notification feed', () => {
  const items = buildDiscordNotificationItems([
    {
      id: 'discord-admin-1',
      content: '**New upload**\nModel ready for review',
      author: { username: 'MakerBot' },
      timestamp: '2026-05-21T09:15:00.000Z',
    },
  ])

  assert.deepEqual(items, [
    {
      id: 'discord-admin-1',
      content: '**New upload**\nModel ready for review',
      author: 'MakerBot',
      timestamp: '2026-05-21T09:15:00.000Z',
    },
  ])
})
