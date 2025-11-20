import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import path from 'path'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { computeStlStatsMm } from '@/lib/stl'
import JSZip from 'jszip'
import { estimatePriceUSD } from '@/lib/pricing'
import { refreshUserAchievements } from '@/lib/achievements'
import sharp from 'sharp'
import { isSupportedImageFile } from '@/lib/images'
import { applyKnownOrientation, ensureProcessableImageBuffer } from '@/lib/image-processing'
import { XMLParser } from 'fast-xml-parser'
import { sendAdminDiscordNotification } from '@/lib/discord'

const isAllowedModel = (name: string) => /\.(stl|obj|3mf)$/i.test(name)

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
})

type Vec3 = { x: number, y: number, z: number }
type Matrix4x4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function toNumber(val: any, fallback = 0) {
  if (val == null) return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

const IDENTITY_MATRIX: Matrix4x4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function parseTransformMatrix(value?: string | null): Matrix4x4 {
  if (!value) return IDENTITY_MATRIX.slice() as Matrix4x4
  const parts = value.trim().split(/\s+/).map(Number)
  if (parts.length !== 12 || parts.some(v => !Number.isFinite(v))) {
    return IDENTITY_MATRIX.slice() as Matrix4x4
  }
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22, tx, ty, tz] = parts
  return [
    m00, m01, m02, tx,
    m10, m11, m12, ty,
    m20, m21, m22, tz,
    0, 0, 0, 1,
  ]
}

function multiplyMatrices(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
  const out: Matrix4x4 = new Array(16).fill(0) as Matrix4x4
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0
      for (let k = 0; k < 4; k++) {
        sum += a[row * 4 + k] * b[k * 4 + col]
      }
      out[row * 4 + col] = sum
    }
  }
  return out
}

function applyMatrix(v: Vec3, m: Matrix4x4): Vec3 {
  const x = v.x, y = v.y, z = v.z
  return {
    x: m[0] * x + m[1] * y + m[2] * z + m[3],
    y: m[4] * x + m[5] * y + m[6] * z + m[7],
    z: m[8] * x + m[9] * y + m[10] * z + m[11],
  }
}

function cloneTri(tri: Vec3[]): Vec3[] {
  return tri.map(v => ({ ...v }))
}

function transformTriangles(tris: Vec3[][], matrix: Matrix4x4): Vec3[][] {
  return tris.map(tri => tri.map(v => applyMatrix(v, matrix)))
}

function buildBinaryStl(tris: Vec3[][]): Buffer {
  const header = Buffer.alloc(80)
  header.write('MakerWorks STL Preview')
  const triCount = tris.length
  const body = Buffer.alloc(4 + triCount * 50)
  let offset = 0
  body.writeUInt32LE(triCount, offset); offset += 4
  for (const [a, b, c] of tris) {
    const abx = b.x - a.x
    const aby = b.y - a.y
    const abz = b.z - a.z
    const acx = c.x - a.x
    const acy = c.y - a.y
    const acz = c.z - a.z
    let nx = aby * acz - abz * acy
    let ny = abz * acx - abx * acz
    let nz = abx * acy - aby * acx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len
    body.writeFloatLE(nx, offset); offset += 4
    body.writeFloatLE(ny, offset); offset += 4
    body.writeFloatLE(nz, offset); offset += 4
    ;[a, b, c].forEach((v) => {
      body.writeFloatLE(v.x, offset); offset += 4
      body.writeFloatLE(v.y, offset); offset += 4
      body.writeFloatLE(v.z, offset); offset += 4
    })
    body.writeUInt16LE(0, offset); offset += 2
  }
  return Buffer.concat([header, body])
}

type ParsedObject = {
  key: string
  meshTriangles: Vec3[][]
  components: { key: string, transform: Matrix4x4 }[]
}

function getAttr(obj: any, keys: string[]): any {
  if (!obj) return undefined
  for (const key of keys) {
    if (obj[key] != null) return obj[key]
  }
  return undefined
}

