# MakerWorks User Manual

This guide explains how to use MakerWorks end-to-end: browsing, uploading, configuring prints, checking out, tracking orders, and running admin operations.

## 1. Who This Manual Is For

- Customers placing print and merch orders.
- Creators uploading and managing models.
- Team members managing organization billing/approvals.
- Admin/staff users operating production and storefront controls.

## 2. Roles and Access

MakerWorks uses both account-level roles and organization membership roles. A single user can be a normal customer, a creator, and an organization member at the same time.

### 2.1 Guest

Definition:
- Any visitor who is not signed in.

Can do:
- Browse `Discover`, `Store`, `Collections`, and public model pages.
- View pricing context, creator pages, and product details.

Cannot do:
- Upload models.
- Add likes.
- Checkout.
- Access customer orders, presets, workspaces, organizations, or admin tools.

### 2.2 Signed-in Customer

Definition:
- Any authenticated non-admin user using MakerWorks for personal ordering.

Can do:
- Upload models.
- Configure prints, add to cart, and checkout.
- Save presets and use customer portal/order pages.
- Maintain profile, shipping address, and account settings.
- Comment on models and participate in review flows available to customers.

Cannot do:
- Access admin/staff-only routes.
- Change organization policy unless also given a privileged organization role.

### 2.3 Creator

Definition:
- A signed-in customer who uploads and manages models.

Can do:
- Everything a signed-in customer can do.
- Maintain model listings they own.
- Edit their own model metadata, assets, and creator credit fields.
- Receive public creator profile visibility through `/u/{slug}`.

Cannot do:
- Moderate other users' content unless they are also admin/staff.
- Use production/admin controls unless separately granted admin/staff access.

### 2.4 Organization Member

Definition:
- A signed-in customer attached to an organization through active membership.

Can do:
- Everything a signed-in customer can do.
- Bill eligible orders to an organization.
- Use project codes and organization-aware checkout flows.
- View organization usage, procurement settings, and workspaces allowed by their membership role.

Organization-specific permissions are controlled by membership role:

- `Requester`
  - Default role for members who submit work.
  - Can place organization-linked orders.
  - May be forced into quote/approval flow if org policy requires approval.
  - Cannot change organization settings or manage members.

- `Approver`
  - Can approve quote-driven organization work.
  - Can update organization policy/settings.
  - Can manage members.

- `Finance`
  - Intended for billing/procurement visibility.
  - Can participate in organization workflows and billing-linked ordering.
  - In the current product, finance users do not automatically get full settings control unless separately treated as privileged in that specific surface.

- `Owner`
  - Highest organization role.
  - Can manage members, billing settings, department budgets, approval routing, and procurement policy.

### 2.5 Staff / Admin

Definition:
- Internal MakerWorks operator accounts.

Can do:
- Full customer and creator workflows.
- Access the admin control plane under `/admin`.
- Manage production, orders, users, pricing, analytics, inventory, processing queues, and site configuration.
- Moderate content and operate fulfillment workflows across customers and organizations.

Should be treated as:
- Operational roles, not customer-facing organization roles.
- Users with broad access to storefront and production data.

### 2.6 Role Matrix

| Capability | Guest | Customer | Creator | Org Requester | Org Approver | Org Owner | Staff / Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Browse public catalog | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Upload models | No | Yes | Yes | Yes | Yes | Yes | Yes |
| Edit own models | No | No | Yes | Yes | Yes | Yes | Yes |
| Checkout personally | No | Yes | Yes | Yes | Yes | Yes | Yes |
| Checkout for organization | No | No | No | Yes | Yes | Yes | Yes |
| Submit quote/approval flow | No | No | No | Yes | Yes | Yes | Yes |
| Approve organization work | No | No | No | No | Yes | Yes | Yes |
| Manage org members/settings | No | No | No | No | Yes | Yes | Yes |
| View workspaces/org usage | No | No | No | Yes | Yes | Yes | Yes |
| Access admin tools | No | No | No | No | No | No | Yes |

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
  - `Best confidence`
  - `Fastest to ship`
  - `Lowest failure risk`
  - `Price: Low to High`
  - `Price: High to Low`
- Press `/` anywhere on the page to focus the search box.
- Save and reapply discover presets when signed in.

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
- `gear material:petg tag:functional` -> filtered toward PETG functional models

### 5.4 Typed Search Tokens and Recommendation Cues

Use typed filters directly in the query:

- `material:pla`
- `material:petg`
- `tag:flex`
- `tag:robotics`
- `#models`
- `#products`
- `#merch`

Discover cards can also show buyer-facing recommendation reasons, such as:

- `Title match`
- `Material match`
- `Tag match`

### 5.5 Ready to Print Mode

- Toggle `Ready to Print` to prioritize lower-risk models with live in-stock material availability.
- This mode uses inventory-aware filtering, not just static model metadata.

