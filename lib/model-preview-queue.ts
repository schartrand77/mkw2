import path from 'path'
import { readFile, stat } from 'fs/promises'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { prisma } from '@/lib/db'
import { saveBuffer, storageRoot } from '@/lib/storage'
import { computeStlStatsMm } from '@/lib/stl'
import { estimatePriceUSD, resolveModelPricing } from '@/lib/pricing'
import { BRAND_NAME } from '@/lib/brand'

const STATUS_PENDING = 'pending'
const STATUS_PROCESSING = 'processing'
const STATUS_READY = 'ready'
const STATUS_FAILED = 'failed'

const MAX_3MF_CONVERT_BYTES = readByteEnv('UPLOAD_MAX_3MF_CONVERT_BYTES', 25 * 1024 * 1024)
const MAX_3MF_TRIANGLES = readCountEnv('UPLOAD_MAX_3MF_TRIANGLES', 800000)

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
})

type Vec3 = { x: number, y: number, z: number }
type Matrix4x4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]

type ParsedObject = {
  key: string
  meshTriangles: Vec3[][]
  components: { key: string, transform: Matrix4x4 }[]
}

type PreviewJobInput = {
  modelId: string
  partId?: string | null
  sourcePath: string
  previewPath: string
}

type ProcessResult = {
  processed: number
  failed: number
}

const IDENTITY_MATRIX: Matrix4x4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function readByteEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readCountEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function resolveStoragePath(storedPath: string) {
  const normalized = storedPath.replace(/^\/+/, '')
  return path.join(storageRoot(), normalized)
}

function normalizeStoredPath(storedPath: string) {
  return storedPath.replace(/^\/+/, '')
}

function sanitizeError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 500)
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function toNumber(val: any, fallback = 0) {
  if (val == null) return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
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

function applyMatrix(v: Vec3, m: Matrix4x4): Vec3 {
  const x = v.x, y = v.y, z = v.z
  return {
    x: m[0] * x + m[1] * y + m[2] * z + m[3],
    y: m[4] * x + m[5] * y + m[6] * z + m[7],
    z: m[8] * x + m[9] * y + m[10] * z + m[11],
  }
}

function transformTriangles(tris: Vec3[][], matrix: Matrix4x4): Vec3[][] {
  return tris.map(tri => tri.map(v => applyMatrix(v, matrix)))
}

function buildBinaryStl(tris: Vec3[][]): Buffer {
  const header = Buffer.alloc(80)
  const title = `${BRAND_NAME} STL Preview`.slice(0, 79)
  header.write(title)
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

function getZipEntrySize(entry: JSZip.JSZipObject): number | null {
  const data = (entry as any)?._data
  const size = data?.uncompressedSize ?? data?.compressedSize
  return Number.isFinite(size) ? Number(size) : null
}

export async function convert3mfToStl(buffer: Buffer): Promise<{ buf: Buffer, triangles: number } | null> {
  try {
    if (buffer.length > MAX_3MF_CONVERT_BYTES) {
      console.warn('3MF conversion skipped due to size limit', { bytes: buffer.length })
      return null
    }
    const zip = await JSZip.loadAsync(buffer)
    const embeddedStl = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith('.stl'))
    if (embeddedStl) {
      const embeddedSize = getZipEntrySize(embeddedStl)
      if (embeddedSize && embeddedSize > MAX_3MF_CONVERT_BYTES) {
        console.warn('3MF conversion: embedded STL too large', { bytes: embeddedSize })
        return null
      }
      const stlBuf = await embeddedStl.async('nodebuffer')
      return { buf: Buffer.from(stlBuf), triangles: -1 }
    }
    const modelEntry = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith('.model'))
    if (!modelEntry) return null

    const objectMap = new Map<string, ParsedObject>()
    const processedEntries = new Set<string>()
    const buildItems: { key: string, transform: Matrix4x4 }[] = []
    const queue: { path: string, collectBuild: boolean }[] = [{ path: modelEntry.name, collectBuild: true }]

    while (queue.length) {
      const { path: entryPathRaw, collectBuild } = queue.pop()!
      const entryPath = normalizeZipPath(entryPathRaw)
      if (processedEntries.has(entryPath)) continue
      const entry = zip.file(entryPath)
      if (!entry) continue
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
              if (meshTriangles.length > MAX_3MF_TRIANGLES) {
                throw new Error('3MF conversion exceeded triangle cap.')
              }
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
            if (triList.length > MAX_3MF_TRIANGLES) {
              throw new Error('3MF conversion exceeded triangle cap.')
            }
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
      for (const tri of transformed) {
        triangles.push(tri)
        if (triangles.length > MAX_3MF_TRIANGLES) {
          throw new Error('3MF conversion exceeded triangle cap.')
        }
      }
    }

    if (triangles.length === 0) return null
    return { buf: buildBinaryStl(triangles), triangles: triangles.length }
  } catch (err) {
    console.warn('3MF conversion failed', err)
    return null
  }
}

