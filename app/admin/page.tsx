import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import FeaturedManager from '@/components/admin/FeaturedManager'
import SiteConfigForm from '@/components/admin/SiteConfigForm'
import ModelManager from '@/components/admin/ModelManager'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminPage() {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  if (!user?.isAdmin) redirect('/')

  const featuredItems = await prisma.featuredModel.findMany({ include: { model: { select: { id: true, title: true, coverImagePath: true } } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  const initialFeatured = featuredItems.map(i => i.model)
  const cfg = await prisma.siteConfig.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } })

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-xl">
          <FeaturedManager initial={initialFeatured} />
        </div>
        <div className="glass p-6 rounded-xl">
          <SiteConfigForm initial={cfg as any} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 text-sm">View Users & Badges</Link>
      </div>
      <div className="glass p-6 rounded-xl">
        <ModelManager />
      </div>
    </div>
  )
}
