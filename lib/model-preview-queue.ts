import path from 'path'
import { readFile, stat } from 'fs/promises'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { BufferGeometry, LoadingManager, Matrix4, Mesh, Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js'
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js'
import { prisma } from '@/lib/db'
import { needsModelPreviewConversion } from '@/lib/model-files'
import { saveBuffer, storageRoot } from '@/lib/storage'
import { computeStlStatsMm } from '@/lib/stl'
import { BRAND_NAME } from '@/lib/brand'
import { notifyModelProcessingReady } from '@/lib/model-processing-notifications'
import { updateModelPricingForModel } from '@/lib/model-pricing'
import { scaleStatsToTargetDimensions } from '@/lib/model-dimensions'

const STATUS_PENDING = 'pending'
const STATUS_PROCESSING = 'processing'
const STATUS_READY = 'ready'
const STATUS_FAILED = 'failed'

const MAX_MODEL_CONVERT_BYTES = readByteEnv('UPLOAD_MAX_MODEL_CONVERT_BYTES', readByteEnv('UPLOAD_MAX_3MF_CONVERT_BYTES', 25 * 1024 * 1024))
const MAX_MODEL_CONVERT_TRIANGLES = readCountEnv('UPLOAD_MAX_MODEL_CONVERT_TRIANGLES', readCountEnv('UPLOAD_MAX_3MF_TRIANGLES', 1200000))

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

type PreviewQueueOptions = {
  modelId?: string
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

export function buildPreviewJobWhere(options: PreviewQueueOptions = {}) {
  const where: Record<string, any> = { status: STATUS_PENDING }
  if (options.modelId) where.modelId = options.modelId
  return where
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

async function maybeNotifyPreviewReady(modelId: string) {
  const remainingJobs = await prisma.modelPreviewJob.count({
    where: { modelId, status: { in: [STATUS_PENDING, STATUS_PROCESSING] } },
  })
  if (remainingJobs > 0) return
  const parts = await prisma.modelPart.findMany({
    where: { modelId },
    select: { filePath: true, previewFilePath: true },
  })
  if (parts.length === 0) return
  const hasConvertible = parts.some((part) => needsModelPreviewConversion(path.extname(String(part.filePath || '')).toLowerCase()))
  if (!hasConvertible) return
  const missingPreview = parts.some((part) => {
    const ext = path.extname(String(part.filePath || '')).toLowerCase()
    return needsModelPreviewConversion(ext) && !part.previewFilePath
  })
  if (missingPreview) return
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { id: true, title: true, userId: true },
  })
  if (!model) return
  await notifyModelProcessingReady({
    modelId: model.id,
    userId: model.userId,
    modelTitle: model.title,
    kind: 'preview',
  })
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

function normalizeHexColor(value?: string | null) {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const match = trimmed.match(/#?([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i)
  if (!match) return null
  return `#${match[1].toLowerCase()}`
}

function extractExtruderIds(xml: string) {
  const matches = Array.from(xml.matchAll(/key=["']extruder["']\s+value=["'](\d+)["']/gi))
  return matches.map((m) => m[1]).filter(Boolean)
}

function extractPaintColorIndices(xml: string): number[] {
  const matches = Array.from(xml.matchAll(/paint_color=["']\s*([0-9]+)\s*C["']/gi))
  const ids = matches.map((m) => Number(m[1])).filter((v) => Number.isFinite(v))
  return Array.from(new Set(ids)).sort((a, b) => a - b)
}

type FilamentPaletteInfo = {
  palette: string[]
  selfIndexMap: Map<number, string>
}

function buildSelfIndexMap(selfIndexRaw: unknown, palette: string[]): Map<number, string> {
  const map = new Map<number, string>()
  if (!Array.isArray(selfIndexRaw)) return map
  for (let i = 0; i < Math.min(selfIndexRaw.length, palette.length); i++) {
    const idx = Number(selfIndexRaw[i])
    const color = palette[i]
    if (!Number.isFinite(idx) || idx <= 0 || !color) continue
    if (!map.has(idx)) map.set(idx, color)
  }
  return map
}

function parseFilamentPaletteFromProjectSettings(text: string): FilamentPaletteInfo {
  try {
    const parsed: { filament_colour?: unknown, filament_multi_colour?: unknown, filament_colour_type?: unknown, filament_self_index?: unknown } = JSON.parse(text)
    const basePalette = Array.isArray(parsed?.filament_colour) ? parsed.filament_colour as unknown[] : null
    const multiPalette = Array.isArray(parsed?.filament_multi_colour) ? parsed.filament_multi_colour as unknown[] : null
    const colorType = Array.isArray(parsed?.filament_colour_type) ? parsed.filament_colour_type as unknown[] : null
    const raw = basePalette || multiPalette || []
    const palette = raw
      .map((val, idx) => {
        const typeFlag = colorType?.[idx]
        const wantsMulti = String(typeFlag ?? '') === '1'
        const source = wantsMulti && multiPalette?.[idx] ? multiPalette[idx] : (basePalette?.[idx] ?? multiPalette?.[idx] ?? val)
        return normalizeHexColor(String(source))
      })
      .filter((v): v is string => Boolean(v))
    return { palette, selfIndexMap: buildSelfIndexMap(parsed?.filament_self_index, palette) }
  } catch {
    const match = text.match(new RegExp('"filament_colour"\\s*:\\s*\\[([\\s\\S]*?)\\]', 'i'))
    if (!match) return { palette: [], selfIndexMap: new Map() }
    const values = match[1].split(',').map((v) => v.trim().replace(/^\"|\"$/g, '')).filter(Boolean)
    const palette = values.map((v) => normalizeHexColor(v)).filter((v): v is string => Boolean(v))
    return { palette, selfIndexMap: new Map() }
  }
}

function hasEmbeddedModelColors(xml: string) {
  return /<(?:colorgroup|color|basematerials|texture2d|texture2dgroup|texture2dref)\b/i.test(xml)
}

export async function extract3mfFilamentColors(buffer: Buffer): Promise<string[] | null> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const sliceInfo = zip.file('Metadata/slice_info.config')
    const modelSettings = zip.file('Metadata/model_settings.config')
    if (!sliceInfo || !modelSettings) return null
    const sliceXml = await sliceInfo.async('string')
    const sliceData = xmlParser.parse(sliceXml)
    const plateNode = sliceData?.config?.plate || sliceData?.Config?.plate || sliceData?.config?.Plate || sliceData?.Config?.Plate
    const filaments = asArray(
      plateNode?.filament
      || plateNode?.Filament
      || sliceData?.config?.filament
      || sliceData?.Config?.filament
      || sliceData?.config?.Filament
      || sliceData?.Config?.Filament
    )

    const colorsById = new Map<string, string>()
    for (const filament of filaments) {
      const id = getAttr(filament, ['id', 'ID'])
      const colorRaw = getAttr(filament, ['color', 'Color'])
      const normalized = normalizeHexColor(colorRaw)
      if (id != null && normalized) {
        colorsById.set(String(id), normalized)
      }
    }

    let orderedIds: string[] = []
    const settingsXml = await modelSettings.async('string')
    const usedExtruders = Array.from(new Set(extractExtruderIds(settingsXml)))
    orderedIds = usedExtruders.length ? usedExtruders.sort((a, b) => Number(a) - Number(b)) : []

    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue
      if (!entry.name.toLowerCase().endsWith('.model')) continue
      const xml = await entry.async('string')
      if (hasEmbeddedModelColors(xml)) return null
    }

    let orderedColors: string[] = []
    if (colorsById.size > 0 && orderedIds.length > 0) {
      const unique = new Set<string>()
      for (const id of orderedIds) {
        const color = colorsById.get(id)
        if (color && !unique.has(color)) {
          unique.add(color)
          orderedColors.push(color)
        }
      }
    }

    if (orderedColors.length === 0) {
      const projectSettings = zip.file('Metadata/project_settings.config')
      if (projectSettings) {
        const settingsText = await projectSettings.async('string')
        const paletteInfo = parseFilamentPaletteFromProjectSettings(settingsText)
        const palette = paletteInfo.palette
        if (palette.length > 0) {
          let usedIndices: number[] = []
          for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue
            if (!entry.name.toLowerCase().endsWith('.model')) continue
            const xml = await entry.async('string')
            usedIndices = usedIndices.concat(extractPaintColorIndices(xml))
          }
          usedIndices = Array.from(new Set(usedIndices)).sort((a, b) => a - b)
          if (usedIndices.length > 0) {
            orderedColors = usedIndices
              .map((idx) => {
                if (palette[idx]) return palette[idx]
                if (idx > 0 && palette[idx - 1]) return palette[idx - 1]
                const bySelf = paletteInfo.selfIndexMap.get(idx) || paletteInfo.selfIndexMap.get(idx + 1)
                if (bySelf) return bySelf
                return null
              })
              .filter((v): v is string => Boolean(v))
          } else {
            const extruderIds = Array.from(new Set(extractExtruderIds(settingsXml)))
              .map((id) => Number(id))
              .filter((v) => Number.isFinite(v))
              .sort((a, b) => a - b)
            if (extruderIds.length > 0) {
              orderedColors = extruderIds
                .map((id) => palette[id - 1] || palette[id] || null)
                .filter((v): v is string => Boolean(v))
            } else {
              orderedColors = palette
            }
          }
        }
      }
    }

    if (orderedColors.length === 0 && colorsById.size > 0) {
      orderedColors = Array.from(colorsById.keys())
        .sort((a, b) => Number(a) - Number(b))
        .map((id) => colorsById.get(id) || '')
        .filter(Boolean)
    }

    return orderedColors.length ? orderedColors : null
  } catch (err) {
    console.warn('3MF color extraction failed', err)
    return null
  }
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

export async function convert3mfToStl(buffer: Buffer): Promise<{ buf: Buffer, statsBuf?: Buffer, triangles: number } | null> {
  try {
    if (buffer.length > MAX_MODEL_CONVERT_BYTES) {
      console.warn('3MF conversion skipped due to size limit', { bytes: buffer.length })
      return null
    }
    const zip = await JSZip.loadAsync(buffer)
    const embeddedStl = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith('.stl'))
    if (embeddedStl) {
      const embeddedSize = getZipEntrySize(embeddedStl)
      if (embeddedSize && embeddedSize > MAX_MODEL_CONVERT_BYTES) {
        console.warn('3MF conversion: embedded STL too large', { bytes: embeddedSize })
        return null
      }
      const stlBuf = await embeddedStl.async('nodebuffer')
      return { buf: Buffer.from(stlBuf), statsBuf: Buffer.from(stlBuf), triangles: -1 }
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
              if (meshTriangles.length > MAX_MODEL_CONVERT_TRIANGLES) {
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
    const normalizedTriangles: Vec3[][] = []
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
            if (triList.length > MAX_MODEL_CONVERT_TRIANGLES) {
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
      const normalizedItemTransform = item.transform.slice() as Matrix4x4
      normalizedItemTransform[3] = 0
      normalizedItemTransform[7] = 0
      normalizedItemTransform[11] = 0
      const normalized = transformTriangles(localTris, normalizedItemTransform)
      for (const tri of transformed) {
        triangles.push(tri)
        if (triangles.length > MAX_MODEL_CONVERT_TRIANGLES) {
          throw new Error('3MF conversion exceeded triangle cap.')
        }
      }
      for (const tri of normalized) {
        normalizedTriangles.push(tri)
        if (normalizedTriangles.length > MAX_MODEL_CONVERT_TRIANGLES) {
          throw new Error('3MF conversion exceeded triangle cap.')
        }
      }
    }

    if (triangles.length === 0) return null
    return {
      buf: buildBinaryStl(triangles),
      statsBuf: normalizedTriangles.length > 0 ? buildBinaryStl(normalizedTriangles) : undefined,
      triangles: triangles.length,
    }
  } catch (err) {
    console.warn('3MF conversion failed', err)
    return null
  }
}

function ensureConvertibleSize(buffer: Buffer, label: string) {
  if (buffer.length > MAX_MODEL_CONVERT_BYTES) {
    throw new Error(`${label} exceeds conversion size limit.`)
  }
}

function assertTriangleCap(count: number, label: string) {
  if (count > MAX_MODEL_CONVERT_TRIANGLES) {
    throw new Error(`${label} exceeded triangle cap.`)
  }
}

function wrapGeometry(geometry: BufferGeometry) {
  return new Mesh(geometry)
}

function collectTrianglesFromObject(root: Object3D, label: string): Vec3[][] {
  const triangles: Vec3[][] = []
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  root.updateMatrixWorld(true)
  root.traverse((node: any) => {
    if (!node?.isMesh || !node.geometry) return
    const geometry = node.geometry as BufferGeometry
    const flattened = geometry.index ? geometry.toNonIndexed() : geometry
    const position = flattened.getAttribute('position')
    if (!position || position.itemSize < 3) return
    const matrix = node.matrixWorld instanceof Matrix4 ? node.matrixWorld : new Matrix4()
    for (let i = 0; i + 2 < position.count; i += 3) {
      a.fromBufferAttribute(position, i).applyMatrix4(matrix)
      b.fromBufferAttribute(position, i + 1).applyMatrix4(matrix)
      c.fromBufferAttribute(position, i + 2).applyMatrix4(matrix)
      triangles.push([
        { x: a.x, y: a.y, z: a.z },
        { x: b.x, y: b.y, z: b.z },
        { x: c.x, y: c.y, z: c.z },
      ])
      assertTriangleCap(triangles.length, label)
    }
    if (flattened !== geometry) flattened.dispose()
  })
  return triangles
}

function asBufferLikeInput(buffer: Buffer) {
  return Uint8Array.from(buffer).buffer
}

async function convertObjectLikeToStl(object: Object3D, label: string) {
  const triangles = collectTrianglesFromObject(object, label)
  if (triangles.length === 0) return null
  const stl = buildBinaryStl(triangles)
  return { buf: stl, statsBuf: stl, triangles: triangles.length }
}

async function convertObjToStl(buffer: Buffer) {
  ensureConvertibleSize(buffer, 'OBJ source')
  const loader = new OBJLoader(new LoadingManager())
  const object = loader.parse(buffer.toString('utf8'))
  return convertObjectLikeToStl(object, 'OBJ conversion')
}

async function convertPlyToStl(buffer: Buffer) {
  ensureConvertibleSize(buffer, 'PLY source')
  const loader = new PLYLoader(new LoadingManager())
  const geometry = loader.parse(asBufferLikeInput(buffer))
  return convertObjectLikeToStl(wrapGeometry(geometry), 'PLY conversion')
}

async function convertVrmlToStl(buffer: Buffer) {
  ensureConvertibleSize(buffer, 'VRML source')
  const loader = new VRMLLoader(new LoadingManager())
  const object = loader.parse(buffer.toString('utf8'), '')
  return convertObjectLikeToStl(object, 'VRML conversion')
}

async function convertGltfToStl(buffer: Buffer, ext: string) {
  ensureConvertibleSize(buffer, 'glTF source')
  const loader = new GLTFLoader(new LoadingManager())
  const input = ext === '.gltf' ? buffer.toString('utf8') : asBufferLikeInput(buffer)
  const gltf = await loader.parseAsync(input as any, '')
  return convertObjectLikeToStl(gltf.scene, 'glTF conversion')
}

async function convertUsdzToStl(buffer: Buffer) {
  ensureConvertibleSize(buffer, 'USDZ source')
  const loader = new USDZLoader(new LoadingManager())
  const object = loader.parse(asBufferLikeInput(buffer))
  return convertObjectLikeToStl(object, 'USDZ conversion')
}

async function convertUsdLikeToStl(buffer: Buffer, ext: string) {
  ensureConvertibleSize(buffer, 'USD source')
  const zip = new JSZip()
  zip.file(`model${ext}`, buffer)
  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
  return convertUsdzToStl(archive)
}

async function convertAmfToStl(buffer: Buffer) {
  ensureConvertibleSize(buffer, 'AMF source')
  const data = xmlParser.parse(buffer.toString('utf8'))
  const amf = data?.amf || data?.AMF
  const objects = asArray(amf?.object || amf?.Object)
  const triangles: Vec3[][] = []
  for (const object of objects) {
    const mesh = object?.mesh || object?.Mesh
    const verticesRaw = asArray(mesh?.vertices?.vertex || mesh?.vertices?.Vertex)
    const vertices = verticesRaw.map((vertex: any) => {
      const coords = vertex?.coordinates || vertex?.Coordinates || {}
      return {
        x: toNumber(coords.x ?? coords.X),
        y: toNumber(coords.y ?? coords.Y),
        z: toNumber(coords.z ?? coords.Z),
      }
    })
    const volumes = asArray(mesh?.volume || mesh?.Volume)
    for (const volume of volumes) {
      const tris = asArray(volume?.triangle || volume?.Triangle)
      for (const tri of tris) {
        const v1 = vertices[toNumber(tri?.v1 ?? tri?.V1)]
        const v2 = vertices[toNumber(tri?.v2 ?? tri?.V2)]
        const v3 = vertices[toNumber(tri?.v3 ?? tri?.V3)]
        if (!v1 || !v2 || !v3) continue
        triangles.push([{ ...v1 }, { ...v2 }, { ...v3 }])
        assertTriangleCap(triangles.length, 'AMF conversion')
      }
    }
  }
  if (triangles.length === 0) return null
  const stl = buildBinaryStl(triangles)
  return { buf: stl, statsBuf: stl, triangles: triangles.length }
}

export async function convertModelToStlPreview(buffer: Buffer, ext: string): Promise<{ buf: Buffer, statsBuf?: Buffer, triangles: number } | null> {
  const normalized = ext.toLowerCase()
  if (normalized === '.stl') {
    return { buf: Buffer.from(buffer), statsBuf: Buffer.from(buffer), triangles: -1 }
  }
  if (normalized === '.3mf') return convert3mfToStl(buffer)
  if (normalized === '.obj') return convertObjToStl(buffer)
  if (normalized === '.amf') return convertAmfToStl(buffer)
  if (normalized === '.ply') return convertPlyToStl(buffer)
  if (normalized === '.wrl' || normalized === '.vrml') return convertVrmlToStl(buffer)
  if (normalized === '.glb' || normalized === '.gltf') return convertGltfToStl(buffer, normalized)
  if (normalized === '.usd' || normalized === '.usda') return convertUsdLikeToStl(buffer, normalized)
  if (normalized === '.usdz') return convertUsdzToStl(buffer)
  return null
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

export async function processPendingModelPreviews(limit = 3, options: PreviewQueueOptions = {}): Promise<ProcessResult> {
  const jobs = await prisma.modelPreviewJob.findMany({
    where: buildPreviewJobWhere(options),
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
      if (info.size > MAX_MODEL_CONVERT_BYTES) {
        throw new Error('Model source exceeds conversion limit.')
      }
      const buffer = await readFile(sourceDiskPath)
      const sourceExt = path.extname(job.sourcePath).toLowerCase()
      const converted = await convertModelToStlPreview(buffer, sourceExt)
      if (!converted) {
        throw new Error(`Preview conversion failed for ${sourceExt || 'source file'}.`)
      }
      const previewRel = normalizeStoredPath(job.previewPath)
      await saveBuffer(previewRel, converted.buf)
      let stats = computeStlStatsMm(converted.statsBuf || converted.buf)

      const part = job.partId
        ? await prisma.modelPart.findUnique({ where: { id: job.partId }, select: { id: true, index: true } })
        : null
      if (job.partId && !part) {
        throw new Error('Model part not found.')
      }

      if (part) {
        const modelDims = await prisma.model.findUnique({
          where: { id: job.modelId },
          select: { sizeXmm: true, sizeYmm: true, sizeZmm: true },
        })
        stats = scaleStatsToTargetDimensions(stats, {
          x: modelDims?.sizeXmm ?? null,
          y: modelDims?.sizeYmm ?? null,
          z: modelDims?.sizeZmm ?? null,
        })
        await prisma.modelPart.update({
          where: { id: part.id },
          data: {
            previewFilePath: job.previewPath,
            volumeMm3: stats.volumeMm3 || undefined,
            sizeXmm: stats.sizeXmm ?? undefined,
            sizeYmm: stats.sizeYmm ?? undefined,
            sizeZmm: stats.sizeZmm ?? undefined,
            supportRatio: stats.supportAreaRatio ?? undefined,
          },
        })
      }

      if (part && part.index === 0) {
        await prisma.model.update({
          where: { id: job.modelId },
          data: { viewerFilePath: job.previewPath },
        })
      }

      await updateModelPricingForModel(job.modelId)

      await prisma.modelPreviewJob.update({
        where: { id: job.id },
        data: { status: STATUS_READY },
      })
      await maybeNotifyPreviewReady(job.modelId)
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
