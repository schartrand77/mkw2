# Configuration Reference

Use `.env.example` as the source of truth for environment variables. This page groups the most important settings by responsibility so operators can reason about configuration faster.

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

Required for card-based checkout.

## PrintLab

- `PRINTLAB_BASE_URL`
- `PRINTLAB_API_KEY`
- `PRINTLAB_API_KEY_HEADER`
- `PRINTLAB_SESSION_COOKIE`
- `PRINTLAB_AUTH_HEADER`
- `PRINTLAB_WEBHOOK_SECRET`

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
3. Enable one integration at a time.
4. Validate from `/admin/site-config` and `/api/admin/env-check`.
5. Keep production secrets out of version control and out of copied sample files.
