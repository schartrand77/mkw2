"use client"

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import type { AdminGovernanceOrganization, GovernancePolicyPack } from '@/lib/organization-governance'

type Props = {
  organizations: AdminGovernanceOrganization[]
  policyPacks: GovernancePolicyPack[]
}

function riskTone(risk: 'low' | 'medium' | 'high') {
  if (risk === 'high') return 'text-rose-300 border-rose-500/30 bg-rose-500/10'
  if (risk === 'medium') return 'text-amber-200 border-amber-500/30 bg-amber-500/10'
  return 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
}

function parseDepartments(input: string) {
  return input
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
    .filter(Boolean)
}

function parseRouting(input: string) {
  return input
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
    .filter(Boolean)
}

function toForm(org: AdminGovernanceOrganization) {
  return {
    name: org.name,
    billingEmail: org.billingEmail || '',
    billingContact: org.billingContact || '',
    quoteApprovalRequired: org.quoteApprovalRequired,
    requirePoAboveCents: typeof org.requirePoAboveCents === 'number' && org.requirePoAboveCents > 0 ? String(org.requirePoAboveCents / 100) : '',
    departmentsText: org.procurementConfig.departments
      .map((entry) => `${entry.code},${entry.name},${typeof entry.monthlyBudgetCents === 'number' ? (entry.monthlyBudgetCents / 100).toFixed(2) : ''}`)
      .join('\n'),
    routingText: org.procurementConfig.approvalRouting
      .map((entry) => `${(entry.thresholdCents / 100).toFixed(2)},${entry.approverRole},${entry.label || ''}`)
      .join('\n'),
  }
}

