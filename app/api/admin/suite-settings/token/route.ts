import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { SUITE_SETTING_DEFINITIONS, encryptSecretValue, generateSuiteToken, type SuiteSettingKey } from '@/lib/admin/suite-settings'

export const dynamic = 'force-dynamic'

const TOKEN_TARGETS: Record<string, { key: SuiteSettingKey; prefix: string }> = {
  printlab: { key: 'printlabSubmitApiKey', prefix: 'printlab_submit' },
  stockworks: { key: 'stockworksServiceApiKey', prefix: 'stockworks_service' },
}

function encryptionKey() {
  return process.env.SUITE_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || ''
}

export async function POST(req: NextRequest) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const body = await req.json().catch(() => ({}))
  const target = TOKEN_TARGETS[String(body?.target || '').trim()]
  if (!target) return NextResponse.json({ error: 'Token target must be printlab or stockworks.' }, { status: 400 })
  const key = encryptionKey()
  if (!key) return NextResponse.json({ error: 'SUITE_SETTINGS_ENCRYPTION_KEY or JWT_SECRET is required before saving suite tokens.' }, { status: 400 })
  const token = generateSuiteToken(target.prefix)
  const def = SUITE_SETTING_DEFINITIONS[target.key]
  await prisma.runtimeSetting.upsert({
    where: { key: target.key },
    update: {
      value: encryptSecretValue(token, key),
      category: def.category,
      secret: true,
      source: 'database',
      updatedBy: adminId,
    },
    create: {
      key: target.key,
      value: encryptSecretValue(token, key),
      category: def.category,
      secret: true,
      source: 'database',
      updatedBy: adminId,
    },
  })
  return NextResponse.json({ token, key: target.key })
}
