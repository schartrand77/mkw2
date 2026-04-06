"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  filterCommandPaletteActions,
  getCommandPaletteActions,
  resolvePaletteRoute,
  type CommandPaletteAction,
} from '@/lib/command-palette'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Props = {
  authed: boolean
  isAdmin: boolean
  cartCount: number
  pathname: string
  open: boolean
  onOpenChange: (nextOpen: boolean) => void
}

export default function CommandPalette({ authed, isAdmin, cartCount, pathname, open, onOpenChange }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const actions = useMemo(
    () => getCommandPaletteActions({ authed, isAdmin, cartCount, pathname }),
    [authed, isAdmin, cartCount, pathname],
  )

  const filteredActions = useMemo(
    () => filterCommandPaletteActions(query, actions),
    [actions, query],
  )

  const activeAction = filteredActions[selectedIndex] || null

  useEffect(() => {
    if (!open) {
      setSelectedIndex(0)
      return
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (isShortcut) {
        event.preventDefault()
        onOpenChange(!open)
        return
      }
      if (event.key === 'Escape') onOpenChange(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpenChange, open])

  const closePalette = () => {
    onOpenChange(false)
    setQuery('')
    setSelectedIndex(0)
  }

  const navigateToAction = (action: CommandPaletteAction) => {
    closePalette()
    router.push(action.href)
  }

  const submitQuery = () => {
    const raw = query.trim()
    if (!raw) {
      closePalette()
      router.push('/discover')
      return
    }

    const route = resolvePaletteRoute(raw)
    if (route.navRoute?.startsWith('/admin') && !isAdmin) {
      pushSessionNotification({ type: 'error', title: 'Admin only', message: 'That command requires admin access.' })
      return
    }

    if (activeAction && !raw.startsWith('#')) {
      navigateToAction(activeAction)
      return
    }

    if (route.navRoute && route.navRoute !== '/discover') {
      closePalette()
      router.push(route.navRoute)
      return
    }

    const params = new URLSearchParams()
    if (route.discoverQuery) params.set('q', route.discoverQuery)
    closePalette()
    router.push(`/discover${params.toString() ? `?${params.toString()}` : ''}`)
  }

  if (!open) return null

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={closePalette}>
      <div
        className="command-palette-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submitQuery()
          }}
          className="command-palette-form"
        >
          <div className="command-palette-header">
            <span className="command-palette-kicker">MakerWorks v3</span>
            <button type="button" className="command-palette-close" onClick={closePalette} aria-label="Close command palette">
              Esc
            </button>
          </div>
          <input
            ref={inputRef}
            className="command-palette-input"
            type="search"
            name="commandPalette"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredActions.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Tab' && filteredActions.length > 0) {
                event.preventDefault()
                setSelectedIndex((current) => (current + 1) % filteredActions.length)
              }
            }}
            placeholder="Search pages, actions, or use tags like #discover #jobs #inventory"
            aria-label="Search commands"
          />
        </form>

        <div className="command-palette-body">
          <div className="command-palette-meta">
            <span>{query.trim() ? `${filteredActions.length} matching actions` : 'Jump anywhere in the app shell'}</span>
            <span className="command-palette-hint">Ctrl/Cmd+K</span>
          </div>

          <div className="command-palette-list" role="listbox" aria-label="Suggested actions">
            {filteredActions.length > 0 ? (
              filteredActions.slice(0, 8).map((action, index) => {
                const active = index === selectedIndex
                const current = action.href === pathname
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`command-palette-item ${active ? 'command-palette-item-active' : ''}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => navigateToAction(action)}
                  >
                    <span className="command-palette-item-main">
                      <span className="command-palette-item-label">
                        {action.label}
                        {current ? <span className="command-palette-item-badge">Current</span> : null}
                        {action.adminOnly ? <span className="command-palette-item-badge">Admin</span> : null}
                      </span>
                      <span className="command-palette-item-description">{action.description}</span>
                    </span>
                    <span className="command-palette-item-path">{action.href}</span>
                  </button>
                )
              })
            ) : (
              <div className="command-palette-empty">
                <p>No direct action matched.</p>
                <p>Press Enter to search Discover for "{query.trim() || 'everything'}".</p>
              </div>
            )}
          </div>

          <div className="command-palette-footer">
            <span>Enter to open</span>
            <span>Arrow keys to move</span>
            <span>#tags for route shortcuts</span>
          </div>
        </div>
      </div>
    </div>
  )
}
