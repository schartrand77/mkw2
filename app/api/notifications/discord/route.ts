import { NextResponse } from 'next/server'

import { buildDiscordNotificationItems, type DiscordNotificationMessage } from '@/lib/discord-notifications'
import { getEffectiveSuiteRuntimeSettings } from '@/lib/suite-runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getEffectiveSuiteRuntimeSettings(['discordBotToken', 'discordAdminChannelId'])
  const token = settings.discordBotToken.value
  const channel = settings.discordAdminChannelId.value || process.env.DISCORD_CHANNEL_ID || ''
  if (!token || !channel) return NextResponse.json({ items: [] })

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channel}/messages?limit=50`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ items: [] })
    const messages = await res.json() as DiscordNotificationMessage[]
    return NextResponse.json({ items: buildDiscordNotificationItems(messages) })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
