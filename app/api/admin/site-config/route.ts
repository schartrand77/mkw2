import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { z } from 'zod'
import { resolvePrinterProfile } from '@/lib/printerProfiles'
import { refreshEffectivePrices } from '@/lib/pricing-cache'
import { getAdminAuditRequestMeta, recordAdminAuditEvent } from '@/lib/admin-audit'
import { CACHE_TAGS } from '@/lib/cache-policy'
export const dynamic = 'force-dynamic'

const schema = z.object({
  plaPricePerKgUsd: z.number().nonnegative().optional(),
  petgPricePerKgUsd: z.number().nonnegative().optional(),
  absPricePerKgUsd: z.number().nonnegative().optional(),
  asaPricePerKgUsd: z.number().nonnegative().optional(),
  tpuPricePerKgUsd: z.number().nonnegative().optional(),
  pa6PricePerKgUsd: z.number().nonnegative().optional(),
  pa12PricePerKgUsd: z.number().nonnegative().optional(),
  nylonPricePerKgUsd: z.number().nonnegative().optional(),
  pcPricePerKgUsd: z.number().nonnegative().optional(),
  resinPricePerKgUsd: z.number().nonnegative().optional(),
  allowAnonymousUploads: z.boolean().optional(),
  allowModelDownloads: z.boolean().optional(),
  printSpeedCm3PerHour: z.number().nonnegative().optional(),
  energyUsdPerHour: z.number().nonnegative().optional(),
  machineUsdPerHour: z.number().nonnegative().optional(),
  laborUsdPerHour: z.number().nonnegative().optional(),
  minimumPriceUsd: z.number().nonnegative().optional(),
  minimumOrderSubtotalUsd: z.number().nonnegative().optional(),
  minimumOrderNotes: z.string().max(300).optional(),
  printTimeCorrectionFactor: z.number().min(0.5).max(2.5).optional(),
  extraHourlyUsdAfterFirst: z.number().nonnegative().optional(),
  demandSurgeMultiplier: z.number().positive().max(5).optional(),
  rushMultiplier: z.number().positive().max(5).optional(),
  batchDiscountTiers: z.array(z.object({
    minQty: z.number().int().min(1),
    percent: z.number().min(0).max(100),
  })).optional(),
  fillFactor: z.number().positive().max(2).optional(),
  directUploadUrl: z.union([z.string().url(), z.null()]).optional(),
  showApplePayBadge: z.boolean().optional(),
  showGooglePayBadge: z.boolean().optional(),
  printerProfileKey: z.string().min(2).optional(),
  printerProfileOverrides: z.record(
    z.object({
      nozzleDiameterMm: z.number().min(0.05).max(1.5).optional(),
      materialDensities: z.record(z.number().positive().max(5)).optional(),
    }).strict()
  ).optional(),
})

const CONFIG_ID = 'main'
const PRICING_KEYS = new Set([
  'plaPricePerKgUsd',
  'petgPricePerKgUsd',
  'absPricePerKgUsd',
  'asaPricePerKgUsd',
  'tpuPricePerKgUsd',
  'pa6PricePerKgUsd',
  'pa12PricePerKgUsd',
  'nylonPricePerKgUsd',
  'pcPricePerKgUsd',
  'resinPricePerKgUsd',
  'printSpeedCm3PerHour',
  'energyUsdPerHour',
  'machineUsdPerHour',
  'laborUsdPerHour',
  'minimumPriceUsd',
  'minimumOrderSubtotalUsd',
  'minimumOrderNotes',
  'printTimeCorrectionFactor',
  'extraHourlyUsdAfterFirst',
  'demandSurgeMultiplier',
  'rushMultiplier',
  'batchDiscountTiers',
  'fillFactor',
  'printerProfileKey',
  'printerProfileOverrides',
])

function valuesMatch(a: unknown, b: unknown) {
  if (a === b) return true
  const aJson = typeof a === 'object' && a !== null ? JSON.stringify(a) : null
  const bJson = typeof b === 'object' && b !== null ? JSON.stringify(b) : null
  if (aJson !== null || bJson !== null) return aJson === bJson
  return false
}

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const cfg = await prisma.siteConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  })
  return NextResponse.json({ config: cfg })
}

export async function PATCH(req: NextRequest) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const existing = await prisma.siteConfig.findUnique({ where: { id: CONFIG_ID } })
    const json = await req.json()
    const parsed = schema.parse(json)
    const printerProfileKey = parsed.printerProfileKey ? resolvePrinterProfile(parsed.printerProfileKey).key : undefined
    const overrides = parsed.printerProfileOverrides
      ? JSON.parse(JSON.stringify(parsed.printerProfileOverrides))
      : undefined
    const payload = {
      ...parsed,
      printerProfileKey,
      printerProfileOverrides: overrides,
    }
    const parsedKeys = Object.keys(parsed)
    const changeSet: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of parsedKeys) {
      const before = existing ? (existing as any)[key] : undefined
      const after = (payload as any)[key]
      if (!valuesMatch(before, after)) {
        changeSet[key] = { from: before ?? null, to: after ?? null }
      }
    }
    const changePayload = Object.keys(changeSet).length
      ? JSON.parse(JSON.stringify({ keys: Object.keys(changeSet), updates: changeSet }))
      : null

    const [cfg] = await prisma.$transaction([
      prisma.siteConfig.upsert({
        where: { id: CONFIG_ID },
        update: payload,
        create: { id: CONFIG_ID, ...payload },
      }),
      changePayload
        ? prisma.configChangeLog.create({
          data: {
            adminId,
            section: 'site-config',
            changes: changePayload,
          },
        })
        : prisma.$executeRaw`SELECT 1`,
    ])
    const pricingChanged = parsedKeys.some((key) => {
      if (!PRICING_KEYS.has(key)) return false
      if (!existing) return true
      return !valuesMatch((parsed as any)[key], (existing as any)[key])
    })
    if (pricingChanged) {
      await refreshEffectivePrices(prisma, cfg)
    }
    const requestMeta = getAdminAuditRequestMeta(req)
    await recordAdminAuditEvent({
      adminId,
      action: 'admin.site_config.update',
      targetType: 'site_config',
      targetId: CONFIG_ID,
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: changePayload || ({ keys: [] } as any),
    })
    revalidatePath('/admin')
    revalidatePath('/products')
    revalidateTag(CACHE_TAGS.discoverModels, 'max')
    revalidateTag(CACHE_TAGS.featuredModels, 'max')
    revalidateTag(CACHE_TAGS.homePage, 'max')
    return NextResponse.json({ config: cfg })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
