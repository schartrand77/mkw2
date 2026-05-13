# Admin PrintLab Completed Job Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin workflow that connects a MakerWorks order to an already completed PrintLab submitted job or successful G-code record, carries precise PrintLab G-code execution data into MakerWorks, and feeds StockWorks from exact material usage when PrintLab provides material grams.

**Architecture:** Keep MakerWorks as the order lifecycle owner and PrintLab as a read-only source for completed printer work. Store links in the existing `PrintOrder.metadata.printLabSubmissions` / `lastPrintLabSubmission` shape, and store precise material grams in `PrintOrder.metadata.slicerStats` so the existing StockWorks consumption path uses exact print data instead of volume estimates. The attach route only triggers StockWorks consumption when exact PrintLab material grams are present.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Prisma JSON metadata, Node test runner with `tsx`, Zod validation.

---

## File Structure

- Create `lib/printlab-order-link.ts`: pure domain functions for normalizing PrintLab records and merging them into order metadata.
- Modify `lib/printlab.ts`: add read-only client methods for submitted jobs and successful G-code records.
- Create `tests/printlab-order-link.test.ts`: TDD coverage for metadata and status behavior.
- Create `app/api/admin/printlab/jobs/route.ts`: admin search endpoint for PrintLab submitted jobs.
- Create `app/api/admin/printlab/successful-gcodes/route.ts`: admin search endpoint for successful G-code records.
- Create `app/api/admin/orders/[orderId]/printlab-link/route.ts`: admin attach endpoint.
- Create `components/admin/PrintLabLinkPanel.tsx`: client UI for search, paste ID, and manual fallback.
- Modify `app/admin/users/[userId]/orders/[orderId]/page.tsx`: render the new panel beside existing PrintLab actions.
- Existing `lib/stockworks-consumption.ts`: no new endpoint is required because it already consumes `metadata.slicerStats` before falling back to estimates; the attach route must only call it after exact PrintLab grams have been stored.
- Modify `app/api/models/[id]/route.ts`: include derived exact print templates from successful PrintLab attachments on completed orders for the model.
- Create `components/PrintLabTemplateCard.tsx`: compact model-detail card for successful print template data.
- Modify `app/models/[id]/page.tsx`: render the template card when the model API returns templates.

## Task 1: Metadata Domain Logic

**Files:**
- Create: `lib/printlab-order-link.ts`
- Test: `tests/printlab-order-link.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/printlab-order-link.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildModelPrintTemplateSummary,
  buildManualPrintLabAttachment,
  hasExactPrintLabMaterialUsage,
  mergePrintLabOrderAttachment,
  normalizePrintLabSubmittedJobAttachment,
  normalizeSuccessfulGcodeAttachment,
  resolveOrderStatusFromPrintLabAttachment,
} from '../lib/printlab-order-link'
import { extractPrintLabSubmissionSummary } from '../lib/production'

test('normalizes a completed submitted PrintLab job for order metadata', () => {
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
    completed_at: '2026-05-12T14:00:00.000Z',
    updated_at: '2026-05-12T14:01:00.000Z',
  }, { adminId: 'admin-1', note: 'matched by search' }, '2026-05-13T10:00:00.000Z')

  assert.equal(attachment.recordType, 'submitted_job')
  assert.equal(attachment.source, 'printlab_admin_link')
  assert.equal(attachment.printLabJobId, 'pl-job-1')
  assert.equal(attachment.successfulGcodeId, 'gcode-1')
  assert.equal(attachment.status, 'completed')
  assert.equal(attachment.printerName, 'X1C')
  assert.equal(attachment.note, 'matched by search')
})

test('normalizes a successful G-code record for order metadata', () => {
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
      { material: 'PETG', grams: 6.2, colors: ['Clear'] },
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
  assert.deepEqual(attachment.amsMapping, [0, 1])
  assert.deepEqual(attachment.exactMaterials, [
    { material: 'PLA', grams: 18.4, colors: ['Black'], source: 'printlab' },
    { material: 'PETG', grams: 6.2, colors: ['Clear'], source: 'printlab' },
  ])
})

test('merges PrintLab admin attachment into existing order metadata', () => {
  const attachment = buildManualPrintLabAttachment({
    printLabJobId: 'manual-job-1',
    successfulGcodeId: null,
    status: 'completed',
    printerName: 'A1 Mini',
    note: 'entered from PrintLab history',
  }, { adminId: 'admin-1' }, '2026-05-13T10:00:00.000Z')

  const metadata = mergePrintLabOrderAttachment({
    printLabSubmissions: [{ printLabJobId: 'older-job', status: 'failed' }],
    keep: 'value',
  }, attachment)

  assert.equal(metadata.keep, 'value')
  assert.equal((metadata.printLabSubmissions as any[]).length, 2)
  assert.deepEqual(extractPrintLabSubmissionSummary(metadata), {
    status: 'completed',
    printerName: 'A1 Mini',
    printLabJobId: 'manual-job-1',
    error: null,
  })
})

test('completed attachment completes active MakerWorks order but not terminal orders', () => {
  const attachment = buildManualPrintLabAttachment({
    printLabJobId: 'manual-job-1',
    successfulGcodeId: null,
    status: 'completed',
    printerName: 'X1C',
    note: null,
  }, { adminId: null }, '2026-05-13T10:00:00.000Z')

  assert.equal(resolveOrderStatusFromPrintLabAttachment('queued', attachment), 'completed')
  assert.equal(resolveOrderStatusFromPrintLabAttachment('printing', attachment), 'completed')
  assert.equal(resolveOrderStatusFromPrintLabAttachment('shipped', attachment), 'shipped')
  assert.equal(resolveOrderStatusFromPrintLabAttachment('cancelled', attachment), 'cancelled')
})

test('exact PrintLab material usage is written to slicerStats for StockWorks', () => {
  const attachment = normalizeSuccessfulGcodeAttachment({
    id: 'gcode-1',
    material_usage: [
      { material: 'PLA', grams: 12.35, colors: ['Black', 'White'] },
    ],
    completed_at: '2026-05-12T15:00:00.000Z',
  }, { adminId: 'admin-1' }, '2026-05-13T10:00:00.000Z')

  const metadata = mergePrintLabOrderAttachment({ slicerStats: { printHours: 1.2 } }, attachment)

  assert.deepEqual((metadata.slicerStats as any).materials, [
    { material: 'PLA', grams: 12.35, colors: ['Black', 'White'], source: 'printlab' },
  ])
  assert.equal((metadata.slicerStats as any).source, 'printlab')
  assert.equal((metadata.slicerStats as any).printHours, 1.2)
})

test('detects whether attachment has exact material grams', () => {
  const withMaterials = normalizeSuccessfulGcodeAttachment({
    id: 'gcode-1',
    material_usage: [{ material: 'PLA', grams: 4 }],
  })
  const withoutMaterials = normalizeSuccessfulGcodeAttachment({ id: 'gcode-2' })

  assert.equal(hasExactPrintLabMaterialUsage(withMaterials), true)
  assert.equal(hasExactPrintLabMaterialUsage(withoutMaterials), false)
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
  })

  const template = buildModelPrintTemplateSummary(attachment)

  assert.deepEqual(template, {
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/printlab-order-link.test.ts
```

