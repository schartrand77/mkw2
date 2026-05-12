import SuiteSetupPanel from '@/components/admin/SuiteSetupPanel'
import { prisma } from '@/lib/db'
import {
  SUITE_SETTING_DEFINITIONS,
  decryptSecretValue,
  mergeRuntimeSetting,
  redactRuntimeSettings,
  resolveFirstEnv,
  type SuiteSettingKey,
} from '@/lib/admin/suite-settings'

export const dynamic = 'force-dynamic'

function encryptionKey() {
  return process.env.SUITE_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || ''
}

export default async function SuiteSetupPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Suite setup</h1>
        <p className="mt-1 text-sm text-slate-400">Onboard MakerWorks, PrintLab, StockWorks, and optional media integrations.</p>
      </div>
      <SuiteSetupPanel initialSettings={redactRuntimeSettings(effective)} />
    </div>
  )
}
