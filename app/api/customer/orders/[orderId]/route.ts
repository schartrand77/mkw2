import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrderForUser } from '@/lib/orders'
import { getOrderProductionDetail } from '@/lib/production'

type CustomerOrderDetailContext = { params: Promise<{ orderId: string }> }

function getManufacturabilityReport(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const artifacts = (metadata as Record<string, unknown>).artifacts
  if (!artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)) return null
  const report = (artifacts as Record<string, unknown>).manufacturabilityReport
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null
  const filePath = (report as Record<string, unknown>).filePath
  if (typeof filePath !== 'string' || !filePath.trim()) return null
  const generatedAt = (report as Record<string, unknown>).generatedAt
  return { filePath: filePath.trim(), generatedAt: typeof generatedAt === 'string' ? generatedAt : null }
}

function getOrderOrganizationId(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const orgId = (metadata as Record<string, unknown>).organizationId
  return typeof orgId === 'string' && orgId.trim().length > 0 ? orgId.trim() : null
}

function getEstimateFeedback(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const feedback = (metadata as Record<string, unknown>).estimateFeedback
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) return null
  const record = feedback as Record<string, unknown>
  const estimatedPrintHours = Number(record.estimatedPrintHours)
  const actualPrintHours = Number(record.actualPrintHours)
  const printHoursDelta = Number(record.printHoursDelta)
  const actualMaterialGrams = Number(record.actualMaterialGrams)
  return {
    estimatedPrintHours: Number.isFinite(estimatedPrintHours) ? estimatedPrintHours : null,
    actualPrintHours: Number.isFinite(actualPrintHours) ? actualPrintHours : null,
    printHoursDelta: Number.isFinite(printHoursDelta) ? printHoursDelta : null,
    actualMaterialGrams: Number.isFinite(actualMaterialGrams) ? actualMaterialGrams : null,
  }
}

function getFailureRecovery(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const reprintRequestedAt = (metadata as Record<string, unknown>).reprintRequestedAt
  const reprintSourceOrderId = (metadata as Record<string, unknown>).reprintSourceOrderId
  return {
    reprintRequestedAt: typeof reprintRequestedAt === 'string' ? reprintRequestedAt : null,
    reprintSourceOrderId: typeof reprintSourceOrderId === 'string' ? reprintSourceOrderId : null,
  }
}

export async function GET(_req: NextRequest, { params }: CustomerOrderDetailContext) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await params
  const order = await getOrderForUser(orderId, userId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const production = await getOrderProductionDetail({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    shippingMethod: order.shippingMethod,
    metadata: order.metadata,
    items: order.items,
  })

  return NextResponse.json({
    order,
    production,
    derived: {
      manufacturabilityReport: getManufacturabilityReport(order.metadata),
      organizationId: getOrderOrganizationId(order.metadata),
      estimateFeedback: getEstimateFeedback(order.metadata),
      failureRecovery: getFailureRecovery(order.metadata),
      pendingApprovalRequests: order.approvalRequests.filter((request) => request.status === 'pending'),
    },
  })
}
