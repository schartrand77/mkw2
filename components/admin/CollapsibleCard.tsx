"use client"

import { ReactNode, useId, useState } from 'react'

type CollapsibleCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  defaultOpen?: boolean
  id?: string
  className?: string
  bodyClassName?: string
  variant?: 'glass' | 'plain'
  actions?: ReactNode
}

export default function CollapsibleCard({
  title,
  subtitle,
  children,
  defaultOpen = true,
  id,
  className = '',
  bodyClassName = 'p-6',
  variant = 'glass',
  actions,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  const containerBase =
    variant === 'glass'
      ? 'glass rounded-xl'
      : 'rounded-xl border border-white/10 bg-white/5 shadow-inner shadow-black/10'
  const containerClassName = `${containerBase} ${className}`.trim()

  return (
    <section id={id} className={containerClassName}>
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-6 text-white">{title}</p>
          {subtitle ? <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => setOpen(prev => !prev)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/5 text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className="sr-only">{open ? 'Collapse' : 'Expand'} {title}</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 8l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>
      <div
        id={contentId}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className={bodyClassName}>{children}</div>
        </div>
      </div>
    </section>
  )
}
