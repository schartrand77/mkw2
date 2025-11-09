import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const log: any = process.env.PRISMA_LOG
  ? (process.env.PRISMA_LOG.split(',') as any)
  : ['error', 'warn']

export const prisma = globalForPrisma.prisma || new PrismaClient({ log })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