Expected: FAIL because `../lib/printlab-order-link` does not exist.

- [ ] **Step 3: Implement minimal domain logic**

Create `lib/printlab-order-link.ts`:

```ts
import { deriveOrderStatusFromPrintLabStatus } from '@/lib/production'

export type PrintLabOrderAttachmentRecordType = 'submitted_job' | 'successful_gcode' | 'manual'

export type PrintLabOrderAttachment = {
  at: string
  source: 'printlab_admin_link'
  actor: 'makerworks_admin'
  adminId: string | null
  recordType: PrintLabOrderAttachmentRecordType
  printLabJobId: string | null
  successfulGcodeId: string | null
  status: string | null
  printerId: string | null
  printerName: string | null
  queueItemId: string | null
  modelId: string | null
  modelName: string | null
  fileName: string | null
  filePath: string | null
  plateGcode: string | null
  plateIndex: string | null
  subtaskName: string | null
  useAms: boolean | null
  amsMapping: number[] | null
  progressPercent: number | null
  currentLayer: number | null
  totalLayers: number | null
  exactMaterials: Array<{ material: string; grams: number; colors: string[]; source: 'printlab' }>
  completedAt: string | null
  startedAt: string | null
  updatedAt: string | null
  error: string | null
  note: string | null
}

type AttachmentContext = {
  adminId?: string | null
  note?: string | null
}

type ManualAttachmentInput = {
  printLabJobId?: string | null
  successfulGcodeId?: string | null
  status?: string | null
  printerId?: string | null
  printerName?: string | null
  modelId?: string | null
  modelName?: string | null
  fileName?: string | null
  filePath?: string | null
  completedAt?: string | null
  note?: string | null
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const numbers = value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
  return numbers.length > 0 ? numbers : null
}

function readColors(value: unknown, fallback?: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof fallback === 'string' ? [fallback] : []
  return source.map((entry) => String(entry || '').trim()).filter(Boolean)
}

function extractExactMaterials(data: Record<string, any>): PrintLabOrderAttachment['exactMaterials'] {
  const direct = data.material_usage ?? data.materialUsage ?? data.actual_materials ?? data.actualMaterials
  const metadata = asRecord(data.metadata)
  const nested = asRecord(data.slicer_stats ?? data.slicerStats ?? metadata.slicerStats)
  const entries = Array.isArray(direct) ? direct : Array.isArray(nested.materials) ? nested.materials : []
  return entries
    .map((entry: any) => {
      const row = asRecord(entry)
      const material = readString(row.material) || readString(row.filament_type) || readString(row.filamentType)
      const grams = readNumber(row.grams ?? row.used_grams ?? row.usedGrams ?? row.weight_grams ?? row.weightGrams)
      if (!material || !grams || grams <= 0) return null
      return {
        material,
        grams,
        colors: readColors(row.colors, row.color ?? row.color_name ?? row.colorName),
        source: 'printlab' as const,
      }
    })
    .filter((entry): entry is { material: string; grams: number; colors: string[]; source: 'printlab' } => Boolean(entry))
}

function baseAttachment(
  recordType: PrintLabOrderAttachmentRecordType,
  context: AttachmentContext,
  receivedAt: string,
): Pick<PrintLabOrderAttachment, 'at' | 'source' | 'actor' | 'adminId' | 'recordType' | 'note'> {
  return {
    at: receivedAt,
    source: 'printlab_admin_link',
    actor: 'makerworks_admin',
    adminId: context.adminId ?? null,
    recordType,
    note: readString(context.note),
  }
}

export function normalizePrintLabSubmittedJobAttachment(
  record: unknown,
  context: AttachmentContext = {},
  receivedAt = new Date().toISOString(),
): PrintLabOrderAttachment {
  const data = asRecord(record)
  return {
    ...baseAttachment('submitted_job', context, receivedAt),
    printLabJobId: readString(data.id) || readString(data.job_id),
    successfulGcodeId: readString(data.successful_gcode_id) || readString(data.successfulGcodeId),
    status: readString(data.status),
    printerId: readString(data.printer_id) || readString(data.printerId),
    printerName: readString(data.printer_name) || readString(data.printerName),
    queueItemId: readString(data.queue_item_id) || readString(data.queueItemId),
    modelId: readString(data.model_id) || readString(data.modelId),
    modelName: readString(data.model_name) || readString(data.modelName),
    fileName: readString(data.file_name) || readString(data.fileName),
    filePath: readString(data.file_path) || readString(data.filePath),
    plateGcode: readString(data.plate_gcode) || readString(data.plateGcode),
    plateIndex: readString(data.plate_index) || readString(data.plateIndex),
    subtaskName: readString(data.subtask_name) || readString(data.subtaskName),
    useAms: readBoolean(data.use_ams ?? data.useAms),
    amsMapping: readNumberArray(data.ams_mapping ?? data.amsMapping),
    progressPercent: readNumber(data.progress_percent ?? data.progressPercent),
    currentLayer: readNumber(data.current_layer ?? data.currentLayer),
    totalLayers: readNumber(data.total_layers ?? data.totalLayers),
    exactMaterials: extractExactMaterials(data),
    completedAt: readString(data.completed_at) || readString(data.completedAt),
    startedAt: readString(data.started_at) || readString(data.startedAt),
    updatedAt: readString(data.updated_at) || readString(data.updatedAt),
    error: readString(data.last_error) || readString(data.error),
  }
}

export function normalizeSuccessfulGcodeAttachment(
  record: unknown,
  context: AttachmentContext = {},
  receivedAt = new Date().toISOString(),
): PrintLabOrderAttachment {
  const data = asRecord(record)
  return {
    ...baseAttachment('successful_gcode', context, receivedAt),
    printLabJobId: null,
    successfulGcodeId: readString(data.id) || readString(data.record_id),
    status: 'completed',
    printerId: readString(data.printer_id) || readString(data.printerId),
    printerName: readString(data.printer_name) || readString(data.printerName),
    queueItemId: null,
    modelId: readString(data.model_id) || readString(data.modelId),
    modelName: readString(data.model_name) || readString(data.modelName),
    fileName: readString(data.file_name) || readString(data.fileName),
    filePath: readString(data.file_path) || readString(data.filePath),
    plateGcode: readString(data.plate_gcode) || readString(data.plateGcode),
    plateIndex: readString(data.plate_index) || readString(data.plateIndex),
    subtaskName: readString(data.subtask_name) || readString(data.subtaskName),
    useAms: readBoolean(data.use_ams ?? data.useAms),
    amsMapping: readNumberArray(data.ams_mapping ?? data.amsMapping),
    progressPercent: readNumber(data.progress_percent ?? data.progressPercent),
    currentLayer: readNumber(data.current_layer ?? data.currentLayer),
    totalLayers: readNumber(data.total_layers ?? data.totalLayers),
    exactMaterials: extractExactMaterials(data),
    completedAt: readString(data.completed_at) || readString(data.completedAt),
    startedAt: readString(data.started_at) || readString(data.startedAt),
    updatedAt: readString(data.updated_at) || readString(data.updatedAt),
    error: null,
  }
}

export function buildManualPrintLabAttachment(
  input: ManualAttachmentInput,
  context: AttachmentContext = {},
  receivedAt = new Date().toISOString(),
): PrintLabOrderAttachment {
  const note = readString(input.note) || readString(context.note)
  return {
    ...baseAttachment('manual', { ...context, note }, receivedAt),
    printLabJobId: readString(input.printLabJobId),
    successfulGcodeId: readString(input.successfulGcodeId),
    status: readString(input.status) || 'completed',
    printerId: readString(input.printerId),
    printerName: readString(input.printerName),
    queueItemId: null,
    modelId: readString(input.modelId),
    modelName: readString(input.modelName),
    fileName: readString(input.fileName),
    filePath: readString(input.filePath),
    plateGcode: null,
    plateIndex: null,
    subtaskName: null,
    useAms: null,
    amsMapping: null,
    progressPercent: null,
    currentLayer: null,
    totalLayers: null,
    exactMaterials: [],
    completedAt: readString(input.completedAt),
    startedAt: null,
    updatedAt: null,
    error: null,
  }
}

export function mergePrintLabOrderAttachment(metadata: unknown, attachment: PrintLabOrderAttachment): Record<string, unknown> {
  const prior = asRecord(metadata)
  const priorSubmissions = Array.isArray(prior.printLabSubmissions) ? prior.printLabSubmissions : []
  const priorSlicerStats = asRecord(prior.slicerStats)
  const slicerStats = attachment.exactMaterials.length > 0
    ? {
        ...priorSlicerStats,
        source: 'printlab',
        updatedAt: attachment.at,
        printLabRecordId: attachment.successfulGcodeId || attachment.printLabJobId,
        materials: attachment.exactMaterials,
      }
    : priorSlicerStats
  return {
    ...prior,
    slicerStats,
    printLabSubmissions: [...priorSubmissions, attachment],
    lastPrintLabSubmission: {
      ...attachment,
      printLabJobId: attachment.printLabJobId || attachment.successfulGcodeId,
    },
  }
}

export function resolveOrderStatusFromPrintLabAttachment(currentStatus: string, attachment: PrintLabOrderAttachment): string {
  return deriveOrderStatusFromPrintLabStatus(attachment.status, currentStatus)
}

export function hasExactPrintLabMaterialUsage(attachment: PrintLabOrderAttachment): boolean {
  return attachment.exactMaterials.some((entry) => Number.isFinite(entry.grams) && entry.grams > 0)
}

export type ModelPrintTemplateSummary = {
  printLabJobId: string | null
  successfulGcodeId: string | null
  printerName: string | null
  fileName: string | null
  filePath: string | null
  plateGcode: string | null
  plateIndex: string | null
  subtaskName: string | null
  completedAt: string | null
  useAms: boolean | null
  amsMapping: number[] | null
  exactMaterials: PrintLabOrderAttachment['exactMaterials']
}

export function buildModelPrintTemplateSummary(attachment: PrintLabOrderAttachment): ModelPrintTemplateSummary | null {
  if (attachment.status !== 'completed') return null
  if (!attachment.successfulGcodeId && !attachment.printLabJobId) return null
  return {
    printLabJobId: attachment.printLabJobId,
    successfulGcodeId: attachment.successfulGcodeId,
    printerName: attachment.printerName,
    fileName: attachment.fileName,
    filePath: attachment.filePath,
    plateGcode: attachment.plateGcode,
    plateIndex: attachment.plateIndex,
    subtaskName: attachment.subtaskName,
    completedAt: attachment.completedAt,
    useAms: attachment.useAms,
    amsMapping: attachment.amsMapping,
    exactMaterials: attachment.exactMaterials,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm test -- tests/printlab-order-link.test.ts tests/production-queue-display.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add lib/printlab-order-link.ts tests/printlab-order-link.test.ts
git commit -m "feat: normalize PrintLab order links"
```

