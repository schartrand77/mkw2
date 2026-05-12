"use client"

import { useState } from 'react'

type RedactedSetting = {
  value?: string
  configured?: boolean
  masked?: string | null
  source?: 'env' | 'database' | 'unset'
}

type Props = {
  initialSettings: Record<string, RedactedSetting>
}

type Field = {
  key: string
  label: string
  secret?: boolean
  placeholder?: string
}

const GROUPS: Array<{ title: string; description: string; testKey?: string; fields: Field[] }> = [
  {
    title: 'MakerWorks',
    description: 'Payments, email, notifications, and storefront-adjacent integration settings.',
    fields: [
      { key: 'stripeSecretKey', label: 'Stripe secret key', secret: true },
      { key: 'stripeWebhookSecret', label: 'Stripe webhook secret', secret: true },
      { key: 'paypalClientId', label: 'PayPal client ID' },
      { key: 'paypalClientSecret', label: 'PayPal client secret', secret: true },
      { key: 'smtpHost', label: 'SMTP host' },
      { key: 'smtpPort', label: 'SMTP port' },
      { key: 'smtpUser', label: 'SMTP user' },
      { key: 'smtpPassword', label: 'SMTP password', secret: true },
      { key: 'discordAdminChannelId', label: 'Discord admin channel ID' },
      { key: 'discordBotToken', label: 'Discord bot token', secret: true },
    ],
  },
  {
    title: 'PrintLab',
    description: 'Printer handoff, routing callbacks, and service-to-service authentication.',
    testKey: 'printlabBaseUrl',
    fields: [
      { key: 'printlabBaseUrl', label: 'PrintLab base URL', placeholder: 'http://printlab:8080' },
      { key: 'printlabApiKey', label: 'PrintLab API key', secret: true },
      { key: 'printlabSubmitApiKey', label: 'MakerWorks submit token for PrintLab', secret: true },
    ],
  },
  {
    title: 'StockWorks',
    description: 'Inventory intelligence, material sync, and merch visibility.',
    testKey: 'stockworksBaseUrl',
    fields: [
      { key: 'stockworksBaseUrl', label: 'StockWorks base URL', placeholder: 'http://stockworks:8000' },
      { key: 'stockworksUsername', label: 'StockWorks username' },
      { key: 'stockworksPassword', label: 'StockWorks password', secret: true },
      { key: 'stockworksServiceApiKey', label: 'StockWorks service token', secret: true },
    ],
  },
  {
    title: 'YouTube',
    description: 'PrintLab timelapse upload credentials and publishing defaults.',
    fields: [
      { key: 'youtubeUploadEnabled', label: 'YouTube upload enabled' },
      { key: 'youtubeClientId', label: 'YouTube client ID' },
      { key: 'youtubeClientSecret', label: 'YouTube client secret', secret: true },
      { key: 'youtubeRefreshToken', label: 'YouTube refresh token', secret: true },
      { key: 'youtubePrivacyStatus', label: 'YouTube privacy status' },
    ],
  },
]

function initialPlaceholder(setting: RedactedSetting | undefined, fallback = '') {
  if (!setting) return fallback
  return setting.masked || setting.value || fallback
}

function sourceLabel(setting: RedactedSetting | undefined) {
  if (!setting?.source || setting.source === 'unset') return 'Not configured'
  return setting.source === 'env' ? 'Configured by env' : 'Configured in app'
}

