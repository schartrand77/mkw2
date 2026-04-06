# MakerWorks Next Major Release Roadmap (v3)

Last updated: 2026-04-03
Planning horizon: Q2 2026 -> Q1 2027

## 0) Audit Snapshot (Current State)

This roadmap is based on the current repository/application baseline:

- Frontend/API platform: Next.js App Router + React 19 + TypeScript.
- Commerce + operations breadth is already high and includes customer flows, admin production tools, PrintLab integration, and Stockworks inventory intelligence.
- Codebase footprint (approx):
  - 49 route pages (`app/**/page.tsx`)
  - 133 API routes (`app/api/**/route.ts`)
  - 88 React components (`components/**/*.tsx`)
  - 97 library modules (`lib/**/*.ts`)
- Quality checks from this audit run:
  - `npm run lint` passes with warnings (no errors).
  - `npm run typecheck` passes.
  - `npm test` exits successfully but reports `0` discovered tests in this environment.

### Key strengths

- Strong end-to-end domain coverage from quoting to fulfillment.
- Mature operations surfaces (queues, analytics, fleet, maintenance, inventory, backup/restore).
- Modern integration strategy: PrintLab as execution boundary and Stockworks for inventory/material intelligence.

### Key gaps to close for a major release

- Design consistency across growing feature surfaces (admin + customer + discover + checkout).
- Test depth/coverage and CI confidence gating.
- Multi-tenant enterprise hardening (permissions granularity, audit exportability, SLOs).
- Advanced automation and intelligence to reduce operator touch time further.

---

## 1) Release Theme

**MakerWorks v3 = "Autonomous Print Commerce Platform"**

Primary objective: move from "feature-rich system" to "state-of-the-art operating system" for print farms and distributed maker teams.

Success criteria:

- 30-50% fewer operator interactions per order/job.
- Measurable UX improvements in checkout completion and order confidence.
- Stronger reliability posture (defined SLOs + incident visibility + recovery drills).
- Clear enterprise-ready differentiation: governance, automation, and integrations.

---

## 2) North-Star Product Pillars

### Pillar A — Next-Gen UX/UI System

- Ship a unified design system across storefront, workspace, and admin.
- Add adaptive dashboards by user role (customer, production operator, manager, finance).
- Bring advanced interaction quality to parity with modern SaaS leaders:
  - ~~command palette + global actions~~
  - contextual side panels
  - keyboard-first flows for operations
  - optimistic UI + skeleton/loading states tuned by task type
- Completed v3 shell slice: command palette + global actions shipped in the shared app shell.
- Accessibility target: WCAG 2.2 AA across all critical flows.

### Pillar B — Intelligence Everywhere

- Expand model/job intelligence from static scoring to live recommendations:
  - print strategy assistant (orientation, support, material, queue slot)
  - ETA confidence calibration by printer/material/history
  - pre-flight issue prevention with action-based fixes
- Introduce explainable AI outputs with confidence + reason traces for every recommendation.

### Pillar C — Autonomous Operations

- Policy-driven automation engine:
  - auto-routing jobs to printers by capability, queue health, SLA, and cost
  - automated recovery playbooks (failure detected -> requeue profile -> notify)
  - dynamic material substitution with approval policies
- Shift from dashboards-only to "recommended actions" and one-click execution.

### Pillar D — Enterprise Governance & Security

- Fine-grained RBAC (module + record + action scope).
- Full audit/event timeline export (compliance-friendly).
- Security posture upgrades:
  - secrets rotation playbooks
  - signed webhook lifecycle management
  - abuse/rate-limit analytics and anomaly alerts

### Pillar E — Open Ecosystem & Integrations

- API/automation platform maturity:
  - stable webhook contracts
  - outbound event bus
  - connector SDK template
- First-party connectors roadmap:
  - ecommerce (Shopify/Woo)
  - shipping providers
  - accounting/ERP exports
  - printer adapters beyond current boundary

---

## 3) Release Tracks and Milestones

## Track 1 — Platform & Reliability Foundation (Weeks 1-6)

