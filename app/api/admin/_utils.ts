import { getUserIdFromCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'

export type ApiRole = 'admin' | 'staff' | 'customer'

export async function requireRole(allowedRoles: ApiRole[]): Promise<string> {
  const userId = await getUserIdFromCookie()
  if (!userId) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, role: true } })
  const role = ((user?.isAdmin ? 'admin' : (user?.role || 'customer')) as ApiRole)
  if (!allowedRoles.includes(role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  return userId
}

export async function requireAdmin(): Promise<string> {
  return requireRole(['admin', 'staff'])
}

export const adminRouteGuards = {
  requireAdmin,
}
