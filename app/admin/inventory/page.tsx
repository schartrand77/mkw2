import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import StockworksInventoryPanel from '@/components/admin/StockworksInventoryPanel'

export const dynamic = 'force-dynamic'

async function requireAdminServer() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  return (user?.isAdmin || role === 'admin' || role === 'staff') ? payload.sub : null
}

export default async function AdminInventoryPage() {
  const adminId = await requireAdminServer()
  if (!adminId) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Inventory adjustments</h1>
        <p className="text-sm text-slate-400">Sync filament levels with StockWorks and keep an audit log.</p>
      </div>
      <StockworksInventoryPanel />
    </div>
  )
}