function normalizeZipPath(p: string) {
  const replaced = p.replace(/\\/g, '/').replace(/^\/+/, '')
  const normalized = path.posix.normalize(replaced)
  if (normalized.startsWith('../')) return normalized.replace(/^(\.\.\/)+/, '')
  return normalized
}

async function convert3mfToStl(buffer: Buffer): Promise<{ buf: Buffer, triangles: number } | null> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const embeddedStl = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith('.stl'))
    if (embeddedStl) {
      const stlBuf = await embeddedStl.async('nodebuffer')
      console.info('3MF conversion: extracted embedded STL', { entry: embeddedStl.name })
      return { buf: Buffer.from(stlBuf), triangles: -1 }
    }
    const modelEntry = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith('.model'))
    if (!modelEntry) {
      console.warn('3MF conversion: .model part not found')
      return null
    }

    const objectMap = new Map<string, ParsedObject>()
    const processedEntries = new Set<string>()
    const buildItems: { key: string, transform: Matrix4x4 }[] = []
    const queue: { path: string, collectBuild: boolean }[] = [{ path: modelEntry.name, collectBuild: true }]

    while (queue.length) {
      const { path: entryPathRaw, collectBuild } = queue.pop()!
      const entryPath = normalizeZipPath(entryPathRaw)
      if (processedEntries.has(entryPath)) continue
      const entry = zip.file(entryPath)
      if (!entry) {
        console.warn('3MF conversion: referenced model entry missing', { entryPath })
        continue
      }
      processedEntries.add(entryPath)
      const xml = await entry.async('string')
      const data = xmlParser.parse(xml)
      const model = data?.model || data?.Model
      if (!model) continue
      const resourcesList = asArray(model.resources || model.Resources)

      for (const obj of resourcesList.flatMap((res) => asArray(res?.object || res?.Object))) {
        const rawId = getAttr(obj, ['id', 'ID'])
        if (rawId == null) continue
        const objectId = String(rawId)
        const key = `${entryPath}#${objectId}`
        if (objectMap.has(key)) continue
        const mesh = obj?.mesh || obj?.Mesh
        const vertexNodes = asArray(mesh?.vertices?.vertex || mesh?.vertices?.Vertex)
        const vertices: Vec3[] = vertexNodes.map((v: any) => ({
          x: toNumber(getAttr(v, ['x', 'X'])),
          y: toNumber(getAttr(v, ['y', 'Y'])),
          z: toNumber(getAttr(v, ['z', 'Z'])),
        }))
        const triangleNodes = asArray(mesh?.triangles?.triangle || mesh?.triangles?.Triangle)
        const meshTriangles: Vec3[][] = []
        if (vertices.length && triangleNodes.length) {
          for (const tri of triangleNodes) {
            const indices = [getAttr(tri, ['v1', 'V1']), getAttr(tri, ['v2', 'V2']), getAttr(tri, ['v3', 'V3'])]
            if (indices.some(idx => idx == null)) continue
            const v1 = vertices[toNumber(indices[0])]
            const v2 = vertices[toNumber(indices[1])]
            const v3 = vertices[toNumber(indices[2])]
            if (v1 && v2 && v3) {
              meshTriangles.push([{ ...v1 }, { ...v2 }, { ...v3 }])
            }
          }
        }
        const componentNodes = asArray(obj?.components?.component || obj?.components?.Component)
        const components: { key: string, transform: Matrix4x4 }[] = []
        for (const comp of componentNodes) {
          const compIdRaw = getAttr(comp, ['objectid', 'objectId', 'objectID', 'object'])
          if (compIdRaw == null) continue
          const compId = String(compIdRaw)
          const compPathRaw = getAttr(comp, ['path', 'Path'])
          const targetPath = compPathRaw ? normalizeZipPath(compPathRaw) : entryPath
          if (compPathRaw) queue.push({ path: compPathRaw, collectBuild: false })
          const childKey = `${targetPath}#${compId}`
          components.push({
            key: childKey,
            transform: parseTransformMatrix(getAttr(comp, ['transform', 'Transform'])),
          })
        }
        objectMap.set(key, { key, meshTriangles, components })
      }

      if (collectBuild) {
        const buildList = asArray(model.build?.item || model.build?.Item).map((item) => {
          const itemId = getAttr(item, ['objectid', 'objectId', 'objectID', 'id', 'ID'])
          if (itemId == null) return null
          const key = `${entryPath}#${String(itemId)}`
          return {
            key,
            transform: parseTransformMatrix(getAttr(item, ['transform', 'Transform'])),
          }
        }).filter((v): v is { key: string, transform: Matrix4x4 } => !!v)
        buildItems.push(...buildList)
      }
    }
    const triangles: Vec3[][] = []
    const cache = new Map<string, Vec3[][]>()

    // Resolve triangles iteratively to avoid deep recursion on complex component graphs
    const resolveObjectTriangles = (rootKey: string): Vec3[][] => {
      if (cache.has(rootKey)) return cache.get(rootKey)!

      type Frame = { key: string, phase: 'enter' | 'exit' }
      const frames: Frame[] = [{ key: rootKey, phase: 'enter' }]
      const active = new Set<string>()

      while (frames.length) {
        const frame = frames.pop()!
        const key = frame.key

        if (frame.phase === 'enter') {
          if (cache.has(key)) continue
          if (active.has(key)) {
            console.warn('3MF conversion: detected recursive component reference', { key })
            cache.set(key, [])
            continue
          }
          active.add(key)
          const obj = objectMap.get(key)
          if (!obj) {
            cache.set(key, [])
            active.delete(key)
            continue
          }
          frames.push({ key, phase: 'exit' })
          for (let i = obj.components.length - 1; i >= 0; i--) {
            const child = obj.components[i]
            frames.push({ key: child.key, phase: 'enter' })
          }
        } else {
          active.delete(key)
          const obj = objectMap.get(key)
          if (!obj) {
            cache.set(key, [])
            continue
          }
          let triList = obj.meshTriangles.map(tri => tri.map(v => ({ ...v })))
          for (const comp of obj.components) {
            const childTris = cache.get(comp.key) || []
            const transformed = transformTriangles(childTris, comp.transform)
            triList = triList.concat(transformed)
          }
          cache.set(key, triList)
        }
      }

      return cache.get(rootKey) || []
    }

    const itemsToProcess = buildItems.length > 0
      ? buildItems
      : Array.from(objectMap.keys()).map((key) => ({ key, transform: IDENTITY_MATRIX }))

    for (const item of itemsToProcess) {
      const localTris = resolveObjectTriangles(item.key)
      if (!localTris.length) continue
      const transformed = transformTriangles(localTris, item.transform)
      for (const tri of transformed) triangles.push(tri)
    }

    if (triangles.length === 0) {
      console.warn('3MF conversion: no triangles located in model', { entry: modelEntry.name })
      return null
    }
    return { buf: buildBinaryStl(triangles), triangles: triangles.length }
  } catch (err) {
    console.warn('3MF conversion to STL failed', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check site config for anonymous upload policy
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
    const uidFromCookie = await getUserIdFromCookie()
    if (cfg && cfg.allowAnonymousUploads === false && !uidFromCookie) {
      return NextResponse.json({ error: 'Sign in required to upload' }, { status: 401 })
    }
    const userId = uidFromCookie || (await ensureAnonymousUser())
    const uploader = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, profile: { select: { slug: true } } },
    })

    const form = await req.formData()
    const title = String(form.get('title') || '').slice(0, 200)
    const description = String(form.get('description') || '').slice(0, 2000)
    const creditName = ((form.get('creditName') as string) || '').slice(0, 200) || null
    const creditUrl = ((form.get('creditUrl') as string) || '').slice(0, 500) || null
    const material = String(form.get('material') || 'PLA').slice(0, 40)
    const files = form.getAll('files') as File[]
    const model = (form.get('model') as File | null) // legacy single file field
    const tagsRaw = (form.get('tags') as string | null) || ''
    const image = form.get('image') as File | null

    // Collect candidate model files (support zip or multiple file inputs)
    const modelFiles: { name: string, buf: Buffer }[] = []
    const inputs = files && files.length > 0 ? files : (model ? [model] : [])
    if (!inputs || inputs.length === 0) return NextResponse.json({ error: 'Missing model files' }, { status: 400 })

    for (const f of inputs) {
      const lower = f.name.toLowerCase()
      const ab = await f.arrayBuffer()
      const buf = Buffer.from(ab)
      if (lower.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(buf)
        const entries = Object.values(zip.files)
        for (const entry of entries) {
          if (entry.dir) continue
          const ename = entry.name
          if (!isAllowedModel(ename)) continue
          const ebuf = await entry.async('nodebuffer')
          modelFiles.push({ name: path.basename(ename), buf: ebuf })
        }
      } else if (isAllowedModel(lower)) {
        modelFiles.push({ name: f.name, buf })
      }
    }

    if (modelFiles.length === 0) return NextResponse.json({ error: 'No valid model files found' }, { status: 400 })

    let coverImageRel: string | undefined
    if (image && isSupportedImageFile(image.name, image.type)) {
      try {
        const imgBuf = Buffer.from(await image.arrayBuffer())
        const prepared = await ensureProcessableImageBuffer(imgBuf, { filename: image.name, mimeType: image.type })
        const pipeline = applyKnownOrientation(sharp(prepared.buffer), prepared.orientation)
        const processed = await pipeline.resize(1600, 1200, { fit: 'inside' }).webp({ quality: 88 }).toBuffer()
        // Store cover images under userId/thumbnails as consistent webp assets
        coverImageRel = path.join(userId, 'thumbnails', `${Date.now()}-${safeName(title) || 'cover'}.webp`)
        await saveBuffer(coverImageRel, processed)
      } catch (err) {
        console.error('Failed to process cover image:', err)
      }
    }

    // Save files and create model + parts
    const now = Date.now()
    let totalVolMm3 = 0
    let totalPrice = 0
    const partCreates: any[] = []
    let firstPath: string | null = null
    let firstViewerPath: string | null = null
    const storedExts: string[] = []
    // overall bounding box
    let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, minZ = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY

    for (let i = 0; i < modelFiles.length; i++) {
      const f = modelFiles[i]
      let ext = path.extname(f.name).toLowerCase()
      let fileBuf = f.buf
      if (ext === '.3mf') {
        const extracted = await convert3mfToStl(f.buf)
        if (extracted) {
          fileBuf = extracted.buf
          ext = '.stl'
          console.info('3MF converted to STL preview', { triangles: extracted.triangles })
        } else {
          console.warn('3MF conversion returned no data; keeping original 3MF', { file: f.name })
        }
      }
      const rel = path.join(userId, 'models', `${now}-${safeName(title) || 'model'}-${i + 1}${ext}`)
      await saveBuffer(rel, fileBuf)
      const storedPath = `/${rel.replace(/\\/g, '/')}`
      storedExts.push(ext.replace('.', '').toUpperCase())
      if (!firstPath) firstPath = storedPath
      const previewPath: string | null = ext === '.stl' ? storedPath : null
      if (!firstViewerPath && previewPath) firstViewerPath = previewPath
      let volMm3: number | null = null
      let sizeXmm: number | undefined, sizeYmm: number | undefined, sizeZmm: number | undefined
      if (ext === '.stl') {
        const stats = computeStlStatsMm(fileBuf)
        volMm3 = stats.volumeMm3
        sizeXmm = stats.sizeXmm; sizeYmm = stats.sizeYmm; sizeZmm = stats.sizeZmm
        if (sizeXmm != null && sizeYmm != null && sizeZmm != null) {
          // update overall
          const sx = sizeXmm, sy = sizeYmm, sz = sizeZmm
          // We don't know min/max directly from sizes; assume centered around 0 -> approximate using size only
          // Better: treat size as extents; expand overall by size (relative). We'll skip for now and set overall based on max of parts sizes.
          if (sx > (maxX - minX) || minX === Infinity) { maxX = sx; minX = 0 }
          if (sy > (maxY - minY) || minY === Infinity) { maxY = sy; minY = 0 }
          if (sz > (maxZ - minZ) || minZ === Infinity) { maxZ = sz; minZ = 0 }
        }
      }
      const cm3 = volMm3 ? volMm3 / 1000 : null
      const p = cm3 != null ? estimatePriceUSD({ cm3, material, cfg }) : null
      if (volMm3) totalVolMm3 += volMm3
      if (p) totalPrice += p
      const storedName = ext === '.stl' && f.name.toLowerCase().endsWith('.3mf') ? f.name.replace(/\.3mf$/i, '.stl') : f.name
      partCreates.push({
        name: storedName,
        index: i,
        filePath: storedPath,
        previewFilePath: previewPath || undefined,
        volumeMm3: volMm3 || undefined,
        sizeXmm,
        sizeYmm,
        sizeZmm,
        priceUsd: p || undefined
      })
    }

    const created = await prisma.model.create({
      data: {
        userId,
        title,
        description,
        creditName: creditName || undefined,
        creditUrl: creditUrl || undefined,
        material,
        filePath: firstPath!,
        viewerFilePath: firstViewerPath || firstPath!,
        coverImagePath: coverImageRel ? `/${coverImageRel.replace(/\\/g, '/')}` : undefined,
        fileType: modelFiles.length > 1 ? 'MULTI' : (storedExts[0] || path.extname(modelFiles[0].name).replace('.', '').toUpperCase()),
        volumeMm3: totalVolMm3 || undefined,
        sizeXmm: isFinite(maxX - minX) ? (maxX - minX) : undefined,
        sizeYmm: isFinite(maxY - minY) ? (maxY - minY) : undefined,
        sizeZmm: isFinite(maxZ - minZ) ? (maxZ - minZ) : undefined,
        priceUsd: totalPrice || undefined,
        modelTags: tagsRaw ? { create: await prepareTags(tagsRaw) } : undefined,
        parts: { create: partCreates }
      }
    })
    try { await refreshUserAchievements(prisma, userId) } catch {}
    try {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const uploaderLabel = uploader?.name || uploader?.email || 'anonymous'
      const profileUrl = uploader?.profile?.slug ? `${baseUrl}/u/${uploader.profile.slug}` : undefined
      await sendAdminDiscordNotification({
        title: 'New upload',
        body: [
          `Title: ${title || '(untitled)'}`,
          `By: ${uploaderLabel}`,
          profileUrl ? `Profile: ${profileUrl}` : null,
          `${baseUrl}/models/${created.id}`,
        ],
        meta: {
          modelId: created.id,
          files: modelFiles.length,
          types: storedExts.length ? storedExts.join(', ') : undefined,
        },
      })
    } catch (notifyErr) {
      console.error('Admin Discord notification failed for upload:', notifyErr)
    }
    return NextResponse.json({ model: created })
  } catch (e: any) {
    console.error('Upload failed:', e)
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 400 })
  }
}

function safeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function ensureAnonymousUser(): Promise<string> {
  // Create a stable anonymous user to attach uploads when not logged in
  const anonEmail = 'anonymous@local'
  const existing = await prisma.user.findUnique({ where: { email: anonEmail } })
  if (existing) return existing.id
  const created = await prisma.user.create({ data: { email: anonEmail, passwordHash: '!', emailVerified: true, isSuspended: false } })
  return created.id
}

async function prepareTags(tagsRaw: string) {
  const { prisma } = await import('@/lib/db')
  const { slugify } = await import('@/lib/userpage')
  const names = Array.from(new Set(tagsRaw.split(',').map(t => t.trim()).filter(Boolean))).slice(0, 12)
  const result: any[] = []
  for (const name of names) {
    const slug = slugify(name)
    let tag = await prisma.tag.findUnique({ where: { slug } })
    if (!tag) {
      try {
        tag = await prisma.tag.create({ data: { name, slug } })
      } catch {
        tag = await prisma.tag.findUnique({ where: { slug } })
      }
    }
    if (tag) result.push({ tag: { connect: { id: tag.id } } })
  }
  return result
}

