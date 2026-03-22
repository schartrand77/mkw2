# Architecture

MakerWorks is a monolithic application with clear internal domain boundaries. The public storefront, admin control plane, API routes, and most orchestration logic live in the same Next.js repository.

## High-Level View

```text
Browser
  -> Next.js App Router pages and route handlers
  -> Domain services in lib/
  -> Prisma
  -> PostgreSQL

Optional side systems
  -> Redis + BullMQ for async processing
  -> PrintLab for printer execution and callbacks
  -> Stockworks for inventory and material availability
  -> Stripe for payments
  -> SMTP / Web Push / Discord for notifications
```

## Major Layers

### Presentation layer

- `app/`: page routes and API route handlers
- `components/`: reusable UI for storefront, checkout, discover, orders, and admin surfaces

This layer owns request handling, page composition, and user interaction. It should stay thin where possible and delegate business rules into `lib/`.

### Domain and service layer

- `lib/pricing.ts`: pricing engine and quote breakdown logic
- `lib/orders.ts`: order persistence, detail loading, reprints, revisions
- `lib/printlab.ts`: PrintLab client and printer/job API calls
- `lib/printlab-jobs.ts`: local PrintLab job orchestration and callback mapping
- `lib/stockworks-client.ts`: Stockworks authentication and upstream requests
- `lib/processing-jobs.ts`, `lib/model-preview-queue.ts`, `lib/image-queue.ts`: async work scheduling
- `lib/auth.ts`, `lib/rate-limit.ts`, `lib/csrf.ts`: security and access control support

### Persistence layer

- `prisma/schema.prisma`: source of truth for the data model
- `prisma/migrations/`: schema history
- `lib/db.ts`: Prisma client binding

### Background processing

- `scripts/processing-worker.ts`: BullMQ worker entry point
- `lib/processing-broker.ts`: Redis connection gate

If `REDIS_URL` is unset, queue-backed processing is effectively disabled.

## Product Domains

### Catalog and discovery

- Models, tags, collections, likes, downloads, and creator profiles
- Public routes centered around `/discover`, `/models/[id]`, `/collections`, and `/u/[slug]`

### Commerce and quoting

- Cart, checkout, pricing policies, discounting, organization billing, and payment mode selection
- Key routes: `/cart`, `/checkout`, `/products`, `/products/[id]`

### Orders and customer workflows

- Order creation, line items, revisions, messages, approval requests, reprints, and customer portal/workspaces
- Key routes: `/customer/orders`, `/customer/orders/[orderId]`, `/customer/workspaces`

### Operations and admin

- Site config, featured content, analytics, backups, queues, printer assignment, inventory, and catalog admin
- Key routes live under `/admin`

### Manufacturing intelligence

- Printability, support ratio, failure scoring, material recommendation, creator quality, and feasibility guidance
- Implemented through model fields plus service modules in `lib/`

## Data Model Highlights

The Prisma schema is mature and strongly aligned with the business domain. Key entities include:

- `User`, `Profile`, `Organization`, `OrganizationMember`
- `Model`, `ModelPart`, `ModelImage`, `ModelRevision`, `ModelComment`, `Collection`
- `PrintOrder`, `PrintOrderItem`, `PrintOrderRevision`, `PrintOrderMessage`, `PrintOrderApprovalRequest`
- `Printer`, `PrintLabJob`, `FailurePhoto`
- `SiteConfig`, `PricingProfile`, `ProductTemplate`, `MerchItem`

## Integration Boundaries

### PrintLab

PrintLab is the active printer execution boundary. MakerWorks creates local `PrintLabJob` records per printable order item and uses callbacks to keep order execution state synchronized.

### Stockworks

Stockworks provides material and inventory intelligence used in storefront warnings, admin inventory tools, and availability-aware recommendation paths.

### OrderWorks

Legacy OrderWorks compatibility remains in the repository, but it is no longer the primary execution boundary for new print jobs.

## Design Characteristics

- Single repo, shared types, shared deployment surface
- Strong route-handler driven APIs
- Rich domain logic in `lib/`
- Progressive optional integrations rather than mandatory external dependencies
- File-backed storage for uploads and generated artifacts
