"use client"
import { useEffect, useMemo, useRef, useState } from 'react'

type ThreeLib = typeof import('three')
type OrbitControlsModule = typeof import('three/examples/jsm/controls/OrbitControls')
type STLLoaderModule = typeof import('three/examples/jsm/loaders/STLLoader')
type OBJLoaderModule = typeof import('three/examples/jsm/loaders/OBJLoader.js')
type ThreeMFLoaderModule = typeof import('three/examples/jsm/loaders/3MFLoader.js')
type FflateModule = typeof import('three/examples/jsm/libs/fflate.module.js')

let threePromise: Promise<ThreeLib> | null = null
let orbitPromise: Promise<OrbitControlsModule> | null = null
let stlPromise: Promise<STLLoaderModule> | null = null
let objPromise: Promise<OBJLoaderModule> | null = null
let threeMfPromise: Promise<ThreeMFLoaderModule> | null = null
let fflatePromise: Promise<FflateModule> | null = null

function loadThree() {
  if (!threePromise) threePromise = import('three')
  return threePromise
}

function loadOrbitControls() {
  if (!orbitPromise) orbitPromise = import('three/examples/jsm/controls/OrbitControls')
  return orbitPromise
}

function loadStl() {
  if (!stlPromise) stlPromise = import('three/examples/jsm/loaders/STLLoader')
  return stlPromise
}

function loadObj() {
  if (!objPromise) objPromise = import('three/examples/jsm/loaders/OBJLoader.js')
  return objPromise
}

function loadThreeMf() {
  if (!threeMfPromise) threeMfPromise = import('three/examples/jsm/loaders/3MFLoader.js')
  return threeMfPromise
}

function loadFflate() {
  if (!fflatePromise) fflatePromise = import('three/examples/jsm/libs/fflate.module.js')
  return fflatePromise
}

type Props = {
  src?: string
  srcs?: string[]
  fallbackSrc?: string | null
  fallbackSrcs?: Array<string | null | undefined>
  className?: string
  height?: number
  autoRotate?: boolean
}

function toAbsoluteUrl(url?: string | null) {
  if (!url) return null
  if (typeof window === 'undefined') return url
  try {
    return new URL(url, window.location.origin).toString()
  } catch {
    return url
  }
}

function disposeObject(THREE: ThreeLib, object: InstanceType<ThreeLib['Object3D']>) {
  object.traverse((child: any) => {
    if (child.geometry?.dispose) {
      try { child.geometry.dispose() } catch {}
    }
    const material = child.material
    if (Array.isArray(material)) {
      material.forEach((mat) => disposeMaterial(mat))
    } else if (material) {
      disposeMaterial(material)
    }
    if (child.texture?.dispose) {
      try { child.texture.dispose() } catch {}
    }
  })

  function disposeMaterial(mat: any) {
    if (!mat) return
    if (mat.map?.dispose) {
      try { mat.map.dispose() } catch {}
    }
    if (mat.dispose) {
      try { mat.dispose() } catch {}
    }
  }
}

type BambuColorPlan = {
  buildItems: Array<{
    objectId: string
    componentIds: string[]
    componentColors: Array<number | null>
    objectColor: number | null
    modifierIndices: Set<number>
  }>
}

function parseXml(text: string) {
  return new DOMParser().parseFromString(text, 'application/xml')
}

function getMetadataValue(node: Element, key: string) {
  const meta = Array.from(node.children).find((m) => m.tagName === 'metadata' && m.getAttribute('key') === key)
  return meta?.getAttribute('value') || null
}

function hasEmbeddedModelColors(text: string) {
  return /<(?:colorgroup|color|basematerials|texture2d|texture2dgroup|texture2dref)\b/i.test(text)
}

