type Suggestion = {
  id: string
  title: string
  action: string
  reason: string
  confidence: number
  priority: 'high' | 'medium' | 'low'
}

type Props = {
  summary: string
  confidence: number
  suggestions: Suggestion[]
}

export default function PreflightAssistantCard({ summary, confidence, suggestions }: Props) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Preflight assistant</div>
          <p className="mt-1 text-sm text-slate-300">{summary}</p>
        </div>
        <div className="rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-brand-100">
          {Math.round(confidence * 100)}% confidence
        </div>
      </div>
      <div className="space-y-3">
        {suggestions.length === 0 ? (
          <p className="text-sm text-emerald-300">No remediation steps suggested for the current setup.</p>
        ) : suggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-white">{suggestion.title}</p>
              <PriorityPill priority={suggestion.priority} />
            </div>
            <p className="text-sm text-slate-200">{suggestion.action}</p>
            <p className="text-xs text-slate-500">{suggestion.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PriorityPill({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const classes = priority === 'high'
    ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
    : priority === 'medium'
      ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
      : 'border-sky-400/30 bg-sky-500/10 text-sky-200'
  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${classes}`}>
      {priority}
    </span>
  )
}
