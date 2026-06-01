import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getEffectiveSuiteRuntimeSetting } from '@/lib/suite-runtime'
import { modelTag } from '@/lib/cache-policy'
import {
  modelGcodeCreateData,
  modelGcodeUpdateData,
  normalizeModelGcodeCapture,
} from '@/lib/printlab-model-gcodes'

type Params = { params: Promise<{ id: string }> }

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

async function configuredTokens() {
  const tokens = [
    process.env.MAKERWORKS_INBOUND_SECRET,
    process.env.PRINTLAB_WEBHOOK_SECRET,
    process.env.MAKERWORKS_SUBMIT_API_KEY,
  ]
  try {
    const runtimeToken = await getEffectiveSuiteRuntimeSetting('printlabSubmitApiKey')
    tokens.push(runtimeToken.value)
  } catch {
    // Database-backed suite settings are optional for local tests and first boot.
  }
  return tokens.map((token) => String(token || '').trim()).filter(Boolean)
}

async function isAuthorized(req: NextRequest) {
  const tokens = await configuredTokens()
  if (tokens.length === 0) return false
  const supplied = [
    req.headers.get('x-api-key'),
    req.headers.get('x-makerworks-secret'),
    req.nextUrl.searchParams.get('secret'),
  ]
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) supplied.push(auth.slice(7))
  return supplied.some((candidate) => {
    const value = String(candidate || '').trim()
    return value && tokens.some((token) => timingSafeEqual(value, token))
  })
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  try {
    const { id } = await params
    const model = await prisma.model.findUnique({ where: { id }, select: { id: true } })
    if (!model) return NextResponse.json({ error: 'Model not found.' }, { status: 404 })

    const capture = normalizeModelGcodeCapture(body)
    const record = await (prisma as any).modelGcode.upsert({
      where: {
        modelId_printLabRecordId: {
          modelId: model.id,
          printLabRecordId: capture.printLabRecordId,
        },
      },
      create: modelGcodeCreateData(model.id, capture),
      update: modelGcodeUpdateData(capture),
    })

    try {
      revalidatePath(`/models/${model.id}`)
      revalidateTag(modelTag(model.id), 'max')
    } catch {
      // Revalidation is unavailable in plain Node tests; the stored capture is still valid.
    }

    return NextResponse.json({
      ok: true,
      gcode: {
        id: record.id,
        modelId: record.modelId,
        printLabRecordId: record.printLabRecordId,
        printerName: record.printerName,
        fileName: record.fileName,
        completedAt: record.completedAt,
        capturedAt: record.capturedAt,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to attach PrintLab G-code.' },
      { status: error?.status || 400 },
    )
  }
}
