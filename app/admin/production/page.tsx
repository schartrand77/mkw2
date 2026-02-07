export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ProductionDashboard from '@/components/admin/ProductionDashboard'
import { getProductionSnapshot } from '@/lib/production'

export default async function ProductionPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const snapshot = await getProductionSnapshot({ includeCustomer: true })
  const initial = {
    ...snapshot,
    generatedAt: snapshot.generatedAt.toISOString(),
    orders: snapshot.orders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
      estimatedCompletionAt: order.estimatedCompletionAt ? order.estimatedCompletionAt.toISOString() : null,
    })),
  }

  return <ProductionDashboard initial={initial} />
}
