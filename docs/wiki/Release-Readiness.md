# Release Readiness

This page is the v3 release execution checklist for staging and production rollout.

## Release Gates

The release is ready to cut only when all are true:

- `npm run lint` passes without new blocking issues.
- `npm run typecheck` passes.
- Focused Node test suites for the new v3 slices pass.
- `/admin/release-health` shows acceptable checkout, callback, and queue posture.
- `/admin/webhooks` shows secrets configured for required inbound routes.
- `/admin/connectors` generates valid beta payload previews.
- Backup creation and restore rehearsal have been completed in the target environment.

## Staging Checklist

1. Deploy the candidate build and database migrations to staging.
2. Verify `/api/health` and `/api/health/ready`.
3. Run storefront smoke:
   - discover
   - model detail
   - quote workspace
   - checkout intent creation
4. Run ops smoke:
   - production board
   - release health
   - governance
   - webhook/API ops
   - connectors
5. Rehearse backup and restore against the staging database.
6. Confirm PrintLab and Stockworks optional integrations behave correctly if configured.

## Production Cutover

1. Confirm a current backup exists and note the artifact path.
2. Deploy the application build.
3. Apply Prisma migrations.
4. Verify readiness and release health.
5. Run a controlled smoke order through quote to order creation.
6. Confirm callback traffic, queue processing, and admin surfaces are stable.

## Rollback Triggers

Rollback immediately if any of these occur after deployment:

- Checkout API availability drops below the accepted release threshold.
- Callback failures spike or webhook secrets are invalid.
- Queue backlog exceeds one day of capacity without recovery.
- Database migration creates blocking read or write failures.
- Critical admin workflows fail on production.

## Rollback Steps

1. Disable new release traffic if your deployment platform supports it.
2. Restore the previous application image or deployment artifact.
3. If a schema change must be reverted, use the tested backup/restore path instead of ad hoc manual edits.
4. Re-verify `/api/health`, `/admin/release-health`, and core order flows.
5. Capture the incident details and affected migration/build identifiers.

## Evidence To Capture

- release commit SHA
- deployed image or build identifier
- Prisma migration names applied
- backup artifact path and timestamp
- screenshots or notes from release health, webhook/API ops, and connector previews
