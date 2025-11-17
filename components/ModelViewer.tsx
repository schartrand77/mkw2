"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Props = {
  src?: string
  srcs?: string[]
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

export default function ModelViewer({ src, srcs, className, height = 480, autoRotate = false }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const fitRef = useRef<(() => void) | null>(null)
  const pivotRef = useRef<THREE.Group | null>(null)
  const contentRef = useRef<THREE.Group | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resolvedFiles = useMemo(() => {
    const list = srcs && srcs.length ? srcs : (src ? [src] : [])
    return list
      .map((item) => toAbsoluteUrl(item))
      .filter((item): item is string => !!item)
  }, [src, srcs])

  useEffect(() => {
    if (!mountRef.current) return
    let disposed = false

    const run = async () => {
      setError(null)
      const container = mountRef.current!
      // Import example helpers dynamically to avoid any bundling/runtime edge cases
      const [{ OrbitControls }, { STLLoader }] = await Promise.all([
        import('three/examples/jsm/controls/OrbitControls'),
        import('three/examples/jsm/loaders/STLLoader'),
      ])

      let OBJLoaderModule: any = null
      let ThreeMFModule: any = null
      try {
        OBJLoaderModule = await import('three/examples/jsm/loaders/OBJLoader.js')
      } catch (err) {
        console.warn('OBJ loader unavailable, OBJ previews disabled', err)
      }
      try {
        ThreeMFModule = await import('three/examples/jsm/loaders/3MFLoader.js')
      } catch (err) {
        console.warn('3MF loader unavailable, 3MF previews disabled', err)
      }

      if (disposed) return

      const width = Math.max(1, container.clientWidth || container.offsetWidth || 1)
      const h = height
      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#000000')
      const camera = new THREE.PerspectiveCamera(45, width / h, 0.001, 5000)
      camera.position.set(2, 1.5, 2)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      container.appendChild(renderer.domElement)
      // Ensure correct initial size after mount
      renderer.setSize(width, h)

      const light1 = new THREE.DirectionalLight(0xffffff, 1)
      light1.position.set(5, 10, 7.5)
      scene.add(light1)
      scene.add(new THREE.AmbientLight(0x888888))
      const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6)
      scene.add(hemi)

      const controls = new OrbitControls(camera as any, renderer.domElement)
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

      const stlLoader = new STLLoader()
      try { (stlLoader as any).setCrossOrigin && (stlLoader as any).setCrossOrigin('anonymous') } catch {}
      const objLoader = OBJLoaderModule ? new OBJLoaderModule.OBJLoader() : null
      const tmfLoader = ThreeMFModule ? new ThreeMFModule.ThreeMFLoader() : null
      const pivot = new THREE.Group()
      scene.add(pivot)
      pivotRef.current = pivot
      const group = new THREE.Group()
      pivot.add(group)
      contentRef.current = group

      const files = resolvedFiles
      const palette = [0xd0d0d0]
      let loaded = 0

      // We cache fit parameters to recompute on resize
      let fitRadius = 1
      const viewDir = new THREE.Vector3(2, 1.5, 2).normalize()
      const paddingFactor = 1.08
      const minZoomFraction = 0.004 // allow users to get very close to the model
      const maxZoomMultiplier = 80
      const fitToView = () => {
        // Object is centered at origin and scaled so its bounding sphere radius = fitRadius
        const vFov = THREE.MathUtils.degToRad(camera.fov)
        // Compute distance to fit object vertically and horizontally
        const distV = fitRadius / Math.tan(vFov / 2)
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
        const distH = fitRadius / Math.tan(hFov / 2)
        const distance = Math.max(distV, distH) * paddingFactor
        const minDist = Math.max(fitRadius * minZoomFraction, 0.002)
        const maxDist = Math.max(distance * maxZoomMultiplier, minDist * 400)
        camera.position.copy(viewDir).multiplyScalar(distance)
        controls.target.set(0, 0, 0)
        // Tighten near/far around scene for better depth precision
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

      const addObject = (object: THREE.Object3D) => {
        group.add(object)
        loaded++
        if (loaded === files.length) onLoaded()
      }

      const meshify = (object: THREE.Object3D, color: number) => {
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

      files.forEach((file, idx) => {
        const ext = file.split('.').pop()?.toLowerCase()
        const color = palette[idx % palette.length]
        const handleError = (err: any) => {
          console.error('Failed to load model', file, err)
          setError(`Failed to load ${file}: ${err?.message || err}`)
          loaded++
          if (loaded === files.length) onLoaded()
        }

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
          tmfLoader.load(
            file,
            (obj: any) => addObject(meshify(obj, color)),
            undefined,
            handleError
          )
          return
        }

        if (ext === 'obj' || ext === '3mf') {
          console.warn('Missing loader for', ext, 'files')
        }

        // Default to STL
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
      // React to container size changes (layout, sidebar toggles, etc.)
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
        renderer.dispose()
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
        fitRef.current = null
        pivotRef.current = null
        contentRef.current = null
      }
    }

    const cleanup = run()

    return () => {
      disposed = true
      cleanup.catch(() => {})
    }
  }, [resolvedFiles, height, autoRotate])

  return (
    <div className={`relative ${className || ''}`} style={{ width: '100%', height }}>
      <div ref={mountRef} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-center px-4 text-sm text-amber-200">
          <div>
            <p>{error}</p>
            {resolvedFiles[0] && (
              <p className="mt-2">
                <a href={resolvedFiles[0]} target="_blank" rel="noreferrer" className="underline">
                  Open STL directly
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
          Rotate 90°
        </button>
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
