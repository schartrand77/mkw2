# MakerWorks v2

MakerWorks v2 is a full-stack 3D print shop platform that combines:
- A customer storefront (discover, upload, configure, checkout, order tracking)
- A shop operations hub (pricing, inventory, printer queueing, analytics, backups, and automation)

This README is written for two audiences:
1. People installing and running the app
2. Customers using the app

## Table of Contents
1. [What You Get](#what-you-get)
2. [Feature Inventory: Installer / Operator](#feature-inventory-installer--operator)
3. [Feature Inventory: Customer](#feature-inventory-customer)
4. [Architecture and Integrations](#architecture-and-integrations)
5. [Installation](#installation)
6. [Configuration (Environment Variables)](#configuration-environment-variables)
7. [First-Run Setup Checklist](#first-run-setup-checklist)
8. [Daily Operations](#daily-operations)
9. [Security and Access Control](#security-and-access-control)
10. [Troubleshooting](#troubleshooting)

## What You Get
MakerWorks v2 includes:
- Model hosting with STL/OBJ/3MF/ZIP upload support
- Instant quoting and configurable product templates
- Cart + checkout with card/cash/invoice/PO/quote flows
- Customer portal with order timeline, approvals, messages, and revisions
- Admin panels for pricing, models, products, orders, printers, inventory, and analytics
- Optional integrations with Stripe, StockWorks, Bambu View, Discord, SMTP email, and Web Push
- Backup/restore utilities for database and uploaded files

## Feature Inventory: Installer / Operator
This section lists the platform capabilities you can enable, configure, and operate.

### Storefront and Catalog Management
- Public home/discover/collections pages
- Featured model management
- Model CRUD (title, description, material, visibility, pricing)
- Multi-image model galleries with cover image management
- Model tags and filtering
- Model likes, comments, and download tracking
- Model revisions and multipart model support
- Public creator profile pages (`/u/[slug]`)
- Gear/referral page for affiliate links (`/gear`)

### Upload and Model Intelligence Pipeline
- Upload endpoint with size/type limits and optional direct-upload host
- Accepted inputs: STL, OBJ, 3MF, ZIP bundles
- 3MF extraction/preview processing queue
- Image/preview generation queue for model assets
- Automatic model measurements (dimensions, volume)
- Printability score
- Support likelihood detection
- Failure risk scoring
- Orientation suggestion
- Support strategy suggestion
- Assembly grouping for multipart models

### Pricing and Commerce Engine
- Formula-based pricing (material + time + machine + labor + electricity)
- Material pricing per material type (PLA/PETG and additional material keys)
- Rush multiplier
- Demand surge multiplier
- Color surcharge and max color limits
- Finish surcharge map support
- Batch discount tiers
- Minimum unit price and minimum order subtotal rules
- Extra hourly cost after first hour
- Saved pricing profiles in admin
- Effective price cache for model listing speed

### Product Builder
- Product templates with:
  - Material options
  - Color options
  - Size options
  - Active/inactive status
- Optional base-model attachment for template defaults
- Admin products list and product API endpoints

### Cart and Checkout Operations
- Cart live repricing as options/quantity change
- Bulk quantity handling
- Saved customer presets
- Checkout methods:
  - Card (Stripe)
  - Cash
  - Invoice
  - Purchase order
  - Quote request
- Shipping/pickup method capture
- Job form/payment intent linking

### Order and Fulfillment Operations
- Order creation from checkout
- Auto job creation from paid orders
- Order statuses and fulfillment tracking
- OrderWorks job sync endpoints for external production pipelines
- Admin order editing and line-item controls
- Approval request workflow (admin requests, customer responds)
- Customer/admin order messaging thread
- Order revisions (customer upload + admin handling)
- Reprint request workflow
- Printer assignment per order
- Printable ticket page with QR support
- Packing checklist support
- Shipping tracking data fields

### Printer and Production Automation
- Printer records with status and maintenance metadata
- Printer status dashboard
- Auto-queue endpoint for assigning work
- Bambu View integration endpoints (status, spools, job operations)
- Slicer profile upload/association
- Slicer stats capture per order
- Print-time correction factor updates from history
- Production dashboard page and API

### Inventory and Material Intelligence
- StockWorks connectivity for filament inventory
- Inventory list and movement logging endpoints
- Material warnings and low-stock visibility
- Filament color data endpoint
- Spool consumption workflow support
- Material optimization page
- Batch optimization page
- Demand forecasting page

### Analytics and Insight
- Admin analytics dashboard and API
- Profit per job visibility
- Profit per printer hour visibility
- Failure rates (model/material trends)
- Revenue by material/filament
- Fleet intelligence page (utilization + maintenance insights)

### Reliability, Backups, and Admin Safety
- Environment validation card + API (`/api/admin/env-check`)
- Config change audit log and admin view
- Backup creation utility (`npm run backup`)
- Pending restore flow (`/api/admin/restore` + `scripts/restore.js`)
- Automatic migration deploy on container start
- Automatic admin bootstrap from env on start

### Communication and Notification Features
- SMTP email support for receipts/account flows
- Email verification request/resend/verify flows
- Admin invite flow with token acceptance
- Discord announcement endpoints
- Web Push subscription/unsubscription endpoints
- PWA manifest + service worker registration + install prompt

### Theming and Branding
- Brand-name/version/lab/handle environment branding keys
- Holiday theme toggles (`christmas`, `halloween`, `easter`, `valentines`, `maythefourth`)
- Payment badge toggles in site config (Apple Pay / Google Pay display)

## Feature Inventory: Customer
This section lists what an end customer can do in the app.

### Account and Profile
- Register account
- Log in / log out
- Verify email
- Update account email/password
- Edit profile details and shipping information
- Public creator page with social/contact links (if configured)

### Discover and Browse
- Browse featured and latest models on home/discover
- Filter and explore collections
- Open model detail pages with:
  - 3D viewer/preview
  - Price estimate labels
  - Material and configuration details
  - Likes/comments
  - Download option (when allowed)

### Upload and Instant Quote
- Upload STL/OBJ/3MF/ZIP files
- Enter model metadata and optional sizing targets
- Receive instant estimate and configuration options
- Add uploaded model directly to cart

### Product Shopping
- Open product templates from `/products`
- Configure size/material/colors based on template options
- See live pricing updates
- Add configured products to cart

### Cart and Presets
- Adjust quantity and options per item
- View dynamic subtotal/total updates
- Save common configurations as presets
- Reapply presets on future items

### Checkout and Payment
- Choose checkout mode:
  - Card
  - Cash
  - Invoice
  - Purchase order
  - Quote request
- Enter shipping/pickup details
- Place order and receive order reference

### Order Tracking and Support Flows
- View all customer orders (`/customer/orders`)
- Open per-order detail page (`/customer/orders/[orderId]`)
- See status progression (review, queued, printing, post-process, shipped/completed)
- Respond to approval requests
- Send/receive messages with the shop
- Upload revision files for an order
- Request reprints when needed

### Community and Personal Pages
- Like models
- Comment on models
- View liked models page (`/likes`)
- View personal dashboard page (`/me`)

### PWA and Notifications (if enabled)
- Install app to home screen
- Receive push notifications
- Benefit from service-worker caching behavior

## Architecture and Integrations
- Framework: Next.js App Router + React + TypeScript
- Database: PostgreSQL + Prisma ORM
- File storage: local filesystem (`STORAGE_DIR`) with optional CDN base URL
- Payments: Stripe (optional)
- Inventory: StockWorks (optional)
- Production bridge: OrderWorks-style job endpoints (optional)
- Printer telemetry/controls: Bambu View (optional)
- Messaging: SMTP + Discord (optional)
- PWA: manifest + service worker + Web Push (optional)

## Installation

### Option A: Docker Compose (recommended)
1. Copy env file:
```bash
cp .env.example .env
```
2. Edit `.env` values (at minimum: secrets, admin credentials, Stripe keys if using card payments).
3. Start services:
```bash
docker compose up --build -d
```
4. Open:
- App: `http://localhost:3000`
- Postgres: `localhost:5432`

Container startup runs:
- `scripts/restore.js` (applies pending restore if present)
- `prisma migrate deploy`
- `scripts/bootstrap-admin.js` (ensures admin user from env)
- `next start`

### Option B: Local Node.js runtime
Prereqs:
- Node.js 20+
- PostgreSQL 15+

1. Install dependencies:
```bash
npm ci
```
2. Copy env and edit:
```bash
cp .env.example .env
```
3. Generate Prisma client and apply schema:
```bash
npm run prisma:generate
npm run prisma:migrate
```
4. Bootstrap admin:
```bash
npm run bootstrap:admin
```
5. Run app:
```bash
npm run dev
```

## Configuration (Environment Variables)
Start from `.env.example`. Most-used groups:

### Required Core
- `DATABASE_URL`
- `JWT_SECRET`
- `BASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### Storage and Uploads
- `STORAGE_DIR`
- `DIRECT_UPLOAD_URL` (optional)
- `UPLOAD_MAX_FILE_BYTES` (optional)
- `UPLOAD_MAX_TOTAL_BYTES` (optional)
- `FILES_BASE_URL` / `NEXT_PUBLIC_FILES_BASE_URL` (optional)

### Pricing and Currency
- `CURRENCY`, `NEXT_PUBLIC_CURRENCY`
- `PLA_PRICE_PER_KG_USD`, `PETG_PRICE_PER_KG_USD`
- `COLOR_SURCHARGE_RATE`
- `NEXT_PUBLIC_MAX_CART_COLORS`
- `SUPPORT_OVERHANG_ANGLE_DEG`
- `SUPPORT_VOLUME_MULTIPLIER_MAX`
- `COLOR_TIME_MULTIPLIER_PER_COLOR`
- Optional finish and CAD overrides from `.env.example`

### Payments
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SHIPPING_RATE_ID` (optional)

### Integrations
- StockWorks: `STOCKWORKS_*`
- Bambu View: `BAMBU_VIEW_*`
- Discord: `DISCORD_*`

### Email and Auth
- `SMTP_*`
- `RECEIPT_FROM_EMAIL`, `RECEIPT_REPLY_TO_EMAIL`
- `INVITE_LOGIN_TOKEN_TTL_HOURS`
- `AUTH_LOGIN_RATE_*`, `AUTH_REGISTER_RATE_*`, `AUTH_RESEND_RATE_*`

### Push/PWA
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

### Branding/Theming
- `NEXT_PUBLIC_BRAND_NAME`
- `NEXT_PUBLIC_BRAND_VERSION`
- `NEXT_PUBLIC_BRAND_LAB_NAME`
- `NEXT_PUBLIC_BRAND_HANDLE`
- `HOLIDAY_THEME`

## First-Run Setup Checklist
1. Confirm admin login works (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
2. Open Admin and validate env status card.
3. Configure site/pricing defaults in Admin site config.
4. Add at least one model and one product template.
5. Test a full customer flow:
- upload or pick model
- configure and add to cart
- place checkout in your preferred payment mode
6. Verify order appears in admin production/jobs views.
7. If using integrations, test:
- Stripe checkout completion
- StockWorks inventory fetch
- Bambu View printer status sync
- email delivery
- push subscription/notification

## Daily Operations

### Useful Commands
```bash
npm run dev
npm run build
npm run test
npm run prisma:generate
npm run prisma:deploy
npm run backup
```

### Backup and Restore
- Create backup:
```bash
npm run backup
```
- Backups include:
  - PostgreSQL dump (`db.sql`)
  - Uploaded storage files (excluding backup folders)
- Restore is applied from pending restore manifest via startup script/API.

### Migrations
- Development:
```bash
npm run prisma:migrate
```
- Production:
```bash
npm run prisma:deploy
```

## Security and Access Control
- Role model: `admin`, `staff`, `customer`
- Admin-only API sections under `/api/admin/*`
- Auth and registration rate limiting via `RateLimit` table and env controls
- Email verification token flow
- Invite acceptance flow for admin-created users
- Config changes logged in audit table

## Troubleshooting
- Prisma/type errors after schema changes:
```bash
npm run prisma:generate
# then clear .next and re-run type checks/build
```
- Stripe checkout not appearing:
  - verify both publishable and secret keys
  - verify `BASE_URL` callback/origin assumptions
- Upload failures:
  - verify `STORAGE_DIR` exists and is writable
  - if using `DIRECT_UPLOAD_URL`, verify it is reachable
- Integration gaps:
  - check StockWorks/Bambu/Discord env variables and network reachability
- Backup failure:
  - ensure Docker `db` service is up OR local `pg_dump` is installed

## Screenshots
![Home](public/screenshots/mwhome.png)
![Discover](public/screenshots/mwdiscover.png)
![Model detail](public/screenshots/mwmodeldetail.png)
![Admin](public/screenshots/mwadmin.png)

## License
MIT (`LICENSE`)

## Support
Issues: `https://github.com/schartrand77/mkw2/issues`
