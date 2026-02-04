import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../_utils'
import { buildInviteLoginUrl, createInviteAccount } from '@/lib/invite'
import { sendInviteEmail } from '@/lib/inviteEmail'
import { sendAdminDiscordNotification } from '@/lib/discord'
import { sendAdminPushNotification } from '@/lib/push'
import { resolveBaseUrl } from '@/lib/base-url'

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
})

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const { email, name } = inviteSchema.parse(await req.json())
    const invitePassword = (process.env.ADMIN_INVITE_PASSWORD || '').trim() || null
    const { user, profile } = await createInviteAccount({
      email,
      name,
      password: invitePassword || undefined,
    })
    const requestOrigin = req.nextUrl.origin.replace(/\/+$/, '')
    const resolvedBaseUrl = await resolveBaseUrl()
    const envBaseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const originIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)
    const baseUrl = (resolvedBaseUrl || envBaseUrl || (originIsLocal ? '' : requestOrigin)).replace(/\/+$/, '')
    const { loginUrl } = buildInviteLoginUrl(user.id, baseUrl)
    let emailSent = false
    try {
      emailSent = await sendInviteEmail(user.email, loginUrl, { userName: user.name, password: invitePassword })
    } catch (mailErr) {
      console.error('Invite email send failed:', mailErr)
    }

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
        },
        url: loginUrl,
      })
    } catch (notifyErr) {
      console.error('Admin Discord notification failed for invite:', notifyErr)
    }
    try {
      await sendAdminPushNotification({
        title: 'Admin invite created',
        body: `${user.email}${user.name ? ` (${user.name})` : ''}`,
        url: loginUrl,
        tag: `invite:${user.id}`,
        data: { userId: user.id },
      })
    } catch (notifyErr) {
      console.error('Admin push notification failed for invite:', notifyErr)
    }

    return NextResponse.json({
      ok: true,
      user,
      loginUrl,
      discordSent,
      emailSent,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: e.status || 400 })
  }
}
