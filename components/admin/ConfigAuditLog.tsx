'use client'

import { useEffect, useState } from 'react'

 type AuditEntry = {
  id: string
  section: string
  changes: any
  createdAt: string
  admin?: { id: string; name: string | null; email: string | null } | null
 }

export default function ConfigAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/config-audit', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load audit log')
      setEntries(Array.isArray(data.logs) ? data.logs : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Config change audit</h2>
          <p className="text-xs text-slate-400">Track who updated global settings and when.</p>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-xs"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="text-sm text-slate-500">No changes recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
                <span className="uppercase tracking-[0.2em]">{entry.section}</span>
              </div>
              <div className="text-sm text-slate-200">
                {entry.admin?.name || entry.admin?.email || 'Admin'} updated {Array.isArray(entry.changes?.keys) ? entry.changes.keys.join(', ') : 'settings'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
