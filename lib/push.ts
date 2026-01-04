import webpush from 'web-push'
import { prisma } from '@/lib/db'

type AdminPushPayload = {
  title: string
  body?: string | null
  url?: string | null
  tag?: string | null
  icon?: string | null
  badge?: string | null
  data?: Record<string, unknown>
}

let vapidConfigured = false
let vapidConfigFailed = false

function ensureVapidConfigured() {
  if (vapidConfigured || vapidConfigFailed) return vapidConfigured
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim()
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim()
  const subject = (process.env.VAPID_SUBJECT || '').trim() || 'mailto:admin@example.com'
  if (!publicKey || !privateKey) {
    vapidConfigFailed = true
    console.warn('[push] VAPID keys missing; push notifications disabled.')
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

function buildPayload(payload: AdminPushPayload) {
  return {
    title: payload.title,
    body: payload.body || '',
    url: payload.url || '/admin',
    tag: payload.tag || undefined,
    icon: payload.icon || '/favicon.svg',
    badge: payload.badge || '/favicon.svg',
    data: payload.data || undefined,
  }
}

export async function sendAdminPushNotification(payload: AdminPushPayload) {
  if (!ensureVapidConfigured()) return false
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { user: { isAdmin: true } },
  })
  if (subscriptions.length === 0) return false
  const message = JSON.stringify(buildPayload(payload))
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        message,
      )
    } catch (err: any) {
      const status = Number(err?.statusCode || err?.status)
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } })
        return
      }
      console.error('[push] Failed to send admin notification', err)
    }
  }))
  return true
}
