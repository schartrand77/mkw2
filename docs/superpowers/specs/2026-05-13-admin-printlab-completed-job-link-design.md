# Admin PrintLab Completed Job Link Design

## Context

MakerWorks already stores PrintLab handoff state on `PrintOrder.metadata` through `printLabSubmissions` and `lastPrintLabSubmission`. Production queue and order detail views read that metadata through `lib/production.ts`, and PrintLab callbacks update the same shape through `/api/printlab/jobs/[jobId]`.

PrintLab already exposes read-only job records and successful G-code records:

- `/api/jobs` and `/api/jobs/{job_id}` for submitted MakerWorks jobs.
- `/api/successful-gcodes` for completed G-code records.

Admins need a way to connect an existing MakerWorks order to work that has already completed in PrintLab.

## Goals

- Let admins attach an order to a completed PrintLab submitted job from a searchable list.
- Let admins attach an order by pasting a known PrintLab submitted job ID or successful G-code record ID.
- Let admins make a clearly marked manual attachment when PrintLab cannot return the record.
- Reuse the existing PrintLab metadata format so production status, customer status, and admin queue displays keep working.
- Avoid printer control actions. This feature only reads PrintLab state and updates MakerWorks order metadata/status.

## Non-Goals

- No real printer commands, job submission, pause/resume/stop, or print start actions.
- No Prisma schema migration unless the metadata approach proves insufficient during implementation.
- No automatic fuzzy matching without admin confirmation.
- No StockWorks inventory consumption changes beyond existing order status behavior.

## User Flow

On the admin order detail page, the existing PrintLab action area gains a `Connect completed job` panel.

The panel has two modes:

1. `Search PrintLab`
   - Admin searches submitted jobs and successful G-code records.
   - MakerWorks displays a compact list with record type, ID, status, printer, model/file name, and completion/update time.
   - Admin selects a record and confirms the attachment.

2. `Paste ID`
   - Admin enters an ID and selects the lookup type: submitted job, successful G-code, or auto-detect.
   - MakerWorks fetches the matching record from PrintLab when possible.
   - If the record cannot be found, admin can create a manual attachment with ID, status, printer name, and note.

After a confirmed attachment, the order page refreshes and shows the attached PrintLab record as the latest PrintLab submission.

## Data Model

No new table is required for the first implementation. MakerWorks appends a normalized entry to `PrintOrder.metadata.printLabSubmissions` and updates `PrintOrder.metadata.lastPrintLabSubmission`.

Normalized attachment entry:

```ts
{
  at: string
  source: 'printlab_admin_link'
  actor: 'makerworks_admin'
  adminId: string | null
  recordType: 'submitted_job' | 'successful_gcode' | 'manual'
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
  completedAt: string | null
  updatedAt: string | null
  error: string | null
  note: string | null
}
```

`lastPrintLabSubmission` must keep the fields consumed today:

```ts
{
  status: string | null
  printerName: string | null
  printLabJobId: string | null
  error: string | null
}
```

Additional fields may be present because existing readers ignore unknown metadata.

## API Design

Add read-only PrintLab client methods in `lib/printlab.ts`:

- `fetchPrintLabJobs(status?: string | null)`
- `fetchPrintLabJob(jobId: string)`
- `fetchPrintLabSuccessfulGcodes()`

Add domain logic in `lib/printlab-order-link.ts`:

- normalize submitted-job records.
- normalize successful-G-code records.
- normalize manual attachments.
- merge attachment metadata into a `PrintOrder.metadata` object.
- derive the MakerWorks order status from the attachment status.

Add admin routes:

- `GET /api/admin/printlab/jobs?status=completed&q=...`
- `GET /api/admin/printlab/successful-gcodes?q=...`
- `POST /api/admin/orders/[orderId]/printlab-link`

The attach route requires admin auth, validates the payload, fetches PrintLab records when requested, updates order metadata, updates order status when the attachment is completed, records an admin audit event, and returns the normalized attachment.

## Error Handling

- Missing PrintLab config returns a clear disabled response for search and lookup.
- Failed lookup returns a validation error unless the payload explicitly requests a manual attachment.
- Unsupported or empty IDs return `400`.
- Unknown order returns `404`.
- Manual attachments are marked with `recordType: 'manual'` and `source: 'printlab_admin_link'`.

## UI Design

Create `components/admin/PrintLabLinkPanel.tsx`.

The panel should:

- sit near `PrintLabSubmitButton` on the admin order detail page.
- show the current latest PrintLab link if present.
- support search and paste modes without navigating away.
- disable submit buttons while requests are running.
- use existing notification and `router.refresh()` patterns.

The list should stay compact and operational, matching existing admin styling.

## Testing

Use TDD for implementation.

Target tests:

- `tests/printlab-order-link.test.ts` for metadata normalization and status derivation.
- Route-level tests if an existing admin API harness supports it; otherwise keep route logic thin and test the domain function directly.
- Existing `tests/production-queue-display.test.ts` should continue passing because `lastPrintLabSubmission` remains compatible.

Minimum verification:

- targeted `npm test -- tests/printlab-order-link.test.ts tests/production-queue-display.test.ts`
- `npm run typecheck`

## Risks

- PrintLab has list endpoints for successful G-code records but no direct record lookup endpoint. MakerWorks can filter the list for paste-ID lookup if needed.
- Existing production queue filters may hide completed orders after attachment. That is acceptable because the order detail page remains the primary admin attachment surface, and completion should remove the job from active production.
