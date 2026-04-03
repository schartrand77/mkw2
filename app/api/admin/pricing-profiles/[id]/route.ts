import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { z } from 'zod'
import { resolvePrinterProfile } from '@/lib/printerProfiles'

export const dynamic = 'force-dynamic'

const numberField = z.number().nonnegative().nullable().optional()

const overridesSchema = z.record(
  z.object({
    nozzleDiameterMm: z.number().min(0.05).max(1.5).nullable().optional(),
    materialDensities: z.record(z.number().positive().max(5)).nullable().optional(),
  }).strict()
).nullable().optional()

const dataSchema = z.object({
  plaPricePerKgUsd: numberField,
  petgPricePerKgUsd: numberField,
  absPricePerKgUsd: numberField,
  asaPricePerKgUsd: numberField,
  tpuPricePerKgUsd: numberField,
  pa6PricePerKgUsd: numberField,
  pa12PricePerKgUsd: numberField,
  nylonPricePerKgUsd: numberField,
  pcPricePerKgUsd: numberField,
  resinPricePerKgUsd: numberField,
  printSpeedCm3PerHour: numberField,
  energyUsdPerHour: numberField,
  machineUsdPerHour: numberField,
  laborUsdPerHour: numberField,
  minimumPriceUsd: numberField,
  extraHourlyUsdAfterFirst: numberField,
  fillFactor: z.number().positive().max(2).nullable().optional(),
  printerProfileKey: z.string().min(2).nullable().optional(),
  printerProfileOverrides: overridesSchema,
}).strict()

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(240).nullable().optional(),
  data: dataSchema.optional(),
}).strict()

function sanitizeOverrides(raw?: Record<string, any> | null) {
  if (!raw || typeof raw !== 'object') return undefined
  const cleaned: Record<string, any> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue
    const entry: Record<string, any> = {}
    if (value.nozzleDiameterMm != null && Number.isFinite(Number(value.nozzleDiameterMm)) && Number(value.nozzleDiameterMm) > 0) {
      entry.nozzleDiameterMm = Number(value.nozzleDiameterMm)
    }
    if (value.materialDensities && typeof value.materialDensities === 'object') {
      const densities: Record<string, number> = {}
      for (const [matKey, density] of Object.entries(value.materialDensities)) {
        const num = Number(density)
        if (Number.isFinite(num) && num > 0) densities[matKey.toUpperCase()] = num
      }
      if (Object.keys(densities).length) entry.materialDensities = densities
    }
    if (Object.keys(entry).length) cleaned[key] = entry
  }
  return Object.keys(cleaned).length ? cleaned : undefined
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const resolved = await params
    const json = await req.json()
    const parsed = patchSchema.parse(json)
    const data = parsed.data
      ? {
        ...parsed.data,
        printerProfileKey: parsed.data.printerProfileKey
          ? resolvePrinterProfile(parsed.data.printerProfileKey).key
          : undefined,
        printerProfileOverrides: sanitizeOverrides(parsed.data.printerProfileOverrides as any),
      }
      : undefined
    const profile = await prisma.pricingProfile.update({
      where: { id: resolved.id },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(data ? { data } : {}),
      },
    })
    return NextResponse.json({ profile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const resolved = await params
    await prisma.pricingProfile.delete({ where: { id: resolved.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to delete profile' }, { status: 400 })
  }
}
