'use client'

import { useEffect, useRef, useState } from 'react'

type ShareStatus = 'idle' | 'shared' | 'copied' | 'failed'

type ModelShareButtonProps = {
  title: string
  url: string
}

export default function ModelShareButton({ title, url }: ModelShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>('idle')
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const resetSoon = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => setStatus('idle'), 2000)
  }

  const copyToClipboard = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
      resetSoon()
      return
    }
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    setStatus(ok ? 'copied' : 'failed')
    resetSoon()
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Check out ${title}`, url })
        setStatus('shared')
        resetSoon()
        return
      }
      await copyToClipboard()
    } catch {
      await copyToClipboard()
    }
  }

  const label = status === 'shared'
    ? 'Shared'
    : status === 'copied'
    ? 'Link copied'
    : status === 'failed'
    ? 'Copy failed'
    : 'Share'

  return (
    <button type="button" onClick={handleShare} className="btn">
      {label}
    </button>
  )
}
