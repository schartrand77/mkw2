# Developer Guide

This page is the contributor-oriented map of the repository.

## Repository Layout

- `app/`: Next.js App Router pages and API handlers
- `components/`: UI components grouped by domain
- `lib/`: business logic, service clients, orchestration, and shared utilities
- `prisma/`: schema and migrations
- `scripts/`: admin/bootstrap/backup/import/worker entry points
- `tests/`: unit, integration, contract, and e2e coverage
- `docs/`: user documentation, audits, and this wiki source
- `public/`: static assets and PWA files

## Important Entry Points

- `app/layout.tsx`: global shell
- `app/page.tsx`: home page
- `app/api/checkout/route.ts`: checkout API boundary
- `lib/pricing.ts`: pricing engine
- `lib/orders.ts`: order persistence and retrieval
- `lib/printlab.ts`: printer execution client
- `lib/stockworks-client.ts`: inventory integration client
- `scripts/processing-worker.ts`: background worker

## Common Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run test:api
npm run test:contracts
npm run e2e
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
```

## Testing Notes

- Unit and integration tests run through Node's built-in test runner with `tsx`.
- Playwright is configured for end-to-end coverage.
- Backup tests can fail in environments without `pg_dump`.

## Development Conventions

- Route handlers in `app/api/` should stay thin and push business rules into `lib/`.
- Prisma schema changes must be accompanied by a migration.
- Integrations are optional; code paths should degrade gracefully when upstream services are not configured.
- Storage-backed features should assume `STORAGE_DIR` is the durable root.

## Suggested Onboarding Path

1. Read [Home](./Home.md).
2. Read [Architecture](./Architecture.md).
3. Read [Configuration Reference](./Configuration-Reference.md).
4. Run the app locally from [Getting Started](./Getting-Started.md).
5. Review [`docs/user-manual.md`](../user-manual.md) to understand the product surface before changing workflows.
