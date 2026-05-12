# Configuration Reference

Use `.env.example` as the source of truth for environment variables. This page groups the most important settings by responsibility so operators can reason about configuration faster.

MakerWorks now supports in-app suite onboarding for optional integrations. Keep boot-critical values in env or Docker secrets, then configure payments, email, PrintLab, StockWorks, OrderWorks compatibility, notifications, direct-upload URLs, and branding from **Admin -> Suite setup** after login. Env values still override persisted settings while existing deployments are migrated.

## Core Runtime

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: session/auth signing secret
- `BASE_URL`: canonical application URL
- `STORAGE_DIR`: file storage root for uploads, previews, backups, and generated assets
- `FILES_BASE_URL`: optional external file base URL for `/files/...`

## Admin Bootstrap

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

Security note:

- `ADMIN_PASSWORD` is validated and weak defaults are rejected.
- In production, weak bootstrap secrets should be treated as deployment blockers.

## Branding and Public UX

- `NEXT_PUBLIC_BRAND_NAME`
- `NEXT_PUBLIC_BRAND_VERSION`
- `NEXT_PUBLIC_BRAND_LAB_NAME`
- `NEXT_PUBLIC_BRAND_HANDLE`
- `NEXT_PUBLIC_CONTACT_EMAIL`
- `HOLIDAY_THEME`

## Pricing and Quote Behavior

- `CURRENCY`
- `NEXT_PUBLIC_CURRENCY`
- `PLA_PRICE_PER_KG_USD`, `PETG_PRICE_PER_KG_USD`
- `PLA_PRICE_PER_KG_CAD`, `PETG_PRICE_PER_KG_CAD`
- `COLOR_SURCHARGE_RATE`
- `NEXT_PUBLIC_COLOR_SURCHARGE_RATE`
- `SUPPORT_OVERHANG_ANGLE_DEG`
- `SUPPORT_VOLUME_MULTIPLIER_MAX`
- `COLOR_TIME_MULTIPLIER_PER_COLOR`
- `PRINTER_PROFILE`

These variables feed the pricing engine in `lib/pricing.ts` together with persisted `SiteConfig` values.

## Upload and File Handling

- `DIRECT_UPLOAD_URL`
- `LAN_DIRECT_UPLOAD_URL`
- `LAN_SITE_HOSTS`
- `LAN_UPLOAD_MAX_FILE_BYTES`
- `LAN_UPLOAD_MAX_TOTAL_BYTES`
- `UPLOAD_MAX_FILE_BYTES`
- `UPLOAD_MAX_TOTAL_BYTES`
- `UPLOAD_MAX_3MF_CONVERT_BYTES`
- `UPLOAD_MAX_3MF_TRIANGLES`

These are useful for deployments that sit behind tunnels, reverse proxies, or LAN-only direct paths.

## Async Processing

- `REDIS_URL`
- `IMAGE_WORKER_CONCURRENCY`
- `PREVIEW_WORKER_CONCURRENCY`
- `PROCESSING_QUEUE_ATTEMPTS`
- `PROCESSING_QUEUE_BACKOFF_MS`

If `REDIS_URL` is unset, queue-backed background processing is disabled.

## Stripe

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SHIPPING_RATE_ID`
- `STRIPE_INVOICE_DAYS_UNTIL_DUE`

`STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are required for card-based checkout. `STRIPE_SECRET_KEY` also enables Stripe invoices for deferred invoice checkout. `STRIPE_INVOICE_DAYS_UNTIL_DUE` is optional and defaults to 14.

Preferred setup: save Stripe settings in **Admin -> Suite setup**. Use env only for legacy override or secret-manager driven deployments.

## PrintLab

- `PRINTLAB_BASE_URL`
- `PRINTLAB_API_KEY`
- `PRINTLAB_API_KEY_HEADER`
- `PRINTLAB_SESSION_COOKIE`
- `PRINTLAB_AUTH_HEADER`
- `PRINTLAB_WEBHOOK_SECRET`

Preferred setup: save PrintLab URL/auth and callback secret in **Admin -> Suite setup**.
On the Windows Docker Desktop dev suite, use `http://host.docker.internal:8289` because MakerWorks runs inside a container while PrintLab is published on the host at port 8289. If PrintLab is on the same Docker network, use its container DNS name and internal port, for example `http://printlab:8080`.

Legacy alias support still exists for:

- `BAMBU_VIEW_BASE_URL`
- `BAMBU_VIEW_API_KEY`
- related `BAMBU_VIEW_*` auth variables

## Stockworks

- `STOCKWORKS_BASE_URL`
- `STOCKWORKS_ADMIN_USERNAME`
- `STOCKWORKS_ADMIN_PASSWORD`
- `STOCKWORKS_USERNAME`
- `STOCKWORKS_PASSWORD`
- `STOCKWORKS_COLOR_OVERRIDES`
- `STOCKWORKS_LIMITED_THRESHOLD_GRAMS`
- `STOCKWORKS_OUT_OF_STOCK_LEAD_DAYS`
- `STOCKWORKS_MATERIAL_LEAD_DAYS`

Preferred setup: save StockWorks URL/auth and inventory behavior in **Admin -> Suite setup**.

## Email and Notifications

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_SECURE`
- `RECEIPT_FROM_EMAIL`
- `RECEIPT_REPLY_TO_EMAIL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`
- `DISCORD_ADMIN_BOT_TOKEN`
- `DISCORD_ADMIN_CHANNEL_ID`

Preferred setup: save SMTP, push, and Discord settings in **Admin -> Suite setup**. Keep env values only when you intentionally want deployment-level overrides.

## Backup and Restore

- `BACKUP_DIR`
- `SKIP_DOCKER`
- `BACKUP_DOCKER_SERVICE`
- `PG_DUMP_BIN`
- `PSQL_BIN`
- `BACKUP_SCHEDULE_ENABLED`
- `BACKUP_SCHEDULE_TIME_UTC`
- `BACKUP_RUN_ON_START`
- `BACKUP_PRUNE_ON_BACKUP`
- `BACKUP_RETENTION_DAYS`
- `BACKUP_RETENTION_MAX_COUNT`

## Bulk Importer

- `BULK_UPLOAD_DIR`
- `BULK_UPLOAD_BASE_URL`
- `BULK_UPLOAD_EMAIL`
- `BULK_UPLOAD_PASSWORD`
- `BULK_UPLOAD_MATERIAL`
- `BULK_UPLOAD_TAGS`
- `BULK_UPLOAD_DESCRIPTION`
- `BULK_UPLOAD_CREDIT_NAME`
- `BULK_UPLOAD_CREDIT_URL`
- `BULK_UPLOAD_LIMIT`
- `BULK_UPLOAD_DRY_RUN`
- `BULK_UPLOAD_MATCH_COVER`

## Recommended Configuration Process

1. Start from `.env.example`.
2. Set core runtime values first.
3. Sign in as an admin and open `/admin/suite-setup`.
4. Enable one integration at a time and use the built-in connection tests where available.
5. Keep production secrets out of version control and out of copied sample files.
