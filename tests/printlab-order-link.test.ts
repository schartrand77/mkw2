import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildManualPrintLabAttachment,
  buildModelPrintTemplateSummary,
  findSuccessfulGcodeRecord,
  hasExactPrintLabMaterialUsage,
  mergePrintLabOrderAttachment,
  normalizePrintLabSubmittedJobAttachment,
  normalizeSuccessfulGcodeAttachment,
  resolveOrderStatusFromPrintLabAttachment,
} from '../lib/printlab-order-link'
import { extractPrintLabSubmissionSummary } from '../lib/production'

test('normalizes a completed submitted PrintLab job with execution metadata', () => {
  const attachment = normalizePrintLabSubmittedJobAttachment({
    id: 'pl-job-1',
    status: 'completed',
    printer_id: 'printer-1',
    printer_name: 'X1C',
    queue_item_id: 'queue-1',
    successful_gcode_id: 'gcode-1',
    model_id: 'model-1',
    model_name: 'Bracket',
    file_name: 'bracket.gcode.3mf',
    file_path: '/cache/bracket.gcode.3mf',
    plate_gcode: 'Metadata/plate_1.gcode',
    plate_index: 1,
    subtask_name: 'Plate 1',
    use_ams: false,
    progress_percent: 100,
    current_layer: 240,
    total_layers: 240,
    slicer_stats: {
      materials: [
        { filament_type: 'PLA', used_grams: '18.4', color_name: 'Black' },
      ],
    },
    started_at: '2026-05-12T12:00:00.000Z',
    completed_at: '2026-05-12T14:00:00.000Z',
    updated_at: '2026-05-12T14:01:00.000Z',
    last_error: '',
  }, { adminId: 'admin-1', note: 'matched by search' }, '2026-05-13T10:00:00.000Z')

  assert.equal(attachment.at, '2026-05-13T10:00:00.000Z')
  assert.equal(attachment.source, 'printlab_admin_link')
  assert.equal(attachment.actor, 'makerworks_admin')
  assert.equal(attachment.adminId, 'admin-1')
  assert.equal(attachment.note, 'matched by search')
  assert.equal(attachment.recordType, 'submitted_job')
  assert.equal(attachment.printLabJobId, 'pl-job-1')
  assert.equal(attachment.successfulGcodeId, 'gcode-1')
  assert.equal(attachment.status, 'completed')
  assert.equal(attachment.printerId, 'printer-1')
  assert.equal(attachment.printerName, 'X1C')
  assert.equal(attachment.queueItemId, 'queue-1')
  assert.equal(attachment.modelId, 'model-1')
  assert.equal(attachment.modelName, 'Bracket')
  assert.equal(attachment.fileName, 'bracket.gcode.3mf')
  assert.equal(attachment.filePath, '/cache/bracket.gcode.3mf')
  assert.equal(attachment.plateGcode, 'Metadata/plate_1.gcode')
  assert.equal(attachment.plateIndex, '1')
  assert.equal(attachment.subtaskName, 'Plate 1')
  assert.equal(attachment.useAms, false)
  assert.equal(attachment.amsMapping, null)
  assert.equal(attachment.progressPercent, 100)
  assert.equal(attachment.currentLayer, 240)
  assert.equal(attachment.totalLayers, 240)
  assert.equal(attachment.startedAt, '2026-05-12T12:00:00.000Z')
  assert.equal(attachment.completedAt, '2026-05-12T14:00:00.000Z')
  assert.equal(attachment.updatedAt, '2026-05-12T14:01:00.000Z')
  assert.equal(attachment.error, null)
  assert.deepEqual(attachment.exactMaterials, [
    { material: 'PLA', grams: 18.4, colors: ['Black'], source: 'printlab' },
  ])
})

