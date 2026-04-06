# V3 Migration Guide

This guide covers the operational migration path from a pre-v3 deployment to the current v3 release baseline.

## Scope of Change

MakerWorks v3 introduces major changes in:

- app shell and navigation
- customer-facing quote, discover, checkout, and order surfaces
- production and predictive operations tooling
- governance, webhook/API ops, and connector beta admin surfaces

These changes are additive at the UI and service layer, but deployment should still be treated as a coordinated release.

## Before You Start

- Confirm a tested backup exists.
- Confirm PostgreSQL tooling is available for restore.
- Review [`Configuration-Reference.md`](./Configuration-Reference.md).
- Review [`Webhook-Operations.md`](./Webhook-Operations.md).
- Review [`Connector-Betas.md`](./Connector-Betas.md).

## Environment Review

Validate these before migration:

- `DATABASE_URL`
- `JWT_SECRET`
- `MAKERWORKS_INBOUND_SECRET`
- `PRINTLAB_WEBHOOK_SECRET` if PrintLab callbacks are used
- `PRINTLAB_BASE_URL` and auth settings if PrintLab is enabled
- `STOCKWORKS_*` credentials if Stockworks is enabled
- Stripe keys if card checkout is enabled

Use:

- `/admin/site-config`
- `/api/admin/env-check`
- `/admin/webhooks`

## Database and App Migration

1. Deploy the new application artifact.
2. Generate the Prisma client if required by the environment.
3. Apply migrations with the standard deployment flow.
4. Verify startup and health endpoints.

## Functional Validation

Run these checks after deployment:

- Open the command palette with `Ctrl/Cmd+K`.
- Verify Discover v3 search and filter presets.
- Verify a model detail page renders the v3 quote workspace.
- Create a checkout preview and confirm order creation still succeeds.
- Check customer order timeline rendering.
- Verify production, release health, governance, webhook/API ops, and connectors admin pages all load.

## Integration Validation

- PrintLab:
  - verify printer sync
  - verify callback secrets
  - verify job callback processing
- Stockworks:
  - verify inventory pages return data
  - verify material optimization and predictions surfaces load
- Connectors:
  - generate Shopify and shipping beta payload previews from `/admin/connectors`

## Rollback Guidance

If migration fails:

1. Restore the previous deployment artifact.
2. Use the backup/restore flow if the schema state is not safe to continue from.
3. Confirm the previous release health posture before reopening traffic.
