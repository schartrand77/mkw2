import { prisma } from '@/lib/db'
import { BRAND_NAME } from '@/lib/brand'
import { sendMail } from '@/lib/mailer'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeName(value?: string | null) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

export async function upsertMerchNotifyRequest(input: { merchItemId: string; email: string; name?: string | null }) {
  const email = normalizeEmail(input.email)
  const name = normalizeName(input.name)
  const request = await prisma.merchNotifyRequest.upsert({
    where: {
      merchItemId_email: {
        merchItemId: input.merchItemId,
        email,
      },
    },
    update: {
      name,
      notifiedAt: null,
    },
    create: {
      merchItemId: input.merchItemId,
      email,
      name,
    },
  })
  return request
}

export async function notifyMerchBackInStock(merchItemId: string) {
  const merch = await prisma.merchItem.findUnique({
    where: { id: merchItemId },
    select: {
      id: true,
      title: true,
      availability: true,
      externalUrl: true,
      isActive: true,
    },
  })
  if (!merch || !merch.isActive || merch.availability !== 'in_stock') {
    return { pending: 0, sent: 0, failed: 0 }
  }

  const pending = await prisma.merchNotifyRequest.findMany({
    where: {
      merchItemId: merch.id,
      notifiedAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (pending.length === 0) {
    return { pending: 0, sent: 0, failed: 0 }
  }

  const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const merchUrl = merch.externalUrl || `${base}/products#merch`
  const succeededIds: string[] = []
  let failed = 0

  for (const entry of pending) {
    const greeting = entry.name ? `Hi ${entry.name},` : 'Hi there,'
    const subject = `${merch.title} is back in stock`
    const text = `${greeting}

${merch.title} is now available at ${BRAND_NAME}.

View item: ${merchUrl}

You are receiving this because you requested an availability notification.`
    const html = `<p>${greeting}</p>
<p><strong>${merch.title}</strong> is now available at ${BRAND_NAME}.</p>
<p><a href="${merchUrl}" style="color:#0ea5e9; text-decoration:underline;">View item</a></p>
<p style="color:#64748b;font-size:12px;">You are receiving this because you requested an availability notification.</p>`

    try {
      const sent = await sendMail({
        to: entry.email,
        subject,
        text,
        html,
      })
      if (sent) {
        succeededIds.push(entry.id)
      } else {
        failed += 1
      }
    } catch {
      failed += 1
    }
  }

  if (succeededIds.length > 0) {
    await prisma.merchNotifyRequest.updateMany({
      where: { id: { in: succeededIds } },
      data: { notifiedAt: new Date() },
    })
  }

  return {
    pending: pending.length,
    sent: succeededIds.length,
    failed,
  }
}
