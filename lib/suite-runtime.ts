import { prisma } from '@/lib/db'
import {
  SUITE_SETTING_DEFINITIONS,
  resolveRuntimeSettingsFromRows,
  resolveFirstEnv,
  type RuntimeSettingRow,
  type RuntimeSettingValue,
  type SuiteSettingKey,
} from '@/lib/admin/suite-settings'

function encryptionKey() {
  return process.env.SUITE_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || ''
}

export async function getEffectiveSuiteRuntimeSettings(keys?: SuiteSettingKey[]): Promise<Record<SuiteSettingKey, RuntimeSettingValue>> {
  let rows: RuntimeSettingRow[] = []
  const requestedKeys = keys && keys.length ? keys : Object.keys(SUITE_SETTING_DEFINITIONS) as SuiteSettingKey[]
  const needsDatabase = requestedKeys.some((key) => !resolveFirstEnv(SUITE_SETTING_DEFINITIONS[key].env, process.env))
  if (needsDatabase) {
    try {
      rows = await prisma.runtimeSetting.findMany()
    } catch {
      rows = []
    }
  }
  return resolveRuntimeSettingsFromRows({
    rows,
    env: process.env,
    encryptionKey: encryptionKey(),
  })
}

export async function getEffectiveSuiteRuntimeSetting(key: SuiteSettingKey) {
  const settings = await getEffectiveSuiteRuntimeSettings([key])
  return settings[key]
}