## Task 2: PrintLab Read Client

**Files:**
- Modify: `lib/printlab.ts`
- Test: `tests/integration-contracts.test.ts`

- [ ] **Step 1: Write failing client contract tests**

Append to `tests/integration-contracts.test.ts`:

```ts
import {
  fetchPrintLabJob,
  fetchPrintLabJobs,
  fetchPrintLabSuccessfulGcodes,
} from '../lib/printlab'

test('PrintLab client fetches submitted jobs with status filter', async () => {
  const originalFetch = global.fetch
  const originalBaseUrl = process.env.PRINTLAB_BASE_URL
  const originalApiKey = process.env.PRINTLAB_API_KEY
  let capturedUrl = ''
  try {
    process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
    process.env.PRINTLAB_API_KEY = 'printlab-secret'
    global.fetch = (async (url: any) => {
      capturedUrl = String(url)
      return new Response(JSON.stringify({ items: [{ id: 'job-1', status: 'completed' }] }), { status: 200 })
    }) as any

    const jobs = await fetchPrintLabJobs({ status: 'completed' })

    assert.equal(capturedUrl, 'https://printlab.local/api/jobs?status=completed')
    assert.deepEqual(jobs, [{ id: 'job-1', status: 'completed' }])
  } finally {
    global.fetch = originalFetch
    if (originalBaseUrl === undefined) delete process.env.PRINTLAB_BASE_URL
    else process.env.PRINTLAB_BASE_URL = originalBaseUrl
    if (originalApiKey === undefined) delete process.env.PRINTLAB_API_KEY
    else process.env.PRINTLAB_API_KEY = originalApiKey
  }
})

test('PrintLab client fetches a submitted job by id', async () => {
  const originalFetch = global.fetch
  const originalBaseUrl = process.env.PRINTLAB_BASE_URL
  let capturedUrl = ''
  try {
    process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
    global.fetch = (async (url: any) => {
      capturedUrl = String(url)
      return new Response(JSON.stringify({ item: { id: 'job-1' } }), { status: 200 })
    }) as any

    const job = await fetchPrintLabJob('job-1')

    assert.equal(capturedUrl, 'https://printlab.local/api/jobs/job-1')
    assert.deepEqual(job, { id: 'job-1' })
  } finally {
    global.fetch = originalFetch
    if (originalBaseUrl === undefined) delete process.env.PRINTLAB_BASE_URL
    else process.env.PRINTLAB_BASE_URL = originalBaseUrl
  }
})

test('PrintLab client fetches successful G-code records', async () => {
  const originalFetch = global.fetch
  const originalBaseUrl = process.env.PRINTLAB_BASE_URL
  try {
    process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
    global.fetch = (async () => new Response(JSON.stringify({ items: [{ id: 'gcode-1' }] }), { status: 200 })) as any

    const records = await fetchPrintLabSuccessfulGcodes()

    assert.deepEqual(records, [{ id: 'gcode-1' }])
  } finally {
    global.fetch = originalFetch
    if (originalBaseUrl === undefined) delete process.env.PRINTLAB_BASE_URL
    else process.env.PRINTLAB_BASE_URL = originalBaseUrl
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/integration-contracts.test.ts
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement read methods**

In `lib/printlab.ts`, add near existing fetch methods:

```ts
function encodeQuery(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim()) search.set(key, value.trim())
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function fetchPrintLabJobs(options: { status?: string | null } = {}) {
  const data = await printLabJson(`/api/jobs${encodeQuery({ status: options.status })}`)
  return Array.isArray(data?.items) ? data.items : []
}

