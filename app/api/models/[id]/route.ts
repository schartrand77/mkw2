import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const model = await prisma.model.findUnique({ where: { id: params.id } })
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ model })
}

