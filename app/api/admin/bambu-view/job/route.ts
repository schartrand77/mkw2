import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { isPrintLabConfigured, printLabDisabledResponse, sendPrintLabJobAction } from '@/lib/printlab'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const payloadSchema = z.object({
  printerId: z.string().min(1),
  action: z.enum(['pause', 'resume', 'stop']),
})

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    if (!(await isPrintLabConfigured())) return printLabDisabledResponse()
    const payload = payloadSchema.parse(await req.json())
    const result = await sendPrintLabJobAction(payload.printerId, payload.action)
    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to send job command' }, { status: 400 })
  }
}
