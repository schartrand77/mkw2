import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getUserIdFromCookie } from '@/lib/auth'
import { getProjectWorkspaceDetailForUser } from '@/lib/project-workspaces'
import { formatCurrency } from '@/lib/currency'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    organizationId: string
    projectCode: string
  }>
}

function formatDate(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'N/A'
  return value.toLocaleDateString()
}

export default async function ProjectWorkspaceDetailPage({ params }: PageProps) {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-3xl font-semibold">Project Workspace</h1>
        <p className="text-sm text-slate-400">
          Please <Link href="/login" className="text-brand-300 underline underline-offset-4">sign in</Link> to access workspace details.
        </p>
      </div>
    )
  }

  const { organizationId, projectCode } = await params
  const workspace = await getProjectWorkspaceDetailForUser(userId, organizationId, decodeURIComponent(projectCode))
  if (!workspace) notFound()
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, status: 'active' },
    select: {
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      organization: {
        select: {
          quoteApprovalRequired: true,
          requirePoAboveCents: true,
          billingEmail: true,
          billingContact: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  const policy = members[0]?.organization || null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <Link href="/customer/workspaces" className="text-sm text-slate-400 hover:text-white">
          ← Back to workspaces
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{workspace.organizationName}</p>
            <h1 className="text-3xl font-semibold mt-2">{workspace.projectCode}</h1>
            <p className="text-sm text-slate-400 mt-1">Workspace role: {workspace.organizationRole}</p>
          </div>
          <Link href="/checkout" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-white/20">
            Start new project order
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass rounded-2xl border border-white/10 p-4">
          <div className="text-xs text-slate-500">Workspace spend</div>
          <div className="mt-2 text-xl font-semibold">{formatCurrency(workspace.spendCents / 100)}</div>
        </div>
        <div className="glass rounded-2xl border border-white/10 p-4">
          <div className="text-xs text-slate-500">Orders</div>
          <div className="mt-2 text-xl font-semibold">{workspace.orderCount}</div>
        </div>
        <div className="glass rounded-2xl border border-white/10 p-4">
          <div className="text-xs text-slate-500">Revisions</div>
          <div className="mt-2 text-xl font-semibold">{workspace.revisionCount}</div>
        </div>
        <div className="glass rounded-2xl border border-white/10 p-4">
          <div className="text-xs text-slate-500">Approval requests</div>
          <div className="mt-2 text-xl font-semibold">{workspace.approvalCount}</div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold">Order history</h2>
          <div className="text-xs text-slate-500">Last order {formatDate(workspace.lastOrderAt)}</div>
        </div>
        <div className="space-y-2">
          {workspace.orders.map((order) => (
            <Link
              key={order.id}
              href={`/customer/orders/${order.id}`}
              className="grid gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm hover:border-white/20 md:grid-cols-[1.1fr_0.9fr_0.7fr_0.7fr]"
            >
              <div>
                <div className="font-medium">Order #{order.orderNumber ?? 'Pending'}</div>
                <div className="text-xs text-slate-400">Created {formatDate(order.createdAt)}</div>
              </div>
              <div className="text-slate-300">
                <div>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</div>
                <div className="text-xs text-slate-400">{order.status}</div>
              </div>
              <div className="text-slate-300">
                <div>{order.revisionCount} revision{order.revisionCount === 1 ? '' : 's'}</div>
                <div className="text-xs text-slate-400">{order.approvalRequestCount} approval request{order.approvalRequestCount === 1 ? '' : 's'}</div>
              </div>
              <div className="text-slate-300 md:text-right">
                <div>{formatCurrency(order.totalCents / 100)}</div>
                <div className="text-xs text-slate-400">Updated {formatDate(order.updatedAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl border border-white/10 p-5 space-y-3">
          <h2 className="text-xl font-semibold">Workspace members</h2>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.user.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{member.user.name || member.user.email}</div>
                    <div className="text-xs text-slate-400">{member.user.email}</div>
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl border border-white/10 p-5 space-y-3">
          <h2 className="text-xl font-semibold">Procurement policy</h2>
          <div className="space-y-2 text-sm text-slate-300">
            <p><span className="text-slate-500">Quote approval:</span> {policy?.quoteApprovalRequired ? 'Required before production' : 'Optional'}</p>
            <p><span className="text-slate-500">PO threshold:</span> {typeof policy?.requirePoAboveCents === 'number' && policy.requirePoAboveCents > 0 ? formatCurrency(policy.requirePoAboveCents / 100) : 'Not enforced'}</p>
            <p><span className="text-slate-500">Billing contact:</span> {policy?.billingContact || 'Not set'}</p>
            <p><span className="text-slate-500">Billing email:</span> {policy?.billingEmail || 'Not set'}</p>
          </div>
          <Link href="/settings/organizations" className="inline-flex text-sm text-brand-300 underline underline-offset-4">
            Manage members and policy
          </Link>
        </div>
      </div>
    </div>
  )
}
