"use client"
import { useEffect } from 'react'

export default function ExtensionsGuard() {
  useEffect(() => {
    const neutralize = () => {
      try {
        const nodes = Array.from(document.querySelectorAll('*')) as HTMLElement[]
        for (const el of nodes) {
          const id = el.id || ''
          const cls = el.className?.toString() || ''
          // Heuristic: common Bitwarden overlay containers
          if (/bitwarden|bw-/.test(id + ' ' + cls)) {
            // Only neuter obviously overlay-like nodes
            const style = getComputedStyle(el)
            if (style.position === 'fixed' || style.position === 'absolute') {
              el.style.pointerEvents = 'none'
              el.style.zIndex = '0'
            }
          }
        }
      } catch {}
    }
    neutralize()
    const mo = new MutationObserver(() => neutralize())
    mo.observe(document.documentElement, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
  return null
}

