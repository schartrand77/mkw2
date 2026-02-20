# MakerWorks User Manual

This guide explains how to use MakerWorks end-to-end: browsing, uploading, configuring prints, checking out, tracking orders, and running admin operations.

## 1. Who This Manual Is For

- Customers placing print and merch orders.
- Creators uploading and managing models.
- Team members managing organization billing/approvals.
- Admin/staff users operating production and storefront controls.

## 2. Roles and Access

- Guest (not signed in):
  - Can browse Discover, Store, Collections, and model details.
  - Cannot upload, checkout, like, or access customer/admin tools.
- Signed-in customer:
  - Can upload, add to cart, checkout, view orders, update profile/account settings.
- Organization member:
  - Same as customer, plus organization-aware checkout and org usage views.
- Admin/staff:
  - Full customer capabilities plus admin control plane at `/admin` and related pages.

## 3. Main Navigation

Primary app navigation is available in the sidebar:

- `Discover` (`/discover`) for searchable catalog results.
- `Store` (`/products`) for product templates and merch.
- `Upload` (`/upload`) for model submission.
- `Cart` (`/cart`) and `Checkout` (`/checkout`).
- Account menu: profile, orders, customer portal, organizations, account settings, sign out.
- Admin users also see `Admin` with links to all operations tools.

## 4. Account Setup

### 4.1 Register (`/register`)

1. Open `Join`.
2. Enter account details.
3. Submit registration.

### 4.2 Sign In (`/login`)

1. Open `Sign in`.
2. Enter credentials.
3. Submit to access upload, cart, checkout, orders, and settings.

### 4.3 Sign Out and Sessions (`/settings/account`)

- `Sign out`: log out current device.
- `Sign out all devices`: invalidate all active sessions.

## 5. Discover and Search (`/discover`)

Discover is the main catalog search UI.

### 5.1 Search Inputs

- Search box, sort dropdown, page-size selector, and apply button are visible by default.
- Sort options:
  - `Latest`
  - `Popular`
  - `Price: Low to High`
  - `Price: High to Low`

### 5.2 Multi-Catalog Search

Discover search can return:

- Regular print models
- Product-template models
- Merch items

### 5.3 Hashtag Scopes

Use hashtags in the query to limit scope:

- `#models` for model-only results
- `#products` for product-template results
- `#merch` for merch results

Examples:

- `dragon` -> all catalogs
- `dragon #models` -> models only
- `hoodie #merch` -> merch only

### 5.4 Result Behavior by Type

- Model result:
  - Opens `/models/{id}`
  - Supports quick `Add` and `Like`
- Product result:
  - Opens `/products/{id}`
  - Detail-first flow (no inline cart add on Discover)
- Merch result:
  - Opens `/products/{id}?kind=merch`
  - Detail-first flow

## 6. Collections (`/collections`)

- Browse curated collections.
- Open a collection page to view matching model cards.
- Use `View all` from Discover featured collections for full list.

## 7. Model Detail Page (`/models/{id}`)

Model detail is the core product page for printable models.

### 7.1 What You Can Do

- View gallery, cover image, and part previews.
- Review tags and jump back to filtered Discover via tag links.
- View creator credit and source link (if provided).
- Use Instant Quote configurator to set print parameters.
- Add full model or parts to cart.
- Download model file or full parts zip (if downloads enabled).
- Like and share model.
- Read and post comments.

### 7.2 Optional/Conditional Sections

- Build video embed.
- Affiliate/required parts section.
- Model intelligence (printability/failure/support signals).
- Revision notes timeline.
- Processing notices (cover/3MF previews) for model owners/admins.

### 7.3 Editing

If you are the model owner (or admin), you can open `Edit` to update model metadata and assets.

## 8. Store Page (`/products`)

Store has two product families:

- Configured print products (product templates built from base models)
- Merch

Use category anchors:

- `#models`
- `#merch`

Open any card to see product detail/configuration.

## 9. Product and Merch Detail (`/products/{id}`)

### 9.1 Product Templates

- Shows locked print configuration details.
- Displays estimated pricing context.
- Supports quantity and add-to-cart through product configurator.

### 9.2 Merch

- Shows merch image, category, availability, and pricing.
- Supports size/color/quantity options.
- If in stock: open external purchase URL (if configured).
- If back ordered: submit notify request in-page.

