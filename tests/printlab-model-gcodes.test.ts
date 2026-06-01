import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { prisma } from '../lib/db'
import {
  buildModelGcodeTemplateSummary,
  modelGcodeCreateData,
  normalizeModelGcodeCapture,
} from '../lib/printlab-model-gcodes'

test('normalizes PrintLab successful G-code captures for model storage', () => {
  const capture = normalizeModelGcodeCapture({
    record_id: 'gcode-1',
    job_id: 'job-1',
    printer_id: 'printer-1',
    printer_name: 'X1C',
    model_name: 'Bracket',
    model_key: 'bracket',
    file_name: 'bracket.gcode.3mf',
    file_path: '/cache/bracket.gcode.3mf',
    plate_gcode: 'Metadata/plate_1.gcode',
    plate_index: 1,
    subtask_name: 'Plate 1',
    use_ams: 'true',
    ams_mapping: ['0', 1],
    material_usage: [
      { material: 'PLA', grams: '18.5', color: 'Black' },
      { filament_type: 'PETG', used_grams: 4.2, colors: ['Clear'] },
      { material: 'PLA', grams: 0 },
    ],
    completed_at: '2026-05-12T15:00:00.000Z',
  }, new Date('2026-05-13T10:00:00.000Z'))

  assert.equal(capture.printLabRecordId, 'gcode-1')
  assert.equal(capture.printLabJobId, 'job-1')
  assert.equal(capture.printerName, 'X1C')
  assert.equal(capture.fileName, 'bracket.gcode.3mf')
  assert.equal(capture.plateIndex, '1')
  assert.equal(capture.useAms, true)
  assert.deepEqual(capture.amsMapping, [0, 1])
  assert.deepEqual(capture.materialUsage, [
    { material: 'PLA', grams: 18.5, colors: ['Black'], source: 'printlab' },
    { material: 'PETG', grams: 4.2, colors: ['Clear'], source: 'printlab' },
  ])
  assert.equal(capture.completedAt?.toISOString(), '2026-05-12T15:00:00.000Z')
})

test('builds model detail print templates from stored G-code captures', () => {
  const capture = normalizeModelGcodeCapture({
    record_id: 'gcode-1',
    printer_name: 'P1S',
    file_name: 'fixture.gcode.3mf',
    plate_gcode: 'Metadata/plate_2.gcode',
    material_usage: [{ material: 'PLA', grams: 12.25, color: 'White' }],
    completed_at: '2026-05-12T16:00:00.000Z',
  })
  const data = modelGcodeCreateData('model-1', capture)

  assert.deepEqual(buildModelGcodeTemplateSummary(data), {
    printLabJobId: null,
    successfulGcodeId: 'gcode-1',
    printerName: 'P1S',
    fileName: 'fixture.gcode.3mf',
    filePath: null,
    plateGcode: 'Metadata/plate_2.gcode',
    plateIndex: null,
    subtaskName: null,
    completedAt: '2026-05-12T16:00:00.000Z',
    useAms: null,
    amsMapping: null,
    exactMaterials: [{ material: 'PLA', grams: 12.25, colors: ['White'], source: 'printlab' }],
  })
})

test('requires a successful G-code record id for model captures', () => {
  assert.throws(
    () => normalizeModelGcodeCapture({ file_name: 'missing-id.gcode.3mf' }),
    /record ID is required/,
  )
})

test('model G-code route upserts authorized PrintLab captures', async () => {
  const { POST } = await import('../app/api/models/[id]/gcodes/route')
  const originalToken = process.env.MAKERWORKS_SUBMIT_API_KEY
  const originalFindUnique = (prisma.model as any).findUnique
  const originalModelGcode = (prisma as any).modelGcode
  let upsertArgs: any = null

  process.env.MAKERWORKS_SUBMIT_API_KEY = 'route-token'
  ;(prisma.model as any).findUnique = async () => ({ id: 'model-1' })
  ;(prisma as any).modelGcode = {
    upsert: async (args: any) => {
      upsertArgs = args
      return {
        id: 'stored-1',
        modelId: 'model-1',
        printLabRecordId: args.create.printLabRecordId,
        printerName: args.create.printerName,
        fileName: args.create.fileName,
        completedAt: args.create.completedAt,
        capturedAt: args.create.capturedAt,
      }
    },
  }

  try {
    const req = new NextRequest('http://localhost/api/models/model-1/gcodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'route-token' },
      body: JSON.stringify({
        record_id: 'gcode-1',
        printer_name: 'X1C',
        file_name: 'bracket.gcode.3mf',
        completed_at: '2026-05-12T15:00:00.000Z',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'model-1' }) })
    const body = await res.json()

    assert.equal(res.status, 200, JSON.stringify(body))
    assert.equal(body.ok, true)
    assert.equal(body.gcode.printLabRecordId, 'gcode-1')
    assert.deepEqual(upsertArgs.where, {
      modelId_printLabRecordId: {
        modelId: 'model-1',
        printLabRecordId: 'gcode-1',
      },
    })
    assert.equal(upsertArgs.create.fileName, 'bracket.gcode.3mf')
    assert.equal(upsertArgs.update.printerName, 'X1C')
  } finally {
    if (originalToken === undefined) delete process.env.MAKERWORKS_SUBMIT_API_KEY
    else process.env.MAKERWORKS_SUBMIT_API_KEY = originalToken
    ;(prisma.model as any).findUnique = originalFindUnique
    ;(prisma as any).modelGcode = originalModelGcode
  }
})

test('model G-code route rejects unauthorized captures', async () => {
  const { POST } = await import('../app/api/models/[id]/gcodes/route')
  const originalToken = process.env.MAKERWORKS_SUBMIT_API_KEY
  process.env.MAKERWORKS_SUBMIT_API_KEY = 'route-token'

  try {
    const req = new NextRequest('http://localhost/api/models/model-1/gcodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'wrong-token' },
      body: JSON.stringify({ record_id: 'gcode-1' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'model-1' }) })
    assert.equal(res.status, 401)
  } finally {
    if (originalToken === undefined) delete process.env.MAKERWORKS_SUBMIT_API_KEY
    else process.env.MAKERWORKS_SUBMIT_API_KEY = originalToken
  }
})
