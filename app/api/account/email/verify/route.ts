import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { setAuthCookie } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  const vt = await prisma.verificationToken.findUnique({ where: { token } })
  if (!vt) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  if (vt.usedAt) return NextResponse.json({ error: 'Token already used' }, { status: 400 })
  if (vt.expiresAt < new Date()) return NextResponse.json({ error: 'Token expired' }, { status: 400 })

  // Ensure email still not taken
  const existing = await prisma.user.findUnique({ where: { email: vt.email } })
  if (existing && existing.id !== vt.userId) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  await prisma.$transaction([
    prisma.user.update({ where: { id: vt.userId }, data: { email: vt.email, emailVerified: true } }),
    prisma.verificationToken.update({ where: { token }, data: { usedAt: new Date() } })
  ])

  const response = NextResponse.redirect(new URL('/login?verified=1', req.url))
  setAuthCookie(vt.userId, response.cookies as any)
  return response
}
