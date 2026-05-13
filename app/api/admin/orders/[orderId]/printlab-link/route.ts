import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { adminRouteGuards } from '@/app/api/admin/_utils'
import { getAdminAuditRequestMeta, recordAdminAuditEvent } from '@/lib/admin-audit'
import { prisma } from '@/lib/db'
import {
  fetchPrintLabJob,
  fetchPrintLabSuccessfulGcodes,
} from '@/lib/printlab'
import {
  buildManualPrintLabAttachment,
  findSuccessfulGcodeRecord,
  hasExactPrintLabMaterialUsage,
  mergePrintLabOrderAttachment,
  normalizePrintLabSubmittedJobAttachment,
  normalizeSuccessfulGcodeAttachment,
  resolveOrderStatusFromPrintLabAttachment,
} from '@/lib/printlab-order-link'
import { maybeConsumeStockForOrder } from '@/lib/stockworks-consumption'

export const dynamic = 'force-dynamic'

export const printLabOrderLinkRouteOps = {
  fetchPrintLabJob,
  fetchPrintLabSuccessfulGcodes,
  maybeConsumeStockForOrder,
  recordAdminAuditEvent,
}

const optionalText = z.string().trim().max(500).optional().nullable()

const payloadSchema = z.object({
  mode: z.enum(['submitted_job', 'successful_gcode', 'manual', 'auto']),
  id: z.string().trim().max(200).optional().nullable(),
  note: optionalText,
  manual: z.object({
    printLabJobId: z.string().trim().max(200).optional().nullable(),
    successfulGcodeId: z.string().trim().max(200).optional().nullable(),
    status: z.string().trim().max(100).optional().nullable(),
    printerId: z.string().trim().max(200).optional().nullable(),
    printerName: z.string().trim().max(200).optional().nullable(),
    modelId: z.string().trim().max(200).optional().nullable(),
    modelName: z.string().trim().max(200).optional().nullable(),
    fileName: z.string().trim().max(500).optional().nullable(),
    filePath: z.string().trim().max(1000).optional().nullable(),
    completedAt: z.string().trim().max(100).optional().nullable(),
    note: optionalText,
  }).optional(),
}).superRefine((payload, ctx) => {
  if (payload.mode === 'manual') {
    const manual = payload.manual
    if (!manual?.printLabJobId?.trim() && !manual?.successfulGcodeId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PrintLab job ID or successful G-code ID is required for a manual link.',
        path: ['manual'],
      })
    }
    return
  }

  if (!payload.id?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'PrintLab record ID is required.',
      path: ['id'],
    })
  }
})

type Payload = z.infer<typeof payloadSchema>
type RouteContext = { params: Promise<{ orderId: string }> }

function firstIssueMessage(error: unknown) {
  const issues = (error as any)?.issues
  return Array.isArray(issues) && issues[0]?.message ? String(issues[0].message) : 'Invalid request body.'
}

function statusError(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

async function buildAttachment(payload: Payload, adminId: string) {
  const context = { adminId, note: payload.note ?? null }

  if (payload.mode === 'manual') {
    return buildManualPrintLabAttachment(payload.manual || {}, context)
  }

  const id = payload.id?.trim()
  if (!id) throw statusError('PrintLab record ID is required.', 400)

  if (payload.mode === 'submitted_job') {
    return normalizePrintLabSubmittedJobAttachment(
      await printLabOrderLinkRouteOps.fetchPrintLabJob(id),
      context,
    )
  }

  if (payload.mode === 'successful_gcode') {
    const record = findSuccessfulGcodeRecord(
      await printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes(),
      id,
    )
    if (!record) throw statusError('PrintLab successful G-code record was not found.', 404)
    return normalizeSuccessfulGcodeAttachment(record, context)
  }

  try {
    return normalizePrintLabSubmittedJobAttachment(
      await printLabOrderLinkRouteOps.fetchPrintLabJob(id),
      context,
    )
  } catch {
    const record = findSuccessfulGcodeRecord(
      await printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes(),
      id,
    )
    if (!record) throw statusError('PrintLab record was not found.', 404)
    return normalizeSuccessfulGcodeAttachment(record, context)
  }
}

async function handleStockworks(orderId: string, attachment: Awaited<ReturnType<typeof buildAttachment>>) {
  if (!hasExactPrintLabMaterialUsage(attachment)) {
    return {
      ok: false,
      warning: 'PrintLab record did not include exact material grams; StockWorks consumption was not triggered by this link.',
    }
  }

  try {
    const consumed = await printLabOrderLinkRouteOps.maybeConsumeStockForOrder(orderId, 'printlab-admin-link')
    return consumed.ok
      ? { ok: true, movements: Number((consumed as any).movements || 0) }
      : { ok: false, warning: String((consumed as any).reason || 'StockWorks consumption was not applied.') }
  } catch (error: any) {
    return { ok: false, warning: error?.message || 'StockWorks consumption failed.' }
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  let adminId: string
  try {
    adminId = await adminRouteGuards.requireAdmin()
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: error?.status || 401 })
  }

  let payload: Payload
  try {
    payload = payloadSchema.parse(await req.json())
  } catch (error) {
    return NextResponse.json({ error: firstIssueMessage(error) }, { status: 400 })
  }

  try {
    const { orderId } = await params
    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, metadata: true },
    } as any)
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    const attachment = await buildAttachment(payload, adminId)
    const metadata = mergePrintLabOrderAttachment(order.metadata, attachment)
    const status = resolveOrderStatusFromPrintLabAttachment(order.status, attachment)

    await prisma.printOrder.update({
      where: { id: order.id },
      data: {
        metadata: metadata as Prisma.InputJsonValue,
        ...(status !== order.status ? { status } : {}),
      },
    } as any)

    const stockworks = await handleStockworks(order.id, attachment)
    const requestMeta = getAdminAuditRequestMeta(req)
    await printLabOrderLinkRouteOps.recordAdminAuditEvent({
      adminId,
      action: 'admin.order.printlab.link',
      targetType: 'print_order',
      targetId: order.id,
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: {
        recordType: attachment.recordType,
        printLabJobId: attachment.printLabJobId,
        successfulGcodeId: attachment.successfulGcodeId,
        status: attachment.status,
      },
    })

    return NextResponse.json({
      ok: true,
      attachment,
      order: { id: order.id, status },
      stockworks,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to link PrintLab record.' },
      { status: error?.status || 400 },
    )
  }
}
