import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'

export async function GET() {
  const userId = getUserIdFromCookie()
  if (!userId) return NextResponse.json({ user: null })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, isAdmin: true } })
  return NextResponse.json({ user })
}
