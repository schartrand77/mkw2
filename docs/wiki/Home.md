# MakerWorks Storefront Wiki

MakerWorks Storefront is a production-grade 3D printing commerce platform that combines public storefront discovery, instant quoting, checkout, manufacturing workflows, and shop operations tooling in one application.

This wiki is the operator and contributor guide for the repository. It is organized around the questions teams usually need answered first: what the system does, how to run it, how it is wired, and how to keep it healthy in production.

## What This System Covers

- Public catalog, collections, model detail pages, and creator profiles.
- Model upload and processing for common 3D file formats.
- Configurable quoting based on material, geometry, machine time, labor, and policy.
- Cart and checkout flows for card, cash, invoice, purchase order, and quote-request modes.
- Customer order tracking, revisions, approvals, and messaging.
- Admin surfaces for catalog management, pricing, analytics, printer assignment, queue monitoring, backups, and environment checks.
- Optional integrations for PrintLab, Stockworks, Stripe, SMTP, web push, and Discord.

## Read This First

- [Getting Started](./Getting-Started.md): local setup, Docker setup, and first-run workflow.
- [Architecture](./Architecture.md): high-level system map and domain boundaries.
- [Configuration Reference](./Configuration-Reference.md): environment variables and integration groups.
- [Operations Runbook](./Operations-Runbook.md): backups, queues, health checks, and production support tasks.
- [Product Guide](./Product-Guide.md): user-facing journeys and admin surfaces.
- [Developer Guide](./Developer-Guide.md): repository layout, coding touchpoints, and testing commands.

## Technology Snapshot

- Framework: Next.js App Router, React 19, TypeScript
- Database: PostgreSQL with Prisma
- Async processing: BullMQ with Redis when configured
- Storage: local filesystem via `STORAGE_DIR`, with optional external file base URL
- Payments: Stripe
- Printer execution boundary: PrintLab
- Inventory/material intelligence: Stockworks

## Core Runtime Components

- `web`: serves pages, APIs, checkout, uploads, and admin UI.
- `db`: PostgreSQL data store.
- `redis`: queue broker for async processing when enabled.
- `processing-worker`: background worker for image and preview jobs.
- `backup-scheduler`: optional long-running backup scheduler process.

## Primary Source Files

- [`README.md`](../../README.md)
- [`package.json`](../../package.json)
- [`prisma/schema.prisma`](../../prisma/schema.prisma)
- [`docker-compose.yml`](../../docker-compose.yml)
- [`docs/user-manual.md`](../user-manual.md)

## Audience

- Operators deploying or maintaining the app.
- Contributors extending the codebase.
- Internal teams onboarding to product, support, or fulfillment workflows.