- Runtime/dependency modernization from `UPGRADE_RECOMMENDATIONS.md` execution wave.
- CI quality gates:
  - ~~route-level API contract tests~~
  - ~~smoke e2e pack for quote -> checkout -> order -> job~~
  - ~~backup/restore validation in CI-capable environment~~
- Completed v3 foundation slice: route-level API contract coverage now locks key quote, checkout, auth, and job-update response/error contracts.
- Completed v3 foundation slice: focused server smoke coverage now exercises quote pricing plus the checkout -> OrderWorks -> customer order -> manufacturability artifact -> PrintLab submission path.
- Completed v3 foundation slice: backup and restore validation now includes an executable restore-flow test and Windows-safe local `psql` restore handling.
- Observability baseline:
  - ~~SLOs for checkout API, job orchestration callbacks, and queue processing~~
  - ~~release health dashboard and alert thresholds~~
- Completed v3 foundation slice: admin release health now surfaces live SLO summaries for checkout API, webhook callbacks, queue pressure, and dependency checks with warn/fail thresholds.

Exit criteria:

- No critical regressions for 2 consecutive release candidates.
- SLO instrumentation live in staging + production.

## Track 2 — UX/UI Modernization (Weeks 4-12)

- Design token system and component primitives rollout.
- Navigation overhaul:
  - role-aware left nav
  - ~~command palette~~
  - cross-context breadcrumbs and quick-switching
- Completed v3 shell slice: role-aware command palette trigger, keyboard shortcut, and global action overlay.
- High-impact surface redesign:
  - ~~discover/search UX~~
  - ~~model detail + quote workspace~~
  - ~~checkout and order status timeline~~
  - ~~production queue board + exception handling panels~~
- Completed v3 surface slice: Discover now uses the new hero search/filter stack, presets, and improved result states.
- Completed v3 surface slice: Model detail now uses a clearer review-and-quote workspace with structured buyer guidance and quote flow entry.
- Completed v3 surface slice: Checkout and customer order detail now share clearer status-preview and timeline patterns across purchase and fulfillment.
- Completed v3 surface slice: Admin production now includes a queue board and dedicated exception-handling/watchlist layer for operator triage.

Exit criteria:

- Visual consistency scorecard complete on all tier-1 screens.
- Accessibility audit signoff for core purchase and ops flows.

## Track 3 — Intelligence & Automation (Weeks 8-16)

- ~~Smart routing engine v2 with policy configuration UI.~~
- ~~AI-assisted preflight and remediation suggestions.~~
- Predictive operations:
  - ~~spool depletion forecasting with confidence windows~~
  - ~~printer downtime risk scoring~~
  - ~~SLA risk early-warning on queued orders~~
- Completed v3 automation slice: production now includes policy-driven smart routing with previewable assignment recommendations, scoring reasons, and operator controls for speed, cost, queue balance, and SLA urgency.
- Completed v3 automation slice: the quote workspace now includes a preflight assistant that turns manufacturability, risk, support, material, and ETA signals into actionable remediation suggestions with confidence and priority.
- Completed v3 automation slice: predictive operations now score spool depletion windows from queue plus burn-rate history, surface printer downtime risk from reliability and maintenance signals, and flag queued orders with early SLA risk warnings.

Exit criteria:

- Operator touches per job reduced by at least 30% in pilot cohort.
- Documented false-positive/false-negative rates for recommendations.

## Track 4 — Enterprise & Ecosystem (Weeks 12-18)

- ~~Advanced org controls (department policy packs, spend controls, approval graphs).~~
- ~~Webhook/API hardening and documentation portal refresh.~~
- ~~Connector beta releases (pick 2 priority integrations by customer demand).~~
- Completed v3 enterprise slice: admin governance now centralizes organization policy packs, spend controls, department budget tracking, and approval-graph visibility with audited policy updates.
- Completed v3 enterprise slice: admin webhook/API ops now surfaces callback security posture, secret coverage, and operator guidance in-product, with refreshed webhook operations docs and inbound secret validation.
- Completed v3 enterprise slice: connector betas now include Shopify draft-order export payloads and shipping-manifest export payloads with admin preview tooling and documented contract shapes.