## 10. Upload Workflow (`/upload`)

Upload supports `.stl`, `.obj`, `.3mf`, `.zip`.

### 10.1 Required Fields

- Title
- At least one model file

### 10.2 Recommended Fields

- Tags (comma-separated)
- Description
- Credit creator + source URL
- Material default
- Optional target dimensions (X/Y/Z mm)
- Optional cover image

### 10.3 Upload Behavior

- Progress bar shows percent and transferred bytes.
- On success: redirects to newly created model page.
- On failure: inline + notification error message.

## 11. Cart Configuration (`/cart`)

Cart is a full configuration workstation, not just a quantity list.

### 11.1 Per-Item Controls

- Quantity increment/decrement.
- Material selection.
- Color slot editing (AMS-style palette and custom color input).
- Finish selection.
- Scale and dimension overrides (with ratio lock mode).
- Part-level controls for multipart models.

### 11.2 Presets

- Customer presets can be loaded/saved (when available in your account).

### 11.3 Pricing and Constraints

- Live subtotal and discounts.
- Batch tier messaging.
- Rush toggle (stored locally and reused in checkout).
- Material availability warnings (if Stockworks integration is active).
- Checkout disabled if:
  - Any item is missing required colors.
  - Minimum order subtotal is not met.

## 12. Checkout (`/checkout`)

Checkout supports card and deferred payment modes.

### 12.1 Inputs Collected

- Cart items with full print configuration.
- Shipping method:
  - Local pickup
  - Ship to saved profile address
- Payment method:
  - Card
  - Cash at pickup
  - Invoice
  - Purchase order (PO)
  - Quote request
- Optional organization billing selection and project code.
- Optional rush production flag.

### 12.2 Organization Rules

When billing to an organization:

- Requester roles may be forced to `quote` mode if approval is required.
- PO threshold rules can appear as guidance.

### 12.3 Card Checkout

- Uses Stripe Elements when publishable key is configured.
- On payment success, order finalization runs and confirmation is shown.

### 12.4 Deferred Checkout (Cash/Invoice/PO/Quote)

- Submits a non-card confirmation flow.
- Generates confirmation ID and order record.

### 12.5 Common Blocks

- Missing color selections.
- Missing shipping address for ship mode.
- Minimum order subtotal not met.

## 13. Customer Portal (`/customer/portal`)

Portal combines quick actions:

- Embedded upload section for fast submission.
- Recent orders panel.
- Presets panel.

Use this page for repeat workflows without hopping between routes.

## 14. Orders

### 14.1 Orders List (`/customer/orders`)

- Shows recent orders, totals, status badges, and line summaries.
- Open each order for full detail and actions.

### 14.2 Order Detail (`/customer/orders/{orderId}`)

Includes:

- Itemized order details and configured options.
- Production progress and ETA confidence.
- Shipping details.
- Order timeline (messages, approvals, revisions, photos, artifacts).
- Actions:
  - Download manufacturability report (when available)
  - Request reprint
  - Respond to org quote approval requests (when applicable)
  - Message the shop
  - Upload revision files

## 15. Profile and Public Creator Page

### 15.1 Edit Profile (`/settings/profile`)

- Name, slug (`/u/{slug}`), bio.
- Avatar upload.
- Contact info.
- Social links.
- Shipping address used by checkout.

### 15.2 My Page (`/me` -> redirects to `/u/{slug}`)

- Public profile page with avatar, bio, badges, contact/social links.
- Paginated list of your published models.

### 15.3 Liked Models (`/likes`)

- Lists models you have liked.

## 16. Account Settings (`/settings/account`)

- Sign out current device.
- Sign out all devices.
- Request email update verification.
- Change password with strength feedback.

## 17. Organization Settings (`/settings/organizations`)

- Create an organization.
- View organizations you belong to and your role.
- View billing and approval policy summary.
- View 90-day usage metrics (orders/spend).

## 18. Admin Manual (`/admin` and subpages)

All pages below require admin/staff access.

### 18.1 Admin Overview (`/admin`)

- High-level metrics (users, pending jobs, featured count).
- Quick links to primary tool pages.
- Backup/restore status snapshot.

