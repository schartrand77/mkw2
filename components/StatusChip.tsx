"use client"

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'

type Props = {
  label: string
  tone?: StatusTone
  pulse?: boolean
  className?: string
}

const TONE_STYLES: Record<StatusTone, { shell: string; dot: string }> = {
  neutral: { shell: 'border-white/10 bg-black/20 text-slate-300', dot: 'bg-slate-400' },
  info: { shell: 'border-sky-400/20 bg-sky-500/10 text-sky-100', dot: 'bg-sky-300' },
  success: { shell: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100', dot: 'bg-emerald-300' },
  warning: { shell: 'border-amber-400/20 bg-amber-500/10 text-amber-100', dot: 'bg-amber-300' },
  error: { shell: 'border-rose-400/20 bg-rose-500/10 text-rose-100', dot: 'bg-rose-300' },
}

export default function StatusChip({ label, tone = 'neutral', pulse = false, className = '' }: Props) {
  const styles = TONE_STYLES[tone]
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${styles.shell} ${className}`.trim()}>
      <span className={`h-2 w-2 rounded-full ${styles.dot} ${pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
