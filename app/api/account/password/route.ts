import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { clearAuthCookie, getUserIdFromCookie, verifyPassword, hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { isSameOriginRequest } from '@/lib/csrf'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function PATCH(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid CSRF origin' }, { status: 403 })
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { currentPassword, newPassword } = schema.parse(await req.json())
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ok = await verifyPassword(currentPassword, user.passwordHash)
    if (!ok) return NextResponse.json({ error: 'Incorrect current password' }, { status: 403 })
    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash, lastLoginAt: new Date() } })
    const response = NextResponse.json({ ok: true, requiresReauth: true })
    const secureHint = req.nextUrl.protocol === 'https:'
    await clearAuthCookie(response.cookies as any, { secureHint })
    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
