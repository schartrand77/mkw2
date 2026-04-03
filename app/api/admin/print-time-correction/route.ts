import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { prisma } from '@/lib/db'
import { computePrintTimeCorrection } from '@/lib/print-time-correction'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days') || 90)
  const result = await computePrintTimeCorrection({
    days: Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 90,
  })
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const payload = await req.json().catch(() => ({}))
    const factor = Number(payload?.factor)
    if (!Number.isFinite(factor) || factor <= 0) {
      return NextResponse.json({ error: 'Invalid factor' }, { status: 400 })
    }
    const clamped = Math.max(0.5, Math.min(2.5, factor))
    const cfg = await prisma.siteConfig.upsert({
      where: { id: 'main' },
      update: { printTimeCorrectionFactor: clamped },
      create: { id: 'main', printTimeCorrectionFactor: clamped },
    })
    await prisma.configChangeLog.create({
      data: {
        adminId,
        section: 'print-time-correction',
        changes: { factor: clamped },
      },
    })
    return NextResponse.json({ config: cfg })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to apply correction' }, { status: 400 })
  }
}
