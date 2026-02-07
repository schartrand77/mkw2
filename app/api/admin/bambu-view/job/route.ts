import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { bambuViewDisabledResponse, sendBambuJobAction } from '@/lib/bambu-view'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const payloadSchema = z.object({
  printerId: z.string().min(1),
  action: z.enum(['pause', 'resume', 'stop', 'start']),
  gcodeFile: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    if (!process.env.BAMBU_VIEW_BASE_URL) return bambuViewDisabledResponse()
    const payload = payloadSchema.parse(await req.json())
    const result = await sendBambuJobAction(payload.printerId, payload.action, payload.gcodeFile ? { gcode_file: payload.gcodeFile } : undefined)
    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to send job command' }, { status: 400 })
  }
}
