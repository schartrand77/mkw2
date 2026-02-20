# MakerWorks v2 Professional App Audit

Date: 2026-02-19

## Executive summary
MakerWorks v2 already has strong product depth: full storefront, quoting, checkout, production operations, inventory links, printer automation, and backup tooling. The biggest gap to becoming a clearly professional-grade product is less about new core capability and more about hardening:

1. **Operational reliability** (monitoring, SLOs, runbooks, CI quality gates)
2. **Security/compliance posture** (auth/session hardening, secrets hygiene, auditability)
3. **Performance and scalability** (queue architecture, caching strategy, heavy-viewer optimization)
4. **Product polish** (clear onboarding, KPI surfaces, stronger self-serve customer UX)

---

## What is already strong
- Broad end-to-end scope covering customer + operator workflows.
- Mature 3D-print-specific intelligence (orientation, support/failure signals, pricing complexity).
- Solid integration readiness (Stripe, inventory sync, printer telemetry, notifications).
- Practical ops hooks (backup/restore scripts, env-check endpoint, migration/bootstrap flow).

---

## Priority improvements (professionalization plan)

## P0 (next 2-4 weeks)

### 1) Add production observability baseline
**Why:** You cannot professionally operate what you cannot measure.

**Implement:**
- Structured request logging (route, latency, user/org, error code).
- Error tracking (Sentry or equivalent) across API + client.
- Metrics for queue age, job success/failure, checkout conversion, payment failures.
- Health endpoints with dependency checks (DB, storage, external APIs).

**Success criteria:**
- MTTR decreases (target < 30 min for P1 issues).
- 90%+ of incidents have stack traces + correlated request IDs.

### 2) Tighten auth/session security
**Why:** `proxy.ts` currently gates pages mostly by cookie presence; stronger verification and defense-in-depth are needed for enterprise readiness.

**Implement:**
- Verify JWT signature + expiry at edge/middleware or server boundary for every privileged page/API.
- Add role-based authorization checks at API handler level (not only route-gating).
- Add CSRF protection for state-changing non-API form submissions if any are cookie-authenticated.
- Add forced session invalidation path (password reset/logout-all).

**Success criteria:**
- Security checklist passes for session fixation/token forgery scenarios.
- Privilege escalation tests included in CI.

### 3) Establish CI/CD quality gates
**Why:** Current scripts include tests, but no explicit lint/typecheck gates are visible.

**Implement:**
- Add `lint`, `typecheck`, and test jobs in CI.
- Block merge on failing checks.
- Add migration drift check for Prisma schema.

**Success criteria:**
- Every PR runs deterministic checks.
- Regression escape rate measurably declines.

### 4) Secrets and environment hardening
**Why:** `.env.example` includes many powerful integration credentials and operational toggles; production deployments need stronger safeguards.

**Implement:**
- Move secrets to managed vault (AWS/GCP/Vercel/1Password Connect, etc.).
- Add startup guardrails for weak defaults (`JWT_SECRET`, admin bootstrap password).
- Add environment profile matrix (dev/staging/prod) with explicit required vars.

**Success criteria:**
- No static secrets in deploy manifests.
- Startup fails fast on insecure prod config.

---

## P1 (1-2 quarters)

### 5) Queue and background job architecture
**Why:** Heavy processing (3MF conversion/images/model intelligence) should be isolated from web request capacity.

**Implement:**
- Move processing queues to dedicated worker(s) + broker (BullMQ/SQS/etc.).
- Add retries with dead-letter queue and idempotency keys.
- Add admin UI for stuck/retryable jobs.

### 6) Performance program
**Implement:**
- Introduce route-level caching and invalidation strategy.
- Lazy-load heavy viewer libraries and optimize model preview payload sizes.
- Add synthetic performance budgets (TTFB/LCP/INP targets).

### 7) Test strategy expansion
**Implement:**
- Add API integration tests for checkout/order/auth flows.
- Add Playwright E2E for critical buyer journey.
- Add contract tests for StockWorks/OrderWorks/Bambu integrations.

### 8) Data lifecycle and compliance
**Implement:**
- Data retention policies for uploads, logs, and messages.
- GDPR/CCPA export + deletion workflow.
- Immutable audit events for privileged admin actions.

---

## High-impact new feature ideas

### A) Customer trust & conversion
- **Manufacturability report PDF** attached to every quote/order.
  - Customer sees: part dimensions, printability/failure risk, recommended orientation, material choice rationale, and expected post-processing needs.
  - MVP scope: generate on quote acceptance and store immutable snapshot with order artifacts.
  - Inputs: existing mesh analysis, orientation engine output, material profile data, and pricing assumptions.
  - KPI impact: increase quote-to-order conversion and reduce pre-production clarification messages.
- **Lead-time estimator** that blends queue load, material availability, and printer capacity.
  - Customer sees: estimated ship window and confidence band before checkout.
  - MVP scope: rules-based ETA using queue depth, printer uptime history, and in-stock filament constraints.
  - Inputs: job queue metrics, printer telemetry/utilization, and inventory reservations.
  - KPI impact: improve on-time fulfillment and reduce orders delayed by unavailable material/printer contention.
