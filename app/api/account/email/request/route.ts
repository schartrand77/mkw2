import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const schema = z.object({ email: z.string().email() })

function tokenString() {
  return randomBytes(24).toString('hex')
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { email } = schema.parse(await req.json())
    if (email === 'anonymous@local') return NextResponse.json({ error: 'Email not allowed' }, { status: 400 })
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== userId) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    const token = tokenString()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30) // 30 minutes
    await prisma.verificationToken.create({ data: { userId, email, token, expiresAt } })
    const base = process.env.BASE_URL || 'http://localhost:3000'
    const verifyUrl = `${base}/api/account/email/verify?token=${token}`
    // In production you'd send email instead of returning the URL
    return NextResponse.json({ ok: true, verifyUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
