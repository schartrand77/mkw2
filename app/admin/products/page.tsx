export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import ProductBuilder from '@/components/admin/ProductBuilder'

async function requireAdminServer() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  return (user?.isAdmin || role === 'admin' || role === 'staff') ? payload.sub : null
}

export default async function AdminProductsPage() {
  const adminId = await requireAdminServer()
  if (!adminId) redirect('/login')

  const [products, models] = await Promise.all([
    prisma.productTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { baseModel: { select: { id: true, title: true } } },
    }),
    prisma.model.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        priceUsd: true,
        material: true,
        volumeMm3: true,
        sizeXmm: true,
        sizeYmm: true,
        sizeZmm: true,
      },
      take: 200,
    }),
  ])

  return <ProductBuilder initialProducts={products as any} models={models as any} />
}
