import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  productsModelsLabel: z.string().trim().min(1).max(60).optional().nullable(),
  productsMerchLabel: z.string().trim().min(1).max(60).optional().nullable(),
})

const CONFIG_ID = 'main'

export async function GET() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  const config = await prisma.siteConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
    select: {
      productsModelsLabel: true,
      productsMerchLabel: true,
    },
  })
  return NextResponse.json({ config })
}

export async function PATCH(req: NextRequest) {
  let adminId = ''
  try {
    adminId = await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const parsed = schema.parse(await req.json())
    const payload: Record<string, string | null> = {}
    if (Object.prototype.hasOwnProperty.call(parsed, 'productsModelsLabel')) {
      payload.productsModelsLabel = parsed.productsModelsLabel ?? null
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'productsMerchLabel')) {
      payload.productsMerchLabel = parsed.productsMerchLabel ?? null
    }
    const [config] = await prisma.$transaction([
      prisma.siteConfig.upsert({
        where: { id: CONFIG_ID },
        update: payload,
        create: { id: CONFIG_ID, ...payload },
        select: {
          productsModelsLabel: true,
          productsMerchLabel: true,
        },
      }),
      prisma.configChangeLog.create({
        data: {
          adminId,
          section: 'catalog',
          changes: payload as any,
        },
      }),
    ])
    return NextResponse.json({ config })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
