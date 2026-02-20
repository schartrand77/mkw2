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
}

export default function OrganizationSettingsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', billingEmail: '', billingContact: '' })
  const [createBusy, setCreateBusy] = useState(false)
  const [activeOrgId, setActiveOrgId] = useState('')
  const [usage, setUsage] = useState<any>(null)

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
      return
    }
    let mounted = true
    fetch(`/api/customer/organizations/${activeOrgId}/usage`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => { if (mounted) setUsage(data) })
      .catch(() => {})
    return () => { mounted = false }
  }, [activeOrgId])

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
          </div>
          <div className="glass rounded-xl border border-white/10 p-4 space-y-2 text-sm">
            <h3 className="text-base font-semibold">Usage summary (90d)</h3>
            <p><span className="text-slate-400">Orders:</span> {usage?.totals?.orders ?? '--'}</p>
            <p><span className="text-slate-400">Spend:</span> {typeof usage?.totals?.spendCents === 'number' ? formatCurrency(usage.totals.spendCents / 100) : '--'}</p>
            <p className="text-xs text-slate-400">Project/material breakdown is available via `/api/customer/organizations/{activeOrg.id}/usage`.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
