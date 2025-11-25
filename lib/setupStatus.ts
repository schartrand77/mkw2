type Severity = 'error' | 'warning'

export interface SetupIssue {
  id: string
  severity: Severity
  title: string
  detail: string
  action: string
}

export interface SetupStatus {
  checkedAt: string
  issues: SetupIssue[]
  blockingIssues: SetupIssue[]
  warnings: SetupIssue[]
  hasBlockingIssues: boolean
}

const MIN_JWT_LENGTH = 32

function hasValue(raw: string | undefined) {
  return !!raw && raw.trim().length > 0
}

function clean(raw: string | undefined) {
  return (raw || '').trim()
}

function addIssue(list: SetupIssue[], issue: SetupIssue) {
  list.push(issue)
}

export function getSetupStatus(): SetupStatus {
  const issues: SetupIssue[] = []
  const dbUrl = clean(process.env.DATABASE_URL)
  if (!dbUrl) {
    addIssue(issues, {
      id: 'database-url',
      severity: 'error',
      title: 'DATABASE_URL missing',
      detail: 'The app cannot boot without a Postgres connection string.',
      action: 'Set DATABASE_URL to your Postgres 15+ connection URI (e.g., postgresql://user:pass@host:5432/db?schema=public).',
    })
  }

  const jwt = clean(process.env.JWT_SECRET)
  if (!jwt || jwt.length < MIN_JWT_LENGTH) {
    addIssue(issues, {
      id: 'jwt-secret',
      severity: 'error',
      title: 'JWT_SECRET is too short or undefined',
      detail: 'Sessions and API auth tokens rely on a long random signing secret.',
      action: 'Generate a random string at least 32 characters long and assign it to JWT_SECRET.',
    })
  }

  const baseUrl = clean(process.env.BASE_URL)
  if (!baseUrl) {
    addIssue(issues, {
      id: 'base-url-missing',
      severity: 'error',
      title: 'BASE_URL missing',
      detail: 'Redirect URLs, cookies, and email links require a canonical base URL.',
      action: 'Set BASE_URL to the public HTTPS origin of this MakerWorks instance (e.g., https://prints.example.com).',
    })
  } else {
    try {
      const parsed = new URL(baseUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('invalid protocol')
      }
      if (process.env.NODE_ENV === 'production' && parsed.hostname === 'localhost') {
        addIssue(issues, {
          id: 'base-url-localhost',
          severity: 'warning',
          title: 'BASE_URL points to localhost',
          detail: 'Using localhost in production breaks verification links for remote users.',
          action: 'Update BASE_URL to a domain reachable by your customers.',
        })
      }
    } catch {
      addIssue(issues, {
        id: 'base-url-invalid',
        severity: 'error',
        title: 'BASE_URL is not a valid URL',
        detail: `The provided value ("${baseUrl}") is not a valid http(s) URL.`,
        action: 'Provide a valid URL that includes protocol, host, and optional port, e.g., https://prints.example.com.',
      })
    }
  }

  const adminEmail = clean(process.env.ADMIN_EMAIL)
  const adminPassword = clean(process.env.ADMIN_PASSWORD)
  if (!adminEmail || !adminPassword) {
    addIssue(issues, {
      id: 'bootstrap-admin',
      severity: 'warning',
      title: 'Bootstrap admin credentials missing',
      detail: 'The first admin user will not be seeded without ADMIN_EMAIL and ADMIN_PASSWORD.',
      action: 'Set ADMIN_EMAIL, ADMIN_PASSWORD, and optionally ADMIN_NAME so the container can create the bootstrap admin on first run.',
    })
  }

  const stripeSecret = clean(process.env.STRIPE_SECRET_KEY)
  const stripePublic = clean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  if (stripeSecret || stripePublic) {
    if (!stripeSecret || !stripePublic) {
      addIssue(issues, {
        id: 'stripe-partial',
        severity: 'error',
        title: 'Stripe keys incomplete',
        detail: 'Stripe checkout requires both STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.',
        action: 'Copy both secret + publishable keys from the Stripe dashboard (same mode) so payments can initialize.',
      })
    }
  } else {
    addIssue(issues, {
      id: 'stripe-disabled',
      severity: 'warning',
      title: 'Stripe keys absent (checkout disabled)',
      detail: 'Leave both fields blank to run MakerWorks as a catalog only, or provide keys to take card payments.',
      action: 'When you are ready to charge customers, add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.',
    })
  }

  const s3Bucket = clean(process.env.S3_BUCKET)
  const s3Region = clean(process.env.S3_REGION)
  const s3Key = clean(process.env.S3_ACCESS_KEY_ID)
  const s3Secret = clean(process.env.S3_SECRET_ACCESS_KEY)
  const usingS3 = hasValue(s3Bucket) || hasValue(s3Region) || hasValue(s3Key) || hasValue(s3Secret)
  if (usingS3) {
    if (!s3Bucket || !s3Region || !s3Key || !s3Secret) {
      addIssue(issues, {
        id: 's3-partial',
        severity: 'error',
        title: 'S3 configuration incomplete',
        detail: 'Uploads/backups configured for S3-compatible storage require bucket, region, access key, and secret.',
        action: 'Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY (or clear them all to fall back to local storage).',
      })
    }
  } else {
    addIssue(issues, {
      id: 's3-optional',
      severity: 'warning',
      title: 'S3 storage disabled',
      detail: 'MakerWorks is using local disk for uploads and backups.',
      action: 'Provide the S3 variables when you want uploads written to external object storage.',
    })
  }

  const blockingIssues = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')

  return {
    checkedAt: new Date().toISOString(),
    issues,
    blockingIssues,
    warnings,
    hasBlockingIssues: blockingIssues.length > 0,
  }
}
