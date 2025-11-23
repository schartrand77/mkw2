import { randomBytes } from 'crypto'
import { prisma } from './db'
import { sendMail } from './mailer'
import { BRAND_NAME } from './brand'

type Reason = 'register' | 'change'

function tokenString() {
  return randomBytes(24).toString('hex')
}

export async function createEmailVerificationToken(userId: string, email: string, minutesValid = 30) {
  const token = tokenString()
  const expiresAt = new Date(Date.now() + minutesValid * 60 * 1000)
  await prisma.verificationToken.create({
    data: {
      userId,
      email,
      token,
      expiresAt,
    },
  })
  return token
}

export function buildVerificationUrl(token: string) {
  const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
  return `${base}/api/account/email/verify?token=${token}`
}

export async function sendVerificationEmail(to: string, verifyUrl: string, opts?: { reason?: Reason; userName?: string }) {
  const reason = opts?.reason || 'register'
  const subject = reason === 'change' ? `Confirm your ${BRAND_NAME} email change` : `Confirm your ${BRAND_NAME} email`
  const greeting = opts?.userName ? `Hi ${opts.userName},` : 'Hi there,'
  const actionLine =
    reason === 'change'
      ? 'Please confirm this email change so we can update your account.'
      : 'Please confirm your email to finish creating your account.'
  const text = `${greeting}

${actionLine}

${verifyUrl}

This link expires in 30 minutes. If you did not request this, you can ignore this email.`

  const html = `<p>${greeting}</p>
<p>${actionLine}</p>
<p><a href="${verifyUrl}" style="color:#0ea5e9; text-decoration:underline;">Confirm email</a></p>
<p style="color:#64748b;font-size:12px;">If the button does not work, copy and paste this link into your browser:<br/>${verifyUrl}</p>`

  return sendMail({
    to,
    subject,
    text,
    html,
  })
}
