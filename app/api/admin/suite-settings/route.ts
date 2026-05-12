import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import {
  SUITE_SETTING_DEFINITIONS,
  decryptSecretValue,
  encryptSecretValue,
  mergeRuntimeSetting,
  redactRuntimeSettings,
  resolveFirstEnv,
  validateSuiteSettingsPayload,
  type SuiteSettingKey,
} from '@/lib/admin/suite-settings'

export const dynamic = 'force-dynamic'

function encryptionKey() {
  return process.env.SUITE_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || ''
}

async function loadRedactedSettings() {
  const key = encryptionKey()
  const rows = await prisma.runtimeSetting.findMany()
  const stored = new Map(rows.map((row: any) => [row.key, row]))
  const effective: Record<string, { value: string; source: 'env' | 'database' | 'unset'; secret: boolean }> = {}

  for (const [settingKey, def] of Object.entries(SUITE_SETTING_DEFINITIONS) as Array<[SuiteSettingKey, typeof SUITE_SETTING_DEFINITIONS[SuiteSettingKey]]>) {
    const row = stored.get(settingKey)
    let storedValue = row?.value || ''
    if (storedValue && row?.secret) {
      try {
        storedValue = key ? decryptSecretValue(storedValue, key) : 'configured'
      } catch {
        storedValue = 'configured'
      }
    }
    effective[settingKey] = mergeRuntimeSetting({
      envValue: resolveFirstEnv(def.env),
      storedValue,
      secret: def.secret,
    })
  }

  return redactRuntimeSettings(effective)
}

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const settings = await loadRedactedSettings()
  return NextResponse.json({ settings })
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
    if (writes.length) await prisma.$transaction(writes)
    const settings = await loadRedactedSettings()
    return NextResponse.json({ ok: true, settings })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
