# MakerWorks Storefront

MakerWorks Storefront is a production-grade 3D printing commerce platform: customer-facing storefront, instant quoting, checkout, and a full operations backend for fulfillment teams.

It is built for print labs and shops that need one system for sales, manufacturing, and inventory-aware planning.

## What This App Does

- Runs a public 3D print storefront (discover, product pages, upload, cart, checkout).
- Prices configurable print jobs using material, machine time, labor, and policy rules.
- Manages order lifecycle from quote to fulfillment, including customer approvals and revisions.
- Supports admin workflows for production queues, printer assignment, analytics, and backup/restore.
- Connects optional external systems for payments, inventory, printer telemetry, and notifications.

## Core Product Areas

### Customer Commerce
- Browse catalog and collections.
- Upload STL/OBJ/3MF/ZIP files.
- Configure print options and get instant estimates.
- Checkout with card, cash, invoice, PO, or quote-request modes.
- Track orders, respond to approvals, and request revisions/reprints.

### Shop Operations
- Manage models, product templates, featured content, and pricing profiles.
- Operate printer queues and production assignment tools.
- Monitor analytics, demand forecasting, and material optimization.
- Run backups/restores and environment validation from admin tooling.

## Integrations

### Orderworks (job orchestration bridge)
MakerWorks includes Orderworks-compatible job sync surfaces for external production orchestration.

- Core client/service: [`lib/orderworks.ts`](lib/orderworks.ts)
- Sync logic: [`lib/orderworks-sync.ts`](lib/orderworks-sync.ts)
- Status mapping: [`lib/orderworks-status.ts`](lib/orderworks-status.ts)
- Admin endpoints:
  - [`app/api/admin/orderworks/jobs/route.ts`](app/api/admin/orderworks/jobs/route.ts)
  - [`app/api/admin/orderworks/jobs/[id]/route.ts`](app/api/admin/orderworks/jobs/[id]/route.ts)
- Public bridge endpoint: [`app/api/makerworks/jobs/route.ts`](app/api/makerworks/jobs/route.ts)

### Stockworks (inventory + material intelligence)
MakerWorks includes Stockworks integration for filament/material inventory, consumption, and warnings.

- Core client: [`lib/stockworks-client.ts`](lib/stockworks-client.ts)
- Inventory domain modules:
  - [`lib/stockworks-products.ts`](lib/stockworks-products.ts)
  - [`lib/stockworks-consumption.ts`](lib/stockworks-consumption.ts)
  - [`lib/stockworks-product-consumption.ts`](lib/stockworks-product-consumption.ts)
  - [`lib/stockworks-merch.ts`](lib/stockworks-merch.ts)
- API routes:
  - [`app/api/stockworks/inventory/route.ts`](app/api/stockworks/inventory/route.ts)
  - [`app/api/stockworks/movements/route.ts`](app/api/stockworks/movements/route.ts)
  - [`app/api/stockworks/material-warnings/route.ts`](app/api/stockworks/material-warnings/route.ts)
  - [`app/api/stockworks/filament-colors/route.ts`](app/api/stockworks/filament-colors/route.ts)
  - [`app/api/stockworks/predictions/route.ts`](app/api/stockworks/predictions/route.ts)

## Repo Audit Snapshot (2026-02-20)

Current quality-check results from this repository:

- `npm run lint`: passes with warnings (no errors).
- `npm run typecheck`: passes.
- `npm test`: partially fails in backup tests due to missing `pg_dump` in local environment.

Failing tests:
- [`tests/backup.test.ts`](tests/backup.test.ts) `runBackup writes db.sql and copies storage contents`
- [`tests/backup.test.ts`](tests/backup.test.ts) `scheduleRestore creates pending restore manifest`

Root cause observed:
- Backup tests require PostgreSQL client tooling (`pg_dump`) or a Docker-backed DB utility path.

## Quick Start

### Docker (recommended)
1. Copy environment template:
```bash
cp .env.example .env
```
2. Set required values (`DATABASE_URL`, `JWT_SECRET`, admin credentials, and optional integrations).
   - Optional for automated backups: set `BACKUP_SCHEDULE_ENABLED=1` and tune `BACKUP_*` retention vars.
3. Start services:
```bash
docker compose up --build -d
```
4. Open `http://localhost:3000`.

### Local Node Runtime
Requirements:
- Node.js 20+
- PostgreSQL 15+

1. Install dependencies:
```bash
npm ci
```
2. Configure env:
```bash
cp .env.example .env
```
3. Generate Prisma client and run migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```
4. Bootstrap admin:
```bash
npm run bootstrap:admin
```
5. Run the app:
```bash
npm run dev
```

## Environment Configuration

Use `.env.example` as source of truth. Key variable groups:

- Core: `DATABASE_URL`, `JWT_SECRET`, `BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Backup/restore (optional local overrides): `PG_DUMP_BIN`, `PSQL_BIN`
- Backup scheduling/retention: `BACKUP_DOCKER_SERVICE`, `BACKUP_SCHEDULE_ENABLED`, `BACKUP_SCHEDULE_TIME_UTC`, `BACKUP_RUN_ON_START`, `BACKUP_PRUNE_ON_BACKUP`, `BACKUP_RETENTION_DAYS`, `BACKUP_RETENTION_MAX_COUNT`
- Backup runtime mode: `SKIP_DOCKER`, `PG_DUMP_BIN`, `PSQL_BIN`
- Backup destination path: `BACKUP_DIR` (defaults to `STORAGE_DIR/backups`)
- Payments: `STRIPE_*`
- Orderworks bridge: `ORDERWORKS_*`
- Stockworks inventory: `STOCKWORKS_*`
- Printer telemetry: `BAMBU_VIEW_*`
- Email/auth: `SMTP_*`, `RECEIPT_*`, auth rate-limit settings
- Push notifications: `VAPID_*`
- Branding: `NEXT_PUBLIC_BRAND_*`, `HOLIDAY_THEME`

## Operational Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run prisma:deploy
npm run backup
npm run backup:scheduler
```

`backup:scheduler` is intended to run as a separate long-lived process/container and uses UTC schedule + retention env vars from `.env`.

## Architecture

- Frontend/API: Next.js App Router + React + TypeScript
- Data: PostgreSQL + Prisma
- Storage: local filesystem (`STORAGE_DIR`) with optional external file base URL
- Queue/processing support: BullMQ + Redis-compatible backend (when configured)

## License

MIT (`LICENSE`)

## Support

Issues: `https://github.com/schartrand77/mkw2/issues`

## Documentation

- User Manual: [`docs/user-manual.md`](docs/user-manual.md)
