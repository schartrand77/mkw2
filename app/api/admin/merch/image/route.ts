import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { saveBuffer } from '@/lib/storage'
import { randomUUID } from 'crypto'
import path from 'path'

export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function extensionFromUpload(fileName: string, mimeType: string) {
  const fromName = path.extname(fileName || '').toLowerCase()
  if (fromName) return fromName
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  return '.jpg'
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Invalid form payload.' }, { status: 400 })
    const image = form.get('image')
    if (!(image instanceof File)) return NextResponse.json({ error: 'Image file required.' }, { status: 400 })
    if (!image.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image.' }, { status: 400 })
    if (!image.size || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Image must be <= ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.` }, { status: 400 })
    }

    const ext = extensionFromUpload(image.name, image.type)
    const rel = path.join('merch', `${Date.now()}-${randomUUID()}${ext}`)
    const buf = Buffer.from(await image.arrayBuffer())
    await saveBuffer(rel, buf)
    const imageUrl = `/${rel.replace(/\\/g, '/')}`
    return NextResponse.json({ ok: true, imageUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed.' }, { status: 400 })
  }
}