test('normalizes a successful G-code record with plate and material usage lines', () => {
  const attachment = normalizeSuccessfulGcodeAttachment({
    id: 'gcode-1',
    printer_id: 'printer-1',
    printer_name: 'P1S',
    model_id: 'model-2',
    model_name: 'Fixture',
    file_name: 'fixture.gcode.3mf',
    file_path: '/cache/fixture.gcode.3mf',
    plate_gcode: 'Metadata/plate_2.gcode',
    plate_index: 2,
    subtask_name: 'Plate 2',
    use_ams: true,
    ams_mapping: [0, 1],
    material_usage: [
      { material: 'PLA', grams: 18.4, color: 'Black' },
      { filamentType: 'PETG', weightGrams: 6.2, colors: ['Clear'] },
    ],
    completed_at: '2026-05-12T15:00:00.000Z',
  }, { adminId: 'admin-1' }, '2026-05-13T10:00:00.000Z')

  assert.equal(attachment.recordType, 'successful_gcode')
  assert.equal(attachment.printLabJobId, null)
  assert.equal(attachment.successfulGcodeId, 'gcode-1')
  assert.equal(attachment.status, 'completed')
  assert.equal(attachment.printerName, 'P1S')
  assert.equal(attachment.plateGcode, 'Metadata/plate_2.gcode')
  assert.equal(attachment.plateIndex, '2')
  assert.equal(attachment.subtaskName, 'Plate 2')
  assert.equal(attachment.useAms, true)
  assert.deepEqual(attachment.amsMapping, [0, 1])
  assert.deepEqual(attachment.exactMaterials, [
    { material: 'PLA', grams: 18.4, colors: ['Black'], source: 'printlab' },
    { material: 'PETG', grams: 6.2, colors: ['Clear'], source: 'printlab' },
  ])
})

test('merges PrintLab admin attachment into existing metadata and slicer stats', () => {
  const attachment = normalizeSuccessfulGcodeAttachment({
    record_id: 'gcode-1',
    printer_name: 'A1 Mini',
    materialUsage: [
      { material: 'PLA', usedGrams: 12.35, colors: ['Black', 'White'] },
    ],
    completedAt: '2026-05-12T15:00:00.000Z',
  }, { adminId: 'admin-1' }, '2026-05-13T10:00:00.000Z')

  const metadata = mergePrintLabOrderAttachment({
    printLabSubmissions: [{ printLabJobId: 'older-job', status: 'failed' }],
    slicerStats: { printHours: 1.2, source: 'estimate' },
    keep: 'value',
  }, attachment)

  assert.equal(metadata.keep, 'value')
  assert.equal((metadata.printLabSubmissions as any[]).length, 2)
  assert.deepEqual(extractPrintLabSubmissionSummary(metadata), {
    status: 'completed',
    printerName: 'A1 Mini',
    printLabJobId: 'gcode-1',
    error: null,
  })
  assert.deepEqual((metadata.slicerStats as any).materials, [
    { material: 'PLA', grams: 12.35, colors: ['Black', 'White'], source: 'printlab' },
  ])
  assert.equal((metadata.slicerStats as any).source, 'printlab')
  assert.equal((metadata.slicerStats as any).updatedAt, '2026-05-13T10:00:00.000Z')
  assert.equal((metadata.slicerStats as any).printLabRecordId, 'gcode-1')
  assert.equal((metadata.slicerStats as any).printHours, 1.2)
})

test('manual PrintLab attachment defaults to completed without exact material usage', () => {
  const attachment = buildManualPrintLabAttachment({
    printLabJobId: 'manual-job-1',
    status: null,
    printerName: 'A1 Mini',
    modelName: 'Widget',
    filePath: '/manual/widget.3mf',
    completedAt: '2026-05-12T15:00:00.000Z',
    note: 'entered from PrintLab history',
  }, { adminId: 'admin-1' }, '2026-05-13T10:00:00.000Z')

  assert.equal(attachment.recordType, 'manual')
  assert.equal(attachment.status, 'completed')
  assert.equal(attachment.printLabJobId, 'manual-job-1')
  assert.equal(attachment.successfulGcodeId, null)
  assert.equal(attachment.printerName, 'A1 Mini')
  assert.equal(attachment.modelName, 'Widget')
  assert.equal(attachment.filePath, '/manual/widget.3mf')
  assert.equal(attachment.completedAt, '2026-05-12T15:00:00.000Z')
  assert.equal(attachment.note, 'entered from PrintLab history')
  assert.deepEqual(attachment.exactMaterials, [])
})

