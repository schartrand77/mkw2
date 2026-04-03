"use strict"
/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client")
const JSZip = require("jszip")
const { XMLParser } = require("fast-xml-parser")
const path = require("path")
const { access, mkdir, readFile, writeFile } = require("fs/promises")
const { constants } = require("fs")

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
})

const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]

function storageRoot() {
  const envRoot = process.env.STORAGE_DIR
  if (envRoot) return envRoot
  return path.join(process.cwd(), "storage")
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true })
}

async function pathExists(p) {
  try {
    await access(p, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function toNumber(val, fallback = 0) {
  if (val == null) return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

function getAttr(obj, keys) {
  if (!obj) return undefined
  for (const key of keys) {
    if (obj[key] != null) return obj[key]
  }
  return undefined
}

function normalizeZipPath(p) {
  const replaced = p.replace(/\\/g, "/").replace(/^\/+/, "")
  const normalized = path.posix.normalize(replaced)
  if (normalized.startsWith("../")) return normalized.replace(/^(\.\.\/)+/, "")
  return normalized
}

function parseTransformMatrix(value) {
  if (!value) return IDENTITY_MATRIX.slice()
  const parts = value.trim().split(/\s+/).map(Number)
  if (parts.length !== 12 || parts.some(v => !Number.isFinite(v))) {
    return IDENTITY_MATRIX.slice()
  }
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22, tx, ty, tz] = parts
  return [
    m00, m01, m02, tx,
    m10, m11, m12, ty,
    m20, m21, m22, tz,
    0, 0, 0, 1,
  ]
}

function applyMatrix(v, m) {
  const x = v.x, y = v.y, z = v.z
  return {
    x: m[0] * x + m[1] * y + m[2] * z + m[3],
    y: m[4] * x + m[5] * y + m[6] * z + m[7],
    z: m[8] * x + m[9] * y + m[10] * z + m[11],
  }
}

function transformTriangles(tris, matrix) {
  return tris.map(tri => tri.map(v => applyMatrix(v, matrix)))
}

function buildBinaryStl(tris) {
  const header = Buffer.alloc(80)
  const title = "MakerWorks STL Preview".slice(0, 79)
  header.write(title)
  const triCount = tris.length
  const body = Buffer.alloc(4 + triCount * 50)
  let offset = 0
  body.writeUInt32LE(triCount, offset); offset += 4
  for (const tri of tris) {
    const a = tri[0], b = tri[1], c = tri[2]
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
    for (const v of [a, b, c]) {
      body.writeFloatLE(v.x, offset); offset += 4
      body.writeFloatLE(v.y, offset); offset += 4
      body.writeFloatLE(v.z, offset); offset += 4
    }
    body.writeUInt16LE(0, offset); offset += 2
  }
  return Buffer.concat([header, body])
}

async function convert3mfToStl(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const embeddedStl = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith(".stl"))
    if (embeddedStl) {
      const stlBuf = await embeddedStl.async("nodebuffer")
      console.info("3MF conversion: extracted embedded STL", { entry: embeddedStl.name })
      return Buffer.from(stlBuf)
    }
    const modelEntry = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith(".model"))
    if (!modelEntry) {
      console.warn("3MF conversion: .model part not found")
      return null
    }

    const objectMap = new Map()
    const processedEntries = new Set()
    const buildItems = []
    const queue = [{ path: modelEntry.name, collectBuild: true }]

    while (queue.length) {
      const { path: entryPathRaw, collectBuild } = queue.pop()
      const entryPath = normalizeZipPath(entryPathRaw)
      if (processedEntries.has(entryPath)) continue
      const entry = zip.file(entryPath)
      if (!entry) {
        console.warn("3MF conversion: referenced model entry missing", { entryPath })
        continue
      }
      processedEntries.add(entryPath)
      const xml = await entry.async("string")
      const data = xmlParser.parse(xml)
      const model = data?.model || data?.Model
      if (!model) continue
      const resourcesList = asArray(model.resources || model.Resources)

      for (const obj of resourcesList.flatMap((res) => asArray(res?.object || res?.Object))) {
        const rawId = getAttr(obj, ["id", "ID"])
        if (rawId == null) continue
        const objectId = String(rawId)
        const key = `${entryPath}#${objectId}`
        if (objectMap.has(key)) continue
        const mesh = obj?.mesh || obj?.Mesh
        const vertexNodes = asArray(mesh?.vertices?.vertex || mesh?.vertices?.Vertex)
        const vertices = vertexNodes.map((v) => ({
          x: toNumber(getAttr(v, ["x", "X"])),
          y: toNumber(getAttr(v, ["y", "Y"])),
          z: toNumber(getAttr(v, ["z", "Z"])),
        }))
        const triangleNodes = asArray(mesh?.triangles?.triangle || mesh?.triangles?.Triangle)
        const meshTriangles = []
        if (vertices.length && triangleNodes.length) {
          for (const tri of triangleNodes) {
            const indices = [getAttr(tri, ["v1", "V1"]), getAttr(tri, ["v2", "V2"]), getAttr(tri, ["v3", "V3"])]
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
        const components = []
        for (const comp of componentNodes) {
          const compIdRaw = getAttr(comp, ["objectid", "objectId", "objectID", "object"])
          if (compIdRaw == null) continue
          const compId = String(compIdRaw)
          const compPathRaw = getAttr(comp, ["path", "Path"])
          const targetPath = compPathRaw ? normalizeZipPath(compPathRaw) : entryPath
          if (compPathRaw) queue.push({ path: compPathRaw, collectBuild: false })
          const childKey = `${targetPath}#${compId}`
          components.push({
            key: childKey,
            transform: parseTransformMatrix(getAttr(comp, ["transform", "Transform"])),
          })
        }
        objectMap.set(key, { key, meshTriangles, components })
      }

      if (collectBuild) {
        const buildList = asArray(model.build?.item || model.build?.Item).map((item) => {
          const itemId = getAttr(item, ["objectid", "objectId", "objectID", "id", "ID"])
          if (itemId == null) return null
          const key = `${entryPath}#${String(itemId)}`
          return {
            key,
            transform: parseTransformMatrix(getAttr(item, ["transform", "Transform"])),
          }
        }).filter(v => v)
        buildItems.push(...buildList)
      }
    }
    const triangles = []
    const cache = new Map()

    const resolveObjectTriangles = (rootKey) => {
      if (cache.has(rootKey)) return cache.get(rootKey)

      const frames = [{ key: rootKey, phase: "enter" }]
      const active = new Set()

      while (frames.length) {
        const frame = frames.pop()
        const key = frame.key

        if (frame.phase === "enter") {
          if (cache.has(key)) continue
          if (active.has(key)) {
            console.warn("3MF conversion: detected recursive component reference", { key })
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
          frames.push({ key, phase: "exit" })
          for (let i = obj.components.length - 1; i >= 0; i--) {
            const child = obj.components[i]
            frames.push({ key: child.key, phase: "enter" })
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
      console.warn("3MF conversion: no triangles located in model", { entry: modelEntry.name })
      return null
    }
    return buildBinaryStl(triangles)
  } catch (err) {
    console.warn("3MF conversion to STL failed", err)
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const limitArg = args.find(arg => arg.startsWith("--limit="))
  const limit = limitArg ? Number(limitArg.split("=")[1]) : null
  const prisma = new PrismaClient()
  let processed = 0
  let created = 0
  let skipped = 0
  let failed = 0

  try {
    const parts = await prisma.modelPart.findMany({
      where: {
        previewFilePath: null,
        filePath: { contains: ".3mf", mode: "insensitive" },
      },
    })
    const targets = typeof limit === "number" && Number.isFinite(limit) ? parts.slice(0, limit) : parts
    console.log(`Found ${parts.length} 3MF parts missing previews${limit ? ` (processing ${targets.length})` : ""}.`)

    for (const part of targets) {
      processed++
      const rel = String(part.filePath || "").replace(/^\/+/, "")
      if (!rel.toLowerCase().endsWith(".3mf")) {
        skipped++
        continue
      }
      const full = path.join(storageRoot(), rel)
      if (!(await pathExists(full))) {
        console.warn(`Missing 3MF file on disk: ${part.filePath}`)
        failed++
        continue
      }
      let buf
      try {
        buf = await readFile(full)
      } catch (err) {
        console.warn(`Failed to read ${part.filePath}: ${err?.message || err}`)
        failed++
        continue
      }
      const converted = await convert3mfToStl(buf)
      if (!converted) {
        skipped++
        continue
      }
      const parsed = path.parse(rel)
      const previewRel = path.join(parsed.dir, `${parsed.name}-preview.stl`)
      const previewFull = path.join(storageRoot(), previewRel)
      const previewPath = `/${previewRel.replace(/\\/g, "/")}`

      if (!dryRun) {
        if (!(await pathExists(previewFull))) {
          await ensureDir(path.dirname(previewFull))
          await writeFile(previewFull, converted)
        }
        await prisma.modelPart.update({
          where: { id: part.id },
          data: { previewFilePath: previewPath },
        })
      }
      created++
      console.log(`Preview ${dryRun ? "planned" : "created"} for ${part.id}: ${previewPath}`)
    }
  } catch (err) {
    console.error("Backfill failed:", err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }

  console.log(`Done. processed=${processed} created=${created} skipped=${skipped} failed=${failed}`)
}

if (require.main === module) {
  main()
}
