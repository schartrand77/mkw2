import Link from 'next/link'
import { getSetupStatus, type SetupIssue } from '@/lib/setupStatus'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'MakerWorks setup checklist',
}

function IssueCard({ issue }: { issue: SetupIssue }) {
  const isError = issue.severity === 'error'
  const border = isError ? 'border-rose-400/60 bg-rose-50/5' : 'border-amber-400/60 bg-amber-50/5'
  const badge = isError ? 'bg-rose-500/20 text-rose-100' : 'bg-amber-500/20 text-amber-100'
  return (
    <div className={`rounded-lg border ${border} p-4`}>
      <div className="flex items-start gap-3">
        <span className={`text-xs uppercase tracking-wide px-2 py-1 rounded ${badge}`}>
          {isError ? 'Blocking' : 'Warning'}
        </span>
        <div>
          <h3 className="font-semibold text-lg text-white">{issue.title}</h3>
          <p className="text-sm text-slate-300 mt-1">{issue.detail}</p>
          <p className="text-sm text-slate-200 mt-2">
            <span className="font-medium">Fix:</span> {issue.action}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SetupPage() {
  const status = getSetupStatus()
  const ready = !status.hasBlockingIssues
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="space-y-4">
        <p className="text-brand-400 uppercase text-xs tracking-[0.3em]">MakerWorks setup</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">Environment checklist</h1>
        <p className="text-slate-300">
          MakerWorks inspects critical environment variables before loading the main app. Update{' '}
          <code className="font-mono text-sm">.env.local</code> (created from <code className="font-mono text-sm">.env.local.template</code>) or your container environment,
          then restart the process and refresh this page.
        </p>
        <p className="text-xs text-slate-400">Last checked: {new Date(status.checkedAt).toLocaleString()}</p>
      </header>

      <section className={`rounded-xl border p-4 sm:p-6 ${ready ? 'border-emerald-400/60 bg-emerald-900/30 text-emerald-50' : 'border-rose-400/60 bg-rose-900/30 text-rose-50'}`}>
        <h2 className="text-xl font-semibold">
          {ready ? 'All blocking checks passed' : 'Resolve these before continuing'}
        </h2>
        <p className="text-sm mt-2">
          {ready
            ? 'No blocking issues remain. You can sign in and continue bootstrapping the app.'
            : 'MakerWorks will redirect to this page until the blocking issues below are resolved.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="https://github.com/schartrand77/mkw2/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded border border-white/30 px-3 py-1.5 text-sm font-medium hover:border-white hover:text-white"
          >
            Open README
          </a>
          <Link
            href="/login"
            className="inline-flex items-center rounded bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
          >
            Go to login
          </Link>
        </div>
      </section>

      {status.blockingIssues.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Blocking issues</h2>
            <p className="text-slate-300">Fix each item below and restart MakerWorks.</p>
          </div>
          <div className="space-y-4">
            {status.blockingIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </section>
      )}

      {status.warnings.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Warnings</h2>
            <p className="text-slate-300">
              These do not block the app from loading but may disable checkout or backups.
            </p>
          </div>
          <div className="space-y-4">
            {status.warnings.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
