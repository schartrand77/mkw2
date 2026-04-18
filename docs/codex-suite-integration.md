# Codex Suite Integration

This guide makes Codex useful as a broader MakerWorks operations assistant across local development, debugging, docs, GitHub work, Docker services, and the related Works apps.

## Suite Inventory

| App | Local path | Main responsibility | Primary stack |
| --- | --- | --- | --- |
| MakerWorks | `C:\Users\steph\OneDrive\Documents\GitHub\mkwV2` | Storefront, quoting, checkout, admin operations, job lifecycle, and suite hub | Next.js, React, TypeScript, Prisma, PostgreSQL, Docker |
| PrintLab | `C:\Users\steph\OneDrive\Documents\GitHub\printlab` | Bambu printer control, printer dashboard, Works service proxy, MakerWorks job intake and callbacks | Python, Docker, web/API service |
| StockWorks | `C:\Users\steph\OneDrive\Documents\GitHub\stockworks` | Inventory, materials, merch sync, material warnings, and incoming job visibility | Web app, local data, Works integrations |
| SlicerWorks | `C:\Users\steph\OneDrive\Documents\GitHub\slicerworks` | iPad slicer concept, SwiftUI app scaffold, Bambu-first slicing roadmap | SwiftUI, XCTest scaffold |
| OrderWorks | `C:\Users\steph\OneDrive\Documents\GitHub\orderworks` | Legacy/job orchestration context and compatibility reference | Check repo before changing |

## Integration Model

MakerWorks is the business and customer workflow hub. It owns catalog, quotes, checkout, orders, admin operations, and durable commerce data.

PrintLab is the printer execution boundary. It connects to Bambu printers, exposes printer state/actions, accepts MakerWorks job submissions, runs preflight/routing, tracks submitted jobs, and can call MakerWorks back with job status.

StockWorks is the material and inventory intelligence boundary. It tracks filament, hardware, merch, movements, quotes, and job demand. It can read MakerWorks/OrderWorks job information and PrintLab loaded tray state.

OrderWorks remains useful for compatibility, migration context, and older job orchestration flows. Prefer PrintLab for new printer execution work unless the task explicitly targets OrderWorks.

SlicerWorks is currently a separate iPad-focused product concept. Treat it as related suite work, but do not assume it is wired into the production MakerWorks/PrintLab/StockWorks runtime.

## Default Assistant Workflow

1. Identify which app owns the behavior.
2. Read that app's README, command scripts, and relevant architecture docs.
3. Check `git status --short` before editing.
4. Make scoped changes in the owning app first.
5. Update cross-app contracts or docs when an integration payload, env var, route, or workflow changes.
6. Run the smallest meaningful verification set.
7. Report changed files, verification results, and any residual risk.

For production containers, read `docs/production-ops.md` before running remote Docker, SSH, deploy, migration, restore, rollback, or printer-related commands.

## Ownership Guide

Use MakerWorks for:

- storefront, checkout, quoting, order lifecycle, customer/admin workflows
- Prisma schema and business data
- PrintLab callback endpoints
- StockWorks inventory consumption and warning surfaces
- Stripe, SMTP, push notification, backup, and restore flows

Use PrintLab for:

- printer discovery/state/control
- Bambu MQTT behavior
- MakerWorks job intake, preflight, queueing, printer assignment, and callbacks
- successful G-code records and printer-side sync
- Works service proxy routes

Use StockWorks for:

- filament, hardware, merch, inventory movement, and quote records
- low-stock and material availability workflows
- MakerWorks merch sync
- PrintLab loaded tray visibility
- OrderWorks/MakerWorks incoming job views

Use SlicerWorks for:

- iPad slicing UX
- SwiftUI app architecture
- project document, printer profile, painting, import/export, and slicing roadmap work

Use OrderWorks for:

- legacy compatibility behavior
- job orchestration reference
- migration support

## Command Playbook

### Docker Desktop Ownership

The Windows dev PC currently runs the MakerWorks suite in Docker Desktop with these local ports:

| Service | Container | URL |
| --- | --- | --- |
| MakerWorks | `mkwv2-web-1` | `http://localhost:3000` |
| MakerWorks Postgres | `mkwv2-db-1` | `localhost:5432` |
| MakerWorks Redis | `mkwv2-redis-1` | `localhost:6379` |
| StockWorks | `stockworks-api-1` | `http://localhost:8000` |
| PrintLab | `printlab` | `http://localhost:8289` |
| OrderWorks | `orderworks-app-1` | `http://localhost:3001` |

MakerWorks and StockWorks are compose-managed from their repo roots. OrderWorks is compose-managed but uses the `node:20-bookworm` image and runs install/generate/migrate/dev at container start. PrintLab is currently a standalone Docker container, not root-compose-managed.

PrintLab is recreated with:

```powershell
docker build -t printlab-standalone:local .
docker stop printlab
docker rm printlab
docker run -d --name printlab --restart unless-stopped --env-file .env -p 8289:8080 -v "C:\Users\steph\OneDrive\Documents\GitHub\printlab\data:/data" -v "cefed55a2814b90b2990090bbcde8f831ee989aa76af83b48bee780efe3c507b:/config" printlab-standalone:local
```

