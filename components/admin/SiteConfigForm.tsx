"use client"
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { getPrinterProfiles } from '@/lib/printerProfiles'
import { MATERIAL_DENSITY_DEFAULTS } from '@/lib/pricing'

const materialDensitySchema = z.record(z.number().positive().max(5))
const printerOverrideSchema = z.object({
  nozzleDiameterMm: z.number().min(0.05).max(1.5).optional(),
  materialDensities: materialDensitySchema.optional(),
}).partial()

const configSchema = z.object({
  plaPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  petgPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  allowAnonymousUploads: z.boolean().optional(),
  printSpeedCm3PerHour: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  energyUsdPerHour: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  minimumPriceUsd: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  extraHourlyUsdAfterFirst: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  fillFactor: z.number().positive({ message: 'Select an infill percentage.' }).max(2, { message: 'Fill factor is out of range.' }).optional(),
  directUploadUrl: z.union([z.string().url({ message: 'Enter a valid https:// URL.' }), z.null()], { invalid_type_error: 'Enter a valid URL.' }).optional(),
  printerProfileKey: z.string().optional(),
  printerProfileOverrides: z.record(printerOverrideSchema).optional(),
})

type SchemaShape = z.infer<typeof configSchema>
type FieldKey = keyof SchemaShape
type FieldErrors = Partial<Record<FieldKey, string>>
type TouchMap = Partial<Record<FieldKey, boolean>>
type PrinterProfileOverrideState = {
  nozzleDiameterMm?: number
  materialDensities?: Record<string, number>
}
type PrinterProfileOverridesState = Record<string, PrinterProfileOverrideState>
type MaterialOption = 'PLA' | 'PETG' | 'ABS' | 'RESIN'

const MATERIAL_OPTIONS: MaterialOption[] = ['PLA', 'PETG', 'ABS', 'RESIN']
const PRINTER_PROFILES = getPrinterProfiles()
const DEFAULT_PROFILE_KEY = PRINTER_PROFILES[0]?.key || 'BAMBU_X1C'

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
  printerProfileKey?: string | null
  printerProfileOverrides?: PrinterProfileOverridesState | null
}

function buildPayload(cfg: Config): SchemaShape {
  return {
    plaPricePerKgUsd: cfg.plaPricePerKgUsd ?? undefined,
    petgPricePerKgUsd: cfg.petgPricePerKgUsd ?? undefined,
    allowAnonymousUploads: typeof cfg.allowAnonymousUploads === 'boolean' ? cfg.allowAnonymousUploads : undefined,
    printSpeedCm3PerHour: cfg.printSpeedCm3PerHour ?? undefined,
    energyUsdPerHour: cfg.energyUsdPerHour ?? undefined,
    minimumPriceUsd: cfg.minimumPriceUsd ?? undefined,
    extraHourlyUsdAfterFirst: cfg.extraHourlyUsdAfterFirst ?? undefined,
    fillFactor: cfg.fillFactor ?? undefined,
    directUploadUrl: cfg.directUploadUrl === null ? null : cfg.directUploadUrl || undefined,
    printerProfileKey: cfg.printerProfileKey || undefined,
    printerProfileOverrides: sanitizeOverrides(cfg.printerProfileOverrides),
  }
}

function mapErrors(result: z.SafeParseReturnType<SchemaShape, SchemaShape>): FieldErrors {
  if (result.success) return {}
  const next: FieldErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path?.[0] as FieldKey | undefined
    if (field && !next[field]) {
      next[field] = issue.message
    }
  }
  return next
}