async function tryBuildBambuColorPlan(buffer: ArrayBuffer): Promise<BambuColorPlan | null> {
  const fflate = await loadFflate()
  let zip: Record<string, Uint8Array>
  try {
    zip = fflate.unzipSync(new Uint8Array(buffer))
  } catch {
    return null
  }

  const decoder = new TextDecoder()
  const getText = (path: string) => {
    const data = zip[path]
    if (!data) return null
    return decoder.decode(data)
  }

  const modelSettings = getText('Metadata/model_settings.config')
  const sliceInfo = getText('Metadata/slice_info.config')
  const mainModel = getText('3D/3dmodel.model')
  if (!modelSettings || !sliceInfo || !mainModel) return null

  for (const name of Object.keys(zip)) {
    if (name.toLowerCase().endsWith('.model')) {
      const content = decoder.decode(zip[name])
      if (hasEmbeddedModelColors(content)) return null
    }
  }

  const sliceDoc = parseXml(sliceInfo)
  const filamentNodes = Array.from(sliceDoc.getElementsByTagName('filament'))
  const extruderColors = new Map<string, number>()
  for (const fil of filamentNodes) {
    const id = fil.getAttribute('id')
    const color = fil.getAttribute('color')
    if (!id || !color) continue
    const hex = color.trim().replace('#', '')
    if (hex.length < 6) continue
    const value = Number.parseInt(hex.slice(0, 6), 16)
    if (Number.isFinite(value)) extruderColors.set(id, value)
  }
  if (extruderColors.size === 0) return null

  const settingsDoc = parseXml(modelSettings)
  const objectNodes = Array.from(settingsDoc.getElementsByTagName('object'))
  const objectExtruders = new Map<string, string>()
  const partIndexExtruders = new Map<string, Map<number, string>>()
  const partIndexModifiers = new Map<string, Set<number>>()
  for (const obj of objectNodes) {
    const objId = obj.getAttribute('id')
    const objectExtruder = getMetadataValue(obj, 'extruder')
    if (objId && objectExtruder) objectExtruders.set(objId, objectExtruder)
    const parts = Array.from(obj.getElementsByTagName('part'))
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const partExtruder = getMetadataValue(part, 'extruder') || objectExtruder
      if (objId && partExtruder) {
        if (!partIndexExtruders.has(objId)) partIndexExtruders.set(objId, new Map())
        partIndexExtruders.get(objId)!.set(i, partExtruder)
      }
      const subtype = part.getAttribute('subtype')
      if (objId && subtype === 'modifier_part') {
        if (!partIndexModifiers.has(objId)) partIndexModifiers.set(objId, new Set())
        partIndexModifiers.get(objId)!.add(i)
      }
    }
  }
  if (objectExtruders.size === 0 && partIndexExtruders.size === 0) return null

  const modelDoc = parseXml(mainModel)
  const objectMap = new Map<string, string[]>()
  const modelObjects = Array.from(modelDoc.getElementsByTagName('object'))
  for (const obj of modelObjects) {
    const objectId = obj.getAttribute('id')
    if (!objectId) continue
    const componentsNode = obj.getElementsByTagName('components')[0]
    if (!componentsNode) continue
    const componentIds = Array.from(componentsNode.getElementsByTagName('component'))
      .map((comp) => comp.getAttribute('objectid'))
      .filter((id): id is string => !!id)
    objectMap.set(objectId, componentIds)
  }

  const buildNode = modelDoc.getElementsByTagName('build')[0]
  if (!buildNode) return null
  const items = Array.from(buildNode.getElementsByTagName('item'))
  const buildItems: BambuColorPlan['buildItems'] = []
  for (const item of items) {
    const objectId = item.getAttribute('objectid')
    if (!objectId) continue
    const components = objectMap.get(objectId)
    const componentIds = components && components.length > 0 ? components : []
    const partMap = partIndexExtruders.get(objectId)
    const modifierSet = partIndexModifiers.get(objectId) || new Set<number>()
    const componentColors: Array<number | null> = []
    if (componentIds.length > 0) {
      for (let i = 0; i < componentIds.length; i++) {
        const extruderId = partMap?.get(i) || objectExtruders.get(objectId) || null
        const color = extruderId ? extruderColors.get(extruderId) ?? null : null
        componentColors.push(color ?? null)
      }
    }
    const objectExtruder = objectExtruders.get(objectId) || null
    const objectColor = objectExtruder ? extruderColors.get(objectExtruder) ?? null : null
    buildItems.push({ objectId, componentIds, componentColors, objectColor, modifierIndices: modifierSet })
  }
  if (buildItems.length === 0) return null

  const hasAnyColor = buildItems.some((item) => item.objectColor != null || item.componentColors.some((c) => c != null))
  if (!hasAnyColor) return null

  return { buildItems }
}

