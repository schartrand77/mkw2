import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

type DiscordMessage = {
  id: string
  content: string
  author: { username: string }
  timestamp: string
  reactions?: { emoji: { name: string }, count: number }[]
}

export async function GET(_req: NextRequest) {
  const token = process.env.DISCORD_BOT_TOKEN
  const channel = process.env.DISCORD_CHANNEL_ID
  if (!token || !channel) return NextResponse.json({ items: [] })
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channel}/messages?limit=50`, {
      headers: { Authorization: `Bot ${token}` }, cache: 'no-store'
    })
    if (!res.ok) return NextResponse.json({ items: [] })
    const list = await res.json() as DiscordMessage[]
    // Keep messages that are clearly announcements: have ✅ reaction or start with [notify]
    const items = list.filter(m => {
      const hasCheck = (m.reactions || []).some(r => r.emoji?.name === '✅' && r.count > 0)
      return hasCheck || /^\s*\[notify\]/i.test(m.content)
    }).map(m => ({ id: m.id, content: m.content, author: m.author?.username || 'unknown', timestamp: m.timestamp }))
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