export default function OrganizationGovernanceConsole({ organizations: initialOrganizations, policyPacks }: Props) {
  const [organizations, setOrganizations] = useState(initialOrganizations)
  const [activeOrgId, setActiveOrgId] = useState(initialOrganizations[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPack, setSelectedPack] = useState<string>(policyPacks[0]?.id || '')

  const activeOrg = useMemo(
    () => organizations.find((org) => org.id === activeOrgId) || null,
    [organizations, activeOrgId],
  )
  const [form, setForm] = useState(activeOrg ? toForm(activeOrg) : {
    name: '',
    billingEmail: '',
    billingContact: '',
    quoteApprovalRequired: true,
    requirePoAboveCents: '',
    departmentsText: '',
    routingText: '',
  })

  useEffect(() => {
    if (activeOrg) setForm(toForm(activeOrg))
  }, [activeOrg])

  const updateFormFromOrg = (orgId: string) => {
    setActiveOrgId(orgId)
    const next = organizations.find((org) => org.id === orgId)
    if (next) setForm(toForm(next))
  }

  const savePolicy = async (mode: 'save' | 'pack') => {
    if (!activeOrgId) return
    setBusy(true)
    setError(null)
    try {
      const payload = mode === 'pack'
        ? { policyPackId: selectedPack }
        : {
          name: form.name,
          billingEmail: form.billingEmail,
          billingContact: form.billingContact,
          quoteApprovalRequired: form.quoteApprovalRequired,
          requirePoAboveCents: form.requirePoAboveCents ? Math.round(Number(form.requirePoAboveCents) * 100) : 0,
          procurementConfig: {
            departments: parseDepartments(form.departmentsText),
            approvalRouting: parseRouting(form.routingText),
          },
        }
      const res = await fetch(`/api/admin/organizations/${activeOrgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to update organization governance.')
      setOrganizations((prev) => prev.map((org) => org.id === activeOrgId ? data.organization : org))
      setForm(toForm(data.organization))
    } catch (err: any) {
      setError(err?.message || 'Unable to update organization governance.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div> : null}

      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Organization controls</h2>
            <p className="text-sm text-slate-400 mt-1">Apply policy packs, adjust spend controls, and inspect approval graphs across customer organizations.</p>
          </div>
          <div className="text-xs text-slate-500">{organizations.length} organizations</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => updateFormFromOrg(org.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${activeOrgId === org.id ? 'border-brand-400 text-brand-200' : 'border-white/10 text-slate-300'}`}
            >
              {org.name}
            </button>
          ))}
        </div>
      </section>

      {activeOrg ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">90d spend</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(activeOrg.usage90d.spendCents / 100)}</div>
              <div className="text-xs text-slate-400">{activeOrg.usage90d.orders} orders</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Members</div>
              <div className="mt-2 text-2xl font-semibold">{activeOrg.totalMembers}</div>
              <div className="text-xs text-slate-400">{activeOrg.memberCounts.owner || 0} owners, {activeOrg.memberCounts.approver || 0} approvers</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Pending approvals</div>
              <div className="mt-2 text-2xl font-semibold">{activeOrg.usage90d.pendingApprovalRequests}</div>
              <div className="text-xs text-slate-400">Open quote approvals</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Governance risk</div>
              <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs uppercase tracking-[0.2em] ${riskTone(activeOrg.governanceRisk.riskLevel)}`}>
                {activeOrg.governanceRisk.riskLevel}
              </div>
              <div className="mt-2 text-xs text-slate-400">{activeOrg.governanceRisk.reasons[0]}</div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void savePolicy('save')
              }}
              className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Spend controls</h3>
                  <p className="text-sm text-slate-400 mt-1">Edit approval requirements, PO threshold, departments, and routing rules.</p>
                </div>
                <div className="text-xs text-slate-500">{activeOrg.slug}</div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <input className="input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Organization name" />
                <input className="input" value={form.billingEmail} onChange={(e) => setForm((prev) => ({ ...prev, billingEmail: e.target.value }))} placeholder="Billing email" />
                <input className="input md:col-span-2" value={form.billingContact} onChange={(e) => setForm((prev) => ({ ...prev, billingContact: e.target.value }))} placeholder="Billing contact" />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm flex items-center justify-between gap-3">
                  <span>Require quote approval</span>
                  <input type="checkbox" checked={form.quoteApprovalRequired} onChange={(e) => setForm((prev) => ({ ...prev, quoteApprovalRequired: e.target.checked }))} />
                </label>
                <input className="input" value={form.requirePoAboveCents} onChange={(e) => setForm((prev) => ({ ...prev, requirePoAboveCents: e.target.value }))} placeholder="PO required above (USD)" />
              </div>
              <textarea className="input min-h-[120px]" value={form.departmentsText} onChange={(e) => setForm((prev) => ({ ...prev, departmentsText: e.target.value }))} placeholder="Departments: CODE,Name,MonthlyBudgetUSD" />
              <textarea className="input min-h-[120px]" value={form.routingText} onChange={(e) => setForm((prev) => ({ ...prev, routingText: e.target.value }))} placeholder="Approval routing: ThresholdUSD,Role,Label" />
              <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save governance policy'}</button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Policy packs</h3>
                <p className="text-sm text-slate-400 mt-1">Apply a governance baseline, then fine-tune budgets and routing.</p>
              </div>
              <select className="input" value={selectedPack} onChange={(e) => setSelectedPack(e.target.value)}>
                {policyPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>{pack.label}</option>
                ))}
              </select>
              <div className="space-y-3">
                {policyPacks.map((pack) => (
                  <div key={pack.id} className={`rounded-xl border px-4 py-3 text-sm ${selectedPack === pack.id ? 'border-brand-400 bg-brand-500/10' : 'border-white/10 bg-black/20'}`}>
                    <div className="font-medium">{pack.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{pack.description}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {pack.quoteApprovalRequired ? 'Quote approval on' : 'Quote approval off'} •
                      {' '}PO {typeof pack.requirePoAboveCents === 'number' && pack.requirePoAboveCents > 0 ? `above ${formatCurrency(pack.requirePoAboveCents / 100)}` : 'not required'}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn" disabled={busy || !selectedPack} onClick={() => void savePolicy('pack')}>
                {busy ? 'Applying...' : 'Apply policy pack'}
              </button>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Approval graph</h3>
                <p className="text-sm text-slate-400 mt-1">Ordered approval gates as order value increases.</p>
              </div>
              {activeOrg.approvalGraph.length === 0 ? (
                <p className="text-sm text-slate-400">No approval gates configured.</p>
              ) : (
                <div className="space-y-3">
                  {activeOrg.approvalGraph.map((node) => (
                    <div key={`${node.gate}-${node.thresholdCents}-${node.approverRole}`} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{node.label}</div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{node.approverRole}</div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {node.thresholdCents > 0 ? `${formatCurrency(node.thresholdCents / 100)}+` : 'All qualifying quotes'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Department budgets</h3>
                <p className="text-sm text-slate-400 mt-1">90-day spend against configured department budgets.</p>
              </div>
              {activeOrg.usage90d.departments.length === 0 ? (
                <p className="text-sm text-slate-400">No departments configured yet.</p>
              ) : (
                <div className="space-y-3">
                  {activeOrg.usage90d.departments.map((department) => (
                    <div key={department.code} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{department.code} · {department.name}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            Spend {formatCurrency(department.spendCents / 100)}
                            {typeof department.monthlyBudgetCents === 'number' ? ` / Budget ${formatCurrency(department.monthlyBudgetCents / 100)}` : ' / No budget'}
                          </div>
                        </div>
                        <div className={`inline-flex rounded-full border px-2 py-1 text-xs uppercase tracking-[0.2em] ${department.overBudget ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                          {department.overBudget ? 'Over budget' : 'Within range'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
