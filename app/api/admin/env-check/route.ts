import { NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { withRequestObservability } from '@/lib/request-observability'
import { validateAdminBootstrapPassword, validateJwtSecret } from '@/lib/security-config'

export const dynamic = 'force-dynamic'

type Check = {
  key: string
  label: string
  required: boolean
  ok: boolean
  detail?: string | null
}

const REQUIRED_CHECKS: Array<{ key: string; label: string; required: boolean; alt?: string[] }> = [
  { key: 'DATABASE_URL', label: 'Database connection', required: true },
  { key: 'JWT_SECRET', label: 'JWT secret', required: true },
]

const OPTIONAL_CHECKS: Array<{ key: string; label: string; required: boolean; alt?: string[] }> = [
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe payments', required: false },
  { key: 'STRIPE_SHIPPING_RATE_ID', label: 'Stripe shipping rate', required: false },
  { key: 'ORDERWORKS_BASE_URL', label: 'OrderWorks inbound base URL', required: false },
  { key: 'ORDERWORKS_USERNAME', label: 'OrderWorks username', required: false },
  { key: 'ORDERWORKS_PASSWORD', label: 'OrderWorks password', required: false },
  { key: 'STOCKWORKS_BASE_URL', label: 'StockWorks base URL', required: false },
  { key: 'STOCKWORKS_ADMIN_USERNAME', label: 'StockWorks admin user', required: false, alt: ['STOCKWORKS_USERNAME'] },
  { key: 'STOCKWORKS_ADMIN_PASSWORD', label: 'StockWorks admin password', required: false, alt: ['STOCKWORKS_PASSWORD'] },
  { key: 'BAMBU_VIEW_BASE_URL', label: 'Bambu View base URL', required: false },
  { key: 'BAMBU_VIEW_API_KEY', label: 'Bambu View API key', required: false },
  { key: 'BAMBU_VIEW_SESSION_COOKIE', label: 'Bambu View session cookie', required: false },
  { key: 'BAMBU_VIEW_AUTH_HEADER', label: 'Bambu View auth header', required: false },
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

function buildCheck(entry: { key: string; label: string; required: boolean; alt?: string[] }): Check {
  const keys = [entry.key, ...(entry.alt || [])]
  const value = resolveValue(keys)
  let detail = value ? null : `Missing ${entry.key}${entry.alt?.length ? ` (or ${entry.alt.join(', ')})` : ''}`
  let ok = Boolean(value)

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
  }
}

async function handleGet() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const checks = [...REQUIRED_CHECKS, ...OPTIONAL_CHECKS].map(buildCheck)
  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok)
  return NextResponse.json({ ok: requiredOk, checks })
}

export const GET = withRequestObservability(handleGet, { routeName: '/api/admin/env-check' })
