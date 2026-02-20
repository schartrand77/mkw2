import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { filesPublicBaseUrl, storageRoot } from '@/lib/storage'

type FileRouteContext = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, { params }: FileRouteContext) {
  const routeParams = await params
  const relPath = routeParams.path.join('/')
  const base = filesPublicBaseUrl()
  if (base) {
    const target = new URL(relPath, `${base.replace(/\/+$/, '')}/`).toString()
    return Response.redirect(target, 302)
  }
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
    case '.pdf': return 'application/pdf'
    default: return 'application/octet-stream'
  }
}
