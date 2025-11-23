import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyPassword, setAuthCookie } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { email, password } = schema.parse(json)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    if (user.isSuspended) return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 })
    if (!user.emailVerified) {
      return NextResponse.json({ error: 'Please verify your email before signing in.' }, { status: 403 })
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    // Ensure the user has a profile page before responding
    await ensureUserPage(user.id, user.email, user.name)
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: (user as any).isAdmin } })
    const secureHint = req.nextUrl.protocol === 'https:'
    setAuthCookie(user.id, response.cookies as any, { secureHint })
    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
