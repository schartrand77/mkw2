type ValidationResult = {
  ok: boolean
  message?: string
}

const WEAK_DEFAULT_VALUES = new Set([
  '',
  'changeme',
  'change-me',
  'change-me-please',
  'password',
  'password123',
  'admin',
  'admin123',
  'replace-with-a-strong-secret',
  'replace_me',
  'default',
  'secret',
  'test',
  'dev',
])

const MIN_JWT_SECRET_LENGTH = 32
const MIN_ADMIN_PASSWORD_LENGTH = 12

function normalize(value: string | null | undefined) {
  return (value || '').trim()
}

function isWeakDefault(value: string) {
  return WEAK_DEFAULT_VALUES.has(value.toLowerCase())
}

export function validateJwtSecret(secret: string | null | undefined): ValidationResult {
  const normalized = normalize(secret)
  if (!normalized) return { ok: false, message: 'JWT_SECRET is not set.' }
  if (normalized.length < MIN_JWT_SECRET_LENGTH) {
    return { ok: false, message: `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters.` }
  }
  if (isWeakDefault(normalized)) {
    return { ok: false, message: 'JWT_SECRET uses a known weak/default value.' }
  }
  return { ok: true }
}

export function validateAdminBootstrapPassword(password: string | null | undefined): ValidationResult {
  const normalized = normalize(password)
  if (!normalized) return { ok: true }
  if (normalized.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return { ok: false, message: `ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.` }
  }
  if (isWeakDefault(normalized)) {
    return { ok: false, message: 'ADMIN_PASSWORD uses a known weak/default value.' }
  }
  return { ok: true }
}

export function assertProductionSecurityConfig() {
  if (process.env.NODE_ENV !== 'production') return

  const jwtResult = validateJwtSecret(process.env.JWT_SECRET)
  if (!jwtResult.ok) {
    throw new Error(`Insecure production configuration: ${jwtResult.message}`)
  }

  const adminPasswordResult = validateAdminBootstrapPassword(process.env.ADMIN_PASSWORD)
  if (!adminPasswordResult.ok) {
    throw new Error(`Insecure production configuration: ${adminPasswordResult.message}`)
  }
}
