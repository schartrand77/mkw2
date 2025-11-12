import { getUserIdFromCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function requireAdmin(): Promise<string> {
  const userId = await getUserIdFromCookie()
  if (!userId) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) throw Object.assign(new Error('Forbidden'), { status: 403 })
  return userId
}
