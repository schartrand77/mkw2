"use client"

import { useEffect, useState } from 'react'

type CustomerPreset = {
  id: string
  name: string
  data: unknown
  createdAt: string
  updatedAt: string
  ownedByMe?: boolean
  ownerName?: string | null
  organizationName?: string | null
  scope?: 'personal' | 'organization' | null
}

function getPresetKindLabel(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Print config'
  const kind = (data as Record<string, unknown>).kind
  if (kind === 'discover_filters') return 'Discover'
  return 'Print config'
}

function getPresetScopeLabel(preset: CustomerPreset) {
  if (preset.scope === 'organization') {
    const owner = preset.ownerName ? ` by ${preset.ownerName}` : ''
    return `${preset.organizationName || 'Organization'} shared${owner}`
  }
  return 'Personal'
}

export default function CustomerPresetsPanel() {
  const [presets, setPresets] = useState<CustomerPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPresets = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/presets', { cache: 'no-store' })
      if (!res.ok) throw new Error('Unable to load presets.')
      const data = await res.json().catch(() => ({}))
      setPresets(Array.isArray(data.presets) ? data.presets : [])
    } catch (err: any) {
      setError(err?.message || 'Unable to load presets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPresets().catch(() => {})
  }, [])

  const removePreset = async (id: string) => {
    try {
      const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed.')
      setPresets((prev) => prev.filter((p) => p.id !== id))
    } catch (err: any) {
      setError(err?.message || 'Delete failed.')
    }
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved presets</h2>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20"
          onClick={() => loadPresets()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Loading presets...</p>
      ) : presets.length === 0 ? (
        <p className="text-sm text-slate-400">No presets saved yet. Save one from your cart.</p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div key={preset.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{preset.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{getPresetKindLabel(preset.data)}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-600 mt-1">{getPresetScopeLabel(preset)}</div>
                </div>
                {preset.ownedByMe ? (
                  <button
                    type="button"
                    className="text-xs text-rose-300 hover:text-rose-200"
                    onClick={() => removePreset(preset.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="text-xs text-slate-400">
                Updated {new Date(preset.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="text-xs text-amber-300">{error}</div>}
    </div>
  )
}