export default function SuiteSetupPanel({ initialSettings }: Props) {
  const [displayedSettings, setDisplayedSettings] = useState<Record<string, RedactedSetting>>(initialSettings)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [statusKind, setStatusKind] = useState<'info' | 'success' | 'error'>('info')
  const [oneTimeToken, setOneTimeToken] = useState<{ label: string; token: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function updateField(key: string, value: string) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    setBusy(true)
    setStatus('')
    setStatusKind('info')
    setOneTimeToken(null)
    const payload = Object.fromEntries(Object.entries(settings).filter(([, value]) => value.trim().length > 0))
    if (Object.keys(payload).length === 0) {
      setBusy(false)
      setStatusKind('info')
      setStatus('Enter at least one setting before saving.')
      return
    }
    try {
      const res = await fetch('/api/admin/suite-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setStatusKind('error')
        setStatus(body?.error || 'Unable to save suite settings.')
        return
      }
      if (body?.settings && typeof body.settings === 'object') setDisplayedSettings(body.settings)
      setSettings({})
      setStatusKind('success')
      setStatus('Saved suite settings.')
    } catch (error: any) {
      setStatusKind('error')
      setStatus(error?.message || 'Unable to save suite settings.')
    } finally {
      setBusy(false)
    }
  }

  async function testConnection(group: { title: string; testKey?: string }) {
    if (!group.testKey) return
    setBusy(true)
    setStatus('')
    setStatusKind('info')
    const configured = displayedSettings[group.testKey]
    const baseUrl = settings[group.testKey] || configured?.value || ''
    const apiKey = group.title === 'PrintLab' ? settings.printlabApiKey : settings.stockworksServiceApiKey
    const res = await fetch('/api/admin/suite-settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: group.title.toLowerCase(), baseUrl, apiKey }),
    })
    const payload = await res.json().catch(() => null)
    setBusy(false)
    setStatusKind(payload?.ok ? 'success' : 'error')
    setStatus(payload?.ok ? `${group.title} connection succeeded.` : (payload?.error || `${group.title} connection failed.`))
  }

  async function generateToken(target: 'printlab' | 'stockworks') {
    setBusy(true)
    setStatus('')
    setStatusKind('info')
    setOneTimeToken(null)
    const res = await fetch('/api/admin/suite-settings/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    })
    const payload = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) {
      setStatusKind('error')
      setStatus(payload?.error || 'Unable to generate token.')
      return
    }
    setStatusKind('success')
    setOneTimeToken({ label: target === 'printlab' ? 'PrintLab submit token' : 'StockWorks service token', token: payload.token })
    setStatus('Token generated and saved. Copy it into the target app now; it will not be shown again.')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Suite setup</h2>
        <p className="mt-1 text-sm text-slate-400">
          Configure integrations in app where possible. Boot-critical database, session, storage, and encryption values still belong in env or Docker secrets.
        </p>
      </div>

      {oneTimeToken && (
        <section className="rounded-lg border border-amber-300/30 bg-amber-950/30 p-4">
          <p className="text-sm font-semibold text-amber-100">{oneTimeToken.label}</p>
          <code className="mt-2 block break-all rounded bg-black/40 p-3 text-xs text-amber-50">{oneTimeToken.token}</code>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3">
              <h3 className="font-semibold">{group.title}</h3>
              <p className="text-xs text-slate-400">{group.description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.fields.map((field) => {
                const setting = displayedSettings[field.key]
                return (
                  <label key={field.key} className="block text-sm">
                    <span className="flex items-center justify-between gap-2 text-slate-300">
                      <span>{field.label}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">{sourceLabel(setting)}</span>
                    </span>
                    <input
                      className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                      type={field.secret ? 'password' : 'text'}
                      placeholder={initialPlaceholder(setting, field.placeholder)}
                      value={settings[field.key] || ''}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  </label>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {group.testKey && (
                <button className="btn" type="button" disabled={busy} onClick={() => testConnection(group)}>
                  Test connection
                </button>
              )}
              {group.title === 'PrintLab' && (
                <button className="rounded-md border border-white/10 px-3 py-2 text-sm hover:border-white/20" type="button" disabled={busy} onClick={() => generateToken('printlab')}>
                  Generate PrintLab submit token
                </button>
              )}
              {group.title === 'StockWorks' && (
                <button className="rounded-md border border-white/10 px-3 py-2 text-sm hover:border-white/20" type="button" disabled={busy} onClick={() => generateToken('stockworks')}>
                  Generate StockWorks service token
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" type="button" disabled={busy} onClick={save}>Save settings</button>
        {status && (
          <p
            className={`rounded-md border px-3 py-2 text-sm ${
              statusKind === 'error'
                ? 'border-red-400/30 bg-red-950/30 text-red-100'
                : statusKind === 'success'
                  ? 'border-emerald-400/30 bg-emerald-950/30 text-emerald-100'
                  : 'border-white/10 bg-black/20 text-slate-300'
            }`}
          >
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
