import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import JSZip from 'jszip'
import { readFile } from 'fs/promises'
import path from 'path'
import { storageRoot } from '@/lib/storage'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const model = await prisma.model.findUnique({ where: { id: params.id }, select: { title: true, parts: true, filePath: true } })
  if (!model) return new Response('Not found', { status: 404 })
  const zip = new JSZip()
  if (model.parts.length > 0) {
    for (const p of model.parts) {
      const full = path.join(storageRoot(), p.filePath.replace(/^\//, ''))
      const buf = await readFile(full)
      zip.file(p.name || path.basename(full), buf)
    }
  } else if (model.filePath) {
    const full = path.join(storageRoot(), model.filePath.replace(/^\//, ''))
    const buf = await readFile(full)
    zip.file(path.basename(full), buf)
  }
  // Generate as Uint8Array for Response BodyInit compatibility
  const content = await zip.generateAsync({ type: 'uint8array' })
  const headers = new Headers({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${(model.title || 'model').replace(/[^a-z0-9\-_.]+/gi, '_')}.zip"`
  })
  const arrayCopy = new Uint8Array(content) // ensure backing ArrayBuffer, not SharedArrayBuffer
  const ab: ArrayBuffer = arrayCopy.buffer.slice(0)
  return new Response(ab, { headers })
}
