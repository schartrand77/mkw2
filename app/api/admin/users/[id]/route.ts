import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { z } from 'zod'

const patchSchema = z.object({
  suspended: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
}).refine((data) => typeof data.suspended === 'boolean' || typeof data.emailVerified === 'boolean', {
  message: 'No updates provided',
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const userId = params.id
  try {
    const { suspended, emailVerified } = patchSchema.parse(await req.json())
    const updateData: Record<string, boolean> = {}
    if (typeof suspended === 'boolean') updateData.isSuspended = suspended
    if (typeof emailVerified === 'boolean') updateData.emailVerified = emailVerified
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, isSuspended: true, emailVerified: true },
    })
    return NextResponse.json({ user: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const userId = params.id
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (user.isAdmin) return NextResponse.json({ error: 'Cannot delete admin accounts' }, { status: 403 })

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { OR: [{ userId }, { model: { userId } }] } }),
      prisma.modelTag.deleteMany({ where: { model: { userId } } }),
      prisma.model.deleteMany({ where: { userId } }),
      prisma.profile.deleteMany({ where: { userId } }),
      prisma.verificationToken.deleteMany({ where: { userId } }),
      prisma.userAchievement.deleteMany({ where: { userId } }),
      prisma.jobForm.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete user' }, { status: 400 })
  }
}
