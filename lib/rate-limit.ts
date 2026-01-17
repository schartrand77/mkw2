import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export type RateLimitConfig = {
  windowMs: number
  max: number
  blockDurationMs: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds: number | null
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function msFromSecondsEnv(name: string, fallbackSeconds: number) {
  return readPositiveInt(process.env[name], fallbackSeconds) * 1000
}

export function getAuthRateLimitConfig(kind: 'login' | 'register' | 'resend'): RateLimitConfig {
  if (kind === 'login') {
    return {
      windowMs: msFromSecondsEnv('AUTH_LOGIN_RATE_WINDOW_SECONDS', 15 * 60),
      max: readPositiveInt(process.env.AUTH_LOGIN_RATE_MAX, 5),
      blockDurationMs: msFromSecondsEnv('AUTH_LOGIN_LOCK_SECONDS', 15 * 60),
    }
  }
  if (kind === 'register') {
    return {
      windowMs: msFromSecondsEnv('AUTH_REGISTER_RATE_WINDOW_SECONDS', 60 * 60),
      max: readPositiveInt(process.env.AUTH_REGISTER_RATE_MAX, 5),
      blockDurationMs: msFromSecondsEnv('AUTH_REGISTER_LOCK_SECONDS', 60 * 60),
    }
  }
  return {
    windowMs: msFromSecondsEnv('AUTH_RESEND_RATE_WINDOW_SECONDS', 60 * 60),
    max: readPositiveInt(process.env.AUTH_RESEND_RATE_MAX, 3),
    blockDurationMs: msFromSecondsEnv('AUTH_RESEND_LOCK_SECONDS', 60 * 60),
  }
}

export function getRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real
  const hinted = (req as any).ip
  if (typeof hinted === 'string' && hinted) return hinted
  return 'unknown'
}

function retryAfterSeconds(when: Date, now: Date) {
  const diffMs = when.getTime() - now.getTime()
  return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0
}

export async function checkRateLimit(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const now = new Date()
  const entry = await prisma.rateLimit.findUnique({ where: { key } })
  if (!entry) {
    return {
      allowed: true,
      remaining: cfg.max,
      resetAt: new Date(now.getTime() + cfg.windowMs),
      retryAfterSeconds: null,
    }
  }

  let { count, resetAt, blockedUntil } = entry
  if (resetAt <= now) {
    count = 0
    resetAt = new Date(now.getTime() + cfg.windowMs)
    blockedUntil = null
    await prisma.rateLimit.update({
      where: { key },
      data: { count, resetAt, blockedUntil },
    })
  }

  if (blockedUntil && blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: retryAfterSeconds(blockedUntil, now),
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, cfg.max - count),
    resetAt,
    retryAfterSeconds: null,
  }
}

export async function consumeRateLimit(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const now = new Date()
  const entry = await prisma.rateLimit.findUnique({ where: { key } })

  if (!entry) {
    const resetAt = new Date(now.getTime() + cfg.windowMs)
    await prisma.rateLimit.create({
      data: {
        key,
        count: 1,
        resetAt,
      },
    })
    return {
      allowed: true,
      remaining: Math.max(0, cfg.max - 1),
      resetAt,
      retryAfterSeconds: null,
    }
  }

  let { count, resetAt, blockedUntil } = entry
  if (resetAt <= now) {
    count = 0
    resetAt = new Date(now.getTime() + cfg.windowMs)
    blockedUntil = null
  }

  if (blockedUntil && blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: retryAfterSeconds(blockedUntil, now),
    }
  }

  const nextCount = count + 1
  if (nextCount > cfg.max) {
    blockedUntil = new Date(now.getTime() + cfg.blockDurationMs)
    await prisma.rateLimit.update({
      where: { key },
      data: { count: nextCount, resetAt, blockedUntil },
    })
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: retryAfterSeconds(blockedUntil, now),
    }
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { count: nextCount, resetAt, blockedUntil },
  })

  return {
    allowed: true,
    remaining: Math.max(0, cfg.max - nextCount),
    resetAt,
    retryAfterSeconds: null,
  }
}

export async function clearRateLimit(key: string) {
  try {
    await prisma.rateLimit.delete({ where: { key } })
  } catch {
    // ignore missing entries
  }
}
