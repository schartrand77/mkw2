export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import CatalogManager from '@/components/admin/CatalogManager'

async function requireAdminServer() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  return (user?.isAdmin || role === 'admin' || role === 'staff') ? payload.sub : null
}

type AdminCatalogPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>
}

export default async function AdminCatalogPage({ searchParams }: AdminCatalogPageProps) {
  const adminId = await requireAdminServer()
  if (!adminId) redirect('/login')
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const q = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q

  const [config, merch] = await Promise.all([
    prisma.siteConfig.upsert({
      where: { id: 'main' },
      update: {},
      create: { id: 'main' },
      select: {
        productsModelsLabel: true,
        productsMerchLabel: true,
      },
    }),
    prisma.merchItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Catalog Manager</h1>
        <p className="mt-1 text-sm text-slate-400">Manage storefront categories and merch for your business.</p>
      </div>
      <CatalogManager initialLabels={config as any} initialMerch={merch as any} initialSearch={q || ''} />
    </div>
  )
}
