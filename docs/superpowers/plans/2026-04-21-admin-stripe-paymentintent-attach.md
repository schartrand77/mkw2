# Admin Stripe PaymentIntent Attach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins attach a Stripe `PaymentIntent` from the customer order detail view so paid jobs can be linked back to their real Stripe record.

**Architecture:** Add an admin-only attach route under the existing order admin API, then extend the existing `StripePaymentPanel` to call it and reuse the current Stripe sync logic. Keep the linkage source of truth as `PrintOrder.stripePaymentIntentId` while mirroring the value into nested Stripe metadata for compatibility.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Prisma, Node test runner, existing Stripe reconciliation helpers.

---

### Task 1: Add Route-Level Tests First

**Files:**
- Create: `tests/admin-order-stripe-attach.test.ts`

- [ ] **Step 1: Write the failing invalid-id test**

Add a test that posts `{ paymentIntentId: "bad_123" }` to the new route and asserts a `400` response with an invalid PaymentIntent error.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm test -- tests/admin-order-stripe-attach.test.ts
```

Expected: FAIL because the route does not exist yet.

- [ ] **Step 3: Add duplicate and success tests**

Extend the same file with:

- duplicate attach rejected when another order already owns the PaymentIntent
- successful attach persists the value and invokes Stripe sync

- [ ] **Step 4: Re-run the test file**

Run:

```powershell
npm test -- tests/admin-order-stripe-attach.test.ts
```

Expected: FAIL in the new success and duplicate cases because implementation is still missing.

### Task 2: Implement Attach Route

**Files:**
- Create: `app/api/admin/orders/[orderId]/stripe-attach/route.ts`
- Modify: `lib/stripe-payments.ts`

- [ ] **Step 1: Add a metadata helper if needed**

If `lib/stripe-payments.ts` lacks a reusable helper for setting the nested Stripe PaymentIntent while preserving other metadata, add one there with a focused testable shape.

- [ ] **Step 2: Implement the route minimally**

Create the route handler to:

- require admin auth
- validate `pi_...`
- load the order
- reject duplicates
- persist the PaymentIntent linkage
- call `syncStripePaymentIntent(paymentIntentId, "admin.attach")`

- [ ] **Step 3: Run the attach route tests**

Run:

```powershell
npm test -- tests/admin-order-stripe-attach.test.ts
```

Expected: PASS.

### Task 3: Cover Helper Behavior

**Files:**
- Modify: `tests/stripe-payments.test.ts`
- Modify: `lib/stripe-payments.ts`

- [ ] **Step 1: Write a failing metadata helper test**

Add a test proving the attach path preserves unrelated metadata while updating `stripe.paymentIntentId`.

- [ ] **Step 2: Run helper tests to verify failure**

Run:

```powershell
npm test -- tests/stripe-payments.test.ts
```

Expected: FAIL in the new helper case before implementation is complete.

- [ ] **Step 3: Implement the minimal helper/update logic**

Update `lib/stripe-payments.ts` only enough to make the metadata behavior deterministic and reusable by the attach route.

- [ ] **Step 4: Re-run helper tests**

Run:

```powershell
npm test -- tests/stripe-payments.test.ts
```

Expected: PASS.

### Task 4: Extend Admin Stripe Panel

**Files:**
- Modify: `components/admin/StripePaymentPanel.tsx`

- [ ] **Step 1: Add attach UI**

Add an input and button for attaching a `pi_...` while preserving existing sync and refund controls.

- [ ] **Step 2: Wire the new route call**

POST to `/api/admin/orders/${orderId}/stripe-attach`, display errors inline, and reload on success.

- [ ] **Step 3: Manually review the component for conflicts**

Read the current file carefully before editing so existing in-progress Stripe panel changes in the dirty worktree are preserved.

### Task 5: Targeted Verification

**Files:**
- Read: `app/api/admin/orders/[orderId]/stripe-attach/route.ts`
- Read: `components/admin/StripePaymentPanel.tsx`
- Read: `tests/admin-order-stripe-attach.test.ts`
- Read: `tests/stripe-payments.test.ts`

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npm test -- tests/admin-order-stripe-attach.test.ts tests/stripe-payments.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run diff sanity check**

Run:

```powershell
git diff --check
git diff -- app/api/admin/orders/[orderId]/stripe-attach/route.ts components/admin/StripePaymentPanel.tsx lib/stripe-payments.ts tests/admin-order-stripe-attach.test.ts tests/stripe-payments.test.ts docs/superpowers/specs/2026-04-21-admin-stripe-paymentintent-attach-design.md docs/superpowers/plans/2026-04-21-admin-stripe-paymentintent-attach.md
```

Expected: no whitespace errors and only the intended changes in the touched files.
