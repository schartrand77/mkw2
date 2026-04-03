import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import path from 'path'
import { prisma } from '@/lib/db'
import { saveBuffer } from '@/lib/storage'
import { classifyFailurePhoto } from '@/lib/failure-photo-classifier'
import { requireAdmin } from '@/app/api/admin/_utils'

export const dynamic = 'force-dynamic'

const MAX_FILE_BYTES = Number(process.env.FAILURE_PHOTO_MAX_BYTES || 12 * 1024 * 1024)

export async function GET(req: Request) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const url = new URL(req.url)
  const limitRaw = Number(url.searchParams.get('limit') || 25)
  const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 25
  const photos = await prisma.failurePhoto.findMany({
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { id: true, orderNumber: true } },
      printer: { select: { id: true, name: true } },
      model: { select: { id: true, title: true } },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json({
    photos: photos.map((p) => ({
      id: p.id,
      filePath: p.filePath,
      label: p.label,
      confidence: p.confidence,
      createdAt: p.createdAt,
      note: p.note,
      orderId: p.orderId,
      printerId: p.printerId,
      modelId: p.modelId,
      orderNumber: p.order?.orderNumber ?? null,
      printerName: p.printer?.name ?? null,
      modelTitle: p.model?.title ?? null,
      signals: p.signals,
      uploadedBy: p.uploadedBy,
    })),
  })
}

export async function POST(req: Request) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }

  try {
    const form = await req.formData()
    const file = form.get('photo')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing photo file.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Photo exceeds size limit.' }, { status: 413 })
    }
    const originalName = file.name || 'failure-photo.jpg'
    const ext = sanitizeExt(path.extname(originalName)) || '.jpg'
    const relPath = path.join('failure-photos', `${Date.now()}-${randomUUID()}${ext}`)
    const buffer = Buffer.from(await file.arrayBuffer())

    const classification = await classifyFailurePhoto(buffer)
    const overrideLabel = readText(form.get('overrideLabel'))
    const label = overrideLabel || classification.label
    const signals = {
      ...classification.signals,
      predictedLabel: classification.label,
      predictedConfidence: classification.confidence,
      scores: classification.scores,
      overrideLabel: overrideLabel || null,
    }

    await saveBuffer(relPath, buffer)

    const created = await prisma.failurePhoto.create({
      data: {
        filePath: `/${relPath.replace(/\\/g, '/')}`,
        originalName,
        label,
        confidence: classification.confidence,
        signals,
        note: readText(form.get('note')),
        sizeBytes: file.size || undefined,
        width: classification.signals.width,
        height: classification.signals.height,
        orderId: readText(form.get('orderId')) || undefined,
        printerId: readText(form.get('printerId')) || undefined,
        modelId: readText(form.get('modelId')) || undefined,
        uploadedById: adminId,
      },
      include: {
        order: { select: { id: true, orderNumber: true } },
        printer: { select: { id: true, name: true } },
        model: { select: { id: true, title: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      photo: {
        id: created.id,
        filePath: created.filePath,
        label: created.label,
        confidence: created.confidence,
        createdAt: created.createdAt,
        note: created.note,
        orderId: created.orderId,
        printerId: created.printerId,
        modelId: created.modelId,
        orderNumber: created.order?.orderNumber ?? null,
        printerName: created.printer?.name ?? null,
        modelTitle: created.model?.title ?? null,
        signals: created.signals,
        uploadedBy: created.uploadedBy,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 400 })
  }
}

function readText(value: FormDataEntryValue | null): string | null {
  if (!value) return null
  const text = String(value).trim()
  return text.length ? text : null
}

function sanitizeExt(ext: string) {
  const safe = ext.toLowerCase().replace(/[^a-z0-9.]/g, '')
  if (!safe || safe.length > 6) return ''
  if (!safe.startsWith('.')) return `.${safe}`
  return safe
}
