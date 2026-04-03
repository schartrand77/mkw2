"use client"

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'

type Org = {
  id: string
  name: string
  slug: string
  role: string
  billingEmail?: string | null
  billingContact?: string | null
  quoteApprovalRequired?: boolean
  requirePoAboveCents?: number | null
  procurementConfig?: {
    departments: Array<{ code: string; name: string; monthlyBudgetCents?: number | null }>
    approvalRouting: Array<{ thresholdCents: number; approverRole: string; label?: string | null }>
  }
  joinedAt?: string
}

type OrgMember = {
  id: string
  role: string
  status: string
  joinedAt: string
  user: {
    id: string
    email: string
    name?: string | null
  }
}

export default function OrganizationSettingsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', billingEmail: '', billingContact: '' })
  const [createBusy, setCreateBusy] = useState(false)
  const [activeOrgId, setActiveOrgId] = useState('')
  const [usage, setUsage] = useState<any>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [memberForm, setMemberForm] = useState({ email: '', role: 'requester' })
  const [memberBusy, setMemberBusy] = useState(false)
  const [policyBusy, setPolicyBusy] = useState(false)
  const [policyForm, setPolicyForm] = useState({
    name: '',
    billingEmail: '',
    billingContact: '',
    quoteApprovalRequired: true,
    requirePoAboveCents: '',
    departmentsText: '',
    routingText: '',
  })

  useEffect(() => {
    let mounted = true
    fetch('/api/customer/organizations', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted) return
        const list = Array.isArray(data?.organizations) ? data.organizations : []
        setOrgs(list)
        if (list.length > 0) setActiveOrgId(list[0].id)
      })
      .catch(() => setError('Unable to load organizations.'))
      .finally(() => setLoading(false))
    return () => { mounted = false }
  }, [])

  const activeOrg = useMemo(() => orgs.find((org) => org.id === activeOrgId) || null, [orgs, activeOrgId])

  useEffect(() => {
    if (!activeOrgId) {
      setUsage(null)
      setMembers([])
      return
    }
    let mounted = true
    fetch(`/api/customer/organizations/${activeOrgId}/usage`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => { if (mounted) setUsage(data) })
      .catch(() => {})
    fetch(`/api/customer/organizations/${activeOrgId}/members`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => { if (mounted) setMembers(Array.isArray(data?.members) ? data.members : []) })
      .catch(() => {})
    return () => { mounted = false }
  }, [activeOrgId])

  useEffect(() => {
    if (!activeOrg) return
    setPolicyForm({
      name: activeOrg.name || '',
      billingEmail: activeOrg.billingEmail || '',
      billingContact: activeOrg.billingContact || '',
      quoteApprovalRequired: activeOrg.quoteApprovalRequired !== false,
      requirePoAboveCents: typeof activeOrg.requirePoAboveCents === 'number' && activeOrg.requirePoAboveCents > 0
        ? String(activeOrg.requirePoAboveCents / 100)
        : '',
      departmentsText: (activeOrg.procurementConfig?.departments || [])
        .map((entry) => `${entry.code},${entry.name},${typeof entry.monthlyBudgetCents === 'number' ? (entry.monthlyBudgetCents / 100).toFixed(2) : ''}`)
        .join('\n'),
      routingText: (activeOrg.procurementConfig?.approvalRouting || [])
        .map((entry) => `${(entry.thresholdCents / 100).toFixed(2)},${entry.approverRole},${entry.label || ''}`)
        .join('\n'),
    })
  }, [activeOrg])

  const parseDepartments = (input: string) => input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [codeRaw, nameRaw, budgetRaw] = line.split(',').map((part) => part.trim())
      const budget = Number(budgetRaw)
      if (!codeRaw || !nameRaw) return null
      return {
        code: codeRaw.toUpperCase(),
        name: nameRaw,
        monthlyBudgetCents: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) : null,
      }
    })
    .filter((entry): entry is { code: string; name: string; monthlyBudgetCents: number | null } => Boolean(entry))

  const parseRouting = (input: string) => input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [thresholdRaw, approverRoleRaw, labelRaw] = line.split(',').map((part) => part.trim())
      const threshold = Number(thresholdRaw)
      if (!Number.isFinite(threshold) || threshold < 0 || !approverRoleRaw) return null
      return {
        thresholdCents: Math.round(threshold * 100),
        approverRole: approverRoleRaw.toLowerCase(),
        label: labelRaw || null,
      }
    })
    .filter((entry): entry is { thresholdCents: number; approverRole: string; label: string | null } => Boolean(entry))

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setCreateBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/customer/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to create organization.')
      const listRes = await fetch('/api/customer/organizations', { cache: 'no-store' })
      const list = await listRes.json().catch(() => ({ organizations: [] }))
      const next = Array.isArray(list.organizations) ? list.organizations : []
      setOrgs(next)
      const createdId = data?.organization?.id
      if (createdId) setActiveOrgId(createdId)
      setCreateForm({ name: '', billingEmail: '', billingContact: '' })
    } catch (err: any) {
      setError(err?.message || 'Unable to create organization.')
    } finally {
      setCreateBusy(false)
    }
  }

  const savePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrgId) return
    setPolicyBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/customer/organizations/${activeOrgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: policyForm.name,
          billingEmail: policyForm.billingEmail,
          billingContact: policyForm.billingContact,
          quoteApprovalRequired: policyForm.quoteApprovalRequired,
          requirePoAboveCents: policyForm.requirePoAboveCents ? Math.round(Number(policyForm.requirePoAboveCents) * 100) : 0,
          procurementConfig: {
            departments: parseDepartments(policyForm.departmentsText),
            approvalRouting: parseRouting(policyForm.routingText),
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to update organization.')
      setOrgs((prev) => prev.map((org) => org.id === activeOrgId ? { ...org, ...data.organization } : org))
    } catch (err: any) {
      setError(err?.message || 'Unable to update organization.')
    } finally {
      setPolicyBusy(false)
    }
  }

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrgId || !memberForm.email.trim()) return
    setMemberBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/customer/organizations/${activeOrgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to add member.')
      setMembers((prev) => {
        const next = prev.filter((member) => member.user.id !== data.member.user.id)
        return [...next, data.member]
      })
      setMemberForm({ email: '', role: 'requester' })
    } catch (err: any) {
      setError(err?.message || 'Unable to add member.')
    } finally {
      setMemberBusy(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Accounts</h1>
        <p className="text-sm text-slate-400">Manage teams, approval policy, and enterprise usage analytics.</p>
      </div>

      {error ? <div className="text-sm text-amber-300">{error}</div> : null}

      <form onSubmit={createOrganization} className="glass rounded-xl border border-white/10 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Create organization</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Organization name" value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} />
          <input className="input" placeholder="Billing email" value={createForm.billingEmail} onChange={(e) => setCreateForm((prev) => ({ ...prev, billingEmail: e.target.value }))} />
          <input className="input" placeholder="Billing contact" value={createForm.billingContact} onChange={(e) => setCreateForm((prev) => ({ ...prev, billingContact: e.target.value }))} />
        </div>
        <button className="btn" disabled={createBusy}>{createBusy ? 'Creating...' : 'Create organization'}</button>
      </form>

      <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Your organizations</h2>
        {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
        {!loading && orgs.length === 0 ? <p className="text-sm text-slate-400">No organizations yet.</p> : null}
        {orgs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {orgs.map((org) => (
              <button key={org.id} type="button" className={`px-3 py-1.5 rounded-md border text-sm ${activeOrgId === org.id ? 'border-brand-400 text-brand-200' : 'border-white/20 text-slate-300'}`} onClick={() => setActiveOrgId(org.id)}>
                {org.name} ({org.role})
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {activeOrg ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass rounded-xl border border-white/10 p-4 space-y-2 text-sm">
            <h3 className="text-base font-semibold">Billing & approval policy</h3>
            <p><span className="text-slate-400">Billing email:</span> {activeOrg.billingEmail || 'Not set'}</p>
            <p><span className="text-slate-400">Billing contact:</span> {activeOrg.billingContact || 'Not set'}</p>
            <p><span className="text-slate-400">Quote approval:</span> {activeOrg.quoteApprovalRequired ? 'Required' : 'Optional'}</p>
            <p><span className="text-slate-400">PO threshold:</span> {typeof activeOrg.requirePoAboveCents === 'number' && activeOrg.requirePoAboveCents > 0 ? formatCurrency(activeOrg.requirePoAboveCents / 100) : 'Not required'}</p>
            <p><span className="text-slate-400">Departments:</span> {activeOrg.procurementConfig?.departments?.length || 0}</p>
            <p><span className="text-slate-400">Approval routes:</span> {activeOrg.procurementConfig?.approvalRouting?.length || 0}</p>
          </div>
          <div className="glass rounded-xl border border-white/10 p-4 space-y-2 text-sm">
            <h3 className="text-base font-semibold">Usage summary (90d)</h3>
            <p><span className="text-slate-400">Orders:</span> {usage?.totals?.orders ?? '--'}</p>
            <p><span className="text-slate-400">Spend:</span> {typeof usage?.totals?.spendCents === 'number' ? formatCurrency(usage.totals.spendCents / 100) : '--'}</p>
            <p><span className="text-slate-400">Departments tracked:</span> {usage?.procurement?.departments?.length ?? 0}</p>
            <p className="text-xs text-slate-400">Project/material/department breakdown is available via `/api/customer/organizations/{activeOrg.id}/usage`.</p>
          </div>
          <form onSubmit={savePolicy} className="glass rounded-xl border border-white/10 p-4 space-y-3 text-sm">
            <h3 className="text-base font-semibold">Procurement controls</h3>
            <input className="input" value={policyForm.name} onChange={(e) => setPolicyForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Organization name" />
            <input className="input" value={policyForm.billingEmail} onChange={(e) => setPolicyForm((prev) => ({ ...prev, billingEmail: e.target.value }))} placeholder="Billing email" />
            <input className="input" value={policyForm.billingContact} onChange={(e) => setPolicyForm((prev) => ({ ...prev, billingContact: e.target.value }))} placeholder="Billing contact" />
            <label className="flex items-center justify-between gap-3">
              <span>Require quote approval</span>
              <input type="checkbox" checked={policyForm.quoteApprovalRequired} onChange={(e) => setPolicyForm((prev) => ({ ...prev, quoteApprovalRequired: e.target.checked }))} />
            </label>
            <input className="input" value={policyForm.requirePoAboveCents} onChange={(e) => setPolicyForm((prev) => ({ ...prev, requirePoAboveCents: e.target.value }))} placeholder="PO required above (USD)" />
            <textarea
              className="input min-h-[100px]"
              value={policyForm.departmentsText}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, departmentsText: e.target.value }))}
              placeholder="Departments: CODE,Name,MonthlyBudgetUSD"
            />
            <textarea
              className="input min-h-[100px]"
              value={policyForm.routingText}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, routingText: e.target.value }))}
              placeholder="Approval routing: ThresholdUSD,Role,Label"
            />
            <p className="text-xs text-slate-400">Use one rule per line. Example: `ENG,Engineering,2500` and `1000,approver,Manager review`.</p>
            <button className="btn" disabled={policyBusy}>{policyBusy ? 'Saving...' : 'Save policy'}</button>
          </form>
          <div className="glass rounded-xl border border-white/10 p-4 space-y-3 text-sm">
            <h3 className="text-base font-semibold">Budget tracking</h3>
            {(usage?.procurement?.departments?.length ?? 0) === 0 ? (
              <p className="text-slate-400">Add departments with budgets to start procurement budget tracking.</p>
            ) : (
              <div className="space-y-2">
                {usage.procurement.departments.map((department: any) => (
                  <div key={department.code} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{department.code} - {department.name}</div>
                        <div className="text-xs text-slate-400">
                          Spend {formatCurrency((department.spendCents || 0) / 100)}
                          {typeof department.monthlyBudgetCents === 'number' ? ` / Budget ${formatCurrency(department.monthlyBudgetCents / 100)}` : ''}
                        </div>
                      </div>
                      <div className={`text-xs uppercase tracking-[0.2em] ${department.overBudget ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {department.overBudget ? 'Over budget' : 'Within budget'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="glass rounded-xl border border-white/10 p-4 space-y-3 text-sm">
            <h3 className="text-base font-semibold">Approval routing</h3>
            {(activeOrg.procurementConfig?.approvalRouting?.length ?? 0) === 0 ? (
              <p className="text-slate-400">No approval routing rules configured yet.</p>
            ) : (
              <div className="space-y-2">
                {activeOrg.procurementConfig?.approvalRouting?.map((route) => (
                  <div key={`${route.thresholdCents}-${route.approverRole}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="font-medium">{formatCurrency(route.thresholdCents / 100)}+</div>
                    <div className="text-xs text-slate-400">{route.approverRole}{route.label ? ` - ${route.label}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="glass rounded-xl border border-white/10 p-4 space-y-3 text-sm md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Members</h3>
              <span className="text-xs text-slate-500">{members.length} active</span>
            </div>
            <form onSubmit={inviteMember} className="grid md:grid-cols-[1.2fr_0.8fr_auto] gap-3">
              <input className="input" value={memberForm.email} onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Member email" />
              <select className="input" value={memberForm.role} onChange={(e) => setMemberForm((prev) => ({ ...prev, role: e.target.value }))}>
                <option value="requester">Requester</option>
                <option value="approver">Approver</option>
                <option value="finance">Finance</option>
                <option value="owner">Owner</option>
              </select>
              <button className="btn" disabled={memberBusy}>{memberBusy ? 'Adding...' : 'Add member'}</button>
            </form>
            <div className="grid gap-2">
              {members.map((member) => (
                <div key={member.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
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
        </div>
      ) : null}
    </div>
  )
}
