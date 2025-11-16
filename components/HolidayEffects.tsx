"use client"
import { useMemo } from 'react'

export type HolidayTheme = 'christmas' | 'halloween' | 'easter'

type Particle = {
  id: number
  left: number
  delay: number
  duration: number
  size: number
  opacity: number
  variant: number
}

type ParticleConfig = {
  count: number
  className: string
  maxSize: number
  minSize: number
}

const CONFIG: Record<HolidayTheme, ParticleConfig> = {
  christmas: { count: 42, className: 'holiday-snowflake', minSize: 4, maxSize: 10 },
  halloween: { count: 26, className: 'holiday-halloween-candy', minSize: 6, maxSize: 14 },
  easter: { count: 28, className: 'holiday-easter-petal', minSize: 6, maxSize: 16 },
}

function createParticles(theme: HolidayTheme): Particle[] {
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
    }
  })
}

export default function HolidayEffects({ theme }: { theme: HolidayTheme | null }) {
  const particles = useMemo(() => (theme ? createParticles(theme) : []), [theme])
  if (!theme || particles.length === 0) return null
  const { className } = CONFIG[theme]

  return (
    <div className="holiday-effects" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={`${className}-${particle.id}`}
          className={`holiday-particle ${className}`}
          data-variant={particle.variant}
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
