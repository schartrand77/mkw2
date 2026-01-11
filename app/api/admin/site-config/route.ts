import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { z } from 'zod'
import { resolvePrinterProfile } from '@/lib/printerProfiles'
import { amazonShopItems } from '@/lib/amazon'
import { refreshEffectivePrices } from '@/lib/pricing-cache'
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
  printSpeedCm3PerHour: z.number().nonnegative().optional(),
  energyUsdPerHour: z.number().nonnegative().optional(),
  minimumPriceUsd: z.number().nonnegative().optional(),
  extraHourlyUsdAfterFirst: z.number().nonnegative().optional(),
  fillFactor: z.number().positive().max(2).optional(),
  directUploadUrl: z.union([z.string().url(), z.null()]).optional(),
  favoriteShopLinkIds: z.array(z.string().min(1)).optional(),
  printerProfileKey: z.string().min(2).optional(),
  printerProfileOverrides: z.record(
    z.object({
      nozzleDiameterMm: z.number().min(0.05).max(1.5).optional(),
      materialDensities: z.record(z.number().positive().max(5)).optional(),
    }).strict()
  ).optional(),
})

const CONFIG_ID = 'main'
const SHOP_ITEM_IDS = new Set(amazonShopItems.map((item) => item.id))
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
  'minimumPriceUsd',
  'extraHourlyUsdAfterFirst',
  'fillFactor',
  'printerProfileKey',
  'printerProfileOverrides',
])

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
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const json = await req.json()
    const parsed = schema.parse(json)
    const printerProfileKey = parsed.printerProfileKey ? resolvePrinterProfile(parsed.printerProfileKey).key : undefined
    const overrides = parsed.printerProfileOverrides
      ? JSON.parse(JSON.stringify(parsed.printerProfileOverrides))
      : undefined
    const favoriteShopLinkIds = parsed.favoriteShopLinkIds
      ? Array.from(new Set(parsed.favoriteShopLinkIds.filter((id) => SHOP_ITEM_IDS.has(id))))
      : undefined
    const payload = {
      ...parsed,
      printerProfileKey,
      printerProfileOverrides: overrides,
      favoriteShopLinkIds,
    }
    const cfg = await prisma.siteConfig.upsert({
      where: { id: CONFIG_ID },
      update: payload,
      create: { id: CONFIG_ID, ...payload },
    })
    const shouldRefresh = Object.keys(parsed).some((key) => PRICING_KEYS.has(key))
    if (shouldRefresh) {
      await refreshEffectivePrices(prisma, cfg)
    }
    revalidatePath('/admin')
    revalidatePath('/gear')
    return NextResponse.json({ config: cfg })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
