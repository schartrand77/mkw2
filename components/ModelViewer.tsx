"use client"
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

export default function ModelViewer({ src }: { src: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 480
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b0f17')
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(2, 2, 2)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mountRef.current.appendChild(renderer.domElement)

    const light1 = new THREE.DirectionalLight(0xffffff, 1)
    light1.position.set(5, 10, 7.5)
    scene.add(light1)
    scene.add(new THREE.AmbientLight(0x888888))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const loader = new STLLoader()
    loader.load(src, (geometry) => {
      geometry.computeVertexNormals()
      const material = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.2, roughness: 0.6 })
      const mesh = new THREE.Mesh(geometry, material)
      geometry.center()
      // Auto scale to fit
      geometry.computeBoundingSphere()
      const bs = geometry.boundingSphere
      if (bs) {
        const scale = 1 / (bs.radius || 1)
        mesh.scale.setScalar(scale)
      }
      scene.add(mesh)
      camera.lookAt(0, 0, 0)
    })

    const onResize = () => {
      if (!mountRef.current) return
      const w = mountRef.current.clientWidth
      const h = height
      renderer.setSize(w, h)
      camera.aspect = w / h
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
      renderer.dispose()
      mountRef.current?.removeChild(renderer.domElement)
    }
  }, [src])

  return <div className="rounded-xl overflow-hidden border border-white/10" ref={mountRef} />
}

