# MakerWorks Suite Assistant Guide

This repository is the operational hub for the MakerWorks suite. Treat this file as the first stop for Codex or any other coding assistant working in this workspace.

## Workspace Map

Primary local repositories on the Windows dev PC:

- `C:\Users\steph\OneDrive\Documents\GitHub\mkwV2` - MakerWorks storefront, quoting, admin, operations, and integration hub.
- `C:\Users\steph\OneDrive\Documents\GitHub\printlab` - PrintLab printer control, Bambu printer integration, and Works service bridge.
- `C:\Users\steph\OneDrive\Documents\GitHub\stockworks` - StockWorks material, inventory, merch, and job visibility app.
- `C:\Users\steph\OneDrive\Documents\GitHub\slicerworks` - SlicerWorks iPad slicer concept and SwiftUI app scaffold.
- `C:\Users\steph\OneDrive\Documents\GitHub\orderworks` - OrderWorks legacy/job orchestration context.

If the user says "StackWorks", confirm whether they mean `stockworks` unless a separate StackWorks repo appears.

## First References

Read these before making suite-level changes:

- `README.md` for MakerWorks product scope and current local caveats.
- `docs/wiki/Architecture.md` for MakerWorks boundaries.
- `docs/wiki/Developer-Guide.md` for repo conventions and commands.
- `docs/codex-suite-integration.md` for suite-wide assistant workflows, safety rules, and verification commands.
- `docs/production-ops.md` for production container access, GitOps deployment, rollback, and approval boundaries.

## MakerWorks Conventions

- Keep `app/api/` route handlers thin and move business rules into `lib/`.
- Prisma schema changes require a matching migration.
- Optional integrations must degrade gracefully when upstream services or env vars are missing.
- Treat `STORAGE_DIR` as the durable root for storage-backed features.
- Preserve the existing Next.js App Router, TypeScript, Prisma, Docker, and Node test-runner patterns.

## Safety Rules

- Do not print `.env`, secrets, API keys, printer access codes, session secrets, database URLs, or private tokens in final answers.
- Ask before destructive actions such as deleting data, resetting Git history, dropping databases, pruning Docker volumes, stopping production-like services, or sending real printer control commands.
- Treat printer operations as real-world actions. Inspect state freely; require explicit user approval before pause, resume, stop, temperature, fan, light, upload, or print-job submission actions.
- Do not revert user changes unless the user explicitly asks.
- Prefer targeted verification over broad commands when the change is small.

## Standard MakerWorks Verification

Use the smallest relevant set:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:api`
- `npm run test:contracts`
- `npm run e2e`
- `npm run build`

Known local caveat: backup tests may fail without PostgreSQL client tooling such as `pg_dump`.
