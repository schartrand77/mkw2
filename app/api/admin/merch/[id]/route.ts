import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { z } from 'zod'
import { storageRoot } from '@/lib/storage'
import path from 'path'
import { unlink } from 'fs/promises'
import { notifyMerchBackInStock } from '@/lib/merch-notify'

export const dynamic = 'force-dynamic'

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(60).optional().nullable(),
  availability: z.enum(['in_stock', 'back_ordered']).optional(),
  priceUsd: z.number().nonnegative().optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  externalUrl: z.string().trim().url().max(500).optional().nullable(),
  ctaLabel: z.string().trim().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

function normalizeSelfHostedImagePath(value?: string | null) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error('Merch image must be uploaded and self-hosted.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Merch image path must start with "/".')
  }
  return trimmed
}

function resolveStorageFilePath(input: string | null | undefined): string | null {
  if (!input) return null
  let normalized = String(input).trim()
  if (!normalized) return null
  if (/^https?:\/\//i.test(normalized)) return null
  normalized = normalized.replace(/\\/g, '/')
  const root = storageRoot()
  const normalizedRoot = root.replace(/\\/g, '/')
  if (normalized.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
    normalized = normalized.slice(normalizedRoot.length)
  }
  normalized = normalized.replace(/^\/+/, '')
  normalized = normalized.replace(/^(?:[a-z]:)?\/?files\//i, '')
  normalized = normalized.replace(/^(?:[a-z]:)?\/?app\/storage\//i, '')
  normalized = normalized.replace(/^(?:[a-z]:)?\/?storage\//i, '')
  normalized = normalized.replace(/^\/+/, '')
  if (!normalized || path.isAbsolute(normalized) || normalized.includes('..')) return null
  return path.join(root, normalized)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { id } = await params
    const parsed = schema.parse(await req.json())
    const existing = await prisma.merchItem.findUnique({
      where: { id },
      select: { imageUrl: true, availability: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const nextImage = parsed.imageUrl === undefined ? undefined : normalizeSelfHostedImagePath(parsed.imageUrl)
    const nextAvailability = parsed.availability ?? existing.availability
    const item = await prisma.merchItem.update({
      where: { id },
      data: {
        title: parsed.title ?? undefined,
        description: parsed.description === undefined ? undefined : (parsed.description || null),
        category: parsed.category === undefined ? undefined : (parsed.category || 'Merch'),
        availability: parsed.availability ?? undefined,
        priceUsd: parsed.priceUsd ?? undefined,
        imageUrl: nextImage,
        externalUrl: parsed.externalUrl === undefined ? undefined : (parsed.externalUrl || null),
        ctaLabel: parsed.ctaLabel === undefined ? undefined : (parsed.ctaLabel || null),
        isActive: parsed.isActive ?? undefined,
        sortOrder: parsed.sortOrder ?? undefined,
      },
    })
    if (parsed.imageUrl !== undefined && existing.imageUrl && existing.imageUrl !== item.imageUrl) {
      const oldFile = resolveStorageFilePath(existing.imageUrl)
      if (oldFile) {
        try { await unlink(oldFile) } catch {}
      }
    }
    let notifyResult: { pending: number; sent: number; failed: number } | null = null
    let notifyWarning: string | null = null
    if (existing.availability === 'back_ordered' && nextAvailability === 'in_stock') {
      try {
        notifyResult = await notifyMerchBackInStock(id)
      } catch (err: any) {
        notifyWarning = err?.message || 'Failed to process back-in-stock notifications.'
      }
    }
    return NextResponse.json({ item, notifyResult, notifyWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { id } = await params
    const existing = await prisma.merchItem.findUnique({
      where: { id },
      select: { imageUrl: true },
    })
    await prisma.merchItem.delete({ where: { id } })
    const filePath = resolveStorageFilePath(existing?.imageUrl || null)
    if (filePath) {
      try { await unlink(filePath) } catch {}
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Delete failed' }, { status: 400 })
  }
}
