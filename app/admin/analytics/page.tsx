export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard'
import { getAnalyticsSnapshot } from '@/lib/admin/analytics'

async function requireAdminServer() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  return (user?.isAdmin || role === 'admin' || role === 'staff') ? payload.sub : null
}

export default async function AdminAnalyticsPage() {
  const adminId = await requireAdminServer()
  if (!adminId) redirect('/login')
  const snapshot = await getAnalyticsSnapshot({ days: 30 })
  return <AnalyticsDashboard initial={snapshot} />
}
