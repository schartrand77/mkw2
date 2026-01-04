import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../_utils'
import { buildInviteLoginUrl, createInviteAccount } from '@/lib/invite'
import { sendAdminDiscordNotification } from '@/lib/discord'

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
})

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const { email, name } = inviteSchema.parse(await req.json())
    const invitePassword = (process.env.ADMIN_INVITE_PASSWORD || '').trim()
    if (!invitePassword) {
      return NextResponse.json({ error: 'ADMIN_INVITE_PASSWORD not set' }, { status: 500 })
    }

    const { user, profile } = await createInviteAccount({ email, name, password: invitePassword })
    const { loginUrl } = buildInviteLoginUrl(user.id)

    const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const profileUrl = profile?.slug ? `${baseUrl}/u/${profile.slug}` : undefined
    let discordSent = false
    try {
      discordSent = await sendAdminDiscordNotification({
        title: 'Admin invite created',
        body: [
          `Email: ${user.email}`,
          user.name ? `Name: ${user.name}` : null,
          profileUrl ? `Profile: ${profileUrl}` : null,
        ],
        meta: {
          preapproved: true,
          password: invitePassword,
        },
        url: loginUrl,
      })
    } catch (notifyErr) {
      console.error('Admin Discord notification failed for invite:', notifyErr)
    }

    return NextResponse.json({
      ok: true,
      user,
      password: invitePassword,
      loginUrl,
      discordSent,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: e.status || 400 })
  }
}
