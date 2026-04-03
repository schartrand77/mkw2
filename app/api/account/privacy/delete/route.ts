import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { clearAuthCookie, getUserIdFromCookie, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteUserPrivacyData } from '@/lib/privacy'
import { isSameOriginRequest } from '@/lib/csrf'

export const dynamic = 'force-dynamic'

const payloadSchema = z.object({
  currentPassword: z.string().min(1),
  confirmation: z.literal('DELETE'),
})

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid CSRF origin' }, { status: 403 })
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { currentPassword } = payloadSchema.parse(await req.json())
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Incorrect current password' }, { status: 403 })

    await deleteUserPrivacyData(userId)
    const response = NextResponse.json({ ok: true, deleted: true })
    const secureHint = req.nextUrl.protocol === 'https:'
    await clearAuthCookie(response.cookies as any, { secureHint })
    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