- **Order transparency timeline** with photo milestones and ETA confidence score.
  - Customer sees: timestamped stages (queued, printing, post-process, packed, shipped), milestone photos, and updated ETA confidence.
  - MVP scope: timeline events from existing job status transitions plus optional operator photo upload at key checkpoints.
  - Inputs: order/job events, shipping tracking events, and queue-based ETA recalculation.
  - KPI impact: lower support ticket volume ("where is my order") and increase repeat purchase trust.

### B) B2B revenue expansion
- **Organization accounts** with teams, seats, role permissions, and shared billing.
  - Customer sees: centralized workspace with member roles (requester, approver, finance, admin) and shared payment methods.
  - MVP scope: multi-user org container, invitation flow, role-based permissions, and org-level billing profile.
  - Inputs: existing user/auth model, RBAC checks, and checkout/invoicing flows.
  - KPI impact: increase average order value, retention of business customers, and multi-seat account adoption.
- **Quote approval workflow** with requester/approver split and PO controls.
  - Customer sees: configurable approval steps, approver comments, and required PO attachment for eligible orders.
  - MVP scope: approval states (draft, pending approval, approved, rejected) and policy rules by order amount/customer type.
  - Inputs: quote/order state machine, notification system, and document storage for PO files.
  - KPI impact: improve enterprise conversion rate and reduce manual back-and-forth in sales operations.
- **Usage analytics for enterprise customers** (spend by project, material, and time).
  - Customer sees: downloadable dashboards for budget tracking, trend analysis, and team-level usage accountability.
  - MVP scope: org reporting views with date filters, project tags, and CSV export.
  - Inputs: order line items, material metadata, project attribution fields, and invoice/payment status.
  - KPI impact: increase enterprise stickiness and upsell potential through procurement visibility.

### C) Operations excellence
- **Predictive maintenance** from print failure patterns and printer telemetry.
  - Operator sees: maintenance risk score per printer with recommended preventive actions and due windows.
  - MVP scope: rules-based anomaly detection using failure counts, runtime hours, and error-code patterns.
  - Inputs: printer telemetry stream, failure/reprint history, and maintenance logs.
  - KPI impact: reduce unplanned downtime, failed prints, and emergency repair costs.
- **Capacity planner** proposing staffing and utilization plans from demand forecasts.
  - Operator sees: projected weekly load vs available machine/labor hours with suggested staffing adjustments.
  - MVP scope: forecast-aware planner with scenario toggles for rush demand, maintenance outages, and shift coverage.
  - Inputs: demand forecast, queue backlog, printer availability calendar, and labor schedule.
  - KPI impact: improve on-time delivery and gross margin per printer-hour.
- **Auto-routing** to best-fit printer based on material, due date, and confidence score.
  - Operator sees: recommended printer assignment with rationale and override controls.
  - MVP scope: decision engine using material compatibility, current queue position, expected completion time, and reliability score.
  - Inputs: printer capability matrix, queue state, maintenance flags, and job SLA/due date.
  - KPI impact: increase throughput and first-pass success rate while reducing manual scheduling time.

### D) Marketplace/community growth
- **Designer storefront tiers** (verified creators, royalties, featured placement bidding).
  - Creator sees: tiered visibility and monetization options with transparent payout/fee rules.
  - MVP scope: creator profiles, verification badge workflow, royalty split settings, and featured listing placements.
  - Inputs: commerce/order pipeline, payout ledger, moderation queue, and ranking signals.
  - KPI impact: increase catalog quality, creator retention, and marketplace GMV.
- **Remix/version lineage graph** for model derivatives.
  - Community sees: parent-child model history with attribution, version notes, and license inheritance.
  - MVP scope: version graph metadata, attribution display, and remix creation flow linked to source model.
  - Inputs: model metadata store, user identity, and licensing terms.
  - KPI impact: increase content reuse velocity and trust in creator attribution.
- **Public API + webhooks** for external storefront/ERP integrations.
  - Integrator sees: stable endpoints/events for quote, order, status, and inventory synchronization.
  - MVP scope: API keys, scoped permissions, webhook signing/retry policy, and core integration endpoints.
  - Inputs: existing internal services for orders, inventory, and job status events.
  - KPI impact: expand partner ecosystem and reduce integration friction for high-volume customers.

---

## Suggested KPI dashboard for "professional app" readiness
Track weekly:
- Checkout conversion rate
- Quote-to-order conversion rate
- On-time fulfillment rate
- Failed print rate and reprint rate
- Gross margin per order and per printer-hour
- P95 API latency for checkout + model pages
- Queue wait time (image/model processing)
- Incident count + MTTR

---

## Recommended implementation sequence
1. Observability + CI gates + auth hardening (foundation)
2. Worker queue architecture + reliability controls
3. Customer trust features (lead-time, status transparency)
4. B2B org accounts + approval controls
5. Predictive/capacity intelligence and platform API

This sequence maximizes risk reduction first, then compounds into growth features that are easier to support at scale.

