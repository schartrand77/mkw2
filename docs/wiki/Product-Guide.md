# Product Guide

This page summarizes the major user journeys and operational surfaces in MakerWorks. For full end-user instructions, see [`docs/user-manual.md`](../user-manual.md).

## User Roles

- Guest: browse-only access
- Signed-in customer: uploads, cart, checkout, orders, presets
- Creator: manages owned models and public profile
- Organization member: organization billing, project codes, approvals, procurement-aware ordering
- Staff/Admin: full admin control plane

## Public Storefront

Key routes:

- `/`
- `/discover`
- `/collections`
- `/products`
- `/models/[id]`
- `/u/[slug]`

Key capabilities:

- search and typed filters
- featured content and curated collections
- model detail with quote guidance, comments, lineage, and creator trust surfaces
- merch and product-template browsing

## Upload and Model Management

Key routes:

- `/upload`
- `/models/[id]/edit`

Supported uploads include common printable 3D model formats plus archives. The upload flow can also capture metadata, cover assets, creator credit, and tags.

## Cart and Checkout

Key routes:

- `/cart`
- `/checkout`

Capabilities:

- material, finish, scale, and color configuration
- multipart order support
- minimum order enforcement
- organization billing and project-code support
- payment methods for card, cash, invoice, PO, and quote request

## Customer Workspace

Key routes:

- `/customer/portal`
- `/customer/orders`
- `/customer/orders/[orderId]`
- `/customer/workspaces`

Capabilities:

- recent orders and presets
- order timelines, messages, revisions, and approval responses
- reprint and manufacturability-report actions
- project workspaces for organization-linked activity

## Admin Control Plane

Key route groups:

- `/admin`
- `/admin/site-config`
- `/admin/products`
- `/admin/catalog`
- `/admin/models`
- `/admin/production`
- `/admin/processing-queues`
- `/admin/users`
- `/admin/inventory`
- `/admin/analytics`
- `/admin/backup-tools`

Admin responsibilities include:

- pricing and site configuration
- featured and home content curation
- model and catalog operations
- order oversight and printer assignment
- queue triage
- analytics and demand planning
- backups and restore readiness

## Organizations and B2B Support

Key route:

- `/settings/organizations`

Capabilities:

- organization creation
- role-based member access
- procurement configuration
- approval-routing logic
- department budget tracking
- organization-linked checkout behavior

## Integration-Aware Experiences

### PrintLab

Adds printer execution, queue state, and callback-driven production updates.

### Stockworks

Adds inventory-backed material warnings, low-stock signals, and prediction endpoints.

### Stripe

Enables card checkout and payment confirmation flows.