function applyBambuColors(THREE: ThreeLib, root: InstanceType<ThreeLib['Object3D']>, plan: BambuColorPlan) {
  const { buildItems } = plan
  const buildChildren = root.children || []

  const applyColorTo = (obj: InstanceType<ThreeLib['Object3D']>, color: number) => {
    obj.traverse((child: any) => {
      if (!(child instanceof THREE.Mesh)) return
      const material = child.material
      const setMatColor = (mat: any) => {
        if (!mat || !mat.color) return
        mat.color.setHex(color)
        mat.needsUpdate = true
      }
      if (Array.isArray(material)) material.forEach((m) => setMatColor(m))
      else setMatColor(material)
    })
  }

  for (let i = 0; i < Math.min(buildChildren.length, buildItems.length); i++) {
    const buildChild = buildChildren[i]
    const item = buildItems[i]
    const componentIds = item.componentIds
    if (!componentIds || componentIds.length === 0) {
      if (item.objectColor != null) applyColorTo(buildChild, item.objectColor)
      continue
    }

    const componentChildren = buildChild.children || []
    if (componentChildren.length > 0) {
      for (let j = 0; j < Math.min(componentChildren.length, componentIds.length); j++) {
        if (item.modifierIndices.has(j)) {
          componentChildren[j].visible = false
          continue
        }
        const color = item.componentColors[j]
        if (color != null) applyColorTo(componentChildren[j], color)
      }
      if (componentChildren.length < componentIds.length) {
        const fallback = item.componentColors.find((c) => c != null) ?? item.objectColor
        if (fallback != null) applyColorTo(buildChild, fallback)
      }
    } else if (componentIds.length === 1 && item.componentColors[0] != null) {
      if (!item.modifierIndices.has(0)) {
        applyColorTo(buildChild, item.componentColors[0] as number)
      } else {
        buildChild.visible = false
      }
    } else if (item.objectColor != null) {
      applyColorTo(buildChild, item.objectColor)
    } else {
      const fallback = item.componentColors.find((c) => c != null)
      if (fallback != null) applyColorTo(buildChild, fallback)
    }
  }
}

type ParsedMesh = {
  vertices: Float32Array
  indices: Uint32Array
}

type ParsedComponent = {
  objectId: string
  path: string | null
  transform: InstanceType<ThreeLib['Matrix4']> | null
}

type ParsedObject = {
  mesh?: ParsedMesh
  components?: ParsedComponent[]
}

type ParsedModelPart = {
  objects: Map<string, ParsedObject>
}

function parseTransformMatrix(THREE: ThreeLib, transform?: string | null) {
  if (!transform) return null
  const t = transform.trim().split(/\s+/).map((n) => Number.parseFloat(n))
  if (t.length < 12 || t.some((v) => !Number.isFinite(v))) return null
  const matrix = new THREE.Matrix4()
  matrix.set(
    t[0], t[3], t[6], t[9],
    t[1], t[4], t[7], t[10],
    t[2], t[5], t[8], t[11],
    0, 0, 0, 1
  )
  return matrix
}

function parseMeshNode(meshNode: Element): ParsedMesh {
  const vertexNodes = Array.from(meshNode.getElementsByTagName('vertex'))
  const vertices: number[] = []
  for (const v of vertexNodes) {
    vertices.push(
      Number.parseFloat(v.getAttribute('x') || '0'),
      Number.parseFloat(v.getAttribute('y') || '0'),
      Number.parseFloat(v.getAttribute('z') || '0'),
    )
  }
  const triNodes = Array.from(meshNode.getElementsByTagName('triangle'))
  const indices: number[] = []
  for (const tri of triNodes) {
    indices.push(
      Number.parseInt(tri.getAttribute('v1') || '0', 10),
      Number.parseInt(tri.getAttribute('v2') || '0', 10),
      Number.parseInt(tri.getAttribute('v3') || '0', 10),
    )
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  }
}

