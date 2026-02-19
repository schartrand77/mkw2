import { createHash } from 'crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'

const ADMIN_AUDIT_CHAIN_LOCK = 98234721

export type AdminAuditInput = {
  adminId: string
  action: string
  targetType?: string | null
  targetId?: string | null
  requestMethod: string
  requestPath: string
  requestIp?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function resolveClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return null
}

export function getAdminAuditRequestMeta(req: Request) {
  const url = new URL(req.url)
  return {
    requestMethod: req.method,
    requestPath: url.pathname,
    requestIp: resolveClientIp(req),
    userAgent: (req.headers.get('user-agent') || '').trim().slice(0, 512) || null,
  }
}

export async function recordAdminAuditEvent(input: AdminAuditInput, client: PrismaClient | Prisma.TransactionClient = prisma) {
  const admin = await client.user.findUnique({
    where: { id: input.adminId },
    select: { id: true, email: true, name: true },
  })
  if (!admin) {
    throw new Error('Admin actor not found for audit log')
  }

  const now = new Date()
  await (client as any).$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_AUDIT_CHAIN_LOCK})`
  const previous = await client.adminAuditEvent.findFirst({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { eventHash: true },
  })
  const prevHash = previous?.eventHash || null
  const hashMaterial = stableJson({
    prevHash,
    createdAt: now.toISOString(),
    adminId: admin.id,
    adminEmail: admin.email || null,
    adminName: admin.name || null,
    action: input.action,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    requestMethod: input.requestMethod,
    requestPath: input.requestPath,
    requestIp: input.requestIp || null,
    userAgent: input.userAgent || null,
    metadata: input.metadata || null,
  })
  const eventHash = createHash('sha256').update(hashMaterial).digest('hex')
  const metadataValue =
    input.metadata === undefined
      ? undefined
      : input.metadata === null
        ? Prisma.DbNull
        : input.metadata

  await client.adminAuditEvent.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email || null,
      adminName: admin.name || null,
      action: input.action,
      targetType: input.targetType || null,
      targetId: input.targetId || null,
      requestMethod: input.requestMethod,
      requestPath: input.requestPath,
      requestIp: input.requestIp || null,
      userAgent: input.userAgent || null,
      metadata: metadataValue,
      prevHash,
      eventHash,
      createdAt: now,
    },
  })
}
