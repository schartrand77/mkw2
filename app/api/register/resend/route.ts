import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createEmailVerificationToken, buildVerificationUrl, sendVerificationEmail } from '@/lib/emailVerification'

const schema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const { email } = schema.parse(await req.json())
    const normalized = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, name: true, emailVerified: true, isSuspended: true },
    })
    if (!user) return NextResponse.json({ error: 'No account found for that email' }, { status: 404 })
    if (user.emailVerified) return NextResponse.json({ error: 'Email already verified' }, { status: 400 })
    if (user.isSuspended) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

    await prisma.verificationToken.deleteMany({ where: { userId: user.id } })
    const token = await createEmailVerificationToken(user.id, normalized)
    const verifyUrl = buildVerificationUrl(token)
    let emailSent = false
    try {
      emailSent = await sendVerificationEmail(normalized, verifyUrl, { reason: 'register', userName: user.name || undefined })
    } catch (mailErr) {
      console.error('Verification email resend failed:', mailErr)
    }
    if (!emailSent) {
      return NextResponse.json({ error: 'Account exists but email could not be sent. Try again later.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, message: 'Verification email resent.' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
