# Operations Runbook

This page is for operators responsible for uptime, recoverability, and day-to-day administration.

## Daily Health Checks

- Verify the main app responds at `/`.
- Verify readiness at `/api/health` and `/api/health/ready`.
- Check `/admin` for queue, backup, and production status surfaces.
- Review any failed background jobs in `/admin/processing-queues`.
- Review active production work in `/admin/production`.

## Backups

Primary commands:

```bash
npm run backup
npm run backup:scheduler
```

Expected backup requirements:

- PostgreSQL client tooling is available either locally or through Docker Compose execution.
- `STORAGE_DIR` is readable.
- `BACKUP_DIR` is writable if explicitly configured.

### Compose-based runtime

- Leave `SKIP_DOCKER` unset or `0`.
- Set `BACKUP_DOCKER_SERVICE` if your database service is not named `db`.

### Unraid or non-compose runtime

- Set `SKIP_DOCKER=1`
- Set `PG_DUMP_BIN`
- Set `PSQL_BIN`
- Optionally set `BACKUP_DIR`

### Retention controls

- `BACKUP_SCHEDULE_ENABLED=1`
- `BACKUP_SCHEDULE_TIME_UTC=03:00`
- `BACKUP_PRUNE_ON_BACKUP=1`
- `BACKUP_RETENTION_DAYS`
- `BACKUP_RETENTION_MAX_COUNT`

## Restore Expectations

- Restore manifests are created through admin backup tools and runtime scripts.
- Restores depend on the same PostgreSQL tooling assumptions as backups.
- If `BACKUP_DIR` is outside `STORAGE_DIR`, the restore flow can still work, but in-app `/files/...` links for those backup artifacts are not available.

## Queue and Worker Operations

Queue-backed processing depends on:

- `REDIS_URL`
- a running `processing-worker`

Useful surfaces:

- `/admin/processing-queues`
- `/api/admin/processing-queues`
- `/api/admin/processing-queues/retry`
- `/api/admin/processing-queues/requeue-stuck`

Symptoms of a worker outage:

- model previews remain pending
- image processing stalls
- queue retries accumulate

## PrintLab Operations

MakerWorks uses PrintLab as the active printer execution boundary.

Operational checks:

- confirm `PRINTLAB_BASE_URL` resolves from the app container
- confirm one outbound auth mode is configured
- confirm callback traffic reaches `POST /api/printlab/jobs/:jobId`
- verify `PRINTLAB_WEBHOOK_SECRET` matches on both sides

Admin/operator surfaces:

- `/api/admin/printlab`
- `/api/admin/printlab/jobs`
- `/api/admin/printlab/jobs/[id]/resubmit`

## Stockworks Operations

Stockworks-backed inventory and material signals require valid upstream credentials and reachable upstream service URLs.

Operational checks:

- confirm `STOCKWORKS_BASE_URL` is reachable from the app runtime
- confirm credentials can authenticate
- verify inventory pages and material warning APIs return data

Useful routes:

- `/api/stockworks/inventory`
- `/api/stockworks/movements`
- `/api/stockworks/material-warnings`
- `/api/stockworks/predictions`

## Incident Triage

### Checkout failures

Check:

- Stripe keys
- database connectivity
- cart configuration validity
- organization approval rules and minimum order thresholds

### Upload failures

Check:

- file size caps
- storage permissions
- direct upload configuration
- reverse-proxy or tunnel limits

### Missing previews or generated artifacts

Check:

- `REDIS_URL`
- worker process health
- `STORAGE_DIR` write permissions

### Admin pages show reduced data

Many admin surfaces degrade gracefully when integrations are not configured. Empty states do not always mean a local app failure.

## Recommended Operational Commands

```bash
npm run lint
npm run typecheck
npm test
npm run prisma:deploy
npm run backup
```

## Support Artifacts

Useful repository references:

- [`scripts/backup.js`](../../scripts/backup.js)
- [`scripts/backup-scheduler.js`](../../scripts/backup-scheduler.js)
- [`scripts/processing-worker.ts`](../../scripts/processing-worker.ts)
- [`lib/printlab.ts`](../../lib/printlab.ts)
- [`lib/stockworks-client.ts`](../../lib/stockworks-client.ts)
