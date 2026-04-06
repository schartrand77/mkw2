export type WebhookAuthMode = 'bearer' | 'signed'

export type WebhookEndpointPosture = {
  id: string
  label: string
  path: string
  secretEnvKeys: string[]
  secretConfigured: boolean
  authModes: WebhookAuthMode[]
  querySecretEnabled: boolean
  signatureHeaderNames: string[]
  secretHeaderNames: string[]
  replayToleranceMinutes: number
  risk: 'ok' | 'warn'
  notes: string[]
}

export type WebhookPortalSnapshot = {
  endpoints: WebhookEndpointPosture[]
  summary: {
    total: number
    configured: number
    warnings: number
  }
}

export type WebhookDocSection = {
  id: string
  title: string
  body: string
  bullets: string[]
}

function hasAnyEnv(env: Record<string, string | undefined>, keys: string[]) {
  return keys.some((key) => {
    const value = env[key]
    return Boolean(value && value.trim())
  })
}

export function buildWebhookPortalSnapshot(env: Record<string, string | undefined> = process.env) {
  const endpoints: WebhookEndpointPosture[] = [
    {
      id: 'makerworks-inbound',
      label: 'MakerWorks inbound job updates',
      path: '/api/makerworks/jobs',
      secretEnvKeys: ['MAKERWORKS_INBOUND_SECRET'],
      secretConfigured: hasAnyEnv(env, ['MAKERWORKS_INBOUND_SECRET']),
      authModes: ['bearer', 'signed'] as WebhookAuthMode[],
      querySecretEnabled: true,
      signatureHeaderNames: ['x-makerworks-signature-v1', 'makerworks-signature-v1'],
      secretHeaderNames: ['authorization: Bearer <secret>', 'x-makerworks-secret'],
      replayToleranceMinutes: 5,
      risk: 'ok',
      notes: [
        'Accepts either bearer-secret auth or HMAC signature verification.',
        'Timestamped signatures expire after five minutes.',
        'Legacy query-string secret support remains enabled for compatibility.',
      ],
    },
    {
      id: 'printlab-callback',
      label: 'PrintLab callback',
      path: '/api/printlab/jobs/[jobId]',
      secretEnvKeys: ['PRINTLAB_WEBHOOK_SECRET', 'MAKERWORKS_INBOUND_SECRET'],
      secretConfigured: hasAnyEnv(env, ['PRINTLAB_WEBHOOK_SECRET', 'MAKERWORKS_INBOUND_SECRET']),
      authModes: ['bearer', 'signed'] as WebhookAuthMode[],
      querySecretEnabled: true,
      signatureHeaderNames: ['x-printlab-signature-v1', 'printlab-signature-v1', 'x-makerworks-signature-v1'],
      secretHeaderNames: ['authorization: Bearer <secret>', 'x-printlab-secret', 'x-makerworks-secret'],
      replayToleranceMinutes: 5,
      risk: 'ok',
      notes: [
        'Accepts dedicated PrintLab secret or shared inbound secret fallback.',
        'Rejects unexpected callback sources after payload validation.',
        'Legacy query-string secret support remains enabled for compatibility.',
      ],
    },
  ].map((endpoint) => ({
    ...endpoint,
    risk: endpoint.secretConfigured ? 'warn' : 'warn',
    notes: [
      ...endpoint.notes,
      endpoint.secretConfigured
        ? 'Secret is configured, but query-token fallback should still be treated as a migration target.'
        : `Missing secret configuration for ${endpoint.secretEnvKeys.join(' or ')}.`,
    ],
  }))

  const configured = endpoints.filter((entry) => entry.secretConfigured).length
  const warnings = endpoints.filter((entry) => entry.risk !== 'ok').length

  return {
    endpoints,
    summary: {
      total: endpoints.length,
      configured,
      warnings,
    },
  } satisfies WebhookPortalSnapshot
}

export function getWebhookDocSections(): WebhookDocSection[] {
  return [
    {
      id: 'auth-model',
      title: 'Authentication model',
      body: 'Webhook endpoints support bearer-secret auth for compatibility and HMAC signatures for stronger verification.',
      bullets: [
        'Prefer timestamped HMAC headers over query-string secrets.',
        'Use a dedicated PrintLab secret when possible instead of only the shared inbound secret.',
        'Treat missing secrets as a deployment blocker for callback-dependent flows.',
      ],
    },
    {
      id: 'rotation',
      title: 'Secret rotation playbook',
      body: 'Rotation should happen by staging the new secret in the upstream sender first, validating delivery, then removing legacy fallbacks.',
      bullets: [
        'Update `.env` and upstream callback senders in the same maintenance window.',
        'Validate from the admin webhook/API page and release health after rotation.',
        'Remove query-token usage from upstream systems once signature headers are confirmed.',
      ],
    },
    {
      id: 'contracts',
      title: 'Contract expectations',
      body: 'Inbound payloads are schema-validated and rejected if they are malformed, stale, unsigned, or mapped to unknown jobs.',
      bullets: [
        'MakerWorks inbound route validates payment/job payload shape before persistence.',
        'PrintLab callback route validates source and status transitions before updating local jobs.',
        'Operational failures are reflected in callback success/failure metrics for release-health tracking.',
      ],
    },
  ]
}
