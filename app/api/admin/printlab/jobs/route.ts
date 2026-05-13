import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { fetchPrintLabJobs } from '@/lib/printlab'

export const dynamic = 'force-dynamic'

function matchesQuery(item: Record<string, any>, query: string) {
  if (!query) return true
  const haystack = [
    item.id,
    item.job_id,
    item.status,
    item.printer_id,
    item.printer_name,
    item.model_id,
    item.model_name,
    item.file_name,
    item.file_path,
    item.successful_gcode_id,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

function serializeJob(item: Record<string, any>) {
  return {
    id: item.id ?? item.job_id ?? null,
    status: item.status ?? null,
    printer_id: item.printer_id ?? null,
    printer_name: item.printer_name ?? null,
    model_id: item.model_id ?? null,
    model_name: item.model_name ?? null,
    file_name: item.file_name ?? null,
    file_path: item.file_path ?? null,
    plate_gcode: item.plate_gcode ?? null,
    plate_index: item.plate_index ?? null,
    subtask_name: item.subtask_name ?? null,
    successful_gcode_id: item.successful_gcode_id ?? null,
    completed_at: item.completed_at ?? null,
    started_at: item.started_at ?? null,
    updated_at: item.updated_at ?? null,
  }
}

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'completed'
    const query = (url.searchParams.get('q') || '').trim().toLowerCase()
    const jobs = await fetchPrintLabJobs({ status })
    const items = jobs
      .filter((item: any) => item && typeof item === 'object' && matchesQuery(item, query))
      .slice(0, 50)
      .map((item: any) => serializeJob(item))
    return NextResponse.json({ items, count: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load PrintLab jobs.' }, { status: e.status || 400 })
  }
}
