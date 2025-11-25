import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { z } from 'zod'
import { resolvePrinterProfile } from '@/lib/printerProfiles'
export const dynamic = 'force-dynamic'

const schema = z.object({
  plaPricePerKgUsd: z.number().nonnegative().optional(),
  petgPricePerKgUsd: z.number().nonnegative().optional(),
  allowAnonymousUploads: z.boolean().optional(),
  printSpeedCm3PerHour: z.number().nonnegative().optional(),
  energyUsdPerHour: z.number().nonnegative().optional(),
  minimumPriceUsd: z.number().nonnegative().optional(),
  extraHourlyUsdAfterFirst: z.number().nonnegative().optional(),
  fillFactor: z.number().positive().max(2).optional(),
  directUploadUrl: z.union([z.string().url(), z.null()]).optional(),
  printerProfileKey: z.string().min(2).optional(),
  printerProfileOverrides: z.record(
    z.object({
      nozzleDiameterMm: z.number().min(0.05).max(1.5).optional(),
      materialDensities: z.record(z.number().positive().max(5)).optional(),
    }).strict()
  ).optional(),
})

const CONFIG_ID = 'main'

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
    const payload = {
      ...parsed,
      printerProfileKey,
      printerProfileOverrides: overrides,
    }
    const cfg = await prisma.siteConfig.upsert({
      where: { id: CONFIG_ID },
      update: payload,
      create: { id: CONFIG_ID, ...payload },
    })
    revalidatePath('/admin')
    return NextResponse.json({ config: cfg })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
