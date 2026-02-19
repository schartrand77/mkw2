import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { refreshUserAchievements } from '@/lib/achievements'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, stat } from 'fs/promises'
import path from 'path'
import { PassThrough, Readable } from 'stream'
import archiver from 'archiver'
import { storageRoot } from '@/lib/storage'
import { getUserIdFromCookie } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, modelTag } from '@/lib/cache-policy'
export const dynamic = 'force-dynamic'

type ModelDownloadContext = { params: Promise<{ id: string }> }

function readZipLevel() {
  const raw = process.env.ZIP_COMPRESSION_LEVEL
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9) return Math.floor(parsed)
  return 6
}

export async function GET(_req: NextRequest, { params }: ModelDownloadContext) {
  const { id } = await params
  const model = await prisma.model.findUnique({
    where: { id },
    select: { id: true, title: true, parts: true, filePath: true, userId: true, updatedAt: true },
  })
  if (!model) return new Response('Not found', { status: 404 })
  const userId = await getUserIdFromCookie()
  const storage = storageRoot()
  const versionKey = model.updatedAt ? model.updatedAt.getTime() : Date.now()
  const zipDir = path.join(storage, 'zips', model.id)
  const zipPath = path.join(zipDir, `${versionKey}.zip`)
  const filename = `${(model.title || 'model').replace(/[^a-z0-9\-_.]+/gi, '_')}.zip`
  const headers = new Headers({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`
  })

  let body: BodyInit | null = null
  try {
    await stat(zipPath)
    const fileStream = createReadStream(zipPath)
    body = Readable.toWeb(fileStream) as BodyInit
  } catch {
    await mkdir(zipDir, { recursive: true })
    const archive = archiver('zip', { zlib: { level: readZipLevel() } })
    const passThrough = new PassThrough()
    const writeStream = createWriteStream(zipPath)
    archive.on('error', (err) => {
      passThrough.destroy(err)
      writeStream.destroy(err)
    })
    archive.pipe(passThrough)
    archive.pipe(writeStream)
    if (model.parts.length > 0) {
      for (const p of model.parts) {
        const full = path.join(storage, p.filePath.replace(/^\//, ''))
        archive.file(full, { name: p.name || path.basename(full) })
      }
    } else if (model.filePath) {
      const full = path.join(storage, model.filePath.replace(/^\//, ''))
      archive.file(full, { name: path.basename(full) })
    }
    void archive.finalize()
    body = Readable.toWeb(passThrough) as BodyInit
  }
  // Increment download count and refresh achievements asynchronously
  try {
    await prisma.model.update({ where: { id }, data: { downloads: { increment: 1 } } })
    if (model.userId) await refreshUserAchievements(prisma, model.userId)
    if (userId) {
      await prisma.modelDownload.upsert({
        where: { modelId_userId: { modelId: id, userId } },
        update: {},
        create: { modelId: id, userId },
      })
    }
    revalidateTag(modelTag(id), 'max')
    revalidateTag(CACHE_TAGS.discoverModels, 'max')
    revalidateTag(CACHE_TAGS.featuredModels, 'max')
  } catch {}
  return new Response(body, { headers })
}
