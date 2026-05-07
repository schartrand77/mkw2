# Charity Organization Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track charity/community organizations and donated or discounted production work inside MakerWorks.

**Architecture:** Add small, explicit fields to `Organization` and `PrintOrder`, then centralize contribution normalization/report calculations in `lib/community-contributions.ts`. Existing organization APIs and settings UI expose the classification fields; admin/manual orders can record contribution details while normal checkout orders default to paid work.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, Node test runner.

---

### Task 1: Contribution Domain Helpers

**Files:**
- Create: `lib/community-contributions.ts`
- Test: `tests/community-contributions.test.ts`

- [ ] Write tests for organization category, contribution type, receipt status normalization, and report totals.
- [ ] Run `npm test tests/community-contributions.test.ts` and confirm the missing module failure.
- [ ] Implement the helper module.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Database Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260506120000_charity_organization_tracking/migration.sql`

- [ ] Add organization fields: `category`, `charitableRegistrationNumber`, `communityNotes`.
- [ ] Add order fields: `contributionType`, `donatedAmountCents`, `materialCostCents`, `machineTimeMinutes`, `receiptStatus`, `contributionNotes`.
- [ ] Add indexes for category and contribution reporting.
- [ ] Run `npm run prisma:generate`.

### Task 3: API Wiring

**Files:**
- Modify: `lib/organizations.ts`
- Modify: `app/api/customer/organizations/route.ts`
- Modify: `app/api/customer/organizations/[organizationId]/route.ts`
- Modify: `app/api/admin/orders/route.ts`

- [ ] Include organization classification fields in reads, creates, and privileged updates.
- [ ] Validate admin-created contribution fields using domain helpers.
- [ ] Persist contribution fields when admins create manual/community orders.

### Task 4: UI Wiring

**Files:**
- Modify: `app/settings/organizations/page.tsx`

- [ ] Add organization category controls and charity registration/community notes fields.
- [ ] Show classification in organization summary.
- [ ] Submit classification fields through the existing create and policy update flows.

### Task 5: Verification

**Commands:**
- `npm test tests/community-contributions.test.ts`
- `npm run typecheck`

- [ ] Run focused unit tests.
- [ ] Run TypeScript verification.
