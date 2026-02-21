"use client"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

export type HolidayTheme = 'christmas' | 'halloween' | 'easter' | 'valentines' | 'maythefourth'
type ParticleTheme = Exclude<HolidayTheme, 'maythefourth'>
type Ship = 'xwing' | 'tie'

type ShipMotion = {
  fromX: number
  fromY: number
  toX: number
  toY: number
  angleDeg: number
  scale: number
}

type ChaseRun = {
  id: number
  durationSec: number
  leader: Ship
  xwing: ShipMotion
  tie: ShipMotion
}

type Particle = {
  id: number
  left: number
  delay: number
  duration: number
  size: number
  opacity: number
  variant: number
  tone: number
}

type EasterPeek = {
  id: number
  left: number
  durationSec: number
  scale: number
  tiltDeg: number
  side: 'left' | 'right'
}

type ParticleConfig = {
  count: number
  className: string
  maxSize: number
  minSize: number
}

const CONFIG: Record<ParticleTheme, ParticleConfig> = {
  christmas: { count: 42, className: 'holiday-snowflake', minSize: 4, maxSize: 10 },
  halloween: { count: 26, className: 'holiday-halloween-candy', minSize: 6, maxSize: 14 },
  easter: { count: 3, className: 'holiday-easter-egg', minSize: 72, maxSize: 132 },
  valentines: { count: 34, className: 'holiday-valentines-candy', minSize: 8, maxSize: 18 },
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function edgePoint(edge: number): { x: number, y: number } {
  switch (edge) {
    case 0: return { x: rand(5, 95), y: -24 } // top
    case 1: return { x: 124, y: rand(5, 95) } // right
    case 2: return { x: rand(5, 95), y: 124 } // bottom
    default: return { x: -24, y: rand(5, 95) } // left
  }
}

function pickLeader(previous: Ship | null): Ship {
  if (!previous) return Math.random() < 0.5 ? 'xwing' : 'tie'
  // Swap roles occasionally so the chase direction changes over time.
  if (Math.random() < 0.35) return previous === 'xwing' ? 'tie' : 'xwing'
  return previous
}

function createChaseRun(previousLeader: Ship | null, id: number): ChaseRun {
  const leader = pickLeader(previousLeader)
  const startEdge = Math.floor(rand(0, 4))
  let endEdge = Math.floor(rand(0, 4))
  while (endEdge === startEdge) endEdge = Math.floor(rand(0, 4))

  const start = edgePoint(startEdge)
  const end = edgePoint(endEdge)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)
  const gap = rand(20, 34)
  const sideOffset = rand(-4, 4)

  const leaderMotion: ShipMotion = {
    fromX: start.x + px * sideOffset,
    fromY: start.y + py * sideOffset,
    toX: end.x + px * sideOffset,
    toY: end.y + py * sideOffset,
    angleDeg,
    scale: rand(0.88, 1.06),
  }

  const followerMotion: ShipMotion = {
    fromX: start.x - ux * gap + px * (sideOffset * 0.5),
    fromY: start.y - uy * gap + py * (sideOffset * 0.5),
    toX: end.x - ux * gap + px * (sideOffset * 0.5),
    toY: end.y - uy * gap + py * (sideOffset * 0.5),
    angleDeg,
    scale: rand(0.84, 1.02),
  }

  return {
    id,
    durationSec: rand(8.5, 12.5),
    leader,
    xwing: leader === 'xwing' ? leaderMotion : followerMotion,
    tie: leader === 'tie' ? leaderMotion : followerMotion,
  }
}

function toShipStyle(motion: ShipMotion, durationSec: number, isLeader: boolean): CSSProperties {
  return {
    ['--from-x' as any]: `${motion.fromX}vw`,
    ['--from-y' as any]: `${motion.fromY}vh`,
    ['--to-x' as any]: `${motion.toX}vw`,
    ['--to-y' as any]: `${motion.toY}vh`,
    ['--ship-angle' as any]: `${motion.angleDeg}deg`,
    ['--ship-scale' as any]: `${motion.scale}`,
    animationDuration: `${durationSec}s`,
    zIndex: isLeader ? 12 : 11,
  }
}

