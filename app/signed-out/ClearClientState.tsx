"use client"

import { useEffect } from 'react'

export default function ClearClientState() {
  useEffect(() => {
    try {
      localStorage.removeItem('mwv2:avatarUrl')
    } catch {}
    window.dispatchEvent(new CustomEvent('mwv2:avatar:update', { detail: '' }))
  }, [])

  return null
}
