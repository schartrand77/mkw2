# Admin Stripe PaymentIntent Attach Design

## Context

MakerWorks already stores Stripe reconciliation data on `PrintOrder`, including:

- `stripePaymentIntentId`
- `stripeChargeId`
- `stripeCustomerId`
- `receiptUrl`
- `paymentStatus`

The admin order detail page for customer order history already renders this information through `StripePaymentPanel` on the admin customer order screen. It also exposes an admin-only "Sync Stripe" action that re-fetches Stripe data, but only when the order already has a linked PaymentIntent.

The missing workflow is retroactive linkage. Admin can manually mark a job paid, but there is no follow-up way to attach the real Stripe Tap to Pay PaymentIntent for bookkeeping and receipt history.

## Goal

Allow an admin, from the existing admin customer order detail view, to attach a Stripe `PaymentIntent` ID to an existing order and immediately reconcile Stripe payment metadata onto that order.

## Design

Add an admin-only attach action to the existing Stripe panel instead of creating a new page or customer-facing flow.

The flow:

1. Admin opens a customer order in the admin order history view.
2. In the existing Stripe panel, admin pastes a `pi_...` ID.
3. MakerWorks validates the ID format.
4. MakerWorks persists the PaymentIntent reference on the target order.
5. MakerWorks reuses the existing Stripe reconciliation path to retrieve and store charge ID, receipt URL, customer ID, refunded amount, and normalized payment status.
6. The panel refreshes to show the linked payment record.

This keeps the feature aligned with the existing Stripe sync behavior and avoids a second, divergent reconciliation implementation.

## API Design

Add an admin-only route:

- `POST /api/admin/orders/[orderId]/stripe-attach`

Request body:

```json
{
  "paymentIntentId": "pi_..."
}
```

Behavior:

- Require admin authentication.
- Validate that `paymentIntentId` is a non-empty string beginning with `pi_`.
- Confirm the target order exists.
- Reject if the same `stripePaymentIntentId` is already assigned to a different order.
- Persist `stripePaymentIntentId` on the target order.
- Update order metadata so `metadata.stripe.paymentIntentId` reflects the attached value.
- Call the existing `syncStripePaymentIntent(paymentIntentId, 'admin.attach')`.
- Return the normalized Stripe state needed by the panel.

## UI Design

Extend `components/admin/StripePaymentPanel.tsx` with:

- a small text input for `pi_...`
- an `Attach PaymentIntent` button
- existing message handling reused for attach results and failures

Behavior details:

- Pre-fill the input with the current `paymentIntentId` when one already exists.
- Disable attach while another Stripe panel action is running.
- Surface validation and API errors inline.
- Reload after a successful attach so the page reflects the reconciled order record.

The feature remains admin-only because the panel is only rendered in the admin customer order detail page.

## Data Rules

- `stripePaymentIntentId` remains the first-class linkage field on `PrintOrder`.
- `metadata.stripe.paymentIntentId` is updated for compatibility with existing fallback lookup paths.
- Existing order `metadata.paymentIntentId` is not repurposed for this feature because it is broader legacy linkage data used by job/order relationships.
- Attaching a PaymentIntent updates Stripe-derived payment details, but does not automatically change other workflow decisions beyond what existing Stripe sync already does.

## Error Handling

Return clear, explicit failures for:

- unauthorized admin access
- invalid or missing PaymentIntent IDs
- missing orders
- duplicate linkage where another order already owns the same PaymentIntent
- Stripe retrieval failures such as "not found"

The panel should display these errors without losing the current page context.

## Testing

Add focused tests for:

- attach route rejects invalid `paymentIntentId`
- attach route rejects when another order already uses the same PaymentIntent
- attach route stores the ID and invokes Stripe sync successfully
- Stripe metadata merge preserves unrelated metadata while replacing the nested Stripe PaymentIntent

Verification should stay targeted to the changed route/test files and avoid unrelated payment work already in progress in the dirty worktree.

## Scope

In scope:

- admin order detail Stripe panel updates
- new admin attach route
- reuse of existing Stripe reconciliation logic
- targeted automated tests

Out of scope:

- customer-facing payment linking
- support for attaching raw `charge` IDs
- bulk reconciliation tools
- changing how jobs are initially marked paid

## Acceptance Criteria

- Admin can attach a `pi_...` from the customer order detail Stripe panel.
- The linked order records `stripePaymentIntentId`.
- Existing Stripe sync populates charge, receipt, customer, refund, and payment status fields after attach.
- Duplicate attachment to multiple orders is blocked.
- Invalid IDs fail with a clear error.
