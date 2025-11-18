import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { z } from 'zod'
import { createEmailVerificationToken, buildVerificationUrl, sendVerificationEmail } from '@/lib/emailVerification'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { email } = schema.parse(await req.json())
    if (email === 'anonymous@local') return NextResponse.json({ error: 'Email not allowed' }, { status: 400 })
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== userId) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    const token = await createEmailVerificationToken(userId, email)
    const verifyUrl = buildVerificationUrl(token)
    await sendVerificationEmail(email, verifyUrl, { reason: 'change' })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
