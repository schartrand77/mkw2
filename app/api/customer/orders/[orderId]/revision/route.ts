import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { addOrderRevision } from '@/lib/orders'
import { publicFilePath } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }
  const noteValue = form.get('note')
  const note = typeof noteValue === 'string' && noteValue.trim().length > 0 ? noteValue.trim() : undefined
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (50MB max).' }, { status: 400 })
  }
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  try {
    const revision = await addOrderRevision({
      orderId: params.orderId,
      userId,
      filename: file.name || 'revision.stl',
      note,
      buffer,
    })
    return NextResponse.json({
      revision: {
        id: revision.id,
        version: revision.version,
        createdAt: revision.createdAt,
        label: revision.label,
        note: revision.note,
        filePath: publicFilePath(revision.filePath),
      },
    })
  } catch (err: any) {
    const message = err?.message || 'Unable to upload revision'
    const status = message.toLowerCase().includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
