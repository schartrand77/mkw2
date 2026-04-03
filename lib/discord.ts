type AdminDiscordPayload = {
  title?: string
  body?: string | Array<string | null | undefined>
  meta?: Record<string, string | number | boolean | null | undefined>
  url?: string
}

const ADMIN_CHANNEL_ID = process.env.DISCORD_ADMIN_CHANNEL_ID
const ADMIN_BOT_TOKEN = process.env.DISCORD_ADMIN_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN

let warnedMissingConfig = false

function trimContent(input: string) {
  const normalized = input.replace(/\s+$/g, '')
  if (normalized.length <= 1900) return normalized
  return `${normalized.slice(0, 1897)}...`
}

export function adminDiscordEnabled() {
  return Boolean(ADMIN_CHANNEL_ID && ADMIN_BOT_TOKEN)
}

export function discordBotEnabled() {
  return Boolean(ADMIN_BOT_TOKEN)
}

export async function sendAdminDiscordNotification(payload: AdminDiscordPayload) {
  if (!ADMIN_CHANNEL_ID || !ADMIN_BOT_TOKEN) {
    if (!warnedMissingConfig) {
      console.warn('Admin Discord notifications are disabled (missing DISCORD_ADMIN_CHANNEL_ID or token)')
      warnedMissingConfig = true
    }
    return false
  }

  const lines: string[] = []
  if (payload.title) lines.push(`**${payload.title}**`)
  const bodyLines = Array.isArray(payload.body) ? payload.body : payload.body ? [payload.body] : []
  for (const line of bodyLines) {
    if (line) lines.push(String(line))
  }
  if (payload.meta) {
    for (const [key, value] of Object.entries(payload.meta)) {
      if (value === undefined || value === null) continue
      lines.push(`• ${key}: ${value}`)
    }
  }
  if (payload.url) lines.push(String(payload.url))

  if (lines.length === 0) return false

  const content = trimContent(lines.join('\n'))
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${ADMIN_CHANNEL_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${ADMIN_BOT_TOKEN}`,
      },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('Failed to post admin Discord notification', res.status, errText)
      return false
    }
    return true
  } catch (err) {
    console.error('Admin Discord notification error', err)
    return false
  }
}

export async function sendDiscordDirectMessage(userId: string, content: string) {
  if (!ADMIN_BOT_TOKEN) {
    if (!warnedMissingConfig) {
      console.warn('Discord bot is disabled (missing DISCORD_ADMIN_BOT_TOKEN or DISCORD_BOT_TOKEN)')
      warnedMissingConfig = true
    }
    return false
  }
  try {
    const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${ADMIN_BOT_TOKEN}`,
      },
      body: JSON.stringify({ recipient_id: userId }),
    })
    if (!channelRes.ok) {
      const errText = await channelRes.text().catch(() => '')
      console.error('Failed to create Discord DM channel', channelRes.status, errText)
      return false
    }
    const channel = await channelRes.json().catch(() => null) as { id?: string } | null
    if (!channel?.id) {
      console.error('Discord DM channel missing id')
      return false
    }
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${ADMIN_BOT_TOKEN}`,
      },
      body: JSON.stringify({ content: trimContent(content) }),
    })
    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => '')
      console.error('Failed to send Discord DM', msgRes.status, errText)
      return false
    }
    return true
  } catch (err) {
    console.error('Discord DM error', err)
    return false
  }
}
