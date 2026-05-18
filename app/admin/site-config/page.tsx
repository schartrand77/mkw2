export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import SiteConfigForm from '@/components/admin/SiteConfigForm'
import EnvCheckCard from '@/components/admin/EnvCheckCard'
import ConfigAuditLog from '@/components/admin/ConfigAuditLog'

export default async function AdminSiteConfigPage() {
  const cfg = await prisma.siteConfig.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Site config</h1>
        <p className="mt-1 text-sm text-slate-400">Global pricing, policy, notifications, and environment checks.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <SiteConfigForm initial={cfg as any} />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <h2 className="mb-4 text-lg font-semibold">Environment checks</h2>
        <EnvCheckCard />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <h2 className="mb-4 text-lg font-semibold">Config audit log</h2>
        <ConfigAuditLog />
      </div>
    </div>
  )
}
