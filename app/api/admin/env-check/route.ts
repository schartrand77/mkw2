import { NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { withRequestObservability } from '@/lib/request-observability'
import { validateAdminBootstrapPassword, validateJwtSecret } from '@/lib/security-config'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Check = {
  key: string
  label: string
  required: boolean
  ok: boolean
  detail?: string | null
  configurableInApp?: boolean
}

const REQUIRED_CHECKS: Array<{ key: string; label: string; required: boolean; alt?: string[] }> = [
  { key: 'DATABASE_URL', label: 'Database connection', required: true },
  { key: 'JWT_SECRET', label: 'JWT secret', required: true },
]

const OPTIONAL_CHECKS: Array<{ key: string; label: string; required: boolean; alt?: string[] }> = [
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe payments', required: false },
  { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook signing secret', required: false },
  { key: 'STRIPE_SHIPPING_RATE_ID', label: 'Stripe shipping rate', required: false },
  { key: 'ORDERWORKS_BASE_URL', label: 'OrderWorks inbound base URL', required: false },
  { key: 'ORDERWORKS_USERNAME', label: 'OrderWorks username', required: false },
  { key: 'ORDERWORKS_PASSWORD', label: 'OrderWorks password', required: false },
  { key: 'STOCKWORKS_BASE_URL', label: 'StockWorks base URL', required: false },
  { key: 'STOCKWORKS_ADMIN_USERNAME', label: 'StockWorks admin user', required: false, alt: ['STOCKWORKS_USERNAME'] },
  { key: 'STOCKWORKS_ADMIN_PASSWORD', label: 'StockWorks admin password', required: false, alt: ['STOCKWORKS_PASSWORD'] },
  { key: 'PRINTLAB_BASE_URL', label: 'PrintLab base URL', required: false, alt: ['BAMBU_VIEW_BASE_URL'] },
  { key: 'PRINTLAB_API_KEY', label: 'PrintLab API key', required: false, alt: ['BAMBU_VIEW_API_KEY'] },
  { key: 'PRINTLAB_SESSION_COOKIE', label: 'PrintLab session cookie', required: false, alt: ['BAMBU_VIEW_SESSION_COOKIE'] },
  { key: 'PRINTLAB_AUTH_HEADER', label: 'PrintLab auth header', required: false, alt: ['BAMBU_VIEW_AUTH_HEADER'] },
  { key: 'VAPID_PUBLIC_KEY', label: 'Push notifications key', required: false, alt: ['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] },
  { key: 'VAPID_PRIVATE_KEY', label: 'Push notifications secret', required: false },
  { key: 'ADMIN_PASSWORD', label: 'Admin bootstrap password', required: false },
]

function resolveValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim()) return value
  }
  return null
}

const IN_APP_SETTING_KEYS: Record<string, string> = {
  STRIPE_SECRET_KEY: 'stripeSecretKey',
  STRIPE_WEBHOOK_SECRET: 'stripeWebhookSecret',
  STRIPE_SHIPPING_RATE_ID: 'stripeShippingRateId',
  ORDERWORKS_BASE_URL: 'orderworksBaseUrl',
  ORDERWORKS_USERNAME: 'orderworksUsername',
  ORDERWORKS_PASSWORD: 'orderworksPassword',
  STOCKWORKS_BASE_URL: 'stockworksBaseUrl',
  STOCKWORKS_ADMIN_USERNAME: 'stockworksUsername',
  STOCKWORKS_ADMIN_PASSWORD: 'stockworksPassword',
  PRINTLAB_BASE_URL: 'printlabBaseUrl',
  PRINTLAB_API_KEY: 'printlabApiKey',
  PRINTLAB_SESSION_COOKIE: 'printlabSessionCookie',
  PRINTLAB_AUTH_HEADER: 'printlabAuthHeader',
  VAPID_PUBLIC_KEY: 'vapidPublicKey',
  VAPID_PRIVATE_KEY: 'vapidPrivateKey',
}

function buildCheck(entry: { key: string; label: string; required: boolean; alt?: string[] }, configuredSettings: Set<string>): Check {
  const keys = [entry.key, ...(entry.alt || [])]
  const value = resolveValue(keys)
  const configuredInApp = Boolean(IN_APP_SETTING_KEYS[entry.key] && configuredSettings.has(IN_APP_SETTING_KEYS[entry.key]))
  let detail = value ? null : `Missing ${entry.key}${entry.alt?.length ? ` (or ${entry.alt.join(', ')})` : ''}`
  let ok = Boolean(value) || configuredInApp

  if (!value && configuredInApp) {
    detail = 'Configured in Admin -> Suite setup'
  }

  if (value && entry.key === 'JWT_SECRET') {
    const jwt = validateJwtSecret(value)
    ok = jwt.ok
    detail = jwt.ok ? null : jwt.message || 'Invalid JWT secret'
  } else if (value && entry.key === 'ADMIN_PASSWORD') {
    const adminPassword = validateAdminBootstrapPassword(value)
    ok = adminPassword.ok
    detail = adminPassword.ok ? null : adminPassword.message || 'Invalid admin bootstrap password'
  }

  return {
    key: entry.key,
    label: entry.label,
    required: entry.required,
    ok,
    detail,
    configurableInApp: Boolean(IN_APP_SETTING_KEYS[entry.key]),
  }
}

async function handleGet() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const configuredSettings = new Set(
    (await prisma.runtimeSetting.findMany({
      where: { value: { not: null } },
      select: { key: true },
    })).map((row: any) => String(row.key)),
  )
  const checks = [...REQUIRED_CHECKS, ...OPTIONAL_CHECKS].map((entry) => buildCheck(entry, configuredSettings))
  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok)
  return NextResponse.json({ ok: requiredOk, checks })
}

export const GET = withRequestObservability(handleGet, { routeName: '/api/admin/env-check' })