### 5.6 Result Behavior by Type

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
- Review creator quality score and profile trust indicators.
- Review model lineage: upstream source, revisions, and remixes.
- Add full model or parts to cart.
- Download model file or full parts zip (if downloads enabled).
- Like and share model.
- Read and post comments.
- Add part-aware review comments with selected-part and pin context.

### 7.2 Optional/Conditional Sections

- Build video embed.
- Affiliate/required parts section.
- Model intelligence (printability/failure/support signals).
- Print feasibility scorecard.
- Material recommender suggestions.
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
- Tolerance class selection (`Draft`, `Standard`, `Cosmetic`, `Fit-critical`).
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
- Optional organization department selection when procurement departments are configured.
- Optional rush production flag.

### 12.2 Organization Rules

When billing to an organization:

- Requester roles may be forced to `quote` mode if approval is required.
- PO threshold rules can appear as guidance.
- Department selection can feed budget tracking and approval routing.

### 12.3 Checkout Guidance Surfaces

Checkout now includes:

- Persistent mini-summary while editing shipping/payment details.
- Configuration comparison for multiple items/configs.
- Quote breakdown with lead-time confidence carried into line items.
- Material availability warnings when inventory integration is enabled.

### 12.4 Card Checkout

- Uses Stripe Elements when publishable key is configured.
- On payment success, order finalization runs and confirmation is shown.

### 12.5 Deferred Checkout (Cash/Invoice/PO/Quote)

- Submits a non-card confirmation flow.
- Generates confirmation ID and order record.

### 12.6 Common Blocks

- Missing color selections.
- Missing shipping address for ship mode.
- Minimum order subtotal not met.

## 13. Customer Portal (`/customer/portal`)

Portal combines quick actions:

- Embedded upload section for fast submission.
- Recent orders panel.
- Presets panel.

Use this page for repeat workflows without hopping between routes.

## 14. Workspaces (`/customer/workspaces`)

Project Workspaces group organization activity by project code.

### 14.1 Workspace Index

- Lists workspaces by organization/project code.
- Shows order count, revision count, approval count, spend, and recent activity.

### 14.2 Workspace Detail

- Shows recent orders tied to the project.
- Highlights approvals, revisions, members, and procurement context.
- Works best when organization checkout uses project codes consistently.

## 15. Orders

### 15.1 Orders List (`/customer/orders`)

- Shows recent orders, totals, status badges, and line summaries.
- Open each order for full detail and actions.

### 15.2 Order Detail (`/customer/orders/{orderId}`)

Includes:

- Itemized order details and configured options.
- Production progress and ETA confidence.
- Customer-facing production milestone timeline.
- Shipping details.
- Order timeline (messages, approvals, revisions, photos, artifacts).
- Estimate calibration details when actual slicer stats are available.
- Failure recovery guidance when an order fails.
- Actions:
  - Download manufacturability report (when available)
  - Request reprint
  - Respond to org quote approval requests (when applicable)
  - Message the shop
  - Upload revision files

## 16. Profile and Public Creator Page

### 15.1 Edit Profile (`/settings/profile`)

- Name, slug (`/u/{slug}`), bio.
- Avatar upload.
- Contact info.
- Social links.
- Shipping address used by checkout.

### 16.2 My Page (`/me` -> redirects to `/u/{slug}`)

- Public profile page with avatar, bio, badges, contact/social links.
- Creator quality score and production-trust summary.
- Paginated list of your published models.

### 16.3 Liked Models (`/likes`)

- Lists models you have liked.

## 17. Account Settings (`/settings/account`)

- Sign out current device.
- Sign out all devices.
- Request email update verification.
- Change password with strength feedback.

## 18. Organization Settings (`/settings/organizations`)

- Create an organization.
- View organizations you belong to and your role.
- View billing and approval policy summary.
- View 90-day usage metrics (orders/spend).
- Configure department budgets and approval routing thresholds.
- Track department budget status and procurement routing rules.

## 19. Admin Manual (`/admin` and subpages)

All pages below require admin/staff access.

### 19.1 Admin Overview (`/admin`)

- High-level metrics (users, pending jobs, featured count).
- Quick links to primary tool pages.
- Backup/restore status snapshot.

### 19.2 Site Config (`/admin/site-config`)

- Update runtime storefront and pricing configuration.
- Run environment checks and review config audit history.

### 19.3 Notifications (`/admin/notifications`)

- Manage push notification setup/subscriptions for admin alerting.

### 19.4 Featured Models (`/admin/featured`)

- Curate the set/order of featured models used in storefront surfaces.

### 19.5 Home Comments (`/admin/home-comments`)

- Curate and moderate comments surfaced on the home experience.

### 19.6 Backups and Restore (`/admin/backup-tools`)