Exit criteria:

- Two production beta customers onboarded per connector.
- Audit exports and governance controls validated with real admin workflows.

## Track 5 — Launch Readiness (Weeks 18-20)

- Release candidate hardening, migration docs, rollback drills.
- Performance pass (core web vitals + high-volume admin tables).
- GTM bundle:
  - launch narrative
  - migration guide from current MakerWorks release
  - benchmark snapshots (throughput, operator time savings)

Exit criteria:

- Launch checklist complete with green status across engineering, product, and operations.

---

## 4) UI Modernization Blueprint (State-of-the-Art Target)

### Design language

- Introduce semantic tokens (`color.surface.*`, `color.status.*`, `space.*`, `motion.*`, etc.) and dark mode parity.
- Use systemized data-density modes (comfortable/compact) per workflow context.
- Standardize feedback patterns: toast hierarchy, inline validation, activity timelines.

### Interaction model

- ~~Command palette as universal action layer.~~
- Contextual drawers replacing deep navigation for frequent tasks.
- Inline "why" explanations for pricing, lead-time, and risk decisions.
- Real-time collaboration presence on model review + order approval pages.

Completed v3 shell slice: universal command palette is now implemented in the app shell with keyboard access and role-aware actions.

### Visual analytics

- Unified chart grammar for analytics and production dashboards.
- Drill-down from KPI cards to actionable queue/filter states.
- Time-travel comparisons (today vs last week vs trailing 30-day baseline).

---

## 5) Technical Architecture Initiatives

- Domain service boundaries for quoting, orchestration, inventory, and billing.
- Event-driven workflow backbone for order/job state transitions.
- Idempotency hardening across integrations and retries.
- Background processing roadmap:
  - queue partitioning by workload class
  - dead-letter handling UX
  - replay tooling for failed flows
- Data strategy:
  - query performance profiling + index roadmap
  - analytical snapshot tables for dashboards

---

## 6) Quality and Performance Bar

### Test strategy target for v3

- Unit tests for critical pricing/orchestration logic.
- API contract tests for public and admin endpoints.
- End-to-end critical-path coverage:
  - discover -> quote -> cart -> checkout
  - order -> job creation -> printer assignment -> status callbacks
  - backup -> restore smoke validation

### Performance targets

- <2.0s median interactive load on top storefront routes.
- <500ms p95 for key quote and order read endpoints.
- 99.9% success for job callback processing with retry traceability.

---

## 7) Suggested Team Structure for Delivery

- **Track Lead: Platform/Reliability** (CI, infra, SLOs, upgrade waves)
- **Track Lead: Design System + Frontend** (tokens, primitives, nav overhaul)
- **Track Lead: Automation/AI** (routing engine, recommendation services)
- **Track Lead: Integrations/Enterprise** (API/webhooks/connectors/governance)
- **Release PM/Ops** (milestones, launch readiness, migration docs)

---

## 8) Risks and Mitigations

- **Risk:** Scope explosion across too many major features.
  - **Mitigation:** enforce milestone exit criteria and freeze non-critical features after week 14.
- **Risk:** UI modernization causes regressions in mature operations workflows.
  - **Mitigation:** shadow mode + operator pilot group before default rollout.
- **Risk:** Automation confidence issues reduce trust.
  - **Mitigation:** explainability + confidence thresholds + easy manual overrides.
- **Risk:** Integration instability under production load.
  - **Mitigation:** contract testing, replay tooling, and canary rollout by tenant.

---

## 9) Definition of Done (Major Release)

MakerWorks v3 ships when all are true:

1. Platform reliability objectives and SLO dashboards are live and stable.
2. Core customer + operations surfaces use the new unified UI system.
3. Automation features demonstrably reduce operator effort in real workflows.
4. Governance and integration layers support enterprise adoption requirements.
5. Migration and rollback playbooks are tested and published.

