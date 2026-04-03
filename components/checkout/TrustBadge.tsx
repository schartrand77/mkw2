type TrustBadgeProps = {
  title?: string
  note?: string
  providers?: string[]
  className?: string
}

export default function TrustBadge({ title, note, providers, className }: TrustBadgeProps) {
  const providerLine = providers && providers.length > 0
    ? `Processed by ${providers.join(' + ')}`
    : null

  return (
    <div className={`flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 ${className ?? ''}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-300">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M7.5 11V8.5a4.5 4.5 0 1 1 9 0V11" />
          <rect x="5" y="11" width="14" height="9" rx="2" />
        </svg>
      </span>
      <div className="space-y-0.5">
        <div className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">{title || 'Secure checkout'}</div>
        <div className="text-xs text-slate-200">{providerLine || note || 'Your payment details are protected.'}</div>
      </div>
    </div>
  )
}
