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
      scene.background = new THREE.Color('#0b0f17')
      const camera = new THREE.PerspectiveCamera(45, width / h, 0.01, 1000)
      camera.position.set(2, 2, 2)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      container.appendChild(renderer.domElement)

      const light1 = new THREE.DirectionalLight(0xffffff, 1)
      light1.position.set(5, 10, 7.5)
      scene.add(light1)
      scene.add(new THREE.AmbientLight(0x888888))

      const controls = new OrbitControls(camera as any, renderer.domElement)
      controls.enableDamping = true
      controls.autoRotate = autoRotate
      controls.autoRotateSpeed = 1.0

      const loader = new STLLoader()
      const group = new THREE.Group()
      scene.add(group)

      const files = srcs && srcs.length ? srcs : (src ? [src] : [])
      const palette = [0x84cc16, 0xf59e0b, 0x3b82f6, 0x10b981, 0xef4444, 0xa855f7]
      let loaded = 0

      const onLoaded = () => {
        group.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(group)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)
        group.position.sub(center)
        group.updateMatrixWorld(true)
        const maxDim = Math.max(size.x, size.y, size.z)
        const radius = maxDim > 0 ? maxDim / 2 : 1
        const scale = radius > 0 ? 1 / radius : 1
        group.scale.setScalar(scale)
        group.updateMatrixWorld(true)
        const fov = THREE.MathUtils.degToRad(camera.fov)
        const distance = 1.8
        const camDist = distance / Math.tan(fov / 2)
        const dir = new THREE.Vector3(2, 1.5, 2).normalize()
        camera.position.copy(dir.multiplyScalar(camDist))
        controls.target.set(0, 0, 0)
        camera.near = 0.01
        camera.far = 1000
        camera.updateProjectionMatrix()
        controls.update()
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
            const material = new THREE.MeshStandardMaterial({ color: palette[idx % palette.length], metalness: 0.2, roughness: 0.6 })
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
        const w = Math.max(1, mountRef.current.clientWidth || 1)
        const hh = h
        renderer.setSize(w, hh)
        camera.aspect = w / hh
        camera.updateProjectionMatrix()
      }
      window.addEventListener('resize', onResize)

      let raf = 0
      const animate = () => {
        controls.update()
        renderer.render(scene, camera)
        raf = requestAnimationFrame(animate)
      }
      animate()

      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
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