### 18.2 Site Config (`/admin/site-config`)

- Update runtime storefront and pricing configuration.
- Run environment checks and review config audit history.

### 18.3 Notifications (`/admin/notifications`)

- Manage push notification setup/subscriptions for admin alerting.

### 18.4 Featured Models (`/admin/featured`)

- Curate the set/order of featured models used in storefront surfaces.

### 18.5 Home Comments (`/admin/home-comments`)

- Curate and moderate comments surfaced on the home experience.

### 18.6 Backups and Restore (`/admin/backup-tools`)

- Create backups.
- View latest backup metadata.
- Queue/monitor restore manifests.

### 18.7 Model Library (`/admin/models`)

- Search and manage model metadata/visibility/admin fields.
- Open model image management route (`/admin/models/{id}/images`) for cover/gallery control.

### 18.8 Product Builder (`/admin/products`)

- Create and maintain product templates tied to base models.
- Set locked print constraints and product configuration defaults.

### 18.9 Catalog Manager (`/admin/catalog`)

- Configure storefront labels for model/merch categories.
- Manage merch catalog entries, pricing, availability, and ordering metadata.

### 18.10 Production Dashboard (`/admin/production`)

- Central production monitoring and execution workspace for active orders.

### 18.11 Job Queue (`/admin/jobs`)

- Monitor and control OrderWorks-style job state and fulfillment transitions.

### 18.12 Processing Queues (`/admin/processing-queues`)

- Observe async processing queues and retry/requeue stuck work.

### 18.13 Users (`/admin/users`)

- Invite users.
- Manage roles/badges/account status.
- Drill into per-user order operations.

### 18.14 User Orders Admin Flow

- `/admin/users/{userId}/orders`:
  - View all user orders with status and linked job controls.
- `/admin/users/{userId}/orders/{orderId}`:
  - Adjust status.
  - Assign printers.
  - Upload slicer profiles.
  - Manage packing checklist, shipping tracking, slicer stats, quantities.
  - Review timeline and revisions.
- `/admin/users/{userId}/orders/{orderId}/ticket`:
  - Print-ready job ticket with QR link back to order.

### 18.15 Inventory (`/admin/inventory`)

- View and adjust inventory (Stockworks-backed when enabled).

### 18.16 Analytics (`/admin/analytics`)

- View KPI snapshots and trend dashboards for order/revenue/operations.

### 18.17 Material Optimization (`/admin/material-optimization`)

- Review material planning recommendations and optimization outputs.

### 18.18 Fleet Intelligence (`/admin/fleet-intelligence`)

- Monitor printer health/identity and maintenance-oriented fleet data.

### 18.19 Batch Optimization (`/admin/batch-optimization`)

- Review suggested order batching, queue ordering, nesting, and cluster plans.

### 18.20 Failure Photos (`/admin/failure-photos`)

- Upload/classify failure images for print issue analysis.

### 18.21 Demand Forecasting (`/admin/demand-forecasting`)

- View demand projections from recent order/revenue trends.

## 19. Notifications and Messaging

- Toast/session notifications appear for success/error states (upload, checkout, profile updates, etc.).
- Order messaging is available on order detail pages.
- Admin push/Discord hooks may send operational alerts when configured.

## 20. Troubleshooting

### 20.1 Cannot Checkout

Check:

- All cart items have at least one color selected.
- Minimum order subtotal is met.
- Shipping address exists for shipping mode.
- Stripe key is configured for card mode.

### 20.2 Upload Fails

Check:

- File extension is supported.
- Files are actually selected before submit.
- Network path to upload endpoint is reachable.
- Error banner text for server-side validation details.

### 20.3 No Admin Access

Check:

- Your user is `isAdmin` or role `admin`/`staff`.
- You are signed in with the intended account.

### 20.4 Missing Inventory/Forecast Data

- Some admin pages depend on integrations (Stockworks, queue telemetry, historical order volume).
- If integrations are not configured, sections may appear empty or reduced.

## 21. Recommended First-Time Workflow

1. Register and sign in.
2. Complete profile and shipping address in `/settings/profile`.
3. Browse `Discover`, then open a model and use instant quote.
4. Add items to cart and configure materials/colors.
5. Complete checkout using preferred payment method.
6. Track order in `/customer/orders`.