function normalizeOverrides(raw: any): PrinterProfileOverridesState {
  if (!raw || typeof raw !== 'object') return {}
  const normalized: PrinterProfileOverridesState = {}
  for (const [profileKey, value] of Object.entries(raw as Record<string, any>)) {
    if (!value || typeof value !== 'object') continue
    const entry: PrinterProfileOverrideState = {}
    if (value.nozzleDiameterMm != null && Number.isFinite(Number(value.nozzleDiameterMm))) {
      entry.nozzleDiameterMm = Number(value.nozzleDiameterMm)
    }
    if (value.materialDensities && typeof value.materialDensities === 'object') {
      const densities: Record<string, number> = {}
      for (const [materialKey, density] of Object.entries(value.materialDensities)) {
        const num = Number(density)
        if (Number.isFinite(num) && num > 0) {
          densities[materialKey.toUpperCase()] = Number(num)
        }
      }
      if (Object.keys(densities).length) entry.materialDensities = densities
    }
    if (Object.keys(entry).length) {
      normalized[profileKey] = entry
    }
  }
  return normalized
}

function sanitizeOverrides(overrides?: PrinterProfileOverridesState | null) {
  if (!overrides) return undefined
  const cleaned: PrinterProfileOverridesState = {}
  for (const [key, value] of Object.entries(overrides)) {
    if (!value || typeof value !== 'object') continue
    const entry: PrinterProfileOverrideState = {}
    if (value.nozzleDiameterMm != null && Number.isFinite(Number(value.nozzleDiameterMm)) && value.nozzleDiameterMm > 0) {
      entry.nozzleDiameterMm = Number(value.nozzleDiameterMm)
    }
    if (value.materialDensities) {
      const densities: Record<string, number> = {}
      for (const [matKey, density] of Object.entries(value.materialDensities)) {
        const num = Number(density)
        if (Number.isFinite(num) && num > 0) densities[matKey.toUpperCase()] = Number(num)
      }
      if (Object.keys(densities).length) entry.materialDensities = densities
    }
    if (Object.keys(entry).length) {
      cleaned[key] = entry
    }
  }
  return Object.keys(cleaned).length ? cleaned : undefined
}

