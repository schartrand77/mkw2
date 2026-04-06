# Webhook Operations

This page is the operator-facing reference for MakerWorks inbound callbacks and webhook security posture.

## Inbound Endpoints

- `/api/makerworks/jobs`
  - Used for MakerWorks/OrderWorks-style inbound job and payment updates.
  - Supports bearer-secret auth and timestamped HMAC signatures.
- `/api/printlab/jobs/[jobId]`
  - Used for PrintLab callback updates on submitted jobs.
  - Supports bearer-secret auth and timestamped HMAC signatures.

## Security Model

- `MAKERWORKS_INBOUND_SECRET` protects the MakerWorks inbound route.
- `PRINTLAB_WEBHOOK_SECRET` protects the PrintLab callback route.
- PrintLab can fall back to `MAKERWORKS_INBOUND_SECRET`, but a dedicated secret is preferred.
- Signature headers use a five-minute replay window.
- Legacy query-string secret support still exists for compatibility and should be phased out where possible.

## Rotation Playbook

1. Stage the new secret in the upstream sender first.
2. Update the MakerWorks deployment environment.
3. Validate callback health from `/admin/webhooks` and `/admin/release-health`.
4. Remove any legacy query-token usage in the sender.
5. Watch callback success/failure metrics for regressions.

## Failure Modes

- Missing secret configuration returns `500` and increments webhook failure metrics.
- Invalid signatures return `401`.
- Invalid JSON returns `400`.
- Schema validation failures return `422`.
- Unknown PrintLab jobs return `404`.

## Operational Checks

- Use `/admin/webhooks` for the current security posture and contract notes.
- Use `/admin/site-config` and `/api/admin/env-check` to confirm secrets exist.
- Use `/admin/release-health` to monitor callback SLOs and latency.
