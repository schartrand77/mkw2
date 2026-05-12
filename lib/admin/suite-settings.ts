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

export type SuiteSettingDefinition = {
  category: string
  secret: boolean
  env?: string[]
}

export const SUITE_SETTING_DEFINITIONS = {
  stripeSecretKey: { category: 'payments', secret: true, env: ['STRIPE_SECRET_KEY'] },
  stripeWebhookSecret: { category: 'payments', secret: true, env: ['STRIPE_WEBHOOK_SECRET'] },
  stripeShippingRateId: { category: 'payments', secret: false, env: ['STRIPE_SHIPPING_RATE_ID'] },
  paypalClientId: { category: 'payments', secret: false, env: ['PAYPAL_CLIENT_ID'] },
  paypalClientSecret: { category: 'payments', secret: true, env: ['PAYPAL_CLIENT_SECRET'] },
  smtpHost: { category: 'email', secret: false, env: ['SMTP_HOST'] },
  smtpPort: { category: 'email', secret: false, env: ['SMTP_PORT'] },
  smtpUser: { category: 'email', secret: false, env: ['SMTP_USER'] },
  smtpPassword: { category: 'email', secret: true, env: ['SMTP_PASSWORD'] },
  receiptFromEmail: { category: 'email', secret: false, env: ['RECEIPT_FROM_EMAIL'] },
  receiptReplyToEmail: { category: 'email', secret: false, env: ['RECEIPT_REPLY_TO_EMAIL'] },
  printlabBaseUrl: { category: 'printlab', secret: false, env: ['PRINTLAB_BASE_URL', 'BAMBU_VIEW_BASE_URL'] },
  printlabApiKey: { category: 'printlab', secret: true, env: ['PRINTLAB_API_KEY', 'BAMBU_VIEW_API_KEY'] },
  printlabSubmitApiKey: { category: 'printlab', secret: true, env: ['MAKERWORKS_SUBMIT_API_KEY'] },
  printlabSessionCookie: { category: 'printlab', secret: true, env: ['PRINTLAB_SESSION_COOKIE', 'BAMBU_VIEW_SESSION_COOKIE'] },
  printlabAuthHeader: { category: 'printlab', secret: true, env: ['PRINTLAB_AUTH_HEADER', 'BAMBU_VIEW_AUTH_HEADER'] },
  stockworksBaseUrl: { category: 'stockworks', secret: false, env: ['STOCKWORKS_BASE_URL'] },
  stockworksUsername: { category: 'stockworks', secret: false, env: ['STOCKWORKS_ADMIN_USERNAME', 'STOCKWORKS_USERNAME'] },
  stockworksPassword: { category: 'stockworks', secret: true, env: ['STOCKWORKS_ADMIN_PASSWORD', 'STOCKWORKS_PASSWORD'] },
  stockworksServiceApiKey: { category: 'stockworks', secret: true, env: ['STOCKWORKS_API_KEY'] },
  orderworksBaseUrl: { category: 'orderworks', secret: false, env: ['ORDERWORKS_BASE_URL'] },
  orderworksUsername: { category: 'orderworks', secret: false, env: ['ORDERWORKS_USERNAME'] },
  orderworksPassword: { category: 'orderworks', secret: true, env: ['ORDERWORKS_PASSWORD'] },
  discordBotToken: { category: 'notifications', secret: true, env: ['DISCORD_ADMIN_BOT_TOKEN', 'DISCORD_BOT_TOKEN'] },
  discordAdminChannelId: { category: 'notifications', secret: false, env: ['DISCORD_ADMIN_CHANNEL_ID'] },
  vapidPublicKey: { category: 'notifications', secret: false, env: ['VAPID_PUBLIC_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY'] },
  vapidPrivateKey: { category: 'notifications', secret: true, env: ['VAPID_PRIVATE_KEY'] },
  youtubeUploadEnabled: { category: 'youtube', secret: false, env: ['YOUTUBE_UPLOAD_ENABLED'] },
  youtubeClientId: { category: 'youtube', secret: false, env: ['YOUTUBE_CLIENT_ID'] },
  youtubeClientSecret: { category: 'youtube', secret: true, env: ['YOUTUBE_CLIENT_SECRET'] },
  youtubeRefreshToken: { category: 'youtube', secret: true, env: ['YOUTUBE_REFRESH_TOKEN'] },
  youtubePrivacyStatus: { category: 'youtube', secret: false, env: ['YOUTUBE_PRIVACY_STATUS'] },
} as const satisfies Record<string, SuiteSettingDefinition>

export type SuiteSettingKey = keyof typeof SUITE_SETTING_DEFINITIONS

export type ValidatedSuiteSetting = {
  value: string
  category: string
  secret: boolean
}

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

export function resolveFirstEnv(keys: readonly string[] = [], env: Record<string, string | undefined> = process.env) {
  for (const key of keys) {
    const value = env[key]
    if (value && value.trim()) return value.trim()
  }
  return ''
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

export function validateSuiteSettingsPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Settings payload must be an object.')
  const result: Partial<Record<SuiteSettingKey, ValidatedSuiteSetting>> = {}
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

export function generateSuiteToken(prefix: string) {
  const normalized = prefix.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'suite'
  return `${normalized}_${crypto.randomBytes(24).toString('base64url')}`
}