function parseModelPart(THREE: ThreeLib, xmlText: string): ParsedModelPart {
  const doc = parseXml(xmlText)
  const objects = new Map<string, ParsedObject>()
  const objectNodes = Array.from(doc.getElementsByTagName('object'))
  for (const obj of objectNodes) {
    const id = obj.getAttribute('id')
    if (!id) continue
    const meshNode = obj.getElementsByTagName('mesh')[0]
    const componentsNode = obj.getElementsByTagName('components')[0]
    const parsed: ParsedObject = {}
    if (meshNode) parsed.mesh = parseMeshNode(meshNode)
    if (componentsNode) {
      const comps: ParsedComponent[] = []
      const compNodes = Array.from(componentsNode.getElementsByTagName('component'))
      for (const comp of compNodes) {
        const objectId = comp.getAttribute('objectid')
        if (!objectId) continue
        const rawPath = comp.getAttribute('p:path') || comp.getAttribute('path') || null
        const transform = parseTransformMatrix(THREE, comp.getAttribute('transform'))
        comps.push({ objectId, path: rawPath, transform })
      }
      parsed.components = comps
    }
    objects.set(id, parsed)
  }
  return { objects }
}

async function parse3mfSimple(THREE: ThreeLib, buffer: ArrayBuffer) {
  const fflate = await loadFflate()
  let zip: Record<string, Uint8Array>
  try {
    zip = fflate.unzipSync(new Uint8Array(buffer))
  } catch {
    return null
  }
  const decoder = new TextDecoder()
  const modelParts = new Map<string, ParsedModelPart>()
  let mainModelText: string | null = null

  for (const name of Object.keys(zip)) {
    if (!name.toLowerCase().endsWith('.model')) continue
    const xmlText = decoder.decode(zip[name])
    const part = parseModelPart(THREE, xmlText)
    const normalized = name.replace(/^\//, '')
    modelParts.set(normalized, part)
    if (name.toLowerCase() === '3d/3dmodel.model') mainModelText = xmlText
  }
  if (!mainModelText) return null

  const mainDoc = parseXml(mainModelText)
  const buildNode = mainDoc.getElementsByTagName('build')[0]
  if (!buildNode) return null
  const buildItems = Array.from(buildNode.getElementsByTagName('item'))

  const mainPart = modelParts.get('3D/3dmodel.model')
  if (!mainPart) return null

  const buildObject3D = (part: ParsedModelPart, objectId: string): InstanceType<ThreeLib['Object3D']> | null => {
    const obj = part.objects.get(objectId)
    if (!obj) return null
    if (obj.mesh) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(obj.mesh.vertices, 3))
      geometry.setIndex(new THREE.BufferAttribute(obj.mesh.indices, 1))
      geometry.computeVertexNormals()
      const material = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide })
      return new THREE.Mesh(geometry, material)
    }
    if (obj.components && obj.components.length > 0) {
      const group = new THREE.Group()
      for (const comp of obj.components) {
        const path = comp.path ? comp.path.replace(/^\//, '') : null
        const compPart = path ? modelParts.get(path) : part
        if (!compPart) continue
        const child = buildObject3D(compPart, comp.objectId)
        if (!child) continue
        if (comp.transform) child.applyMatrix4(comp.transform)
        group.add(child)
      }
      return group
    }
    return null
  }

  const root = new THREE.Group()
  for (const item of buildItems) {
    const objectId = item.getAttribute('objectid')
    if (!objectId) continue
    const child = buildObject3D(mainPart, objectId)
    if (!child) continue
    const transform = parseTransformMatrix(THREE, item.getAttribute('transform'))
    if (transform) child.applyMatrix4(transform)
    root.add(child)
  }

  if (root.children.length === 0) return null
  return root
}

