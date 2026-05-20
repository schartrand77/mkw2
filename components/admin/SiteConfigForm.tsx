"use client"
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { getPrinterProfiles } from '@/lib/printerProfiles'
import { MATERIAL_DENSITY_DEFAULTS, estimatePricingDetails } from '@/lib/pricing'
import { FINISH_OPTIONS } from '@/lib/cartPricing'
import { formatCurrency } from '@/lib/currency'
import { PaymentBadges } from '@/components/PaymentBadges'

const materialDensitySchema = z.record(z.number().positive().max(5))
const printerOverrideSchema = z.object({
  nozzleDiameterMm: z.number().min(0.05).max(1.5).optional(),
  materialDensities: materialDensitySchema.optional(),
}).partial()

const materialPriceSchema = z.object({
  plaPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  petgPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  absPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  asaPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  tpuPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  pa6PricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  pa12PricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  nylonPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  pcPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
  resinPricePerKgUsd: z.number().nonnegative({ message: 'Enter a price at or above 0.' }).optional(),
})

const configSchema = z.object({
  ...materialPriceSchema.shape,
  allowAnonymousUploads: z.boolean().optional(),
  allowModelDownloads: z.boolean().optional(),
  printSpeedCm3PerHour: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  energyUsdPerHour: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  machineUsdPerHour: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  laborUsdPerHour: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  minimumPriceUsd: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  targetMarginPercent: z.number().min(0, { message: 'Must be zero or a positive number.' }).max(90, { message: 'Margin must be below 90%.' }).optional(),
  minimumOrderSubtotalUsd: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  minimumOrderNotes: z.string().max(300).optional(),
  printTimeCorrectionFactor: z.number().min(0.5).max(2.5).optional(),
  extraHourlyUsdAfterFirst: z.number().nonnegative({ message: 'Must be zero or a positive number.' }).optional(),
  demandSurgeMultiplier: z.number().positive().max(5).optional(),
  rushMultiplier: z.number().positive().max(5).optional(),
  batchDiscountTiers: z.array(z.object({
    minQty: z.number().int().min(1),
    percent: z.number().min(0).max(100),
  })).optional(),
  fillFactor: z.number().positive({ message: 'Select an infill percentage.' }).max(2, { message: 'Fill factor is out of range.' }).optional(),
  directUploadUrl: z.union([z.string().url({ message: 'Enter a valid https:// URL.' }), z.null()], { invalid_type_error: 'Enter a valid URL.' }).optional(),
  showApplePayBadge: z.boolean().optional(),
  showGooglePayBadge: z.boolean().optional(),
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
type MaterialOption = keyof typeof MATERIAL_DENSITY_DEFAULTS

const MATERIAL_OPTIONS = Object.keys(MATERIAL_DENSITY_DEFAULTS) as MaterialOption[]
const PRINTER_PROFILES = getPrinterProfiles()
const DEFAULT_PROFILE_KEY = PRINTER_PROFILES[0]?.key || 'BAMBU_X1C'
const MATERIAL_PRICE_FIELDS = [
  { key: 'plaPricePerKgUsd', label: 'PLA' },
  { key: 'petgPricePerKgUsd', label: 'PETG' },
  { key: 'absPricePerKgUsd', label: 'ABS' },
  { key: 'asaPricePerKgUsd', label: 'ASA' },
  { key: 'tpuPricePerKgUsd', label: 'TPU' },
  { key: 'pa6PricePerKgUsd', label: 'PA6' },
  { key: 'pa12PricePerKgUsd', label: 'PA12' },
  { key: 'nylonPricePerKgUsd', label: 'NYLON' },
  { key: 'pcPricePerKgUsd', label: 'PC' },
  { key: 'resinPricePerKgUsd', label: 'RESIN' },
] as const
type MaterialPriceField = typeof MATERIAL_PRICE_FIELDS[number]['key']

type Config = {
  plaPricePerKgUsd?: number | null
  petgPricePerKgUsd?: number | null
  absPricePerKgUsd?: number | null
  asaPricePerKgUsd?: number | null
  tpuPricePerKgUsd?: number | null
  pa6PricePerKgUsd?: number | null
  pa12PricePerKgUsd?: number | null
  nylonPricePerKgUsd?: number | null
  pcPricePerKgUsd?: number | null
  resinPricePerKgUsd?: number | null
  allowAnonymousUploads?: boolean | null
  allowModelDownloads?: boolean | null
  printSpeedCm3PerHour?: number | null
  energyUsdPerHour?: number | null
  machineUsdPerHour?: number | null
  laborUsdPerHour?: number | null
  minimumPriceUsd?: number | null
  targetMarginPercent?: number | null
  minimumOrderSubtotalUsd?: number | null
  minimumOrderNotes?: string | null
  printTimeCorrectionFactor?: number | null
  extraHourlyUsdAfterFirst?: number | null
  demandSurgeMultiplier?: number | null
  rushMultiplier?: number | null
  batchDiscountTiers?: Array<{ minQty: number; percent: number }> | null
  fillFactor?: number | null
  directUploadUrl?: string | null
  showApplePayBadge?: boolean | null
  showGooglePayBadge?: boolean | null
  printerProfileKey?: string | null
  printerProfileOverrides?: PrinterProfileOverridesState | null
}

type PricingProfile = {
  id: string
  name: string
  description?: string | null
  data: Partial<Config>
  createdAt: string
  updatedAt: string
}

type SandboxState = {
  cm3: string
  material: MaterialOption
  infillPct: string
  supportRatio: string
  colorCount: string
  finish: string
  quantity: string
}

const PRICING_PROFILE_KEYS: (keyof Config)[] = [
  'plaPricePerKgUsd',
  'petgPricePerKgUsd',
  'absPricePerKgUsd',
  'asaPricePerKgUsd',
  'tpuPricePerKgUsd',
  'pa6PricePerKgUsd',
  'pa12PricePerKgUsd',
  'nylonPricePerKgUsd',
  'pcPricePerKgUsd',
  'resinPricePerKgUsd',
  'printSpeedCm3PerHour',
  'energyUsdPerHour',
  'machineUsdPerHour',
  'laborUsdPerHour',
  'minimumPriceUsd',
  'targetMarginPercent',
  'printTimeCorrectionFactor',
  'extraHourlyUsdAfterFirst',
  'demandSurgeMultiplier',
  'rushMultiplier',
  'batchDiscountTiers',
  'fillFactor',
  'printerProfileKey',
  'printerProfileOverrides',
]

function extractPricingProfileData(cfg: Config): Partial<Config> {
  const result: Partial<Config> = {}
  for (const key of PRICING_PROFILE_KEYS) {
    if (key in cfg) {
      ;(result as Record<string, unknown>)[key] = cfg[key]
    }
  }
  return result
}

function buildMaterialPricePayload(cfg: Config): Record<MaterialPriceField, number | undefined> {
  const result = {} as Record<MaterialPriceField, number | undefined>
  for (const field of MATERIAL_PRICE_FIELDS) {
    result[field.key] = cfg[field.key] ?? undefined
  }
  return result
}

function buildPayload(cfg: Config): SchemaShape {
  return {
    ...buildMaterialPricePayload(cfg),
    allowAnonymousUploads: typeof cfg.allowAnonymousUploads === 'boolean' ? cfg.allowAnonymousUploads : undefined,
    allowModelDownloads: typeof cfg.allowModelDownloads === 'boolean' ? cfg.allowModelDownloads : undefined,
    printSpeedCm3PerHour: cfg.printSpeedCm3PerHour ?? undefined,
    energyUsdPerHour: cfg.energyUsdPerHour ?? undefined,
    machineUsdPerHour: cfg.machineUsdPerHour ?? undefined,
    laborUsdPerHour: cfg.laborUsdPerHour ?? undefined,
    minimumPriceUsd: cfg.minimumPriceUsd ?? undefined,
    targetMarginPercent: cfg.targetMarginPercent ?? undefined,
    minimumOrderSubtotalUsd: cfg.minimumOrderSubtotalUsd ?? undefined,
    minimumOrderNotes: cfg.minimumOrderNotes ?? undefined,
    printTimeCorrectionFactor: cfg.printTimeCorrectionFactor ?? undefined,
    extraHourlyUsdAfterFirst: cfg.extraHourlyUsdAfterFirst ?? undefined,
    demandSurgeMultiplier: cfg.demandSurgeMultiplier ?? undefined,
    rushMultiplier: cfg.rushMultiplier ?? undefined,
    batchDiscountTiers: normalizeBatchDiscountTiers(cfg.batchDiscountTiers),
    fillFactor: cfg.fillFactor ?? undefined,
    directUploadUrl: cfg.directUploadUrl === null ? null : cfg.directUploadUrl || undefined,
    showApplePayBadge: typeof cfg.showApplePayBadge === 'boolean' ? cfg.showApplePayBadge : undefined,
    showGooglePayBadge: typeof cfg.showGooglePayBadge === 'boolean' ? cfg.showGooglePayBadge : undefined,
    printerProfileKey: cfg.printerProfileKey || undefined,
    printerProfileOverrides: sanitizeOverrides(cfg.printerProfileOverrides),
  }
}

function normalizeBatchDiscountTiers(raw?: Array<{ minQty?: number; percent?: number }> | null) {
  if (!raw || !Array.isArray(raw)) return undefined
  const cleaned = raw
    .map((tier) => {
      const minQty = Number(tier.minQty)
      const percent = Number(tier.percent)
      if (!Number.isFinite(minQty) || minQty <= 0) return null
      if (!Number.isFinite(percent) || percent <= 0) return null
      return { minQty: Math.floor(minQty), percent: Math.min(100, Math.max(0, percent)) }
    })
    .filter((tier): tier is { minQty: number; percent: number } => Boolean(tier))
  return cleaned.length ? cleaned : undefined
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
  const [correctionInfo, setCorrectionInfo] = useState<{
    suggestedFactor: number
    totalActualHours: number
    totalEstimatedHours: number
    samples: number
    rangeDays: number
  } | null>(null)
  const [correctionBusy, setCorrectionBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<TouchMap>({})
  const [profileEditorKey, setProfileEditorKey] = useState(() => cfg.printerProfileKey || DEFAULT_PROFILE_KEY)
  const [sandbox, setSandbox] = useState<SandboxState>({
    cm3: '20',
    material: MATERIAL_OPTIONS[0] || 'PLA',
    infillPct: '',
    supportRatio: '',
    colorCount: '',
    finish: 'standard',
    quantity: '1',
  })
  const [profiles, setProfiles] = useState<PricingProfile[]>([])
  const [profileName, setProfileName] = useState('')
  const [profileDescription, setProfileDescription] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const payload = useMemo(() => buildPayload(cfg), [cfg])

  useEffect(() => {
    if (!PRINTER_PROFILES.some((p) => p.key === profileEditorKey)) {
      setProfileEditorKey(cfg.printerProfileKey || DEFAULT_PROFILE_KEY)
    }
  }, [cfg.printerProfileKey, profileEditorKey])

  useEffect(() => {
    setErrors(mapErrors(configSchema.safeParse(payload)))
  }, [payload])

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/admin/pricing-profiles', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to load pricing profiles.')
      setProfiles(Array.isArray(data.profiles) ? data.profiles : [])
    } catch {
      setProfiles([])
    }
  }

  useEffect(() => {
    loadProfiles().catch(() => {})
  }, [])

  const fetchCorrectionSuggestion = async () => {
    if (correctionBusy) return
    setCorrectionBusy(true)
    try {
      const res = await fetch('/api/admin/print-time-correction?days=90', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to compute correction')
      setCorrectionInfo(data)
    } catch (error: any) {
      setErr(error?.message || 'Failed to compute correction')
    } finally {
      setCorrectionBusy(false)
    }
  }

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

  const preview = useMemo(() => {
    const cm3 = Number(sandbox.cm3)
    if (!Number.isFinite(cm3) || cm3 <= 0) return null
    const infillPct = sandbox.infillPct === '' ? null : Number(sandbox.infillPct)
    const supportRatio = sandbox.supportRatio === '' ? null : Number(sandbox.supportRatio)
    const colorCount = sandbox.colorCount === '' ? null : Number(sandbox.colorCount)
    const finish = sandbox.finish || null
    const breakdown = estimatePricingDetails({
      cm3,
      material: sandbox.material,
      infillPct: Number.isFinite(Number(infillPct)) ? Number(infillPct) : null,
      supportRatio: Number.isFinite(Number(supportRatio)) ? Number(supportRatio) : null,
      colorCount: Number.isFinite(Number(colorCount)) ? Number(colorCount) : null,
      finish,
      cfg,
      applyMinimum: true,
    })
    const qty = Math.max(1, Math.floor(Number(sandbox.quantity) || 1))
    return { breakdown, qty, total: Number((breakdown.price * qty).toFixed(2)) }
  }, [cfg, sandbox])

  const applyProfile = (profile: PricingProfile) => {
    setCfg((prev) => ({
      ...prev,
      ...profile.data,
    }))
    if (profile.data.printerProfileKey) {
      setProfileEditorKey(profile.data.printerProfileKey)
    }
  }

  const saveProfile = async () => {
    const trimmed = profileName.trim()
    if (!trimmed) {
      setErr('Enter a profile name before saving.')
      return
    }
    setProfileBusy(true)
    try {
      const res = await fetch('/api/admin/pricing-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          description: profileDescription.trim() || undefined,
          data: extractPricingProfileData(cfg),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to save profile.')
      setProfileName('')
      setProfileDescription('')
      await loadProfiles()
    } catch (error: any) {
      setErr(error?.message || 'Unable to save profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  const deleteProfile = async (id: string) => {
    setProfileBusy(true)
    try {
      const res = await fetch(`/api/admin/pricing-profiles/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to delete profile.')
      await loadProfiles()
    } catch (error: any) {
      setErr(error?.message || 'Unable to delete profile.')
    } finally {
      setProfileBusy(false)
    }
  }

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

  const updateMaterialPrice = (field: MaterialPriceField, value: string) => {
    markTouched(field)
    setCfg((prev) => ({
      ...prev,
      [field]: value === '' ? null : Number(value),
    }))
  }

  const updateBatchTier = (index: number, field: 'minQty' | 'percent', value: string) => {
    setCfg((prev) => {
      const tiers = Array.isArray(prev.batchDiscountTiers) ? [...prev.batchDiscountTiers] : []
      const existing = tiers[index] || { minQty: 1, percent: 0 }
      const numeric = value === '' ? null : Number(value)
      const next = {
        ...existing,
        [field]: numeric == null || Number.isNaN(numeric) ? existing[field] : numeric,
      }
      tiers[index] = next
      return { ...prev, batchDiscountTiers: tiers }
    })
    markTouched('batchDiscountTiers')
  }

  const addBatchTier = () => {
    setCfg((prev) => {
      const tiers = Array.isArray(prev.batchDiscountTiers) ? [...prev.batchDiscountTiers] : []
      tiers.push({ minQty: 5, percent: 5 })
      return { ...prev, batchDiscountTiers: tiers }
    })
    markTouched('batchDiscountTiers')
  }

  const removeBatchTier = (index: number) => {
    setCfg((prev) => {
      const tiers = Array.isArray(prev.batchDiscountTiers) ? [...prev.batchDiscountTiers] : []
      tiers.splice(index, 1)
      return { ...prev, batchDiscountTiers: tiers.length ? tiers : undefined }
    })
    markTouched('batchDiscountTiers')
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
                  {MATERIAL_PRICE_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm mb-1">{field.label} price per kg ({currency})</label>
                      <input
                        className={`input ${fieldHasError(field.key) ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                        type="number"
                        step="0.01"
                        value={cfg[field.key] ?? ''}
                        disabled={saving}
                        onChange={(e) => updateMaterialPrice(field.key, e.target.value)}
                        onBlur={() => markTouched(field.key)}
                      />
                      {fieldHasError(field.key) && <p className="text-xs text-rose-300 mt-1">{errors[field.key]}</p>}
                    </div>
                  ))}
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
                    <label className="block text-sm mb-1">Print time correction factor</label>
                    <input
                      className={`input ${fieldHasError('printTimeCorrectionFactor') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="2.5"
                      value={cfg.printTimeCorrectionFactor ?? ''}
                      disabled={saving || correctionBusy}
                      onChange={(e) => {
                        markTouched('printTimeCorrectionFactor')
                        setCfg({ ...cfg, printTimeCorrectionFactor: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('printTimeCorrectionFactor')}
                    />
                    <p className="text-xs text-slate-400 mt-1">Scales estimated print hours using slicer history (0.5x - 2.5x).</p>
                    {correctionInfo && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Suggest {correctionInfo.suggestedFactor}x based on {correctionInfo.samples} samples ({correctionInfo.totalActualHours}h actual / {correctionInfo.totalEstimatedHours}h estimated).
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs"
                        onClick={() => fetchCorrectionSuggestion()}
                        disabled={saving || correctionBusy}
                      >
                        {correctionBusy ? 'Calculating…' : 'Recalculate from history'}
                      </button>
                      {correctionInfo && (
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-brand-500/40 hover:border-brand-500 text-xs text-brand-200"
                          onClick={() => {
                            setCfg({ ...cfg, printTimeCorrectionFactor: correctionInfo.suggestedFactor })
                            markTouched('printTimeCorrectionFactor')
                          }}
                          disabled={saving}
                        >
                          Apply suggestion
                        </button>
                      )}
                    </div>
                    {fieldHasError('printTimeCorrectionFactor') && <p className="text-xs text-rose-300 mt-1">{errors.printTimeCorrectionFactor}</p>}
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
                    <label className="block text-sm mb-1">Machine cost per hour ({currency})</label>
                    <input
                      className={`input ${fieldHasError('machineUsdPerHour') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.machineUsdPerHour ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('machineUsdPerHour')
                        setCfg({ ...cfg, machineUsdPerHour: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('machineUsdPerHour')}
                    />
                    {fieldHasError('machineUsdPerHour') && <p className="text-xs text-rose-300 mt-1">{errors.machineUsdPerHour}</p>}
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Labor cost per hour ({currency})</label>
                    <input
                      className={`input ${fieldHasError('laborUsdPerHour') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.laborUsdPerHour ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('laborUsdPerHour')
                        setCfg({ ...cfg, laborUsdPerHour: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('laborUsdPerHour')}
                    />
                    {fieldHasError('laborUsdPerHour') && <p className="text-xs text-rose-300 mt-1">{errors.laborUsdPerHour}</p>}
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
                  <div>
                    <label className="block text-sm mb-1">Target margin (%)</label>
                    <input
                      className={`input ${fieldHasError('targetMarginPercent') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.5"
                      min={0}
                      max={90}
                      value={cfg.targetMarginPercent ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('targetMarginPercent')
                        setCfg({ ...cfg, targetMarginPercent: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('targetMarginPercent')}
                    />
                    <p className="text-xs text-slate-400 mt-1">Auto prices use cost divided by one minus this margin.</p>
                    {fieldHasError('targetMarginPercent') && <p className="text-xs text-rose-300 mt-1">{errors.targetMarginPercent}</p>}
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Minimum order subtotal ({currency})</label>
                    <input
                      className={`input ${fieldHasError('minimumOrderSubtotalUsd') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      type="number"
                      step="0.01"
                      value={cfg.minimumOrderSubtotalUsd ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('minimumOrderSubtotalUsd')
                        setCfg({ ...cfg, minimumOrderSubtotalUsd: e.target.value === '' ? null : Number(e.target.value) })
                      }}
                      onBlur={() => markTouched('minimumOrderSubtotalUsd')}
                    />
                    <p className="text-xs text-slate-400 mt-1">Applied to cart subtotal before shipping.</p>
                    {fieldHasError('minimumOrderSubtotalUsd') && <p className="text-xs text-rose-300 mt-1">{errors.minimumOrderSubtotalUsd}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm mb-1">Minimum order notes</label>
                    <textarea
                      className={`input min-h-[80px] ${fieldHasError('minimumOrderNotes') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                      value={cfg.minimumOrderNotes ?? ''}
                      disabled={saving}
                      onChange={(e) => {
                        markTouched('minimumOrderNotes')
                        setCfg({ ...cfg, minimumOrderNotes: e.target.value })
                      }}
                      onBlur={() => markTouched('minimumOrderNotes')}
                      placeholder="Optional message shown when orders are under the minimum."
                    />
                    {fieldHasError('minimumOrderNotes') && <p className="text-xs text-rose-300 mt-1">{errors.minimumOrderNotes}</p>}
                  </div>
                </div>

                <p className="text-xs text-slate-400">Material costs are derived from the per-kg prices; no multipliers needed.</p>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Pricing adjustments</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Demand surge multiplier</label>
                      <input
                        className={`input ${fieldHasError('demandSurgeMultiplier') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                        type="number"
                        step="0.01"
                        min={1}
                        value={cfg.demandSurgeMultiplier ?? ''}
                        disabled={saving}
                        onChange={(e) => {
                          markTouched('demandSurgeMultiplier')
                          setCfg({ ...cfg, demandSurgeMultiplier: e.target.value === '' ? null : Number(e.target.value) })
                        }}
                        onBlur={() => markTouched('demandSurgeMultiplier')}
                      />
                      {fieldHasError('demandSurgeMultiplier') && <p className="text-xs text-rose-300 mt-1">{errors.demandSurgeMultiplier}</p>}
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Rush multiplier</label>
                      <input
                        className={`input ${fieldHasError('rushMultiplier') ? 'border-rose-400/70 focus:border-rose-400' : ''}`}
                        type="number"
                        step="0.01"
                        min={1}
                        value={cfg.rushMultiplier ?? ''}
                        disabled={saving}
                        onChange={(e) => {
                          markTouched('rushMultiplier')
                          setCfg({ ...cfg, rushMultiplier: e.target.value === '' ? null : Number(e.target.value) })
                        }}
                        onBlur={() => markTouched('rushMultiplier')}
                      />
                      {fieldHasError('rushMultiplier') && <p className="text-xs text-rose-300 mt-1">{errors.rushMultiplier}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm">Batch discount tiers</label>
                      <button type="button" className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={addBatchTier}>
                        Add tier
                      </button>
                    </div>
                    {(cfg.batchDiscountTiers || []).length === 0 && (
                      <p className="text-xs text-slate-500">No batch discounts configured.</p>
                    )}
                    {(cfg.batchDiscountTiers || []).map((tier, index) => (
                      <div key={`tier-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <label className="text-xs text-slate-400">
                          Min qty
                          <input
                            className="input mt-1"
                            type="number"
                            min={1}
                            value={tier.minQty}
                            disabled={saving}
                            onChange={(e) => updateBatchTier(index, 'minQty', e.target.value)}
                          />
                        </label>
                        <label className="text-xs text-slate-400">
                          Discount %
                          <input
                            className="input mt-1"
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={tier.percent}
                            disabled={saving}
                            onChange={(e) => updateBatchTier(index, 'percent', e.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-xs text-rose-300 hover:text-rose-200"
                          onClick={() => removeBatchTier(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {fieldHasError('batchDiscountTiers') && <p className="text-xs text-rose-300">{errors.batchDiscountTiers}</p>}
                  </div>
                </div>

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
            key: 'sandbox',
            label: 'Pricing sandbox',
            content: (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Model volume (cm³)</label>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      value={sandbox.cm3}
                      onChange={(e) => setSandbox((prev) => ({ ...prev, cm3: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Quantity</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      step="1"
                      value={sandbox.quantity}
                      onChange={(e) => setSandbox((prev) => ({ ...prev, quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Material</label>
                    <select
                      className="input"
                      value={sandbox.material}
                      onChange={(e) => setSandbox((prev) => ({ ...prev, material: e.target.value as MaterialOption }))}
                    >
                      {MATERIAL_OPTIONS.map((material) => (
                        <option key={material} value={material}>{material}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Finish</label>
                    <select
                      className="input"
                      value={sandbox.finish}
                      onChange={(e) => setSandbox((prev) => ({ ...prev, finish: e.target.value }))}
                    >
                      {FINISH_OPTIONS.map((finish) => (
                        <option key={finish} value={finish}>{finish}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Infill (%)</label>
                    <input
                      className="input"
                      type="number"
                      step="1"
                      value={sandbox.infillPct}
                      onChange={(e) => setSandbox((prev) => ({ ...prev, infillPct: e.target.value }))}
                      placeholder="Use config default"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Support ratio (0-1)</label>
                    <input
                      className="input"
                      type="number"
                      step="0.05"
                      value={sandbox.supportRatio}
                      onChange={(e) => setSandbox((prev) => ({ ...prev, supportRatio: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Color count</label>
                    <input
                      className="input"
                      type="number"
                      step="1"
                      value={sandbox.colorCount}
                      onChange={(e) => setSandbox((prev) => ({ ...prev, colorCount: e.target.value }))}
                      placeholder="Auto"
                    />
                  </div>
                </div>

                {preview ? (
                  <div className="grid lg:grid-cols-[0.7fr_1.3fr] gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Result</div>
                      <div className="text-2xl font-semibold">
                        {formatCurrency(preview.breakdown.price, preview.breakdown.currency as any)}
                        <span className="text-sm text-slate-400"> per unit</span>
                      </div>
                      <div className="text-sm text-slate-400">
                        Total: {formatCurrency(preview.total, preview.breakdown.currency as any)} for {preview.qty} unit(s)
                      </div>
                      <div className="text-xs text-slate-500">
                        Profile: {preview.breakdown.printerProfile.label} · Nozzle {preview.breakdown.nozzleDiameterMm} mm
                      </div>
                      {preview.breakdown.minimumApplied ? (
                        <div className="text-xs text-amber-300">Minimum price applied</div>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2 text-sm">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <div>Effective volume: {preview.breakdown.effectiveCm3.toFixed(2)} cm³</div>
                        <div>Time: {preview.breakdown.hours.toFixed(2)} hrs</div>
                        <div>Material: {preview.breakdown.grams.toFixed(1)} g</div>
                        <div>Density: {preview.breakdown.densityGPerCm3.toFixed(2)} g/cm³</div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <div>Material cost: {formatCurrency(preview.breakdown.materialCost, preview.breakdown.currency as any)}</div>
                        <div>Machine cost: {formatCurrency(preview.breakdown.machineCost, preview.breakdown.currency as any)}</div>
                        <div>Energy cost: {formatCurrency(preview.breakdown.energyCost, preview.breakdown.currency as any)}</div>
                        <div>Labor cost: {formatCurrency(preview.breakdown.laborCost, preview.breakdown.currency as any)}</div>
                        <div>Extra hourly: {formatCurrency(preview.breakdown.extraHourlyCost, preview.breakdown.currency as any)}</div>
                        <div>Finish multiplier: {preview.breakdown.finishMultiplier.toFixed(2)}x</div>
                        {preview.breakdown.targetMarginPercent ? (
                          <div>Target margin: {preview.breakdown.targetMarginPercent}% ({preview.breakdown.marginMultiplier?.toFixed(2)}x)</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Enter a valid volume to preview pricing.</p>
                )}

                <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">Saved pricing profiles</h3>
                      <p className="text-xs text-slate-500">Store reusable pricing configs and apply them on demand.</p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-white/10 text-xs hover:border-white/30"
                      onClick={() => loadProfiles()}
                      disabled={profileBusy}
                    >
                      {profileBusy ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-[1.2fr_0.8fr] gap-3">
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-400">Profile name</label>
                      <input
                        className="input"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Standard pricing"
                      />
                      <label className="block text-xs text-slate-400">Description (optional)</label>
                      <input
                        className="input"
                        value={profileDescription}
                        onChange={(e) => setProfileDescription(e.target.value)}
                        placeholder="PLA + PETG baseline"
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={saveProfile}
                        disabled={profileBusy}
                      >
                        {profileBusy ? 'Saving...' : 'Save current config'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {profiles.length === 0 ? (
                        <p className="text-xs text-slate-500">No profiles saved yet.</p>
                      ) : (
                        profiles.map((profile) => (
                          <div key={profile.id} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                            <div>
                              <div className="text-sm font-semibold">{profile.name}</div>
                              {profile.description ? (
                                <div className="text-xs text-slate-500">{profile.description}</div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded-md border border-white/10 hover:border-white/30"
                                onClick={() => applyProfile(profile)}
                                disabled={profileBusy}
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded-md border border-white/10 hover:border-white/30 text-rose-300"
                                onClick={() => deleteProfile(profile.id)}
                                disabled={profileBusy}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'uploads',
            label: 'Uploads & Downloads',
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
                <div className="flex items-center gap-2">
                  <input
                    id="amd"
                    type="checkbox"
                    checked={cfg.allowModelDownloads !== false}
                    disabled={saving}
                    onChange={(e) => {
                      markTouched('allowModelDownloads')
                      setCfg({ ...cfg, allowModelDownloads: e.target.checked })
                    }}
                  />
                  <label htmlFor="amd" className="text-sm">Allow model downloads</label>
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
            key: 'footer',
            label: 'Footer',
            content: (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Show payment badges next to the Proudly made in Canada footer text.
                </p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!cfg.showApplePayBadge}
                      disabled={saving}
                      onChange={(e) => setCfg({ ...cfg, showApplePayBadge: e.target.checked })}
                    />
                    <span>Show Apple Pay badge</span>
                    <PaymentBadges showApplePay />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!cfg.showGooglePayBadge}
                      disabled={saving}
                      onChange={(e) => setCfg({ ...cfg, showGooglePayBadge: e.target.checked })}
                    />
                    <span>Show Google Pay badge</span>
                    <PaymentBadges showGooglePay />
                  </label>
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