async function updateModelPricing(modelId: string) {
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { id: true, material: true },
  })
  if (!model) return
  const parts = await prisma.modelPart.findMany({
    where: { modelId },
    select: { id: true, volumeMm3: true, sizeXmm: true, sizeYmm: true, sizeZmm: true },
    orderBy: { index: 'asc' },
  })
  if (parts.length === 0) return
  if (!parts.every((part) => part.volumeMm3 != null)) return

  const isMultipart = parts.length > 1
  const totalVolMm3 = parts.reduce((sum, part) => sum + (part.volumeMm3 || 0), 0)
  if (totalVolMm3 <= 0) return

  let totalPrice = parts.reduce((sum, part) => {
    const cm3 = (part.volumeMm3 || 0) / 1000
    return sum + estimatePriceUSD({ cm3, material: model.material, cfg, applyMinimum: !isMultipart })
  }, 0)

  if (isMultipart) {
    const totalWithMinimum = estimatePriceUSD({ cm3: totalVolMm3 / 1000, material: model.material, cfg, applyMinimum: true })
    totalPrice = totalWithMinimum
    for (const part of parts) {
      const vol = part.volumeMm3 || 0
      const price = vol > 0 ? Number(((totalWithMinimum * vol) / totalVolMm3).toFixed(2)) : 0
      await prisma.modelPart.update({
        where: { id: part.id },
        data: { priceUsd: price },
      })
    }
  } else {
    await prisma.modelPart.update({
      where: { id: parts[0].id },
      data: { priceUsd: totalPrice },
    })
  }

  const effectivePriceUsd = resolveModelPricing({
    volumeMm3: totalVolMm3,
    material: model.material,
    priceUsd: totalPrice,
    salePriceUsd: null,
  }, cfg).priceUsd

  const size = !isMultipart && parts[0]
    ? { sizeXmm: parts[0].sizeXmm ?? undefined, sizeYmm: parts[0].sizeYmm ?? undefined, sizeZmm: parts[0].sizeZmm ?? undefined }
    : { sizeXmm: undefined, sizeYmm: undefined, sizeZmm: undefined }

  await prisma.model.update({
    where: { id: modelId },
    data: {
      volumeMm3: totalVolMm3 || undefined,
      priceUsd: totalPrice || undefined,
      effectivePriceUsd: effectivePriceUsd ?? undefined,
      effectivePriceUpdatedAt: effectivePriceUsd != null ? new Date() : undefined,
      ...size,
    },
  })
}

export async function enqueueModelPreviewJob(input: PreviewJobInput) {
  const existing = await prisma.modelPreviewJob.findFirst({
    where: {
      modelId: input.modelId,
      partId: input.partId ?? null,
      sourcePath: input.sourcePath,
      status: { in: [STATUS_PENDING, STATUS_PROCESSING] },
    },
  })
  if (existing) return existing
  return prisma.modelPreviewJob.create({
    data: {
      modelId: input.modelId,
      partId: input.partId ?? undefined,
      sourcePath: input.sourcePath,
      previewPath: input.previewPath,
    },
  })
}

export async function processPendingModelPreviews(limit = 3): Promise<ProcessResult> {
  const jobs = await prisma.modelPreviewJob.findMany({
    where: { status: STATUS_PENDING },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  let processed = 0
  let failed = 0

  for (const job of jobs) {
    try {
      await prisma.modelPreviewJob.update({
        where: { id: job.id },
        data: { status: STATUS_PROCESSING, attempts: { increment: 1 }, lastError: null },
      })
      const sourceDiskPath = resolveStoragePath(job.sourcePath)
      const info = await stat(sourceDiskPath)
      if (info.size > MAX_3MF_CONVERT_BYTES) {
        throw new Error('3MF source exceeds conversion limit.')
      }
      const buffer = await readFile(sourceDiskPath)
      const converted = await convert3mfToStl(buffer)
      if (!converted) {
        throw new Error('3MF conversion failed.')
      }
      const previewRel = normalizeStoredPath(job.previewPath)
      await saveBuffer(previewRel, converted.buf)
      const stats = computeStlStatsMm(converted.buf)

      const part = job.partId
        ? await prisma.modelPart.findUnique({ where: { id: job.partId }, select: { id: true, index: true } })
        : null
      if (job.partId && !part) {
        throw new Error('Model part not found.')
      }

      if (part) {
        await prisma.modelPart.update({
          where: { id: part.id },
          data: {
            previewFilePath: job.previewPath,
            volumeMm3: stats.volumeMm3 || undefined,
            sizeXmm: stats.sizeXmm ?? undefined,
            sizeYmm: stats.sizeYmm ?? undefined,
            sizeZmm: stats.sizeZmm ?? undefined,
          },
        })
      }

      if (part && part.index === 0) {
        await prisma.model.update({
          where: { id: job.modelId },
          data: { viewerFilePath: job.previewPath },
        })
      }

      await updateModelPricing(job.modelId)

      await prisma.modelPreviewJob.update({
        where: { id: job.id },
        data: { status: STATUS_READY },
      })
      processed += 1

    } catch (err) {
      failed += 1
      await prisma.modelPreviewJob.update({
        where: { id: job.id },
        data: { status: STATUS_FAILED, lastError: sanitizeError(err) },
      })
    }
  }

  return { processed, failed }
}
