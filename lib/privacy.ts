import path from 'path'
import { rm } from 'fs/promises'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { storageRoot } from '@/lib/storage'

export async function exportUserPrivacyData(userId: string) {
  const [
    user,
    profile,
    models,
    comments,
    likes,
    downloads,
    orders,
    orderMessages,
    presets,
    pushSubscriptions,
    jobForms,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.model.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.modelComment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.like.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.modelDownload.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.printOrder.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.printOrderMessage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.customerPreset.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.jobForm.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    user,
    profile,
    models,
    comments,
    likes,
    downloads,
    orders,
    orderMessages,
    presets,
    pushSubscriptions,
    jobForms,
  }
}

export async function deleteUserPrivacyData(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.printOrder.updateMany({
      where: { userId },
      data: {
        userId: null,
        customerEmail: null,
        customerName: null,
        metadata: Prisma.JsonNull,
      },
    })
    await tx.jobForm.updateMany({
      where: { userId },
      data: {
        userId: null,
        customerEmail: null,
        metadata: Prisma.JsonNull,
      },
    })
    await tx.user.delete({ where: { id: userId } })
  })

  const userFolder = path.join(storageRoot(), userId)
  try {
    await rm(userFolder, { recursive: true, force: true })
  } catch {
    // best effort storage cleanup
  }
}
