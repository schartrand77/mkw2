import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { fetchPrintLabSuccessfulGcodes } from '@/lib/printlab'

export const dynamic = 'force-dynamic'

function matchesQuery(item: Record<string, any>, query: string) {
  if (!query) return true
  const haystack = [
    item.id,
    item.record_id,
    item.printer_id,
    item.printer_name,
    item.model_id,
    item.model_name,
    item.model_key,
    item.file_name,
    item.file_path,
    item.plate_gcode,
    item.subtask_name,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

function serializeRecord(item: Record<string, any>) {
  return {
    id: item.id ?? item.record_id ?? null,
    printer_id: item.printer_id ?? null,
    printer_name: item.printer_name ?? null,
    model_id: item.model_id ?? null,
    model_name: item.model_name ?? null,
    model_key: item.model_key ?? null,
    file_name: item.file_name ?? null,
    file_path: item.file_path ?? null,
    plate_gcode: item.plate_gcode ?? null,
    plate_index: item.plate_index ?? null,
    subtask_name: item.subtask_name ?? null,
    use_ams: item.use_ams ?? null,
    ams_mapping: item.ams_mapping ?? null,
    completed_at: item.completed_at ?? null,
    started_at: item.started_at ?? null,
    material_usage: item.material_usage ?? item.materialUsage ?? item.actual_materials ?? item.actualMaterials ?? null,
  }
}

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const query = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase()
    const records = await fetchPrintLabSuccessfulGcodes()
    const items = records
      .filter((item: any) => item && typeof item === 'object' && matchesQuery(item, query))
      .slice(0, 50)
      .map((item: any) => serializeRecord(item))
    return NextResponse.json({ items, count: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load PrintLab successful G-code records.' }, { status: e.status || 400 })
  }
}
