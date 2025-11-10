"use client"
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Props = {
  src?: string
  srcs?: string[]
  className?: string
  height?: number
  autoRotate?: boolean
}

export default function ModelViewer({ src, srcs, className, height = 480, autoRotate = false }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mountRef.current) return
    let disposed = false

    const run = async () => {
      const container = mountRef.current!
      // Import example helpers dynamically to avoid any bundling/runtime edge cases
      const [{ OrbitControls }, { STLLoader }] = await Promise.all([
        import('three/examples/jsm/controls/OrbitControls'),
        import('three/examples/jsm/loaders/STLLoader')
      ])

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
      controls.screenSpacePanning = true
      controls.autoRotate = autoRotate
      controls.autoRotateSpeed = 1.0
      controls.zoomSpeed = 0.9

      const loader = new STLLoader()
      try { (loader as any).setCrossOrigin && (loader as any).setCrossOrigin('anonymous') } catch {}
      const group = new THREE.Group()
      scene.add(group)

      const files = srcs && srcs.length ? srcs : (src ? [src] : [])
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

      const onLoaded = () => {
        group.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(group)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)
        // Center object at origin
        group.position.sub(center)
        group.updateMatrixWorld(true)
        // Normalize scale so we have a stable camera fit independent of model units
        const maxDim = Math.max(size.x, size.y, size.z)
        const radius = maxDim > 0 ? maxDim / 2 : 1
        const scale = radius > 0 ? 1 / radius : 1
        group.scale.setScalar(scale)
        group.updateMatrixWorld(true)
        fitRadius = 1 // after normalization, radius ~1
        fitToView()
      }

      if (files.length === 0) {
        console.warn('ModelViewer: no sources provided')
        onLoaded()
      }

      files.forEach((file, idx) => {
        loader.load(
          file,
          (geometry: any) => {
            try {
              if ((geometry as any).computeVertexNormals) (geometry as any).computeVertexNormals()
            } catch {}
            const material = new THREE.MeshStandardMaterial({ color: palette[idx % palette.length], metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide })
            const mesh = new THREE.Mesh(geometry as any, material)
            group.add(mesh)
            loaded++
            if (loaded === files.length) onLoaded()
          },
          undefined,
          (err: any) => {
            console.error('Failed to load STL', file, err)
            loaded++
            if (loaded === files.length) onLoaded()
          }
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
      }
    }

    const cleanup = run()

    return () => {
      disposed = true
      cleanup.catch(() => {})
    }
  }, [src, srcs, height, autoRotate])

  return <div className={className ? className : ''} style={{ width: '100%', height }} ref={mountRef} />
}
