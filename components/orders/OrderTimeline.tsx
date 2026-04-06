type TimelineEntry = {
  id: string
  title: string
  createdAt: Date
  actor?: string
  detail?: string
  link?: { href: string; label: string }
}

type Props = {
  entries: TimelineEntry[]
  formatDate: (value: Date) => string
  emptyLabel?: string
}

export default function OrderTimeline({ entries, formatDate, emptyLabel = 'No updates yet.' }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative rounded-xl border border-white/10 bg-black/20 p-4 pl-5">
          <span
            aria-hidden="true"
            className={`absolute left-0 top-0 h-full w-px ${index === entries.length - 1 ? 'bg-transparent' : 'bg-white/10'}`}
          />
          <span
            aria-hidden="true"
            className="absolute left-[-0.33rem] top-5 h-3 w-3 rounded-full border border-brand-300/50 bg-brand-400 shadow-[0_0_0_4px_rgba(8,11,18,0.95)]"
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{entry.title}</p>
              {entry.actor ? <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{entry.actor}</p> : null}
            </div>
            <p className="text-xs text-slate-400">{formatDate(entry.createdAt)}</p>
          </div>
          {entry.detail ? <p className="mt-2 text-sm text-slate-300">{entry.detail}</p> : null}
          {entry.link ? (
            <a
              href={entry.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-xs text-brand-400 hover:text-brand-300 underline underline-offset-4"
            >
              {entry.link.label}
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
