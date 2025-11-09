"use client"
import { useState } from 'react'

type Config = {
  heroTitle?: string | null
  heroSubtitle?: string | null
  costPerCm3?: number | null
  fixedFeeUsd?: number | null
  allowAnonymousUploads?: boolean | null
}

export default function SiteConfigForm({ initial }: { initial: Config }) {
  const [cfg, setCfg] = useState<Config>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMsg(null); setErr(null)
    try {
      const res = await fetch('/api/admin/site-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        heroTitle: cfg.heroTitle || undefined,
        heroSubtitle: cfg.heroSubtitle || undefined,
        costPerCm3: cfg.costPerCm3 != null ? Number(cfg.costPerCm3) : undefined,
        fixedFeeUsd: cfg.fixedFeeUsd != null ? Number(cfg.fixedFeeUsd) : undefined,
        allowAnonymousUploads: cfg.allowAnonymousUploads != null ? Boolean(cfg.allowAnonymousUploads) : undefined,
      }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save config')
      setMsg('Saved site configuration.')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <h2 className="text-xl font-semibold">Site settings</h2>
      {err && <div className="text-amber-400 text-sm">{err}</div>}
      {msg && <div className="text-green-400 text-sm">{msg}</div>}
      <div>
        <label className="block text-sm mb-1">Hero title</label>
        <input className="input" value={cfg.heroTitle || ''} onChange={(e) => setCfg({ ...cfg, heroTitle: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm mb-1">Hero subtitle</label>
        <input className="input" value={cfg.heroSubtitle || ''} onChange={(e) => setCfg({ ...cfg, heroSubtitle: e.target.value })} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Cost per cm³ (USD)</label>
          <input className="input" type="number" step="0.01" value={cfg.costPerCm3 ?? ''} onChange={(e) => setCfg({ ...cfg, costPerCm3: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Fixed fee (USD)</label>
          <input className="input" type="number" step="0.01" value={cfg.fixedFeeUsd ?? ''} onChange={(e) => setCfg({ ...cfg, fixedFeeUsd: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input id="anu" type="checkbox" checked={!!cfg.allowAnonymousUploads} onChange={(e) => setCfg({ ...cfg, allowAnonymousUploads: e.target.checked })} />
        <label htmlFor="anu" className="text-sm">Allow anonymous uploads</label>
      </div>
      <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
    </form>
  )
}

