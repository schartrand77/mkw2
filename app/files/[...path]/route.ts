import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { storageRoot } from '@/lib/storage'

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const relPath = params.path.join('/')
  const full = path.join(storageRoot(), relPath)
  try {
    const st = await stat(full)
    if (!st.isFile()) return new Response('Not found', { status: 404 })
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const stream = createReadStream(full)
  const ext = path.extname(full).toLowerCase()
  const contentType = mimeFromExt(ext)
  return new Response(stream as any, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } })
}

function mimeFromExt(ext: string) {
  switch (ext) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.stl': return 'model/stl'
    case '.obj': return 'text/plain'
    case '.3mf': return 'model/3mf'
    default: return 'application/octet-stream'
  }
}