export default function SiteConfigForm({ initial }: { initial: Config }) {
  const currency = (process.env.NEXT_PUBLIC_CURRENCY || 'USD') as 'USD' | 'CAD'
  const [cfg, setCfg] = useState<Config>(() => ({
    ...initial,
    printerProfileOverrides: normalizeOverrides(initial.printerProfileOverrides),
  }))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<TouchMap>({})
  const [profileEditorKey, setProfileEditorKey] = useState(() => cfg.printerProfileKey || DEFAULT_PROFILE_KEY)
  const payload = useMemo(() => buildPayload(cfg), [cfg])

  useEffect(() => {
    if (!PRINTER_PROFILES.some((p) => p.key === profileEditorKey)) {
      setProfileEditorKey(cfg.printerProfileKey || DEFAULT_PROFILE_KEY)
    }
  }, [cfg.printerProfileKey, profileEditorKey])

  useEffect(() => {
    setErrors(mapErrors(configSchema.safeParse(payload)))
  }, [payload])

  const markTouched = (field: FieldKey) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  const fieldHasError = (field: FieldKey) => Boolean(touched[field] && errors[field])
  const allValid = Object.keys(errors).length === 0
  const selectedProfile = useMemo(
    () => PRINTER_PROFILES.find((p) => p.key === (cfg.printerProfileKey || DEFAULT_PROFILE_KEY)) || PRINTER_PROFILES[0],
    [cfg.printerProfileKey],
  )
  const tuningProfile = useMemo(
    () => PRINTER_PROFILES.find((p) => p.key === profileEditorKey) || selectedProfile,
    [profileEditorKey, selectedProfile],
  )
  const tuningOverride = (cfg.printerProfileOverrides && cfg.printerProfileOverrides[tuningProfile.key]) || {}

  const setProfileOverride = (profileKey: string, updater: (prev: PrinterProfileOverrideState) => PrinterProfileOverrideState) => {
    setCfg((prev) => {
      const current = (prev.printerProfileOverrides && prev.printerProfileOverrides[profileKey]) || {}
      const updated = updater({ ...current })
      const clean = Object.keys(updated).length ? updated : undefined
      const nextOverrides = { ...(prev.printerProfileOverrides || {}) }
      if (!clean) {
        delete nextOverrides[profileKey]
      } else {
        nextOverrides[profileKey] = clean
      }
      return {
        ...prev,
        printerProfileOverrides: Object.keys(nextOverrides).length ? nextOverrides : undefined,
      }
    })
  }

  const baseNozzle = tuningProfile.defaultNozzleDiameterMm || 0.4
  const nozzleValue = tuningOverride.nozzleDiameterMm ?? baseNozzle
  const derivedThroughput = Number(
    (tuningProfile.volumetricSpeedCm3PerHour * Math.max(0.25, Math.min(2.5, nozzleValue / baseNozzle))).toFixed(2),
  )

  const handleActiveProfileChange = (value: string) => {
    setCfg((prev) => ({ ...prev, printerProfileKey: value }))
    setProfileEditorKey(value)
  }

  const updateNozzle = (value: string) => {
    setProfileOverride(tuningProfile.key, (prev) => {
      if (value === '') {
        const next = { ...prev }
        delete next.nozzleDiameterMm
        return next
      }
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) return prev
      return { ...prev, nozzleDiameterMm: numeric }
    })
  }

  const updateDensity = (material: MaterialOption, value: string) => {
    setProfileOverride(tuningProfile.key, (prev) => {
      const next: PrinterProfileOverrideState = { ...prev }
      const densities = { ...(next.materialDensities || {}) }
      if (value === '') {
        delete densities[material]
      } else {
        const numeric = Number(value)
        if (Number.isFinite(numeric)) {
          densities[material] = numeric
        }
      }
      next.materialDensities = Object.keys(densities).length ? densities : undefined
      return next
    })
  }

  const resetProfileTuning = () => {
    setCfg((prev) => {
      if (!prev.printerProfileOverrides) return prev
      const next = { ...prev.printerProfileOverrides }
      delete next[tuningProfile.key]
      return {
        ...prev,
        printerProfileOverrides: Object.keys(next).length ? next : undefined,
      }
    })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMsg(null); setErr(null)
    const parsed = configSchema.safeParse(payload)
    if (!parsed.success) {
      const mapped = mapErrors(parsed)
      setErrors(mapped)
      const touchedMap: TouchMap = {}
      Object.keys(mapped).forEach((key) => { touchedMap[key as FieldKey] = true })
      setTouched((prev) => ({ ...prev, ...touchedMap }))
      setErr('Please fix the highlighted fields.')
      setSaving(false)
      return
    }
    try {
      const res = await fetch('/api/admin/site-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save config')
      setMsg('Saved site configuration.')
    } catch (e: any) {
      setErr(e.message)
    } finally { setSaving(false) }
  }

  const disableSubmit = saving || !allValid

  return (
    <form onSubmit={save} className="space-y-3" aria-busy={saving}>
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Site settings</h2>
        {saving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
      </div>
      {err && <div className="text-amber-400 text-sm" role="alert">{err}</div>}
      {msg && <div className="text-brand-400 text-sm" role="status">{msg}</div>}
      {!allValid && !saving && <p className="text-xs text-amber-400">Fix the highlighted fields before saving.</p>}

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
                    <input
                      className={`input ${fieldHasError('plaPricePerKgUsd') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.plaPricePerKgUsd ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('plaPricePerKgUsd')
                        setCfg({ ...cfg, plaPricePerKgUsd: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('plaPricePerKgUsd')}
                    />
                    {fieldHasError('plaPricePerKgUsd') && <p className="text-xs text-rose-300 mt-1">{errors.plaPricePerKgUsd}</p>}
                  </div>
                  <div>
                    <label className="block text-sm mb-1">PETG price per kg ({currency})</label>
                    <input
                      className={`input ${fieldHasError('petgPricePerKgUsd') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.petgPricePerKgUsd ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('petgPricePerKgUsd')
                        setCfg({ ...cfg, petgPricePerKgUsd: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('petgPricePerKgUsd')}
                    />
                    {fieldHasError('petgPricePerKgUsd') && <p className="text-xs text-rose-300 mt-1">{errors.petgPricePerKgUsd}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Print speed (cm^3/hour)</label>
                    <input
                      className={`input ${fieldHasError('printSpeedCm3PerHour') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.printSpeedCm3PerHour ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('printSpeedCm3PerHour')
                        setCfg({ ...cfg, printSpeedCm3PerHour: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('printSpeedCm3PerHour')}
                    />
                    <p className="text-xs text-slate-400 mt-1">Values 0-3 are treated as cm3 per minute for convenience.</p>
                    {fieldHasError('printSpeedCm3PerHour') && <p className="text-xs text-rose-300 mt-1">{errors.printSpeedCm3PerHour}</p>}
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Energy cost per hour ({currency})</label>
                    <input
                      className={`input ${fieldHasError('energyUsdPerHour') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.energyUsdPerHour ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('energyUsdPerHour')
                        setCfg({ ...cfg, energyUsdPerHour: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('energyUsdPerHour')}
                    />
                    {fieldHasError('energyUsdPerHour') && <p className="text-xs text-rose-300 mt-1">{errors.energyUsdPerHour}</p>}
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Extra per-hour charge after first hour ({currency})</label>
                    <input
                      className={`input ${fieldHasError('extraHourlyUsdAfterFirst') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.extraHourlyUsdAfterFirst ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('extraHourlyUsdAfterFirst')
                        setCfg({ ...cfg, extraHourlyUsdAfterFirst: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('extraHourlyUsdAfterFirst')}
                    />
                    <p className="text-xs text-slate-400 mt-1">Apply a surcharge for long prints; first hour is excluded.</p>
                    {fieldHasError('extraHourlyUsdAfterFirst') && <p className="text-xs text-rose-300 mt-1">{errors.extraHourlyUsdAfterFirst}</p>}
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Minimum price ({currency})</label>
                    <input
                      className={`input ${fieldHasError('minimumPriceUsd') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.minimumPriceUsd ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('minimumPriceUsd')
                        setCfg({ ...cfg, minimumPriceUsd: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('minimumPriceUsd')}
                    />
                    {fieldHasError('minimumPriceUsd') && <p className="text-xs text-rose-300 mt-1">{errors.minimumPriceUsd}</p>}
                  </div>
                </div>

                <p className="text-xs text-slate-400">Material costs are derived from the per-kg prices; no multipliers needed.</p>

                <div>
                  <label className="block text-sm mb-1">Infill (%)</label>
                  <select
                    className={`input ${fieldHasError('fillFactor') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                    value={cfg.fillFactor != null ? String(Math.round(Number(cfg.fillFactor) * 100)) : ''}
                    disabled={saving}
                    onChange={(e) => {
                      markTouched('fillFactor')
                      setCfg({ ...cfg, fillFactor: e.target.value === '' ? null : Number(e.target.value) / 100 })
                    }}
                    onBlur={() => markTouched('fillFactor')}
                  >
                    <option value="">Select...</option>
                    <option value="15">15%</option>
                    <option value="30">30%</option>
                    <option value="45">45%</option>
                    <option value="60">60%</option>
                    <option value="75">75%</option>
                    <option value="90">90%</option>
                  </select>
                  {fieldHasError('fillFactor') && <p className="text-xs text-rose-300 mt-1">{errors.fillFactor}</p>}
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
                  <input
                    id="anu"
                    type="checkbox"
                    checked={!!cfg.allowAnonymousUploads}
                    disabled={saving}
                    onChange={(e) => {
                      markTouched('allowAnonymousUploads')
                      setCfg({ ...cfg, allowAnonymousUploads: e.target.checked })
                    }}
                  />
                  <label htmlFor="anu" className="text-sm">Allow anonymous uploads</label>
                </div>
                <div>
                  <label className="block text-sm mb-1">Direct upload URL (optional)</label>
                  <input
                    className={`input ${fieldHasError('directUploadUrl') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                    type="url"
                    placeholder="https://upload.example.com"
                    value={cfg.directUploadUrl ?? ''}
                    disabled={saving}
                    onChange={(e) => {
                      markTouched('directUploadUrl')
                      setCfg({ ...cfg, directUploadUrl: e.target.value === '' ? null : e.target.value })
                    }}
                    onBlur={() => markTouched('directUploadUrl')}
                  />
                  <p className="text-xs text-slate-400 mt-1">When provided, the Upload page will POST to this host&apos;s `/api/upload`, bypassing Cloudflare/Tunnel limits.</p>
                  {fieldHasError('directUploadUrl') && <p className="text-xs text-rose-300 mt-1">{errors.directUploadUrl}</p>}
                </div>
              </div>
            ),
          },
          {
            key: 'printer',
            label: 'Printer tuning',
            content: (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Active printer profile</label>
                  <select
                    className="input"
                    value={cfg.printerProfileKey || selectedProfile.key}
                    onChange={(e) => handleActiveProfileChange(e.target.value)}
                    disabled={saving}
                  >
                    {PRINTER_PROFILES.map((profile) => (
                      <option key={profile.key} value={profile.key}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Used for all automatic price/time estimates.</p>
                </div>
                <div>
                  <label className="block text-sm mb-1">Profile to tune</label>
                  <select
                    className="input"
                    value={profileEditorKey}
                    onChange={(e) => setProfileEditorKey(e.target.value)}
                    disabled={saving}
                  >
                    {PRINTER_PROFILES.map((profile) => (
                      <option key={profile.key} value={profile.key}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Adjust nozzle and material density assumptions per profile.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Nozzle diameter (mm)</label>
                    <input
                      className="input"
                      type="number"
                      min="0.1"
                      max="1.5"
                      step="0.05"
                      value={tuningOverride.nozzleDiameterMm ?? ''}
                      onChange={(e) => updateNozzle(e.target.value)}
                      disabled={saving}
                      placeholder={`${baseNozzle.toFixed(2)}`}
                    />
                    <p className="text-xs text-slate-400 mt-1">Default: {baseNozzle.toFixed(2)} mm</p>
                  </div>
                  <div className="text-sm text-slate-300 space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Throughput</p>
                    <p>{tuningProfile.volumetricSpeedCm3PerHour.toFixed(2)} cm³/hr profile base</p>
                    <p>{derivedThroughput.toFixed(2)} cm³/hr with nozzle override</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-2">Material densities (g/cm³)</label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {MATERIAL_OPTIONS.map((material) => {
                      const defaultDensity = MATERIAL_DENSITY_DEFAULTS[material]
                      const overrideDensity = tuningOverride.materialDensities?.[material]
                      return (
                        <div key={material}>
                          <label className="block text-xs text-slate-400 mb-1">{material}</label>
                          <input
                            className="input"
                            type="number"
                            min="0.1"
                            max="5"
                            step="0.01"
                            value={overrideDensity ?? ''}
                            onChange={(e) => updateDensity(material, e.target.value)}
                            disabled={saving}
                            placeholder={defaultDensity.toString()}
                          />
                          <p className="text-xs text-slate-400 mt-1">Default: {defaultDensity}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md border border-white/10 text-sm hover:border-white/20 disabled:opacity-50"
                    onClick={resetProfileTuning}
                    disabled={saving || !cfg.printerProfileOverrides?.[tuningProfile.key]}
                  >
                    Reset {tuningProfile.label} overrides
                  </button>
                </div>
              </div>
            ),
          },
        ]}
        disabled={saving}
      />

      <button className="btn" disabled={disableSubmit}>{saving ? 'Saving...' : 'Save Settings'}</button>
    </form>
  )
}

function TabSwitcher({ tabs, disabled }: { tabs: { key: string, label: string, content: React.ReactNode }[]; disabled?: boolean }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find((t) => t.key === active) || tabs[0]
  return (
    <div className={`space-y-3 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
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