test('completed attachments complete active MakerWorks orders but not terminal orders', () => {
  const attachment = buildManualPrintLabAttachment({
    printLabJobId: 'manual-job-1',
    printerName: 'X1C',
  })

  assert.equal(resolveOrderStatusFromPrintLabAttachment('queued', attachment), 'completed')
  assert.equal(resolveOrderStatusFromPrintLabAttachment('printing', attachment), 'completed')
  assert.equal(resolveOrderStatusFromPrintLabAttachment('shipped', attachment), 'shipped')
  assert.equal(resolveOrderStatusFromPrintLabAttachment('cancelled', attachment), 'cancelled')
})

test('detects whether attachment has exact material grams', () => {
  const withMaterials = normalizeSuccessfulGcodeAttachment({
    id: 'gcode-1',
    material_usage: [{ material: 'PLA', grams: 4 }],
  })
  const withoutMaterials = normalizeSuccessfulGcodeAttachment({ id: 'gcode-2' })
  const zeroGrams = normalizeSuccessfulGcodeAttachment({
    id: 'gcode-3',
    material_usage: [{ material: 'PLA', grams: 0 }],
  })

  assert.equal(hasExactPrintLabMaterialUsage(withMaterials), true)
  assert.equal(hasExactPrintLabMaterialUsage(withoutMaterials), false)
  assert.equal(hasExactPrintLabMaterialUsage(zeroGrams), false)
})

test('builds a safe model print template from completed PrintLab attachment', () => {
  const attachment = normalizeSuccessfulGcodeAttachment({
    id: 'gcode-1',
    printer_name: 'X1C',
    file_name: 'bracket.gcode.3mf',
    file_path: '/cache/bracket.gcode.3mf',
    plate_gcode: 'Metadata/plate_1.gcode',
    plate_index: 1,
    subtask_name: 'Plate 1',
    use_ams: true,
    ams_mapping: [0],
    material_usage: [{ material: 'PLA', grams: 10, color: 'Black' }],
    completed_at: '2026-05-12T15:00:00.000Z',
    admin_id: 'should-not-leak',
    note: 'should-not-leak',
  })

  assert.deepEqual(buildModelPrintTemplateSummary(attachment), {
    printLabJobId: null,
    successfulGcodeId: 'gcode-1',
    printerName: 'X1C',
    fileName: 'bracket.gcode.3mf',
    filePath: '/cache/bracket.gcode.3mf',
    plateGcode: 'Metadata/plate_1.gcode',
    plateIndex: '1',
    subtaskName: 'Plate 1',
    completedAt: '2026-05-12T15:00:00.000Z',
    useAms: true,
    amsMapping: [0],
    exactMaterials: [{ material: 'PLA', grams: 10, colors: ['Black'], source: 'printlab' }],
  })
  assert.equal(buildModelPrintTemplateSummary({ ...attachment, status: 'failed' }), null)
  assert.equal(buildModelPrintTemplateSummary({ ...attachment, successfulGcodeId: null }), null)
})

test('rejects completed submitted-job attachment without successful G-code from model print templates', () => {
  const attachment = normalizePrintLabSubmittedJobAttachment({
    id: 'pl-job-1',
    status: 'completed',
    printer_name: 'X1C',
    file_name: 'bracket.gcode.3mf',
    completed_at: '2026-05-12T15:00:00.000Z',
  })

  assert.equal(buildModelPrintTemplateSummary(attachment), null)
})

test('rejects manual PrintLab attachment without successful G-code from model print templates', () => {
  const attachment = buildManualPrintLabAttachment({
    printLabJobId: 'manual-job-1',
    printerName: 'X1C',
    completedAt: '2026-05-12T15:00:00.000Z',
  })

  assert.equal(buildModelPrintTemplateSummary(attachment), null)
})

test('finds successful G-code records by exact trimmed id or record_id', () => {
  const records = [
    { id: 'gcode-1', record_id: 'record-1' },
    { id: 'gcode-2 ', record_id: ' record-2 ' },
  ]

  assert.deepEqual(findSuccessfulGcodeRecord(records, 'gcode-1'), records[0])
  assert.deepEqual(findSuccessfulGcodeRecord(records, 'record-2'), records[1])
  assert.equal(findSuccessfulGcodeRecord(records, 'gcode'), null)
  assert.equal(findSuccessfulGcodeRecord(records, 'missing'), null)
})
