"use client"
import { useCallback, useEffect, useState } from 'react'
import { MODEL_ACCEPT_ATTRIBUTE, MODEL_FILE_LABEL } from '@/lib/model-files'

type RevisionEntry = {
  id: string
  version: number
  label?: string | null
  note?: string | null
  createdAt?: string | Date | null
}

export default function ModelRevisionsManager({ modelId }: { modelId: string }) {
  const [revisions, setRevisions] = useState<RevisionEntry[]>([])
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/models/${modelId}/revisions`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setRevisions(Array.isArray(data.revisions) ? data.revisions : [])
    } catch {
      // ignore
    }
  }, [modelId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0) {
      setError('Select at least one model file.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      if (note.trim()) fd.append('note', note.trim())
      Array.from(files).forEach((file) => fd.append('files', file))
      const res = await fetch(`/api/models/${modelId}/revisions`, { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to upload revision')
      }
      setNote('')
      setFiles(null)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to upload revision')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass p-6 rounded-xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Model revisions</h2>
        <p className="text-sm text-slate-400">Upload new files to create a versioned revision with change notes.</p>
      </div>
      {error && <div className="text-sm text-amber-300">{error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Change notes</label>
          <textarea
            className="input h-24"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what changed in this revision."
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Model files ({MODEL_FILE_LABEL})</label>
          <input type="file" multiple accept={MODEL_ACCEPT_ATTRIBUTE} onChange={(e) => setFiles(e.target.files)} />
        </div>
        <button className="btn" disabled={loading}>{loading ? 'Uploading...' : 'Upload revision'}</button>
      </form>
      {revisions.length > 0 ? (
        <div className="space-y-2">
          {revisions.map((rev) => (
            <div key={rev.id} className="rounded-lg border border-white/10 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">v{rev.version}{rev.label ? ` · ${rev.label}` : ''}</div>
                <div className="text-xs text-slate-400">
                  {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ''}
                </div>
              </div>
              {rev.note && <div className="text-xs text-slate-400 mt-1">{rev.note}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500">No revisions yet.</div>
      )}
    </div>
  )
}
