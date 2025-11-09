import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, setAuthCookie } from '@/lib/auth'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  password: z.string().min(6)
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { email, name, password } = schema.parse(json)
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { email, name, passwordHash } })
    setAuthCookie(user.id)
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

