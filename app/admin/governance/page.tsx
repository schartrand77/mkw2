export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import OrganizationGovernanceConsole from '@/components/admin/OrganizationGovernanceConsole'
import { buildAdminGovernanceOrganizations, GOVERNANCE_POLICY_PACKS } from '@/lib/organization-governance'

export default async function AdminGovernancePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const organizations = await buildAdminGovernanceOrganizations()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Governance</h1>
          <p className="mt-1 text-sm text-slate-400">Admin controls for organization policy packs, spend guardrails, and approval structure.</p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <OrganizationGovernanceConsole organizations={organizations} policyPacks={GOVERNANCE_POLICY_PACKS} />
    </div>
  )
}