export async function fetchPrintLabJob(jobId: string) {
  const id = jobId.trim()
  if (!id) throw Object.assign(new Error('PrintLab job id is required.'), { status: 400 })
  const data = await printLabJson(`/api/jobs/${encodeURIComponent(id)}`)
  return data?.item ?? data
}

export async function fetchPrintLabSuccessfulGcodes() {
  const data = await printLabJson('/api/successful-gcodes')
  return Array.isArray(data?.items) ? data.items : []
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm test -- tests/integration-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add lib/printlab.ts tests/integration-contracts.test.ts
git commit -m "feat: read PrintLab completed job records"
```

## Task 3: Admin Search APIs

**Files:**
- Create: `app/api/admin/printlab/jobs/route.ts`
- Create: `app/api/admin/printlab/successful-gcodes/route.ts`

- [ ] **Step 1: Add jobs search route**

Create `app/api/admin/printlab/jobs/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { fetchPrintLabJobs } from '@/lib/printlab'

function matchesQuery(item: Record<string, any>, query: string) {
  if (!query) return true
  const haystack = [
    item.id,
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
      .filter((item: any) => matchesQuery(item, query))
      .slice(0, 50)
    return NextResponse.json({ items, count: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load PrintLab jobs.' }, { status: e.status || 400 })
  }
}
```

- [ ] **Step 2: Add successful G-code search route**

Create `app/api/admin/printlab/successful-gcodes/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { fetchPrintLabSuccessfulGcodes } from '@/lib/printlab'

function matchesQuery(item: Record<string, any>, query: string) {
  if (!query) return true
  const haystack = [
    item.id,
    item.printer_id,
    item.printer_name,
    item.model_id,
    item.model_name,
    item.model_key,
    item.file_name,
    item.file_path,
    item.subtask_name,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const query = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase()
    const records = await fetchPrintLabSuccessfulGcodes()
    const items = records
      .filter((item: any) => matchesQuery(item, query))
      .slice(0, 50)
    return NextResponse.json({ items, count: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load PrintLab successful G-code records.' }, { status: e.status || 400 })
  }
}
```

- [ ] **Step 3: Run typecheck for route shape**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```powershell
git add app/api/admin/printlab/jobs/route.ts app/api/admin/printlab/successful-gcodes/route.ts
git commit -m "feat: expose admin PrintLab record search"
```

## Task 4: Admin Attach API

**Files:**
- Create: `app/api/admin/orders/[orderId]/printlab-link/route.ts`
- Modify: `tests/printlab-order-link.test.ts`

- [ ] **Step 1: Add domain test for pasted successful G-code lookup selection**

Append to `tests/printlab-order-link.test.ts`:

```ts
import { findSuccessfulGcodeRecord } from '../lib/printlab-order-link'

test('finds successful G-code record by pasted id', () => {
  const record = findSuccessfulGcodeRecord([
    { id: 'gcode-1', file_name: 'one.gcode.3mf' },
    { id: 'gcode-2', file_name: 'two.gcode.3mf' },
  ], 'gcode-2')

  assert.deepEqual(record, { id: 'gcode-2', file_name: 'two.gcode.3mf' })
  assert.equal(findSuccessfulGcodeRecord([{ id: 'gcode-1' }], 'missing'), null)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/printlab-order-link.test.ts
```

Expected: FAIL because `findSuccessfulGcodeRecord` is not exported.

- [ ] **Step 3: Add helper to domain file**

Add to `lib/printlab-order-link.ts`:

```ts
export function findSuccessfulGcodeRecord(records: unknown[], recordId: string): Record<string, any> | null {
  const target = recordId.trim()
  if (!target) return null
  for (const record of records) {
    const data = asRecord(record)
    if (readString(data.id) === target || readString(data.record_id) === target) return data
  }
  return null
}
```

- [ ] **Step 4: Add attach route**

Create `app/api/admin/orders/[orderId]/printlab-link/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { getAdminAuditRequestMeta, recordAdminAuditEvent } from '@/lib/admin-audit'
import {
  buildManualPrintLabAttachment,
  findSuccessfulGcodeRecord,
  hasExactPrintLabMaterialUsage,
  mergePrintLabOrderAttachment,
  normalizePrintLabSubmittedJobAttachment,
  normalizeSuccessfulGcodeAttachment,
  resolveOrderStatusFromPrintLabAttachment,
} from '@/lib/printlab-order-link'
import { fetchPrintLabJob, fetchPrintLabSuccessfulGcodes } from '@/lib/printlab'
import { maybeConsumeStockForOrder } from '@/lib/stockworks-consumption'

const payloadSchema = z.object({
  mode: z.enum(['submitted_job', 'successful_gcode', 'manual', 'auto']),
  id: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  manual: z.object({
    printLabJobId: z.string().trim().max(160).optional().nullable(),
    successfulGcodeId: z.string().trim().max(160).optional().nullable(),
    status: z.string().trim().max(80).optional().nullable(),
    printerId: z.string().trim().max(160).optional().nullable(),
    printerName: z.string().trim().max(160).optional().nullable(),
    modelId: z.string().trim().max(160).optional().nullable(),
    modelName: z.string().trim().max(240).optional().nullable(),
    fileName: z.string().trim().max(240).optional().nullable(),
    filePath: z.string().trim().max(500).optional().nullable(),
    completedAt: z.string().trim().max(80).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  }).optional(),
})

type RouteParams = { params: Promise<{ orderId: string }> }

async function buildAttachment(payload: z.infer<typeof payloadSchema>, adminId: string) {
  const context = { adminId, note: payload.note ?? null }
  const id = payload.id?.trim() || ''

  if (payload.mode === 'manual') {
    const manual = payload.manual || {}
    if (!manual.printLabJobId && !manual.successfulGcodeId) {
      throw Object.assign(new Error('Manual link requires a PrintLab job ID or successful G-code ID.'), { status: 400 })
    }
    return buildManualPrintLabAttachment(manual, context)
  }

  if (!id) throw Object.assign(new Error('PrintLab record ID is required.'), { status: 400 })

  if (payload.mode === 'submitted_job') {
    return normalizePrintLabSubmittedJobAttachment(await fetchPrintLabJob(id), context)
  }

  if (payload.mode === 'successful_gcode') {
    const record = findSuccessfulGcodeRecord(await fetchPrintLabSuccessfulGcodes(), id)
    if (!record) throw Object.assign(new Error('PrintLab successful G-code record was not found.'), { status: 404 })
    return normalizeSuccessfulGcodeAttachment(record, context)
  }

  try {
    return normalizePrintLabSubmittedJobAttachment(await fetchPrintLabJob(id), context)
  } catch {
    const record = findSuccessfulGcodeRecord(await fetchPrintLabSuccessfulGcodes(), id)
    if (!record) throw Object.assign(new Error('PrintLab record was not found.'), { status: 404 })
    return normalizeSuccessfulGcodeAttachment(record, context)
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { orderId } = await params
    const payload = payloadSchema.parse(await req.json())
    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, metadata: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    const attachment = await buildAttachment(payload, adminId)
    const metadata = mergePrintLabOrderAttachment(order.metadata, attachment)
    const status = resolveOrderStatusFromPrintLabAttachment(order.status, attachment)
    await prisma.printOrder.update({
      where: { id: order.id },
      data: {
        metadata: metadata as Prisma.InputJsonValue,
        ...(status !== order.status ? { status } : {}),
      },
    })

    let stockworks: { ok: boolean; warning?: string; movements?: number } | null = null
    if (hasExactPrintLabMaterialUsage(attachment)) {
      try {
        const consumed = await maybeConsumeStockForOrder(order.id, 'printlab-admin-link')
        stockworks = consumed.ok
          ? { ok: true, movements: Number((consumed as any).movements || 0) }
          : { ok: false, warning: String((consumed as any).reason || 'StockWorks consumption was not applied.') }
      } catch (err: any) {
        stockworks = { ok: false, warning: err?.message || 'StockWorks consumption failed.' }
      }
    } else {
      stockworks = { ok: false, warning: 'PrintLab record did not include exact material grams; StockWorks consumption was not triggered by this link.' }
    }

    const requestMeta = getAdminAuditRequestMeta(req)
    await recordAdminAuditEvent({
      adminId,
      action: 'admin.order.printlab.link',
      targetType: 'print_order',
      targetId: order.id,
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: {
        recordType: attachment.recordType,
        printLabJobId: attachment.printLabJobId,
        successfulGcodeId: attachment.successfulGcodeId,
        status: attachment.status,
      } as any,
    })

    return NextResponse.json({ ok: true, attachment, order: { id: order.id, status }, stockworks })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to link PrintLab record.' }, { status: e.status || 400 })
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```powershell
npm test -- tests/printlab-order-link.test.ts tests/production-queue-display.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add lib/printlab-order-link.ts tests/printlab-order-link.test.ts app/api/admin/orders/[orderId]/printlab-link/route.ts
git commit -m "feat: link orders to PrintLab records"
```

## Task 5: Model Detail Print Template

**Files:**
- Modify: `app/api/models/[id]/route.ts`
- Create: `components/PrintLabTemplateCard.tsx`
- Modify: `app/models/[id]/page.tsx`

- [ ] **Step 1: Add a bounded template loader to the model API**

In `app/api/models/[id]/route.ts`, import:

```ts
import { buildModelPrintTemplateSummary } from '@/lib/printlab-order-link'
```

Add before the final `NextResponse.json`:

```ts
  const templateOrders = await prisma.printOrder.findMany({
    where: {
      status: { in: ['completed', 'shipped'] },
      items: { some: { modelId: id } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      metadata: true,
      updatedAt: true,
      items: { select: { modelId: true } },
    },
  })
  const printTemplates = templateOrders
    .flatMap((order) => {
      const metadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
        ? order.metadata as Record<string, any>
        : {}
      const submissions = Array.isArray(metadata.printLabSubmissions) ? metadata.printLabSubmissions : []
      return submissions
        .map((submission) => buildModelPrintTemplateSummary(submission as any))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    })
    .sort((a, b) => {
      const materialScore = Number(b.exactMaterials.length > 0) - Number(a.exactMaterials.length > 0)
      if (materialScore !== 0) return materialScore
      return String(b.completedAt || '').localeCompare(String(a.completedAt || ''))
    })
    .slice(0, 3)
```

In the returned `model` object, add:

```ts
      printTemplates,
```

- [ ] **Step 2: Create the display card**

Create `components/PrintLabTemplateCard.tsx`:

```tsx
type PrintTemplate = {
  printLabJobId?: string | null
  successfulGcodeId?: string | null
  printerName?: string | null
  fileName?: string | null
  plateGcode?: string | null
  plateIndex?: string | null
  subtaskName?: string | null
  completedAt?: string | null
  useAms?: boolean | null
  amsMapping?: number[] | null
  exactMaterials?: Array<{ material: string; grams: number; colors?: string[] }>
}

function formatDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

export default function PrintLabTemplateCard({ templates }: { templates: PrintTemplate[] }) {
  const template = templates[0]
  if (!template) return null
  const completedAt = formatDate(template.completedAt)
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Successful print template</div>
        <p className="text-sm text-slate-300 mt-1">Based on a completed shop print from PrintLab.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="text-slate-400">Printer</div>
        <div>{template.printerName || 'PrintLab'}</div>
        <div className="text-slate-400">G-code</div>
        <div className="break-words">{template.fileName || template.successfulGcodeId || 'Successful record'}</div>
        <div className="text-slate-400">Plate</div>
        <div>{template.plateIndex || template.plateGcode || template.subtaskName || 'Default'}</div>
        <div className="text-slate-400">Completed</div>
        <div>{completedAt || 'Recorded by PrintLab'}</div>
        <div className="text-slate-400">AMS</div>
        <div>{template.useAms ? `Used${template.amsMapping?.length ? ` (${template.amsMapping.join(', ')})` : ''}` : 'Not recorded'}</div>
      </div>
      {template.exactMaterials && template.exactMaterials.length > 0 ? (
        <div className="text-xs text-slate-300">
          Materials: {template.exactMaterials.map((entry) => `${entry.material} ${entry.grams.toFixed(1)}g${entry.colors?.length ? ` ${entry.colors.join('/')}` : ''}`).join(', ')}
        </div>
      ) : (
        <div className="text-xs text-amber-200">Exact material grams were not recorded for this template.</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Render card on model page**

In `app/models/[id]/page.tsx`, import:

```ts
import PrintLabTemplateCard from '@/components/PrintLabTemplateCard'
```

Render after `PrintabilityChecksCard` and before `InstantQuoteConfigurator`:

```tsx
        {Array.isArray(model.printTemplates) && model.printTemplates.length > 0 ? (
          <PrintLabTemplateCard templates={model.printTemplates} />
        ) : null}
```

- [ ] **Step 4: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add app/api/models/[id]/route.ts components/PrintLabTemplateCard.tsx app/models/[id]/page.tsx
git commit -m "feat: surface successful PrintLab templates"
```

## Task 6: Admin UI Panel

**Files:**
- Create: `components/admin/PrintLabLinkPanel.tsx`
- Modify: `app/admin/users/[userId]/orders/[orderId]/page.tsx`

- [ ] **Step 1: Create the client panel**

Create `components/admin/PrintLabLinkPanel.tsx`:

```tsx
"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Props = {
  orderId: string
  current?: {
    status?: string | null
    printerName?: string | null
    printLabJobId?: string | null
    error?: string | null
  } | null
}

type SearchKind = 'jobs' | 'successful-gcodes'
type PasteMode = 'auto' | 'submitted_job' | 'successful_gcode'

function recordTitle(item: any) {
  return item.model_name || item.modelName || item.file_name || item.fileName || item.id || 'PrintLab record'
}

function recordMeta(item: any) {
  return [
    item.status,
    item.printer_name || item.printerName,
    item.completed_at || item.completedAt || item.updated_at || item.updatedAt,
  ].filter(Boolean).join(' - ')
}

export default function PrintLabLinkPanel({ orderId, current }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'search' | 'paste' | 'manual'>('search')
  const [searchKind, setSearchKind] = useState<SearchKind>('jobs')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [pasteMode, setPasteMode] = useState<PasteMode>('auto')
  const [pastedId, setPastedId] = useState('')
  const [manualId, setManualId] = useState('')
  const [manualStatus, setManualStatus] = useState('completed')
  const [manualPrinter, setManualPrinter] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    setBusy(true)
    setError(null)
    try {
      const path = searchKind === 'jobs' ? '/api/admin/printlab/jobs' : '/api/admin/printlab/successful-gcodes'
      const res = await fetch(`${path}?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'PrintLab search failed')
      setResults(Array.isArray(data?.items) ? data.items : [])
    } catch (err: any) {
      setError(err?.message || 'PrintLab search failed')
    } finally {
      setBusy(false)
    }
  }

  const attach = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/printlab-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'PrintLab link failed')
      pushSessionNotification({ type: 'success', title: 'PrintLab job connected', message: 'The order now references the selected PrintLab record.' })
      router.refresh()
    } catch (err: any) {
      const message = err?.message || 'PrintLab link failed'
      setError(message)
      pushSessionNotification({ type: 'error', title: 'PrintLab link failed', message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 p-3 bg-black/20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Completed PrintLab job</p>
          <p className="text-xs text-slate-400">
            {current?.printLabJobId ? `${current.status || 'linked'} - ${current.printerName || 'PrintLab'} - ${current.printLabJobId}` : 'No completed PrintLab job connected.'}
          </p>
        </div>
        <select className="input w-32" value={mode} onChange={(event) => setMode(event.target.value as any)}>
          <option value="search">Search</option>
          <option value="paste">Paste ID</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {mode === 'search' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select className="input w-40" value={searchKind} onChange={(event) => setSearchKind(event.target.value as SearchKind)}>
              <option value="jobs">Submitted jobs</option>
              <option value="successful-gcodes">Successful G-code</option>
            </select>
            <input className="input flex-1 min-w-[180px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, model, printer..." />
            <button type="button" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 disabled:opacity-50" onClick={search} disabled={busy}>
              {busy ? 'Searching...' : 'Search'}
            </button>
          </div>
          <div className="space-y-2">
            {results.map((item) => (
              <button
                key={`${searchKind}-${item.id}`}
                type="button"
                className="w-full text-left rounded-md border border-white/10 p-2 hover:border-brand-400 disabled:opacity-50"
                disabled={busy}
                onClick={() => attach({ mode: searchKind === 'jobs' ? 'submitted_job' : 'successful_gcode', id: item.id, note })}
              >
                <span className="block text-sm text-slate-100">{recordTitle(item)}</span>
                <span className="block text-xs text-slate-400">{item.id} - {recordMeta(item)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === 'paste' ? (
        <div className="flex flex-wrap gap-2">
          <select className="input w-40" value={pasteMode} onChange={(event) => setPasteMode(event.target.value as PasteMode)}>
            <option value="auto">Auto-detect</option>
            <option value="submitted_job">Submitted job</option>
            <option value="successful_gcode">Successful G-code</option>
          </select>
          <input className="input flex-1 min-w-[180px]" value={pastedId} onChange={(event) => setPastedId(event.target.value)} placeholder="PrintLab job or G-code ID" />
          <button type="button" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 disabled:opacity-50" onClick={() => attach({ mode: pasteMode, id: pastedId, note })} disabled={busy || !pastedId.trim()}>
            Connect
          </button>
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="grid md:grid-cols-4 gap-2">
          <input className="input" value={manualId} onChange={(event) => setManualId(event.target.value)} placeholder="PrintLab ID" />
          <input className="input" value={manualStatus} onChange={(event) => setManualStatus(event.target.value)} placeholder="Status" />
          <input className="input" value={manualPrinter} onChange={(event) => setManualPrinter(event.target.value)} placeholder="Printer name" />
          <button type="button" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 disabled:opacity-50" onClick={() => attach({ mode: 'manual', manual: { printLabJobId: manualId, status: manualStatus, printerName: manualPrinter, note } })} disabled={busy || !manualId.trim()}>
            Save manual link
          </button>
        </div>
      ) : null}

      <input className="input w-full" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional internal note" />
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </div>
  )
}
```

- [ ] **Step 2: Render panel on order detail page**

In `app/admin/users/[userId]/orders/[orderId]/page.tsx`, add the import:

```ts
import PrintLabLinkPanel from '@/components/admin/PrintLabLinkPanel'
```

In the actions section below the existing button row and current PrintLab status text, render:

```tsx
<PrintLabLinkPanel
  orderId={order.id}
  current={lastPrintLabSubmission ? {
    status: typeof lastPrintLabSubmission.status === 'string' ? lastPrintLabSubmission.status : null,
    printerName: typeof lastPrintLabSubmission.printerName === 'string' ? lastPrintLabSubmission.printerName : null,
    printLabJobId: typeof lastPrintLabSubmission.printLabJobId === 'string' ? lastPrintLabSubmission.printLabJobId : null,
    error: typeof lastPrintLabSubmission.error === 'string' ? lastPrintLabSubmission.error : null,
  } : null}
/>
```

- [ ] **Step 3: Run lint and typecheck**

Run:

```powershell
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```powershell
git add components/admin/PrintLabLinkPanel.tsx app/admin/users/[userId]/orders/[orderId]/page.tsx
git commit -m "feat: add admin PrintLab link panel"
```

## Task 7: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npm test -- tests/printlab-order-link.test.ts tests/production-queue-display.test.ts tests/integration-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Check working tree**

Run:

```powershell
git status --short
```

Expected: only intentional uncommitted files, or no output if all task commits were made.

## Self-Review

Spec coverage:

- Search/select completed PrintLab submitted jobs: Task 2, Task 3, Task 5.
- Search/select successful G-code records: Task 2, Task 3, Task 5.
- Paste ID for submitted jobs and successful G-code records: Task 4, Task 5.
- Manual fallback: Task 1, Task 4, Task 5.
- Existing metadata compatibility: Task 1 and Task 6 include `production-queue-display` coverage.
- Read-only PrintLab behavior: Tasks only call `GET /api/jobs`, `GET /api/jobs/{id}`, and `GET /api/successful-gcodes`.
- Exact G-code execution data: Task 1 normalizes file path/name, plate G-code, plate index, subtask name, AMS usage, and layer/progress fields.
- Exact StockWorks material usage: Task 1 stores exact PrintLab material grams in `slicerStats`; Task 4 triggers StockWorks only when exact grams exist.
- Model detail exact print template: Task 5 derives safe customer-facing print template summaries from completed order PrintLab metadata and renders them on model pages.

Placeholder scan:

- The plan contains concrete files, code, commands, and expected results.

Type consistency:

- Domain functions introduced in Task 1 are used by the attach route in Task 4.
- Client methods introduced in Task 2 are used by admin routes in Tasks 3 and 4.
