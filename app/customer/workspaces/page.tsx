import Link from 'next/link'
import { getUserIdFromCookie } from '@/lib/auth'
import { listProjectWorkspacesForUser } from '@/lib/project-workspaces'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

function formatWorkspaceDate(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'N/A'
  return value.toLocaleDateString()
}

export default async function CustomerWorkspacesPage() {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-3xl font-semibold">Project Workspaces</h1>
        <p className="text-sm text-slate-400">
          Please <Link href="/login" className="text-brand-300 underline underline-offset-4">sign in</Link> to access organization workspaces.
        </p>
      </div>
    )
  }

  const workspaces = await listProjectWorkspacesForUser(userId)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Project Workspaces</h1>
        <p className="text-sm text-slate-400">Track organization projects, recent orders, revisions, and approval-heavy jobs in one place.</p>
      </div>

      {workspaces.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-slate-400">
          No organization projects found yet. Use an organization at checkout and set a project code to start a workspace.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {workspaces.map((workspace) => (
            <div key={`${workspace.organizationId}:${workspace.projectCode}`} className="glass rounded-2xl border border-white/10 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{workspace.organizationName}</p>
                  <h2 className="text-xl font-semibold mt-2">{workspace.projectCode}</h2>
                  <p className="text-xs text-slate-400 mt-1">Role: {workspace.organizationRole}</p>
                </div>
                <Link
                  href={`/customer/workspaces/${workspace.organizationId}/${encodeURIComponent(workspace.projectCode)}`}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs hover:border-white/20"
                >
                  Open workspace
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-slate-500">Total spend</div>
                  <div className="mt-1 font-semibold">{formatCurrency(workspace.spendCents / 100)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-slate-500">Orders</div>
                  <div className="mt-1 font-semibold">{workspace.orderCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-slate-500">Revisions</div>
                  <div className="mt-1 font-semibold">{workspace.revisionCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-slate-500">Approvals</div>
                  <div className="mt-1 font-semibold">{workspace.approvalCount}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Recent orders</h3>
                  <span className="text-xs text-slate-500">Last activity {formatWorkspaceDate(workspace.lastOrderAt)}</span>
                </div>
                <div className="space-y-2">
                  {workspace.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/customer/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:border-white/20"
                    >
                      <div>
                        <div className="font-medium">Order #{order.orderNumber ?? 'Pending'}</div>
                        <div className="text-xs text-slate-400">
                          {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {order.status}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <div>{formatCurrency(order.totalCents / 100)}</div>
                        <div>{formatWorkspaceDate(order.createdAt)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