Important PrintLab env note: `docker run --env-file` preserves quote characters. `ADMIN_PASSWORD_HASH` must start with `scrypt`, not `'scrypt` or `"scrypt`.

Standard suite status check:

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
npm run suite:status
npm run suite:status:prod
```

Standard HTTP smoke checks:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/health
Invoke-WebRequest -UseBasicParsing -Uri http://localhost:8000/
Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3001/
```

PrintLab may return `401 Unauthorized` on unauthenticated endpoints when auth is enabled. Treat that as reachable but protected, then use configured credentials for authenticated checks.

### MakerWorks

Run from `C:\Users\steph\OneDrive\Documents\GitHub\mkwV2`.

Common commands:

```powershell
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
docker compose ps
docker compose logs --tail 200
docker compose up --build -d
docker compose down
```

Known caveat: `npm test` can fail in backup tests when local PostgreSQL client tooling such as `pg_dump` is unavailable.

### PrintLab

Run from `C:\Users\steph\OneDrive\Documents\GitHub\printlab`.

Discover exact commands from `README.md`, `pyproject.toml`, `Dockerfile`, and `docker-compose.yml` before changing code. Likely verification commands include:

```powershell
python -m pytest
python -m mypy app scripts tests
python -m ruff check .
docker compose ps
docker compose logs --tail 200
docker compose up -d --build
```

Printer action endpoints are operational controls. Inspecting health/state is safe; sending actions or jobs requires explicit user approval.

### StockWorks

Run from `C:\Users\steph\OneDrive\Documents\GitHub\stockworks`.

Inspect the repo scripts before running commands. Preserve local data directories and integration config. Use the README/user manual for workflow intent.

### SlicerWorks

Run from `C:\Users\steph\OneDrive\Documents\GitHub\slicerworks`.

The repo currently documents SwiftUI/XCTest coverage but may not include a runnable Xcode project, workspace, or Swift package manifest. Verify available build/test files before promising a simulator or XCTest run.

### OrderWorks

Run from `C:\Users\steph\OneDrive\Documents\GitHub\orderworks`.

Inspect repo docs and scripts before changing anything. Treat it as legacy/compatibility context unless the user says otherwise.

## Safety Boundaries

Always ask before:

- deleting files, storage directories, backups, Docker volumes, or databases
- running `git reset`, forced checkout, forced push, or history rewrite commands
- applying migrations to a non-local database
- stopping or restarting services that may be in active use
- sending printer control commands or submitting print jobs
- exposing or copying secrets from `.env`, config files, Docker inspect output, or logs

Allowed by default when relevant:

- reading code, docs, test files, package metadata, and non-secret config templates
- running status commands such as `git status --short`, `docker compose ps`, and targeted logs
- running local lint/typecheck/tests/build commands that do not mutate production-like systems
- creating or editing docs, tests, and source files inside the active workspace

## Verification Matrix

| Change type | Minimum verification |
| --- | --- |
| MakerWorks docs only | Read changed docs, check `git diff --check` |
| MakerWorks TypeScript logic | `npm run typecheck`, targeted `npm test` or full `npm test` |
| MakerWorks UI | `npm run lint`, `npm run typecheck`, Playwright or screenshot verification when practical |
| MakerWorks API route | targeted Node test, `npm run test:api` when integration behavior changes |
| Prisma schema | `npm run prisma:generate`, migration command, relevant tests |
| PrintLab Python logic | targeted pytest, `ruff`, `mypy` where configured |
| StockWorks behavior | repo-specific tests/scripts after inspecting package metadata |
| Cross-app contract | update both sides or document compatibility, then test caller and receiver |
| Docker/runtime behavior | `docker compose ps`, targeted logs, app health endpoint |

## Common Runbooks

### Check Suite Health

1. Inspect Docker state in each running app repo.
2. Check MakerWorks health/admin env surfaces without exposing secrets.
3. Check PrintLab `/health` and printer state endpoints if credentials/config are available.
4. Check StockWorks main page or health route if present.
5. Summarize service status, broken dependencies, and next actions.

### Debug MakerWorks to PrintLab Job Flow

1. Read MakerWorks job submission and callback code.
2. Read PrintLab MakerWorks job intake, preflight, queue, and callback code.
3. Confirm shared env vars and callback path templates from examples/docs without revealing secrets.
4. Reproduce with tests or a dry-run endpoint where available.
5. Only submit a real job after user approval.

### Debug StockWorks Inventory Sync

1. Identify whether the issue is MakerWorks merch sync, PrintLab tray sync, or job-demand visibility.
2. Read StockWorks sync code and the upstream API/database path.
3. Confirm required env var names from docs/templates.
4. Use fixture or read-only checks first.
5. Avoid modifying inventory quantities unless explicitly requested.

### Prepare A Pull Request

1. Check `git status --short`.
2. Review the diff for unrelated user changes.
3. Run relevant verification.
4. Commit only intended files.
5. Push the current branch and open a draft PR when requested.

## Final Response Expectations

When Codex completes suite work, report:

- what changed
- which files changed
- which verification commands ran and whether they passed
- what was not run and why
- any real operational risk, especially around printers, databases, or secrets
