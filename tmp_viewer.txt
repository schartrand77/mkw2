"use client"
import { useState } from 'react'

type Config = {
  costPerCm3?: number | null
  fixedFeeUsd?: number | null
  allowAnonymousUploads?: boolean | null
  laborPerHourUsd?: number | null
  printSpeedCm3PerHour?: number | null
  energyUsdPerHour?: number | null
  minimumPriceUsd?: number | null
  materialPlaMultiplier?: number | null
  materialAbsMultiplier?: number | null
  materialPetgMultiplier?: number | null
  materialResinMultiplier?: number | null
  fillFactor?: number | null
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
        costPerCm3: cfg.costPerCm3 != null ? Number(cfg.costPerCm3) : undefined,
        fixedFeeUsd: cfg.fixedFeeUsd != null ? Number(cfg.fixedFeeUsd) : undefined,
        allowAnonymousUploads: cfg.allowAnonymousUploads != null ? Boolean(cfg.allowAnonymousUploads) : undefined,
        laborPerHourUsd: cfg.laborPerHourUsd != null ? Number(cfg.laborPerHourUsd) : undefined,
        printSpeedCm3PerHour: cfg.printSpeedCm3PerHour != null ? Number(cfg.printSpeedCm3PerHour) : undefined,
        energyUsdPerHour: cfg.energyUsdPerHour != null ? Number(cfg.energyUsdPerHour) : undefined,
        minimumPriceUsd: cfg.minimumPriceUsd != null ? Number(cfg.minimumPriceUsd) : undefined,
        materialPlaMultiplier: cfg.materialPlaMultiplier != null ? Number(cfg.materialPlaMultiplier) : undefined,
        materialAbsMultiplier: cfg.materialAbsMultiplier != null ? Number(cfg.materialAbsMultiplier) : undefined,
        materialPetgMultiplier: cfg.materialPetgMultiplier != null ? Number(cfg.materialPetgMultiplier) : undefined,
        materialResinMultiplier: cfg.materialResinMultiplier != null ? Number(cfg.materialResinMultiplier) : undefined,
        fillFactor: cfg.fillFactor != null ? Number(cfg.fillFactor) : undefined,
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
      <h2 className="text-xl font-semibold">Pricing settings</h2>
      {err && <div className="text-amber-400 text-sm">{err}</div>}
      {msg && <div className="text-green-400 text-sm">{msg}</div>}
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
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Labor per hour (USD)</label>
          <input className="input" type="number" step="0.01" value={cfg.laborPerHourUsd ?? ''} onChange={(e) => setCfg({ ...cfg, laborPerHourUsd: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Print speed (cm³/hour)</label>
          <input className="input" type="number" step="0.01" value={cfg.printSpeedCm3PerHour ?? ''} onChange={(e) => setCfg({ ...cfg, printSpeedCm3PerHour: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Energy cost per hour (USD)</label>
          <input className="input" type="number" step="0.01" value={cfg.energyUsdPerHour ?? ''} onChange={(e) => setCfg({ ...cfg, energyUsdPerHour: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Minimum price (USD)</label>
          <input className="input" type="number" step="0.01" value={cfg.minimumPriceUsd ?? ''} onChange={(e) => setCfg({ ...cfg, minimumPriceUsd: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">PLA multiplier</label>
          <input className="input" type="number" step="0.01" value={cfg.materialPlaMultiplier ?? ''} onChange={(e) => setCfg({ ...cfg, materialPlaMultiplier: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm mb-1">ABS multiplier</label>
          <input className="input" type="number" step="0.01" value={cfg.materialAbsMultiplier ?? ''} onChange={(e) => setCfg({ ...cfg, materialAbsMultiplier: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">PETG multiplier</label>
          <input className="input" type="number" step="0.01" value={cfg.materialPetgMultiplier ?? ''} onChange={(e) => setCfg({ ...cfg, materialPetgMultiplier: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Resin multiplier</label>
          <input className="input" type="number" step="0.01" value={cfg.materialResinMultiplier ?? ''} onChange={(e) => setCfg({ ...cfg, materialResinMultiplier: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Fill factor (0.1–1.5)</label>
        <input className="input" type="number" step="0.05" value={cfg.fillFactor ?? ''} onChange={(e) => setCfg({ ...cfg, fillFactor: e.target.value === '' ? null : Number(e.target.value) })} />
      </div>
      <div className="flex items-center gap-2">
        <input id="anu" type="checkbox" checked={!!cfg.allowAnonymousUploads} onChange={(e) => setCfg({ ...cfg, allowAnonymousUploads: e.target.checked })} />
        <label htmlFor="anu" className="text-sm">Allow anonymous uploads</label>
      </div>
      <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
    </form>
  )
}
