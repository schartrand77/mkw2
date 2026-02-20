import { NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'

type CustomerReportContext = { params: Promise<{ orderId: string }> }

function extractReportPath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const artifacts = (metadata as Record<string, unknown>).artifacts
  if (!artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)) return null
  const report = (artifacts as Record<string, unknown>).manufacturabilityReport
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null
  const filePath = (report as Record<string, unknown>).filePath
  if (typeof filePath !== 'string') return null
  const trimmed = filePath.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(req: Request, { params }: CustomerReportContext) {
  const { orderId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.printOrder.findFirst({
    where: { id: orderId, userId },
    select: { metadata: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const reportPath = extractReportPath(order.metadata)
  if (!reportPath) {
    return NextResponse.json({ error: 'Manufacturability report not available yet.' }, { status: 404 })
  }

  const href = reportPath.startsWith('/files/')
    ? reportPath
    : `/files/${reportPath.replace(/^\/+/, '')}`
  return NextResponse.redirect(new URL(href, req.url))
}