- Create backups.
- View latest backup metadata.
- Queue/monitor restore manifests.
- Runtime readiness is shown in-page before backup/restore operations.
- Backup location can be remapped with `BACKUP_DIR` (otherwise defaults to `STORAGE_DIR/backups`).
- If `BACKUP_DIR` is outside `STORAGE_DIR`, restore still works but in-app `/files/...` download links are not available for those backups.
- Backup requires one of:
  - Docker Compose available with a running `db` service (container `pg_dump`/`psql`).
  - Local PostgreSQL client tools with `pg_dump` and `psql` available via `PATH` or explicit env vars:
    - `PG_DUMP_BIN`
    - `PSQL_BIN`
- Daily schedule and retention policy are env-driven:
  - Runtime mode:
    - Unraid/non-compose: `SKIP_DOCKER=1`, `PG_DUMP_BIN=/usr/bin/pg_dump`, `PSQL_BIN=/usr/bin/psql`
    - Docker Compose: `SKIP_DOCKER=0` (or unset) and `BACKUP_DOCKER_SERVICE` set to your Postgres service name
  - `BACKUP_DOCKER_SERVICE` overrides the Docker Compose service used for `pg_dump`/`psql` (default: `db`).
  - `BACKUP_SCHEDULE_ENABLED=1` enables scheduler process.
  - `BACKUP_SCHEDULE_TIME_UTC` sets daily run time (24h `HH:mm`, UTC).
  - `BACKUP_RETENTION_DAYS` and `BACKUP_RETENTION_MAX_COUNT` control prune policy.
  - `BACKUP_PRUNE_ON_BACKUP=1` prunes after successful backup.
  - `BACKUP_RUN_ON_START=1` runs one backup when scheduler starts.
  - Run scheduler process with `npm run backup:scheduler` (or equivalent process manager/container).

### 19.7 Model Library (`/admin/models`)

- Search and manage model metadata/visibility/admin fields.
- Open model image management route (`/admin/models/{id}/images`) for cover/gallery control.

### 19.8 Product Builder (`/admin/products`)

- Create and maintain product templates tied to base models.
- Set locked print constraints and product configuration defaults.

### 19.9 Catalog Manager (`/admin/catalog`)

- Configure storefront labels for model/merch categories.
- Manage merch catalog entries, pricing, availability, and ordering metadata.

### 19.10 Production Dashboard (`/admin/production`)

- Central production monitoring and execution workspace for active orders.

### 19.11 Job Queue (`/admin/jobs`)

- Monitor and control OrderWorks-style job state and fulfillment transitions.

### 19.12 Processing Queues (`/admin/processing-queues`)

- Observe async processing queues and retry/requeue stuck work.

### 19.13 Users (`/admin/users`)

- Invite users.
- Manage roles/badges/account status.
- Drill into per-user order operations.

### 19.14 User Orders Admin Flow

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

### 19.15 Inventory (`/admin/inventory`)

- View and adjust inventory (Stockworks-backed when enabled).

### 19.16 Analytics (`/admin/analytics`)

- View KPI snapshots and trend dashboards for order/revenue/operations.
- Includes estimate calibration metrics for predicted vs actual print time.

### 19.17 Material Optimization (`/admin/material-optimization`)

- Review material planning recommendations and optimization outputs.

### 19.18 Fleet Intelligence (`/admin/fleet-intelligence`)

- Monitor printer health/identity and maintenance-oriented fleet data.

### 19.19 Batch Optimization (`/admin/batch-optimization`)

- Review suggested order batching, queue ordering, nesting, and cluster plans.

### 19.20 Failure Photos (`/admin/failure-photos`)

- Upload/classify failure images for print issue analysis.

### 19.21 Demand Forecasting (`/admin/demand-forecasting`)

- View demand projections from recent order/revenue trends.

## 20. Notifications and Messaging

- Toast/session notifications appear for success/error states (upload, checkout, profile updates, etc.).
- Order messaging is available on order detail pages.
- Admin push/Discord hooks may send operational alerts when configured.

## 21. Troubleshooting

### 21.1 Cannot Checkout

Check:

- All cart items have at least one color selected.
- Minimum order subtotal is met.
- Shipping address exists for shipping mode.
- Stripe key is configured for card mode.
- If using organization billing, selected department is valid for that organization.

### 21.2 Upload Fails

Check:

- File extension is supported.
- Files are actually selected before submit.
- Network path to upload endpoint is reachable.
- Error banner text for server-side validation details.

### 21.3 No Admin Access

Check:

- Your user is `isAdmin` or role `admin`/`staff`.
- You are signed in with the intended account.

### 21.4 Missing Inventory/Forecast Data

- Some admin pages depend on integrations (Stockworks, queue telemetry, historical order volume).
- If integrations are not configured, sections may appear empty or reduced.

## 22. Recommended First-Time Workflow

1. Register and sign in.
2. Complete profile and shipping address in `/settings/profile`.
3. Browse `Discover`, try typed search filters or `Ready to Print`, then open a model.
4. Use instant quote to review feasibility, material recommendations, and tolerance class.
5. Add items to cart and configure materials/colors.
6. Complete checkout using preferred payment method.
7. Track order in `/customer/orders` or `/customer/workspaces` if using organization project codes.