export default function ModelViewer({ src, srcs, fallbackSrc, fallbackSrcs, className, height = 480, autoRotate = false }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const fitRef = useRef<(() => void) | null>(null)
  const pivotRef = useRef<InstanceType<ThreeLib['Group']> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileEntries = useMemo(() => {
    const list = srcs && srcs.length ? srcs : (src ? [src] : [])
    const fallbacks = fallbackSrcs && fallbackSrcs.length ? fallbackSrcs : (fallbackSrc ? [fallbackSrc] : [])
    return list
      .map((item, idx) => ({
        src: toAbsoluteUrl(item),
        fallback: fallbacks[idx] ? toAbsoluteUrl(fallbacks[idx]) : null,
      }))
      .filter((item): item is { src: string, fallback: string | null } => !!item.src)
  }, [src, srcs, fallbackSrc, fallbackSrcs])

  useEffect(() => {
    if (!mountRef.current) return
    let disposed = false
    let cleanupFn: (() => void) | null = null

    const run = async () => {
      setError(null)
      const container = mountRef.current!
      const [THREE, OrbitControlsMod, STLLoaderMod] = await Promise.all([loadThree(), loadOrbitControls(), loadStl()])

      const OBJLoaderModule = await loadObj().catch((err) => {
        console.warn('OBJ loader unavailable, OBJ previews disabled', err)
        return null
      })
      const ThreeMFModule = await loadThreeMf().catch((err) => {
        console.warn('3MF loader unavailable, 3MF previews disabled', err)
        return null
      })

      if (disposed || !mountRef.current) return

      const width = Math.max(1, container.clientWidth || container.offsetWidth || 1)
      const h = height
      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#000000')
      const camera = new THREE.PerspectiveCamera(45, width / h, 0.001, 5000)
      camera.position.set(2, 1.5, 2)
      let renderer: InstanceType<ThreeLib['WebGLRenderer']>
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch (err) {
        const WebGL1Renderer = (THREE as any).WebGL1Renderer
        if (WebGL1Renderer) {
          try {
            renderer = new WebGL1Renderer({ antialias: true, alpha: true })
          } catch {
            throw new Error('Unable to initialize WebGL. Check hardware acceleration or GPU/WebGL support.')
          }
        } else {
          throw new Error('Unable to initialize WebGL. Check hardware acceleration or GPU/WebGL support.')
        }
      }
      renderer.setSize(width, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1
      container.appendChild(renderer.domElement)

      const light1 = new THREE.DirectionalLight(0xffffff, 1)
      light1.position.set(5, 10, 7.5)
      scene.add(light1)
      scene.add(new THREE.AmbientLight(0x888888))
      const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6)
      scene.add(hemi)

      const controls = new OrbitControlsMod.OrbitControls(camera as any, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.screenSpacePanning = false
      ;(controls as any).enablePan = false
      controls.autoRotate = autoRotate
      controls.autoRotateSpeed = 1.0
      controls.zoomSpeed = 0.9
      ;(controls as any).minAzimuthAngle = -Infinity
      ;(controls as any).maxAzimuthAngle = Infinity
      ;(controls as any).minPolarAngle = 0
      ;(controls as any).maxPolarAngle = Math.PI

      const stlLoader = new STLLoaderMod.STLLoader()
      try { (stlLoader as any).setCrossOrigin && (stlLoader as any).setCrossOrigin('anonymous') } catch {}
      const objLoader = OBJLoaderModule ? new OBJLoaderModule.OBJLoader() : null
      const tmfLoader = ThreeMFModule ? new ThreeMFModule.ThreeMFLoader() : null
      const pivot = new THREE.Group()
      scene.add(pivot)
      pivotRef.current = pivot
      const group = new THREE.Group()
      pivot.add(group)

      const files = fileEntries
      const palette = [0xd0d0d0]
      let loaded = 0

      let fitRadius = 1
      const viewDir = new THREE.Vector3(2, 1.5, 2).normalize()
      const paddingFactor = 1.08
      const minZoomFraction = 0.004
      const maxZoomMultiplier = 80
      const fitToView = () => {
        const vFov = THREE.MathUtils.degToRad(camera.fov)
        const distV = fitRadius / Math.tan(vFov / 2)
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
        const distH = fitRadius / Math.tan(hFov / 2)
        const distance = Math.max(distV, distH) * paddingFactor
        const minDist = Math.max(fitRadius * minZoomFraction, 0.002)
        const maxDist = Math.max(distance * maxZoomMultiplier, minDist * 400)
        camera.position.copy(viewDir).multiplyScalar(distance)
        controls.target.set(0, 0, 0)
        controls.minDistance = minDist
        controls.maxDistance = maxDist
        camera.near = Math.max(0.0001, minDist * 0.5)
        camera.far = Math.max(maxDist * 2, distance * 50)
        camera.updateProjectionMatrix()
        controls.update()
      }
      fitRef.current = fitToView

      const onLoaded = () => {
        group.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(group)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)
        const radius = Math.max(size.x, size.y, size.z) / 2 || 1
        group.position.sub(center)
        group.updateMatrixWorld(true)
        fitRadius = radius
        fitToView()
      }

      if (files.length === 0) {
        console.warn('ModelViewer: no sources provided')
        onLoaded()
      }

      const addObject = (object: InstanceType<ThreeLib['Object3D']>) => {
        if (disposed) {
          disposeObject(THREE, object)
          return
        }
        group.add(object)
        loaded++
        if (loaded === files.length) onLoaded()
      }

      const meshify = (object: InstanceType<ThreeLib['Object3D']>, color: number) => {
        object.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color,
              metalness: 0.05,
              roughness: 0.9,
              side: THREE.DoubleSide,
            })
          }
        })
        return object
      }

      const preserveMaterials = (object: InstanceType<ThreeLib['Object3D']>) => {
        object.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            const geometry = child.geometry
            const hasVertexColors = Boolean(geometry?.attributes?.color)
            const material = child.material
            const tune = (mat: any) => {
              if (!mat) return
              if ('side' in mat) mat.side = THREE.DoubleSide
              if (hasVertexColors && 'vertexColors' in mat) mat.vertexColors = true
              if (mat.map && 'colorSpace' in mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
            }
            if (Array.isArray(material)) {
              material.forEach((mat) => tune(mat))
            } else {
              tune(material)
            }
          }
        })
        return object
      }

      files.forEach((entry, idx) => {
        const file = entry.src
        const fallback = entry.fallback
        const ext = file.split('.').pop()?.toLowerCase()
        const color = palette[idx % palette.length]
        const handleError = (err: any, attemptedFile = file) => {
          console.error('Failed to load model', attemptedFile, err)
          setError(`Failed to load ${attemptedFile}: ${err?.message || err}`)
          loaded++
          if (loaded === files.length) onLoaded()
        }
        console.info('[ModelViewer] file entry', { file, ext, has3mf: ext === '3mf', hasTmfLoader: Boolean(tmfLoader) })

        if (ext === 'obj' && objLoader) {
          objLoader.load(
            file,
            (obj: any) => addObject(meshify(obj, color)),
            undefined,
            handleError
          )
          return
        }

        if (ext === '3mf' && tmfLoader) {
          ;(async () => {
            try {
              console.info('[ModelViewer] loading 3MF', file)
              const res = await fetch(file)
              if (!res.ok) throw new Error(`Failed to fetch ${file}`)
              const buf = await res.arrayBuffer()
              let obj: InstanceType<ThreeLib['Object3D']> | null = null
              let parsedWithFallback = false
              try {
                obj = tmfLoader.parse(buf)
              } catch (parseErr) {
                console.warn('[ModelViewer] 3MF loader parse failed, trying fallback parser', parseErr)
                obj = await parse3mfSimple(THREE, buf)
                parsedWithFallback = Boolean(obj)
              }
              if (!obj) throw new Error('3MF parsing failed')
              const plan = await tryBuildBambuColorPlan(buf)
              console.info('[ModelViewer] 3MF bambu color plan', {
                hasPlan: Boolean(plan),
                buildCount: plan?.buildItems.length || 0,
                items: plan?.buildItems.map((item) => ({
                  objectId: item.objectId,
                  componentCount: item.componentIds.length,
                  componentColors: item.componentColors,
                  objectColor: item.objectColor,
                })),
                fallbackParser: parsedWithFallback,
              })
              if (plan) applyBambuColors(THREE, obj, plan)
              addObject(preserveMaterials(obj))
            } catch (err: any) {
              console.error('[ModelViewer] 3MF load error', err)
              if (fallback) {
                console.info('[ModelViewer] 3MF failed, falling back to STL', { file, fallback })
                stlLoader.load(
                  fallback,
                  (geometry: any) => {
                    try {
                      if ((geometry as any).computeVertexNormals) (geometry as any).computeVertexNormals()
                    } catch {}
                    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide })
                    const mesh = new THREE.Mesh(geometry as any, material)
                    addObject(mesh)
                  },
                  undefined,
                  (fallbackErr: any) => handleError(fallbackErr, fallback)
                )
              } else {
                handleError(err)
              }
            }
          })()
          return
        }

        if (ext === 'obj' || ext === '3mf') {
          if (ext === '3mf' && fallback) {
            console.warn('Missing 3MF loader, falling back to STL preview', file)
            stlLoader.load(
              fallback,
              (geometry: any) => {
                try {
                  if ((geometry as any).computeVertexNormals) (geometry as any).computeVertexNormals()
                } catch {}
                const material = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide })
                const mesh = new THREE.Mesh(geometry as any, material)
                addObject(mesh)
              },
              undefined,
              (fallbackErr: any) => handleError(fallbackErr, fallback)
            )
            return
          }
          console.warn('Missing loader for', ext, 'files')
        }

        stlLoader.load(
          file,
          (geometry: any) => {
            try {
              if ((geometry as any).computeVertexNormals) (geometry as any).computeVertexNormals()
            } catch {}
            const material = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide })
            const mesh = new THREE.Mesh(geometry as any, material)
            addObject(mesh)
          },
          undefined,
          handleError
        )
      })

      const onResize = () => {
        if (!mountRef.current) return
        const w = Math.max(1, mountRef.current.clientWidth || mountRef.current.offsetWidth || 1)
        const hh = h
        renderer.setSize(w, hh)
        camera.aspect = w / hh
        camera.updateProjectionMatrix()
        fitToView()
      }
      window.addEventListener('resize', onResize)
      let ro: ResizeObserver | null = null
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => onResize())
        ro.observe(container)
      }

      let raf = 0
      const animate = () => {
        controls.update()
        renderer.render(scene, camera)
        raf = requestAnimationFrame(animate)
      }
      onResize()
      animate()

      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
        if (ro) ro.disconnect()
        controls.dispose?.()
        disposeObject(THREE, group)
        pivot.clear()
        renderer.dispose()
        renderer.forceContextLoss?.()
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
        fitRef.current = null
        pivotRef.current = null
        scene.clear()
      }
    }

    run()
      .then((fn) => {
        if (disposed) {
          if (fn) {
            try { fn() } catch {}
          }
          return
        }
        cleanupFn = fn || null
      })
      .catch((err) => {
        console.error('Model viewer failed to start', err)
        setError(err?.message || 'Failed to load model')
      })

    return () => {
      disposed = true
      if (cleanupFn) {
        try { cleanupFn() } catch {}
        cleanupFn = null
      }
    }
  }, [fileEntries, height, autoRotate])

  const firstEntry = fileEntries[0]
  const errorLink = firstEntry?.fallback || firstEntry?.src
  const errorLabel = firstEntry?.fallback ? 'Open STL directly' : 'Open file directly'

  return (
    <div className={`relative ${className || ''}`} style={{ width: '100%', height }}>
      <div ref={mountRef} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-center px-4 text-sm text-amber-200">
          <div>
            <p>{error}</p>
            {errorLink && (
              <p className="mt-2">
                <a href={errorLink} target="_blank" rel="noreferrer" className="underline">
                  {errorLabel}
                </a>
              </p>
            )}
          </div>
        </div>
      )}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => {
            const pivot = pivotRef.current
            if (pivot) {
              pivot.rotation.z += Math.PI / 2
              pivot.updateMatrixWorld(true)
              fitRef.current?.()
            }
          }}
          className="px-3 py-1.5 text-xs rounded-md border border-white/20 bg-black/40 backdrop-blur hover:border-white/40"
        >
          Rotate 90</button>
        <button
          type="button"
          onClick={() => fitRef.current?.()}
          className="px-3 py-1.5 text-xs rounded-md border border-white/20 bg-black/40 backdrop-blur hover:border-white/40"
        >
          Center view
        </button>
      </div>
    </div>
  )
}

