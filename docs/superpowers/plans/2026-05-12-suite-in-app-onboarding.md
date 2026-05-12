# Suite In-App Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every non-boot-critical MakerWorks, PrintLab, and StockWorks integration setting into authenticated in-app onboarding/settings flows, while keeping only startup, database, durable storage, and encryption root values in env or Docker secrets.

**Architecture:** MakerWorks becomes the suite setup hub and stores its own integration settings in Postgres. PrintLab builds on its existing JSON config loader and adds authenticated settings APIs/UI that write `/data/config.json`. StockWorks adds a runtime settings layer backed by its existing database and gradually replaces direct `os.environ` integration reads with that layer.

**Tech Stack:** MakerWorks: Next.js App Router, React, TypeScript, Prisma, PostgreSQL. PrintLab: FastAPI, Python, JSON config files, existing dashboard HTML/JS. StockWorks: FastAPI, SQLModel/SQLAlchemy, existing static JS/templates.

---

## Non-Negotiable Scope Rules

- Keep boot-critical env values:
  - MakerWorks: `DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR`, optional bootstrap admin env.
  - PrintLab: `SESSION_SECRET` or equivalent root session secret, durable data/config paths, optional first admin hash.
  - StockWorks: `DATABASE_URL` or local SQLite path, `SECRET_KEY`, optional first admin password.
- Move integration/runtime settings wherever possible:
  - MakerWorks: Stripe, PayPal, SMTP, Discord, push, PrintLab, StockWorks, OrderWorks compatibility, direct upload URLs, non-secret branding/contact settings.
  - PrintLab: MakerWorks, StockWorks, YouTube upload settings, callback templates, allowlists, submit API key, printer onboarding after first boot.
  - StockWorks: PrintLab sync, OrderWorks HTTP fallback, SMTP digest settings, trace/debug toggles, batch upload limits.
- Never expose secret values in API responses. Return booleans such as `configured: true` and masked summaries.
- Prefer “env wins over persisted config” during migration so existing deployments keep working.
- Each task must be independently shippable and verified before taking the next one.

## Files And Responsibilities

### MakerWorks Repo: `C:\Users\steph\OneDrive\Documents\GitHub\mkwV2`

- `prisma/schema.prisma`: add generic encrypted suite settings and connection test audit models.
- `prisma/migrations/<timestamp>_suite_settings/migration.sql`: create setting tables and indexes.
- `lib/admin/suite-settings.ts`: typed read/write API for persisted settings, env precedence, redaction, and validation.
- `lib/admin/secret-box.ts`: encrypt/decrypt secrets using `SUITE_SETTINGS_ENCRYPTION_KEY` or `JWT_SECRET` fallback.
- `app/api/admin/suite-settings/route.ts`: admin GET/PATCH settings API.
- `app/api/admin/suite-settings/test/route.ts`: admin POST connection test API.
- `app/admin/suite-setup/page.tsx`: server page for setup.
- `components/admin/SuiteSetupPanel.tsx`: client UI for grouped settings, status, save, and test actions.
- `app/api/admin/env-check/route.ts`: reclassify migrated values as “configurable in app” when persisted settings exist.
- `docs/wiki/Configuration-Reference.md`: document minimal env and in-app setup.
- `tests/suite-settings.test.ts`: unit tests for redaction, precedence, and validation.
- `tests/admin-suite-settings-api.test.ts`: route-level tests for auth, save, redaction, and connection test shape.

### PrintLab Repo: `C:\Users\steph\OneDrive\Documents\GitHub\printlab`

- `app/config.py`: add write-safe config path helpers and masked config snapshots.
- `app/settings.py`: new settings schema, redaction helpers, merge/write functions.
- `app/routers/settings.py`: authenticated GET/PATCH/test endpoints.
- `app/dashboard.html`: add settings sections for Works integrations and YouTube.
- `app/static/settings.js` or inline dashboard JS near existing settings code: save/test UI.
- `app/services.py`: ensure Works and YouTube read through `get_env`, preserving env > file precedence.
- `tests/test_settings.py`: JSON config read/write/redaction tests.
- `tests/test_settings_api.py`: authenticated settings API tests.
- `README.md`: document in-app setup and minimal env.

### StockWorks Repo: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks`

- `app/settings.py`: new runtime settings model, schema, redaction helpers, and env fallback.
- `app/models.py` or existing DB model file: add `AppSetting` table if project conventions allow.
- `app/api.py`: add authenticated settings GET/PATCH/test routes and replace selected integration env reads.
- `app/printlab.py`: read PrintLab config through runtime settings.
- `app/orderworks.py`: read OrderWorks HTTP fallback through runtime settings.
- `app/email_digest.py`: accept runtime settings as source or add `smtp_config_from_settings`.
- `app/templates/index.html`: add settings controls for PrintLab, OrderWorks, SMTP digest.
- `app/static/app.js`: add settings load/save/test behavior.
- `tests/test_settings.py`: persistence, redaction, and env precedence tests.
- `tests/test_settings_api.py`: auth and route behavior tests.
- `README.md`: document in-app setup and minimal env.

---

## Task 1: MakerWorks Settings Storage And Secret Encryption

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_suite_runtime_settings/migration.sql`
- Create: `lib/admin/secret-box.ts`
- Create: `lib/admin/suite-settings.ts`
- Test: `tests/suite-settings.test.ts`

- [ ] **Step 1: Write failing tests for redaction, encryption, and env precedence**

Create `tests/suite-settings.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decryptSecretValue,
  encryptSecretValue,
  maskSecret,
  mergeRuntimeSetting,
  redactRuntimeSettings,
} from '../lib/admin/suite-settings'

