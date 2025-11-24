"use client"
import { useState } from 'react'

type Config = {
  plaPricePerKgUsd?: number | null
  petgPricePerKgUsd?: number | null
  allowAnonymousUploads?: boolean | null
  printSpeedCm3PerHour?: number | null
  energyUsdPerHour?: number | null
  minimumPriceUsd?: number | null
  extraHourlyUsdAfterFirst?: number | null
  fillFactor?: number | null
  directUploadUrl?: string | null
}

export default function SiteConfigForm({ initial }: { initial: Config }) {
  const currency = (process.env.NEXT_PUBLIC_CURRENCY || 'USD') as 'USD' | 'CAD'
  const [cfg, setCfg] = useState<Config>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMsg(null); setErr(null)
    try {
      const res = await fetch('/api/admin/site-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaPricePerKgUsd: cfg.plaPricePerKgUsd != null ? Number(cfg.plaPricePerKgUsd) : undefined,
          petgPricePerKgUsd: cfg.petgPricePerKgUsd != null ? Number(cfg.petgPricePerKgUsd) : undefined,
          allowAnonymousUploads: cfg.allowAnonymousUploads != null ? Boolean(cfg.allowAnonymousUploads) : undefined,
          printSpeedCm3PerHour: cfg.printSpeedCm3PerHour != null ? Number(cfg.printSpeedCm3PerHour) : undefined,
          energyUsdPerHour: cfg.energyUsdPerHour != null ? Number(cfg.energyUsdPerHour) : undefined,
          minimumPriceUsd: cfg.minimumPriceUsd != null ? Number(cfg.minimumPriceUsd) : undefined,
          extraHourlyUsdAfterFirst: cfg.extraHourlyUsdAfterFirst != null ? Number(cfg.extraHourlyUsdAfterFirst) : undefined,
          fillFactor: cfg.fillFactor != null ? Number(cfg.fillFactor) : undefined,
          directUploadUrl: cfg.directUploadUrl != null ? cfg.directUploadUrl : null,
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save config')
      setMsg('Saved site configuration.')
    } catch (e: any) {
      setErr(e.message)
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <h2 className="text-xl font-semibold">Site settings</h2>
      {err && <div className="text-amber-400 text-sm">{err}</div>}
      {msg && <div className="text-brand-400 text-sm">{msg}</div>}

      <TabSwitcher
        tabs={[
          {
            key: 'pricing',
            label: 'Pricing',
            content: (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">PLA price per kg ({currency})</label>
                    <input className="input" type="number" step="0.01" value={cfg.plaPricePerKgUsd ?? ''} onChange={(e) => setCfg({ ...cfg, plaPricePerKgUsd: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">PETG price per kg ({currency})</label>
                    <input className="input" type="number" step="0.01" value={cfg.petgPricePerKgUsd ?? ''} onChange={(e) => setCfg({ ...cfg, petgPricePerKgUsd: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Print speed (cm^3/hour)</label>
                    <input className="input" type="number" step="0.01" value={cfg.printSpeedCm3PerHour ?? ''} onChange={(e) => setCfg({ ...cfg, printSpeedCm3PerHour: e.target.value === '' ? null : Number(e.target.value) })} />
                    <p className="text-xs text-slate-400 mt-1">Values 0-3 are treated as cm3 per minute for convenience.</p>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Energy cost per hour ({currency})</label>
                    <input className="input" type="number" step="0.01" value={cfg.energyUsdPerHour ?? ''} onChange={(e) => setCfg({ ...cfg, energyUsdPerHour: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Extra per-hour charge after first hour ({currency})</label>
                    <input className="input" type="number" step="0.01" value={cfg.extraHourlyUsdAfterFirst ?? ''} onChange={(e) => setCfg({ ...cfg, extraHourlyUsdAfterFirst: e.target.value === '' ? null : Number(e.target.value) })} />
                    <p className="text-xs text-slate-400 mt-1">Apply a surcharge for long prints; first hour is excluded.</p>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Minimum price ({currency})</label>
                    <input className="input" type="number" step="0.01" value={cfg.minimumPriceUsd ?? ''} onChange={(e) => setCfg({ ...cfg, minimumPriceUsd: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                </div>

                <p className="text-xs text-slate-400">Material costs are derived from the per-kg prices; no multipliers needed.</p>

                <div>
                  <label className="block text-sm mb-1">Infill (%)</label>
                  <select
                    className="input"
                    value={cfg.fillFactor != null ? String(Math.round(Number(cfg.fillFactor) * 100)) : ''}
                    onChange={(e) => setCfg({ ...cfg, fillFactor: e.target.value === '' ? null : Number(e.target.value) / 100 })}
                  >
                    <option value="">Select...</option>
                    <option value="15">15%</option>
                    <option value="30">30%</option>
                    <option value="45">45%</option>
                    <option value="60">60%</option>
                    <option value="75">75%</option>
                    <option value="90">90%</option>
                  </select>
                </div>
              </div>
            ),
          },
          {
            key: 'uploads',
            label: 'Uploads',
            content: (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input id="anu" type="checkbox" checked={!!cfg.allowAnonymousUploads} onChange={(e) => setCfg({ ...cfg, allowAnonymousUploads: e.target.checked })} />
                  <label htmlFor="anu" className="text-sm">Allow anonymous uploads</label>
                </div>
                <div>
                  <label className="block text-sm mb-1">Direct upload URL (optional)</label>
                  <input
                    className="input"
                    type="url"
                    placeholder="https://upload.example.com"
                    value={cfg.directUploadUrl ?? ''}
                    onChange={(e) => setCfg({ ...cfg, directUploadUrl: e.target.value === '' ? null : e.target.value })}
                  />
                  <p className="text-xs text-slate-400 mt-1">When provided, the Upload page will POST to this host&apos;s `/api/upload`, bypassing Cloudflare/Tunnel limits.</p>
                </div>
              </div>
            ),
          },
        ]}
      />

      <button className="btn" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
    </form>
  )
}

function TabSwitcher({ tabs }: { tabs: { key: string, label: string, content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find((t) => t.key === active) || tabs[0]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`px-3 py-1.5 rounded-md border text-sm ${tab.key === active ? 'border-white/40 bg-white/10' : 'border-white/10 hover:border-white/20'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="glass border border-white/10 rounded-lg p-4">
        {current?.content}
      </div>
    </div>
  )
}
