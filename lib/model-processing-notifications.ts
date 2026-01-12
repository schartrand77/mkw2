import { prisma } from '@/lib/db'
import { sendMail, emailDeliveryEnabled } from '@/lib/mailer'
import { sendUserPushNotification } from '@/lib/push'
import { resolveBaseUrl } from '@/lib/base-url'
import { BRAND_NAME } from '@/lib/brand'

type NotificationKind = 'cover' | 'preview'

const ANON_EMAIL = 'anonymous@local'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildCopy(kind: NotificationKind) {
  if (kind === 'cover') {
    return {
      title: 'Cover image ready',
      summary: 'Your cover image finished processing.',
    }
  }
  return {
    title: 'Model preview ready',
    summary: 'Your 3MF preview is ready to view.',
  }
}

export async function notifyModelProcessingReady(input: {
  modelId: string
  userId: string
  modelTitle: string
  kind: NotificationKind
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    })
    if (!user?.email || user.email === ANON_EMAIL) return
    const baseUrl = await resolveBaseUrl()
    const modelUrl = baseUrl ? `${baseUrl}/models/${input.modelId}` : null
    const copy = buildCopy(input.kind)
    const subject = `${BRAND_NAME}: ${copy.title} for "${input.modelTitle}"`
    const textLines = [
      copy.summary,
      '',
      `Model: ${input.modelTitle}`,
      modelUrl ? `View model: ${modelUrl}` : null,
    ].filter(Boolean)
    const htmlTitle = escapeHtml(input.modelTitle)
    const htmlLink = modelUrl
      ? `<p><a href="${modelUrl}" style="color:#0ea5e9; text-decoration:underline;">View model</a></p>`
      : ''
    const html = `
      <p>${escapeHtml(copy.summary)}</p>
      <p><strong>Model:</strong> ${htmlTitle}</p>
      ${htmlLink}
    `
    const pushBody = `${copy.summary} ${input.modelTitle}`
    const pushUrl = modelUrl || `/models/${input.modelId}`

    await Promise.all([
      emailDeliveryEnabled()
        ? sendMail({
            to: user.email,
            subject,
            text: textLines.join('\n'),
            html,
          })
        : Promise.resolve(false),
      sendUserPushNotification(input.userId, {
        title: copy.title,
        body: pushBody,
        url: pushUrl,
        tag: `model-${input.modelId}-${input.kind}`,
      }),
    ])
  } catch (err) {
    console.error('Failed to notify model processing ready', err)
  }
}