test('encrypts and decrypts suite secrets with a stable key', () => {
  const encrypted = encryptSecretValue('stripe-secret', '0123456789abcdef0123456789abcdef')
  assert.notEqual(encrypted, 'stripe-secret')
  assert.equal(decryptSecretValue(encrypted, '0123456789abcdef0123456789abcdef'), 'stripe-secret')
})

test('redacts secret settings but exposes configured state', () => {
  assert.equal(maskSecret('sk_live_1234567890'), 'sk_liv********7890')
  assert.equal(maskSecret('tiny'), 'configured')
  assert.deepEqual(redactRuntimeSettings({
    stripeSecretKey: { value: 'sk_live_1234567890', secret: true, source: 'database' },
    printlabBaseUrl: { value: 'http://printlab:8080', secret: false, source: 'database' },
  }), {
    stripeSecretKey: { configured: true, masked: 'sk_liv********7890', source: 'database' },
    printlabBaseUrl: { value: 'http://printlab:8080', configured: true, source: 'database' },
  })
})

test('env value wins over persisted settings while migration is in progress', () => {
  const merged = mergeRuntimeSetting({
    envValue: 'https://env.example',
    storedValue: 'https://stored.example',
    secret: false,
  })
  assert.deepEqual(merged, { value: 'https://env.example', source: 'env', secret: false })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm test -- tests/suite-settings.test.ts
```

Expected: FAIL because `lib/admin/suite-settings.ts` does not exist.

- [ ] **Step 3: Add Prisma model and migration**

Add to `prisma/schema.prisma` near `SiteConfig`:

```prisma
model RuntimeSetting {
  key       String   @id
  category  String
  value     String?
  secret    Boolean  @default(false)
  source    String   @default("database")
  updatedBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
  @@index([updatedAt])
}
```

Create migration SQL:

```sql
CREATE TABLE "RuntimeSetting" (
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "value" TEXT,
  "secret" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'database',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RuntimeSetting_category_idx" ON "RuntimeSetting"("category");
CREATE INDEX "RuntimeSetting_updatedAt_idx" ON "RuntimeSetting"("updatedAt");
```

- [ ] **Step 4: Add encryption and settings helper implementation**

Create `lib/admin/suite-settings.ts`:

```ts
import crypto from 'node:crypto'

export type SettingSource = 'env' | 'database' | 'unset'

export type RuntimeSettingValue = {
  value: string
  source: SettingSource
  secret: boolean
}

export type RedactedRuntimeSetting =
  | { value: string; configured: boolean; source: SettingSource }
  | { configured: boolean; masked: string | null; source: SettingSource }

function keyToBuffer(key: string) {
  return crypto.createHash('sha256').update(key).digest()
}

export function encryptSecretValue(value: string, key: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyToBuffer(key), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
}

export function decryptSecretValue(payload: string, key: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(':')
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) throw new Error('Unsupported encrypted setting payload.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyToBuffer(key), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function maskSecret(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.length < 8) return 'configured'
  return `${raw.slice(0, 6)}********${raw.slice(-4)}`
}

export function mergeRuntimeSetting(input: { envValue?: string | null; storedValue?: string | null; secret: boolean }): RuntimeSettingValue {
  const envValue = String(input.envValue || '').trim()
  if (envValue) return { value: envValue, source: 'env', secret: input.secret }
  const storedValue = String(input.storedValue || '').trim()
  if (storedValue) return { value: storedValue, source: 'database', secret: input.secret }
  return { value: '', source: 'unset', secret: input.secret }
}

export function redactRuntimeSettings(settings: Record<string, RuntimeSettingValue>): Record<string, RedactedRuntimeSetting> {
  const result: Record<string, RedactedRuntimeSetting> = {}
  for (const [key, setting] of Object.entries(settings)) {
    if (setting.secret) {
      result[key] = {
        configured: Boolean(setting.value),
        masked: maskSecret(setting.value),
        source: setting.source,
      }
    } else {
      result[key] = {
        value: setting.value,
        configured: Boolean(setting.value),
        source: setting.source,
      }
    }
  }
  return result
}
```

- [ ] **Step 5: Run tests and Prisma generation**

Run:

```powershell
npm test -- tests/suite-settings.test.ts
npm run prisma:generate
```

Expected: tests pass and Prisma client generation succeeds.

- [ ] **Step 6: Commit Task 1**

```powershell
git add prisma/schema.prisma prisma/migrations lib/admin/suite-settings.ts tests/suite-settings.test.ts
git commit -m "feat: add suite runtime settings storage"
```

---

## Task 2: MakerWorks Suite Setup API

**Files:**
- Create: `app/api/admin/suite-settings/route.ts`
- Create: `app/api/admin/suite-settings/test/route.ts`
- Modify: `lib/admin/suite-settings.ts`
- Test: `tests/admin-suite-settings-api.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `tests/admin-suite-settings-api.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { validateSuiteSettingsPayload } from '../lib/admin/suite-settings'

test('validates suite settings payload by category and known key', () => {
  const parsed = validateSuiteSettingsPayload({
    printlabBaseUrl: 'http://printlab:8080',
    stockworksBaseUrl: 'http://stockworks:8000',
    stripeSecretKey: 'sk_test_123',
  })
  assert.equal(parsed.printlabBaseUrl.value, 'http://printlab:8080')
  assert.equal(parsed.stripeSecretKey.secret, true)
})

test('rejects unknown suite setting keys', () => {
  assert.throws(
    () => validateSuiteSettingsPayload({ randomPassword: 'secret' }),
    /Unknown suite setting key/,
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npm test -- tests/admin-suite-settings-api.test.ts
```

Expected: FAIL because `validateSuiteSettingsPayload` does not exist.

- [ ] **Step 3: Add setting registry and payload validation**

Extend `lib/admin/suite-settings.ts`:

```ts
export const SUITE_SETTING_DEFINITIONS = {
  stripeSecretKey: { category: 'payments', secret: true },
  stripeWebhookSecret: { category: 'payments', secret: true },
  paypalClientId: { category: 'payments', secret: false },
  paypalClientSecret: { category: 'payments', secret: true },
  smtpHost: { category: 'email', secret: false },
  smtpPort: { category: 'email', secret: false },
  smtpUser: { category: 'email', secret: false },
  smtpPassword: { category: 'email', secret: true },
  receiptFromEmail: { category: 'email', secret: false },
  printlabBaseUrl: { category: 'printlab', secret: false },
  printlabApiKey: { category: 'printlab', secret: true },
  stockworksBaseUrl: { category: 'stockworks', secret: false },
  stockworksUsername: { category: 'stockworks', secret: false },
  stockworksPassword: { category: 'stockworks', secret: true },
  orderworksBaseUrl: { category: 'orderworks', secret: false },
  orderworksUsername: { category: 'orderworks', secret: false },
  orderworksPassword: { category: 'orderworks', secret: true },
  discordBotToken: { category: 'notifications', secret: true },
  discordAdminChannelId: { category: 'notifications', secret: false },
  vapidPublicKey: { category: 'notifications', secret: false },
  vapidPrivateKey: { category: 'notifications', secret: true },
} as const

export type SuiteSettingKey = keyof typeof SUITE_SETTING_DEFINITIONS

export function validateSuiteSettingsPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Settings payload must be an object.')
  const result: Partial<Record<SuiteSettingKey, { value: string; category: string; secret: boolean }>> = {}
  for (const [key, rawValue] of Object.entries(payload as Record<string, unknown>)) {
    if (!(key in SUITE_SETTING_DEFINITIONS)) throw new Error(`Unknown suite setting key: ${key}`)
    if (rawValue != null && typeof rawValue !== 'string') throw new Error(`Suite setting ${key} must be a string or null.`)
    const def = SUITE_SETTING_DEFINITIONS[key as SuiteSettingKey]
    result[key as SuiteSettingKey] = {
      value: String(rawValue || '').trim(),
      category: def.category,
      secret: def.secret,
    }
  }
  return result
}
```

- [ ] **Step 4: Add admin GET/PATCH routes**

Create `app/api/admin/suite-settings/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { encryptSecretValue, redactRuntimeSettings, validateSuiteSettingsPayload } from '@/lib/admin/suite-settings'

export const dynamic = 'force-dynamic'

function encryptionKey() {
  return process.env.SUITE_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || ''
}

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const rows = await prisma.runtimeSetting.findMany()
  const settings = Object.fromEntries(rows.map((row) => [row.key, {
    value: row.secret ? 'configured' : row.value || '',
    source: row.source as any,
    secret: row.secret,
  }]))
  return NextResponse.json({ settings: redactRuntimeSettings(settings as any) })
}

export async function PATCH(req: NextRequest) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const parsed = validateSuiteSettingsPayload(await req.json())
    const key = encryptionKey()
    if (!key) throw new Error('SUITE_SETTINGS_ENCRYPTION_KEY or JWT_SECRET is required before saving suite secrets.')
    const writes = Object.entries(parsed).map(([settingKey, setting]) => {
      const value = setting.secret && setting.value ? encryptSecretValue(setting.value, key) : setting.value
      return prisma.runtimeSetting.upsert({
        where: { key: settingKey },
        update: { value, category: setting.category, secret: setting.secret, source: 'database', updatedBy: adminId },
        create: { key: settingKey, value, category: setting.category, secret: setting.secret, source: 'database', updatedBy: adminId },
      })
    })
    await prisma.$transaction(writes)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
```

- [ ] **Step 5: Add connection test route**

Create `app/api/admin/suite-settings/test/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const body = await req.json().catch(() => ({}))
  const baseUrl = String(body.baseUrl || '').trim().replace(/\/+$/, '')
  if (!baseUrl) return NextResponse.json({ ok: false, error: 'Base URL is required.' }, { status: 400 })
  try {
    const res = await fetch(`${baseUrl}/health`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Connection failed.' }, { status: 502 })
  }
}
```

- [ ] **Step 6: Run tests**

```powershell
npm test -- tests/suite-settings.test.ts tests/admin-suite-settings-api.test.ts
npm run typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 7: Commit Task 2**

```powershell
git add app/api/admin/suite-settings lib/admin/suite-settings.ts tests/admin-suite-settings-api.test.ts
git commit -m "feat: add MakerWorks suite settings API"
```

---

## Task 3: MakerWorks Suite Setup UI

**Files:**
- Create: `app/admin/suite-setup/page.tsx`
- Create: `components/admin/SuiteSetupPanel.tsx`
- Modify: `components/AppSidebar.tsx`
- Modify: `app/admin/page.tsx`
- Test: `tests/suite-setup-panel.test.tsx`

- [ ] **Step 1: Write failing render test**

Create `tests/suite-setup-panel.test.tsx`:

```tsx
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import SuiteSetupPanel from '../components/admin/SuiteSetupPanel'

test('suite setup panel renders grouped onboarding controls', () => {
  const html = renderToStaticMarkup(<SuiteSetupPanel initialSettings={{}} />)
  assert.match(html, /MakerWorks/)
  assert.match(html, /PrintLab/)
  assert.match(html, /StockWorks/)
  assert.match(html, /YouTube/)
  assert.match(html, /Test connection/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npm test -- tests/suite-setup-panel.test.tsx
```

Expected: FAIL because `SuiteSetupPanel` does not exist.

- [ ] **Step 3: Create the client panel**

Create `components/admin/SuiteSetupPanel.tsx`:

```tsx
"use client"

import { useState } from 'react'

type Props = {
  initialSettings: Record<string, any>
}

const GROUPS = [
  { title: 'MakerWorks', fields: ['stripeSecretKey', 'paypalClientId', 'smtpHost', 'discordAdminChannelId'] },
  { title: 'PrintLab', fields: ['printlabBaseUrl', 'printlabApiKey'] },
  { title: 'StockWorks', fields: ['stockworksBaseUrl', 'stockworksUsername', 'stockworksPassword'] },
  { title: 'YouTube', fields: ['youtubeClientId', 'youtubeClientSecret', 'youtubeRefreshToken'] },
]

export default function SuiteSetupPanel({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')

  async function save() {
    const res = await fetch('/api/admin/suite-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setStatus(res.ok ? 'Saved suite settings.' : 'Unable to save suite settings.')
  }

  async function testConnection(baseUrl: string) {
    const res = await fetch('/api/admin/suite-settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: settings[baseUrl] || initialSettings[baseUrl]?.value || '' }),
    })
    const payload = await res.json().catch(() => null)
    setStatus(payload?.ok ? 'Connection succeeded.' : payload?.error || 'Connection failed.')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Suite setup</h2>
        <p className="text-sm text-slate-400">Configure integrations in app. Boot-critical secrets still belong in env or Docker secrets.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title} className="glass rounded-xl border border-white/10 p-4 space-y-3">
            <h3 className="font-semibold">{group.title}</h3>
            {group.fields.map((field) => (
              <label key={field} className="block text-sm">
                <span className="block text-slate-300">{field}</span>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                  type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('password') || field.toLowerCase().includes('token') ? 'password' : 'text'}
                  placeholder={initialSettings[field]?.masked || initialSettings[field]?.value || ''}
                  value={settings[field] || ''}
                  onChange={(event) => setSettings((current) => ({ ...current, [field]: event.target.value }))}
                />
              </label>
            ))}
            {(group.title === 'PrintLab' || group.title === 'StockWorks') && (
              <button className="btn" type="button" onClick={() => testConnection(group.title === 'PrintLab' ? 'printlabBaseUrl' : 'stockworksBaseUrl')}>
                Test connection
              </button>
            )}
          </section>
        ))}
      </div>
      <button className="btn" type="button" onClick={save}>Save settings</button>
      {status && <p className="text-sm text-slate-300">{status}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Add server page and navigation**

Create `app/admin/suite-setup/page.tsx`:

```tsx
import SuiteSetupPanel from '@/components/admin/SuiteSetupPanel'

export default async function SuiteSetupPage() {
  const res = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/api/admin/suite-settings`, { cache: 'no-store' }).catch(() => null)
  const payload = res?.ok ? await res.json() : { settings: {} }
  return <SuiteSetupPanel initialSettings={payload.settings || {}} />
}
```

Add a sidebar/admin link labeled `Suite setup` to existing admin navigation files.

- [ ] **Step 5: Run verification**

```powershell
npm test -- tests/suite-setup-panel.test.tsx
npm run typecheck
npm run lint -- --quiet
```

Expected: all commands pass.

- [ ] **Step 6: Commit Task 3**

```powershell
git add app/admin/suite-setup components/admin/SuiteSetupPanel.tsx components/AppSidebar.tsx app/admin/page.tsx tests/suite-setup-panel.test.tsx
git commit -m "feat: add MakerWorks suite setup UI"
```

---

## Task 4: PrintLab Settings API And JSON Writer

**Files:**
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\app\config.py`
- Create: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\app\settings.py`
- Create: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\app\routers\settings.py`
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\app\main.py`
- Test: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\tests\test_settings.py`

- [ ] **Step 1: Write failing settings tests**

Create `tests/test_settings.py` in PrintLab:

```py
from app.settings import mask_secret, merge_settings_payload


def test_masks_secret_values():
    assert mask_secret("abcdef1234567890") == "abcdef********7890"
    assert mask_secret("short") == "configured"
    assert mask_secret("") is None


def test_merges_allowed_settings_only():
    current = {"makerworks": {"base_url": "http://old"}}
    result = merge_settings_payload(current, {"makerworks": {"base_url": "http://new"}})
    assert result["makerworks"]["base_url"] == "http://new"


def test_rejects_unknown_settings_section():
    try:
        merge_settings_payload({}, {"unknown": {"x": "y"}})
    except ValueError as exc:
        assert "Unknown settings section" in str(exc)
    else:
        raise AssertionError("expected ValueError")
```

- [ ] **Step 2: Run failing test**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\printlab
python -m pytest tests/test_settings.py -q
```

Expected: FAIL because `app.settings` does not exist.

- [ ] **Step 3: Add settings helpers**

Create `app/settings.py`:

```py
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ALLOWED_SETTINGS: dict[str, set[str]] = {
    "makerworks": {"base_url", "api_key", "bearer_token", "admin_username", "admin_password", "allowed_paths", "allowed_methods", "job_callback_enabled", "job_callback_path_template"},
    "stockworks": {"base_url", "api_key", "bearer_token", "allowed_paths", "allowed_methods"},
    "youtube": {"upload_enabled", "client_id", "client_secret", "refresh_token", "privacy_status", "category_id", "title_template", "description_template", "tags", "made_for_kids"},
    "printer": {"conversion_max_upload_mb", "slicer_target", "slicer_protocol_template"},
}

SECRET_KEYS = {"api_key", "bearer_token", "admin_password", "client_secret", "refresh_token"}


def mask_secret(value: str | None) -> str | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if len(raw) < 8:
        return "configured"
    return f"{raw[:6]}********{raw[-4:]}"


def merge_settings_payload(current: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    merged = json.loads(json.dumps(current or {}))
    for section, values in payload.items():
        if section not in ALLOWED_SETTINGS:
            raise ValueError(f"Unknown settings section: {section}")
        if not isinstance(values, dict):
            raise ValueError(f"Settings section {section} must be an object.")
        target = merged.setdefault(section, {})
        for key, value in values.items():
            if key not in ALLOWED_SETTINGS[section]:
                raise ValueError(f"Unknown settings key: {section}.{key}")
            target[key] = "" if value is None else value
    return merged


def redact_settings(payload: dict[str, Any]) -> dict[str, Any]:
    redacted = json.loads(json.dumps(payload or {}))
    for section, values in redacted.items():
        if not isinstance(values, dict):
            continue
        for key, value in list(values.items()):
            if key in SECRET_KEYS:
                values[key] = {"configured": bool(value), "masked": mask_secret(str(value or ""))}
    return redacted


def read_settings_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_settings_file(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
```

- [ ] **Step 4: Add authenticated router**

Create `app/routers/settings.py`:

```py
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends

from app.auth import require_permission
from app.settings import merge_settings_payload, read_settings_file, redact_settings, write_settings_file

router = APIRouter()
CONFIG_PATH = Path("/data/config.json")


@router.get("/api/settings")
async def get_settings(_: bool = Depends(require_permission("auth:manage"))) -> dict[str, Any]:
    return {"settings": redact_settings(read_settings_file(CONFIG_PATH))}


@router.patch("/api/settings")
async def patch_settings(payload: dict[str, Any], _: bool = Depends(require_permission("auth:manage"))) -> dict[str, Any]:
    current = read_settings_file(CONFIG_PATH)
    merged = merge_settings_payload(current, payload)
    write_settings_file(CONFIG_PATH, merged)
    return {"ok": True, "settings": redact_settings(merged)}
```

Register the router in `app/main.py` with the existing API routers.

- [ ] **Step 5: Run PrintLab verification**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\printlab
python -m pytest tests/test_settings.py -q
python -m ruff check app tests
```

Expected: tests and ruff pass.

- [ ] **Step 6: Commit Task 4 in PrintLab**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\printlab
git add app/config.py app/settings.py app/routers/settings.py app/main.py tests/test_settings.py
git commit -m "feat: add in-app settings API"
```

---

## Task 5: PrintLab UI For Works And YouTube Settings

**Files:**
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\app\dashboard.html`
- Modify or Create: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\app\static\settings.js`
- Test: `C:\Users\steph\OneDrive\Documents\GitHub\printlab\tests\test_settings_api.py`

- [ ] **Step 1: Write API test for redacted settings**

Create `tests/test_settings_api.py`:

```py
from pathlib import Path

from app.settings import redact_settings, write_settings_file


def test_redacted_settings_hide_youtube_refresh_token(tmp_path: Path):
    path = tmp_path / "config.json"
    write_settings_file(path, {"youtube": {"refresh_token": "refresh-token-123456"}})
    redacted = redact_settings({"youtube": {"refresh_token": "refresh-token-123456"}})
    assert redacted["youtube"]["refresh_token"]["configured"] is True
    assert "refresh-token-123456" not in str(redacted)
```

- [ ] **Step 2: Run failing/passing focused test**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\printlab
python -m pytest tests/test_settings_api.py -q
```

Expected: PASS if Task 4 is complete. If it fails, fix redaction before UI work.

- [ ] **Step 3: Add dashboard settings fields**

In `app/dashboard.html`, add a settings card under the existing Settings panel:

```html
<section class="status-card" aria-labelledby="suiteSettingsTitle">
  <h3 id="suiteSettingsTitle">Suite Integrations</h3>
  <label>MakerWorks URL <input id="settingsMakerworksBaseUrl" class="field" type="url"></label>
  <label>MakerWorks API key <input id="settingsMakerworksApiKey" class="field" type="password"></label>
  <label>StockWorks URL <input id="settingsStockworksBaseUrl" class="field" type="url"></label>
  <label>YouTube client ID <input id="settingsYoutubeClientId" class="field" type="text"></label>
  <label>YouTube client secret <input id="settingsYoutubeClientSecret" class="field" type="password"></label>
  <label>YouTube refresh token <input id="settingsYoutubeRefreshToken" class="field" type="password"></label>
  <button class="btn" type="button" onclick="saveRuntimeSettings()">Save integration settings</button>
  <div id="runtimeSettingsStatus" class="settings-status" aria-live="polite"></div>
</section>
```

- [ ] **Step 4: Add browser behavior**

Add JS near existing settings functions:

```js
async function loadRuntimeSettings() {
  const res = await fetch("/api/settings");
  if (!res.ok) return;
  const payload = await res.json();
  const settings = payload.settings || {};
  document.getElementById("settingsMakerworksBaseUrl").value = settings.makerworks?.base_url?.value || settings.makerworks?.base_url || "";
  document.getElementById("settingsStockworksBaseUrl").value = settings.stockworks?.base_url?.value || settings.stockworks?.base_url || "";
  document.getElementById("settingsYoutubeClientId").value = settings.youtube?.client_id?.value || settings.youtube?.client_id || "";
}

async function saveRuntimeSettings() {
  const status = document.getElementById("runtimeSettingsStatus");
  const payload = {
    makerworks: {
      base_url: document.getElementById("settingsMakerworksBaseUrl").value,
      api_key: document.getElementById("settingsMakerworksApiKey").value,
    },
    stockworks: {
      base_url: document.getElementById("settingsStockworksBaseUrl").value,
    },
    youtube: {
      client_id: document.getElementById("settingsYoutubeClientId").value,
      client_secret: document.getElementById("settingsYoutubeClientSecret").value,
      refresh_token: document.getElementById("settingsYoutubeRefreshToken").value,
    },
  };
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  status.textContent = res.ok ? "Saved integration settings." : "Unable to save integration settings.";
}
```

- [ ] **Step 5: Run verification**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\printlab
python -m pytest tests/test_settings.py tests/test_settings_api.py -q
python -m ruff check app tests
```

- [ ] **Step 6: Commit Task 5 in PrintLab**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\printlab
git add app/dashboard.html app/static tests/test_settings_api.py
git commit -m "feat: add PrintLab integration settings UI"
```

---

## Task 6: StockWorks Runtime Settings Foundation

**Files:**
- Create: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\app\settings.py`
- Modify: StockWorks model/metadata file used for table creation.
- Test: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\tests\test_settings.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_settings.py` in StockWorks:

```py
from app.settings import get_effective_setting, mask_secret, validate_settings_payload


def test_env_wins_over_database_setting(monkeypatch):
    monkeypatch.setenv("PRINTLAB_BASE_URL", "http://env-printlab")
    assert get_effective_setting("PRINTLAB_BASE_URL", {"PRINTLAB_BASE_URL": "http://db-printlab"}) == "http://env-printlab"


def test_database_setting_used_when_env_missing(monkeypatch):
    monkeypatch.delenv("PRINTLAB_BASE_URL", raising=False)
    assert get_effective_setting("PRINTLAB_BASE_URL", {"PRINTLAB_BASE_URL": "http://db-printlab"}) == "http://db-printlab"


def test_validates_known_settings_only():
    parsed = validate_settings_payload({"PRINTLAB_BASE_URL": "http://printlab:8080"})
    assert parsed["PRINTLAB_BASE_URL"] == "http://printlab:8080"
    try:
        validate_settings_payload({"UNKNOWN": "x"})
    except ValueError as exc:
        assert "Unknown setting" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_masks_secret_values():
    assert mask_secret("secret-value-123456") == "secret********3456"
```

- [ ] **Step 2: Run failing test**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
python -m pytest tests/test_settings.py -q
```

Expected: FAIL because `app.settings` does not exist.

- [ ] **Step 3: Add settings helper**

Create `app/settings.py`:

```py
from __future__ import annotations

import os

ALLOWED_SETTINGS = {
    "PRINTLAB_BASE_URL": {"secret": False, "category": "printlab"},
    "PRINTLAB_API_KEY": {"secret": True, "category": "printlab"},
    "PRINTLAB_BEARER_TOKEN": {"secret": True, "category": "printlab"},
    "PRINTLAB_API_AUTH_HEADER": {"secret": False, "category": "printlab"},
    "ORDERWORKS_BASE_URL": {"secret": False, "category": "orderworks"},
    "ORDERWORKS_ADMIN_USERNAME": {"secret": False, "category": "orderworks"},
    "ORDERWORKS_ADMIN_PASSWORD": {"secret": True, "category": "orderworks"},
    "SMTP_HOST": {"secret": False, "category": "email"},
    "SMTP_PORT": {"secret": False, "category": "email"},
    "SMTP_USERNAME": {"secret": False, "category": "email"},
    "SMTP_PASSWORD": {"secret": True, "category": "email"},
    "LOW_STOCK_DIGEST_RECIPIENTS": {"secret": False, "category": "email"},
    "PRINTLAB_TRACE": {"secret": False, "category": "diagnostics"},
}


def mask_secret(value: str | None) -> str | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if len(raw) < 8:
        return "configured"
    return f"{raw[:6]}********{raw[-4:]}"


def validate_settings_payload(payload: dict[str, object]) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for key, value in payload.items():
        if key not in ALLOWED_SETTINGS:
            raise ValueError(f"Unknown setting: {key}")
        if value is not None and not isinstance(value, str):
            raise ValueError(f"{key} must be a string or null.")
        parsed[key] = (value or "").strip()
    return parsed


def get_effective_setting(key: str, stored: dict[str, str] | None = None, default: str = "") -> str:
    env_value = (os.environ.get(key) or "").strip()
    if env_value:
        return env_value
    return ((stored or {}).get(key) or default).strip()
```

- [ ] **Step 4: Add persistent table using existing DB conventions**

Add an `AppSetting` SQLModel table in the same place as other StockWorks DB models:

```py
class AppSetting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    category: str
    value: str | None = None
    secret: bool = False
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

Use the project’s existing startup table-creation path so this table is created with other StockWorks tables.

- [ ] **Step 5: Run verification**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
python -m pytest tests/test_settings.py -q
```

Expected: tests pass.

- [ ] **Step 6: Commit Task 6 in StockWorks**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
git add app/settings.py app tests/test_settings.py
git commit -m "feat: add StockWorks runtime settings foundation"
```

---

## Task 7: StockWorks Settings API And Integration Refactor

**Files:**
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\app\api.py`
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\app\printlab.py`
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\app\orderworks.py`
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\app\email_digest.py`
- Test: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\tests\test_settings_api.py`

- [ ] **Step 1: Write failing API/refactor tests**

Create `tests/test_settings_api.py`:

```py
from app.settings import validate_settings_payload


def test_printlab_settings_payload_accepts_auth_fields():
    parsed = validate_settings_payload({
        "PRINTLAB_BASE_URL": "http://printlab:8080",
        "PRINTLAB_API_KEY": "key",
    })
    assert parsed["PRINTLAB_BASE_URL"] == "http://printlab:8080"
    assert parsed["PRINTLAB_API_KEY"] == "key"


def test_orderworks_settings_payload_accepts_http_fallback_fields():
    parsed = validate_settings_payload({
        "ORDERWORKS_BASE_URL": "http://orderworks:3001",
        "ORDERWORKS_ADMIN_USERNAME": "admin",
        "ORDERWORKS_ADMIN_PASSWORD": "secret",
    })
    assert parsed["ORDERWORKS_BASE_URL"] == "http://orderworks:3001"
```

- [ ] **Step 2: Run focused tests**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
python -m pytest tests/test_settings.py tests/test_settings_api.py -q
```

Expected: pass if Task 6 registry covers these values.

- [ ] **Step 3: Add authenticated settings routes**

In `app/api.py`, add routes near existing settings tab endpoints:

```py
@app.get("/settings/runtime")
def get_runtime_settings(_: bool = Depends(require_auth), session: Session = Depends(get_session)):
    rows = session.exec(select(AppSetting)).all()
    settings = {}
    for row in rows:
        if row.secret:
            settings[row.key] = {"configured": bool(row.value), "masked": mask_secret(row.value), "source": "database"}
        else:
            settings[row.key] = {"value": row.value or "", "configured": bool(row.value), "source": "database"}
    return {"settings": settings}


@app.patch("/settings/runtime")
def patch_runtime_settings(payload: dict[str, object], _: bool = Depends(require_auth), session: Session = Depends(get_session)):
    parsed = validate_settings_payload(payload)
    for key, value in parsed.items():
        definition = ALLOWED_SETTINGS[key]
        row = session.get(AppSetting, key) or AppSetting(key=key, category=definition["category"], secret=definition["secret"])
        row.value = value
        row.category = definition["category"]
        row.secret = bool(definition["secret"])
        session.add(row)
    session.commit()
    return {"ok": True}
```

- [ ] **Step 4: Refactor PrintLab client source**

In `app/printlab.py`, replace direct `os.environ.get(...)` calls in `get_printlab_client()` with calls to `get_effective_setting(...)`, loading stored values from the DB only in request paths where a session is available. If avoiding DB access in the client factory is simpler, add an optional `settings: dict[str, str]` parameter to `get_printlab_client(settings=None)` and pass loaded settings from `app/api.py`.

- [ ] **Step 5: Refactor OrderWorks and SMTP paths**

Apply the same pattern:

```py
client = get_orderworks_client(settings=runtime_settings)
config = smtp_config_from_settings(runtime_settings)
```

Keep env fallback inside the helper so existing installs do not break.

- [ ] **Step 6: Run verification**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
python -m pytest tests/test_settings.py tests/test_settings_api.py -q
```

Also run the project’s broader configured verification command if present in its README or package metadata.

- [ ] **Step 7: Commit Task 7 in StockWorks**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
git add app/api.py app/printlab.py app/orderworks.py app/email_digest.py tests/test_settings_api.py
git commit -m "feat: add StockWorks runtime settings API"
```

---

## Task 8: StockWorks Settings UI

**Files:**
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\app\templates\index.html`
- Modify: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\app\static\app.js`
- Test: `C:\Users\steph\OneDrive\Documents\GitHub\stockworks\tests\test_settings_ui.py`

- [ ] **Step 1: Write HTML smoke test**

Create `tests/test_settings_ui.py`:

```py
from pathlib import Path


def test_settings_template_contains_runtime_settings_controls():
    html = Path("app/templates/index.html").read_text(encoding="utf-8")
    assert "PrintLab integration" in html
    assert "OrderWorks fallback" in html
    assert "Low-stock email digest" in html
```

- [ ] **Step 2: Run failing test**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
python -m pytest tests/test_settings_ui.py -q
```

Expected: FAIL until controls are added.

- [ ] **Step 3: Add settings controls**

In `app/templates/index.html`, add cards under the existing Settings tab:

```html
<section class="settings-block">
  <h3>PrintLab integration</h3>
  <label>PrintLab URL <input id="runtime-printlab-base-url" type="url"></label>
  <label>API key <input id="runtime-printlab-api-key" type="password"></label>
  <button id="runtime-settings-save" type="button">Save runtime settings</button>
</section>
<section class="settings-block">
  <h3>OrderWorks fallback</h3>
  <label>OrderWorks URL <input id="runtime-orderworks-base-url" type="url"></label>
  <label>Admin username <input id="runtime-orderworks-username" type="text"></label>
  <label>Admin password <input id="runtime-orderworks-password" type="password"></label>
</section>
<section class="settings-block">
  <h3>Low-stock email digest</h3>
  <label>SMTP host <input id="runtime-smtp-host" type="text"></label>
  <label>SMTP password <input id="runtime-smtp-password" type="password"></label>
</section>
```

- [ ] **Step 4: Add JS load/save behavior**

In `app/static/app.js`, add:

```js
async function loadRuntimeSettings() {
  const payload = await api("/settings/runtime");
  const settings = payload.settings || {};
  const setValue = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.value = settings[key]?.value || "";
  };
  setValue("runtime-printlab-base-url", "PRINTLAB_BASE_URL");
  setValue("runtime-orderworks-base-url", "ORDERWORKS_BASE_URL");
  setValue("runtime-orderworks-username", "ORDERWORKS_ADMIN_USERNAME");
  setValue("runtime-smtp-host", "SMTP_HOST");
}

async function saveRuntimeSettings() {
  const value = (id) => document.getElementById(id)?.value || "";
  await api("/settings/runtime", {
    method: "PATCH",
    body: {
      PRINTLAB_BASE_URL: value("runtime-printlab-base-url"),
      PRINTLAB_API_KEY: value("runtime-printlab-api-key"),
      ORDERWORKS_BASE_URL: value("runtime-orderworks-base-url"),
      ORDERWORKS_ADMIN_USERNAME: value("runtime-orderworks-username"),
      ORDERWORKS_ADMIN_PASSWORD: value("runtime-orderworks-password"),
      SMTP_HOST: value("runtime-smtp-host"),
      SMTP_PASSWORD: value("runtime-smtp-password"),
    },
  });
  setMessage("Saved runtime settings.", "success");
}
```

Wire `runtime-settings-save` to `saveRuntimeSettings()` during existing app initialization.

- [ ] **Step 5: Run verification**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
python -m pytest tests/test_settings.py tests/test_settings_api.py tests/test_settings_ui.py -q
```

- [ ] **Step 6: Commit Task 8 in StockWorks**

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
git add app/templates/index.html app/static/app.js tests/test_settings_ui.py
git commit -m "feat: add StockWorks runtime settings UI"
```

---

## Task 9: Cross-App Token Generation And Connection Tests

**Files:**
- MakerWorks: `lib/admin/suite-connection-tests.ts`, `app/api/admin/suite-settings/test/route.ts`, `components/admin/SuiteSetupPanel.tsx`
- PrintLab: `app/routers/settings.py`
- StockWorks: `app/api.py`
- Tests in all three repos.

- [ ] **Step 1: Add MakerWorks connection test helper tests**

Create `tests/suite-connection-tests.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHealthCheckUrl } from '../lib/admin/suite-connection-tests'

test('builds suite service health URLs without double slashes', () => {
  assert.equal(buildHealthCheckUrl('http://printlab:8080/'), 'http://printlab:8080/health')
  assert.equal(buildHealthCheckUrl('http://stockworks:8000'), 'http://stockworks:8000/health')
})
```

- [ ] **Step 2: Implement helper**

Create `lib/admin/suite-connection-tests.ts`:

```ts
export function buildHealthCheckUrl(baseUrl: string) {
  return `${baseUrl.trim().replace(/\/+$/, '')}/health`
}
```

- [ ] **Step 3: Extend connection test route**

Update MakerWorks test route to accept:

```ts
type Body = { service: 'printlab' | 'stockworks' | 'orderworks'; baseUrl: string; apiKey?: string }
```

Send `X-API-Key` when `apiKey` is present. Return only:

```ts
{ ok: boolean, status?: number, service: string, error?: string }
```

- [ ] **Step 4: Add token generation controls**

In MakerWorks UI, add buttons:

```text
Generate PrintLab submit token
Generate StockWorks service token
```

Generated tokens should be displayed once and stored encrypted in MakerWorks. The user then pastes them into PrintLab/StockWorks in-app settings.

- [ ] **Step 5: Verify all three apps**

Run:

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\mkwV2
npm test -- tests/suite-connection-tests.test.ts tests/admin-suite-settings-api.test.ts
npm run typecheck

cd C:\Users\steph\OneDrive\Documents\GitHub\printlab
python -m pytest tests/test_settings.py tests/test_settings_api.py -q

cd C:\Users\steph\OneDrive\Documents\GitHub\stockworks
python -m pytest tests/test_settings.py tests/test_settings_api.py -q
```

- [ ] **Step 6: Commit Task 9 in each repo**

Commit only the repo-local changes in each repo with messages:

```powershell
git commit -m "feat: add suite connection tests"
git commit -m "feat: support suite onboarding tokens"
git commit -m "feat: support suite service token settings"
```

---

## Task 10: Documentation And Migration Cleanup

**Files:**
- MakerWorks: `docs/wiki/Configuration-Reference.md`, `README.md`, `.env.example`
- PrintLab: `README.md`, `.env.example`
- StockWorks: `README.md`, `.env.example`

- [ ] **Step 1: Document minimal env**

Update each README with a section named `Minimal boot environment`.

MakerWorks:

```md
Only these values are required before the app can start safely:

- `DATABASE_URL`
- `JWT_SECRET`
- `STORAGE_DIR`
- optional `SUITE_SETTINGS_ENCRYPTION_KEY`
- initial admin bootstrap values for first install

Payments, email, suite integrations, and notification settings can be configured in Admin -> Suite setup after login.
```

PrintLab:

```md
Only these values are required before the app can start safely:

- `SESSION_SECRET`
- one admin password hash or mounted auth config for first login
- durable `/data` or `/config` volume

MakerWorks, StockWorks, YouTube, callback, and service allowlist settings can be configured in the authenticated Settings screen.
```

StockWorks:

```md
Only these values are required before the app can start safely:

- `SECRET_KEY`
- `DATABASE_URL` for Postgres, or durable local data path for SQLite
- initial admin password for first login

PrintLab, OrderWorks fallback, and SMTP digest settings can be configured in Settings after login.
```

- [ ] **Step 2: Move optional env examples under legacy compatibility**

In `.env.example`, keep optional env values commented and labeled:

```env
# Optional legacy override. In-app settings are preferred.
# PRINTLAB_BASE_URL=
```

- [ ] **Step 3: Add migration notes**

Document:

```md
Environment variables continue to override persisted settings. Remove an env value only after saving and testing the equivalent in-app setting.
```

- [ ] **Step 4: Run docs verification**

MakerWorks:

```powershell
git diff --check
```

PrintLab:

```powershell
git diff --check
```

StockWorks:

```powershell
git diff --check
```

- [ ] **Step 5: Commit docs in each repo**

```powershell
git add README.md docs/wiki/Configuration-Reference.md .env.example
git commit -m "docs: document in-app suite onboarding"
```

---

## Execution Order To Save Codex Credits

Run these as separate sessions:

1. MakerWorks Task 1 only.
2. MakerWorks Task 2 only.
3. MakerWorks Task 3 only.
4. PrintLab Task 4 only.
5. PrintLab Task 5 only.
6. StockWorks Task 6 only.
7. StockWorks Task 7 only.
8. StockWorks Task 8 only.
9. Cross-app Task 9 only.
10. Documentation Task 10 only.

Stop after each task, run verification, and commit. Do not attempt the full suite migration in one Codex session.

## Residual Risks

- A stored encryption key must survive backup/restore. If `SUITE_SETTINGS_ENCRYPTION_KEY` changes, encrypted settings cannot be decrypted.
- Env-overrides-persisted-config avoids breaking existing installs but can confuse operators. UI must show `source: env` clearly.
- PrintLab printer access codes and real printer controls remain operationally sensitive. Onboarding can store credentials, but no setup test should send pause/resume/stop/temperature/fan/print commands.
- YouTube OAuth refresh tokens must be masked and never included in exported non-secret backups.
- StockWorks has module-level env reads today. Refactors must be incremental to avoid import-time behavior changes.