function createParticles(theme: HolidayTheme): Particle[] {
  if (theme === 'maythefourth') return []
  const { count, minSize, maxSize } = CONFIG[theme]
  return Array.from({ length: count }, (_, idx) => {
    const size = Math.random() * (maxSize - minSize) + minSize
    return {
      id: idx,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 8 + Math.random() * 12,
      size,
      opacity: 0.5 + Math.random() * 0.5,
      variant: Math.floor(Math.random() * 3),
      tone: Math.floor(Math.random() * 6),
    }
  })
}

function createEasterPeek(id: number): EasterPeek {
  const side = Math.random() < 0.5 ? 'left' : 'right'
  const left = side === 'left' ? rand(10, 40) : rand(60, 90)
  return {
    id,
    left,
    durationSec: rand(4.2, 5.8),
    scale: rand(0.84, 1.06),
    tiltDeg: side === 'left' ? rand(-8, -2) : rand(2, 8),
    side,
  }
}

export default function HolidayEffects({ theme }: { theme: HolidayTheme | null }) {
  const particles = useMemo(() => (theme && theme !== 'easter' ? createParticles(theme) : []), [theme])
  const [easterPeek, setEasterPeek] = useState<EasterPeek>(() => createEasterPeek(1))
  const [run, setRun] = useState<ChaseRun>(() => createChaseRun(null, 1))
  const easterPeekRef = useRef(1)
  const runRef = useRef(1)
  const leaderRef = useRef<Ship | null>(null)

  useEffect(() => {
    if (theme !== 'maythefourth') return
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      runRef.current += 1
      const next = createChaseRun(leaderRef.current, runRef.current)
      leaderRef.current = next.leader
      setRun(next)
      timer = setTimeout(schedule, Math.max(5000, Math.floor(next.durationSec * 1000)))
    }

    schedule()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [theme])

  useEffect(() => {
    if (theme !== 'easter') return
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      easterPeekRef.current += 1
      const next = createEasterPeek(easterPeekRef.current)
      setEasterPeek(next)
      const gapMs = Math.floor(rand(900, 2300))
      timer = setTimeout(schedule, Math.floor(next.durationSec * 1000) + gapMs)
    }

    schedule()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [theme])

  if (!theme) return null
  if (theme === 'maythefourth') {
    return (
      <div className="holiday-mtf-scene" aria-hidden="true">
        <span
          key={`xwing-${run.id}`}
          className="holiday-mtf-ship holiday-mtf-xwing"
          style={toShipStyle(run.xwing, run.durationSec, run.leader === 'xwing')}
        >
          <span className="holiday-mtf-xwing-core" />
          <span className="holiday-mtf-xwing-wings" />
          <span className="holiday-mtf-xwing-engines" />
          <span className="holiday-mtf-xwing-lasers" />
          <span className="holiday-mtf-laser" />
        </span>
        <span
          key={`tie-${run.id}`}
          className="holiday-mtf-ship holiday-mtf-tie"
          style={toShipStyle(run.tie, run.durationSec, run.leader === 'tie')}
        >
          <span className="holiday-mtf-laser" />
        </span>
      </div>
    )
  }
  if (theme === 'easter') {
    return (
      <div className="holiday-effects holiday-easter-scene" aria-hidden="true">
        <span
          key={`holiday-easter-bunny-${easterPeek.id}`}
          className="holiday-easter-bunny"
          data-side={easterPeek.side}
          style={{
            left: `${easterPeek.left}%`,
            animationDuration: `${easterPeek.durationSec}s`,
            ['--peek-scale' as any]: `${easterPeek.scale}`,
            ['--peek-tilt' as any]: `${easterPeek.tiltDeg}deg`,
          }}
        >
          <span className="holiday-easter-bunny-ear holiday-easter-bunny-ear-left" />
          <span className="holiday-easter-bunny-ear holiday-easter-bunny-ear-right" />
          <span className="holiday-easter-bunny-head">
            <span className="holiday-easter-bunny-eye holiday-easter-bunny-eye-left" />
            <span className="holiday-easter-bunny-eye holiday-easter-bunny-eye-right" />
            <span className="holiday-easter-bunny-nose" />
          </span>
        </span>
      </div>
    )
  }
  if (particles.length === 0) return null
  const { className } = CONFIG[theme]

  return (
    <div className="holiday-effects" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={`${className}-${particle.id}`}
          className={`holiday-particle ${className}`}
          data-variant={particle.variant}
          data-tone={particle.tone}
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
          }}
        />
      ))}
    </div>
  )
}
