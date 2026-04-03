"use client"

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import StatusChip from '@/components/StatusChip'
import type { CheckoutOrganization } from '@/types/checkout'

type CustomerPreset = {
  id: string
  name: string
  data: unknown
  updatedAt: string
  ownedByMe?: boolean
  ownerName?: string | null
  organizationId?: string | null
  organizationName?: string | null
  scope?: 'personal' | 'organization' | null
}

type Props = {
  canSave: boolean
}

function isDiscoverPreset(value: unknown): value is {
  kind: 'discover_filters'
  params: Record<string, string>
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.kind === 'discover_filters' && !!record.params && typeof record.params === 'object' && !Array.isArray(record.params)
}

export default function DiscoverPresetBar({ canSave }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [presets, setPresets] = useState<CustomerPreset[]>([])
  const [organizations, setOrganizations] = useState<CheckoutOrganization[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveScope, setSaveScope] = useState<'personal' | 'organization'>('personal')
  const [organizationId, setOrganizationId] = useState('')

  const currentParams = useMemo(() => {
    const params: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      if (!value) continue
      if (key === 'page') continue
      params[key] = value
    }
    return params
  }, [searchParams])

  const discoverPresets = useMemo(
    () => presets.filter((preset) => isDiscoverPreset(preset.data)),
    [presets],
  )

  useEffect(() => {
    if (!canSave) return
    let active = true
    fetch('/api/customer/organizations', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.organizations)) return
        setOrganizations(data.organizations)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canSave])

  useEffect(() => {
    if (saveScope !== 'organization') return
    if (organizationId) return
    if (organizations.length === 0) {
      setSaveScope('personal')
      return
    }
    setOrganizationId(organizations[0]?.id || '')
  }, [organizationId, organizations, saveScope])

  const loadPresets = async () => {
    if (!canSave) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/presets', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to load presets.')
      setPresets(Array.isArray(data.presets) ? data.presets : [])
      setLoaded(true)
    } catch (err: any) {
      setMessage(err?.message || 'Unable to load presets.')
    } finally {
      setBusy(false)
    }
  }

  const applyPreset = (preset: CustomerPreset) => {
    if (!isDiscoverPreset(preset.data)) return
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(preset.data.params)) {
      if (value) next.set(key, value)
    }
    next.set('page', '1')
    router.push(`${pathname}?${next.toString()}`)
  }

  const savePreset = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setMessage('Enter a preset name.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          data: {
            kind: 'discover_filters',
            params: currentParams,
          },
          visibility: saveScope,
          organizationId: saveScope === 'organization' ? organizationId || undefined : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to save preset.')
      const saved = data.preset as CustomerPreset
      setPresets((prev) => [saved, ...prev.filter((entry) => entry.id !== saved.id)])
      setName('')
      setLoaded(true)
      setMessage(saveScope === 'organization' ? 'Organization preset saved.' : 'Preset saved.')
    } catch (err: any) {
      setMessage(err?.message || 'Unable to save preset.')
    } finally {
      setBusy(false)
    }
  }

  const shareCurrent = async () => {
    const query = new URLSearchParams(currentParams)
    const href = `${window.location.origin}${pathname}${query.toString() ? `?${query.toString()}` : ''}`
    try {
      await navigator.clipboard.writeText(href)
      setMessage('Share link copied.')
    } catch {
      setMessage(href)
    }
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Discover presets</p>
          <p className="text-sm text-slate-400">Save, reapply, or share your current filter stack.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {busy && <StatusChip label="Working" tone="info" pulse />}
          <button
            type="button"
            onClick={shareCurrent}
            className="rounded-full px-3 py-1.5 text-xs border border-white/10 hover:border-white/20"
          >
            Copy share link
          </button>
        </div>
      </div>
      {canSave ? (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              className="input max-w-xs text-sm"
              placeholder="Preset name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="input max-w-[220px] text-sm"
              value={saveScope === 'organization' ? `org:${organizationId}` : 'personal'}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'personal') {
                  setSaveScope('personal')
                  return
                }
                setSaveScope('organization')
                setOrganizationId(value.replace(/^org:/, ''))
              }}
            >
              <option value="personal">Personal preset</option>
              {organizations.map((org) => (
                <option key={org.id} value={`org:${org.id}`}>Share with {org.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={savePreset}
              disabled={busy}
              className="rounded-full px-3 py-1.5 text-xs border border-white/10 hover:border-white/20 disabled:opacity-60"
            >
              Save current filters
            </button>
            {!loaded && (
              <button
                type="button"
                onClick={loadPresets}
                disabled={busy}
                className="rounded-full px-3 py-1.5 text-xs border border-white/10 hover:border-white/20 disabled:opacity-60"
              >
                Load presets
              </button>
            )}
          </div>
          {loaded && discoverPresets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {discoverPresets.map((preset) => (
                <div key={preset.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-200">
                  <button
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="hover:text-white"
                    title={`Updated ${new Date(preset.updatedAt).toLocaleDateString()}`}
                  >
                    {preset.name}
                  </button>
                  <span className="mx-2 text-slate-500">|</span>
                  <span className="text-slate-400">
                    {preset.scope === 'organization'
                      ? `${preset.organizationName || 'Org'} shared${preset.ownerName ? ` by ${preset.ownerName}` : ''}`
                      : 'Personal'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400">Sign in to save reusable discover presets.</p>
      )}
      {message && (
        <StatusChip
          label={message}
          tone={/saved|copied/i.test(message) ? 'success' : /unable|enter/i.test(message) ? 'error' : 'neutral'}
        />
      )}
    </div>
  )
}
