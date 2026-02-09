MakerWorks v2 - 3D Print Shop Hub

MakerWorks v2 is a customer-facing storefront and internal operations hub for 3D print shops. It organizes models, estimates pricing, captures orders, and keeps production moving with analytics, inventory insight, and automation.


**What This App Does**
- Hosts a catalog of 3D models and configurable products.
- Generates instant estimates using material, time, and shop settings.
- Supports multi-color configuration and 3MF previews.
- Lets customers submit orders, pay online, or request quotes and invoices.
- Provides admin tools for pricing, jobs, approvals, and analytics.
- Integrates with OrderWorks (production) and StockWorks (inventory).


**Who This Is For**
- Print shops that need a customer portal + operations dashboard.
- Makerspaces that need controlled, trackable print requests.
- Teams that want pricing, inventory, and order flow in one place.


**Table Of Contents**
1. Quick Start
2. User Manual: Customer
3. User Manual: Admin
4. Integrations
5. Configuration
6. Operations And Maintenance
7. Troubleshooting


**Quick Start (High Level)**
1. Point the app to a Postgres database.
2. Configure pricing, materials, and shop settings in Admin.
3. Add models and product templates.
4. Optionally set Stripe keys for card payments.
5. Connect OrderWorks and StockWorks if used.


**User Manual: Customer**

**Navigation**
- Discover: Browse public models.
- Products: Shop configurable templates (size, material, color count).
- Upload: Upload a model for instant estimate.
- Cart: Configure options and review pricing.
- Checkout: Pay by card, cash, invoice, PO, or request a quote.
- Customer Portal: Upload models, view recent orders, manage presets.

**Browse And Configure Models**
1. Open a model detail page.
2. Review pricing estimate, materials, and model intelligence.
3. Select options in the configurator.
4. Add to cart.

**Shop Configurable Products**
1. Open Products.
2. Choose a product template.
3. Select size, material, and color palette.
4. Set quantity and add to cart.
5. Finalize color choices in the cart if multiple colors are required.

**Upload A Model For Instant Estimate**
1. Go to Upload.
2. Provide title, description, and optional size targets.
3. Upload STL, OBJ, 3MF, or ZIP.
4. After upload, use the instant quote panel to configure and add to cart.

**Cart And Pricing**
- Pricing updates live as you change options.
- Rush production increases price based on the configured multiplier.
- Bulk pricing tiers apply automatically based on quantity.
- Minimum order subtotal can block checkout until met.

**Checkout Options**
- Card: Pay immediately with Stripe.
- Cash: Pay at pickup.
- Invoice: Submit billing contact details for invoicing.
- PO: Provide a purchase order number.
- Quote: Request approval before production.

**Order Tracking**
- Visit Orders or Customer Portal to see order status.
- Order statuses reflect production stages: queued, printing, post-process, shipped, completed.
- Approval requests appear on the order detail page.

**Saved Presets**
- Save common configuration sets in the cart.
- Apply presets to new items to reuse material, colors, and scaling.
- Manage presets in Customer Portal.


**User Manual: Admin**

**Admin Overview**
- Dashboard: Quick status, analytics, and environment checks.
- Products: Create and manage product templates.
- Models: Manage uploads, visibility, and pricing.
- Orders: Review, edit status, request approvals, and message customers.
- Printers: Manage printer records and auto-queue.
- Inventory: Review StockWorks material levels and warnings.

**Product Builder**
- Create product templates with size, material, and color options.
- Set option multipliers and color count rules.
- Attach a base model to define default pricing and sizing.

**Pricing And Config**
- Set per-material prices, labor, and machine costs.
- Configure rush multiplier and demand surge multiplier.
- Configure batch discount tiers and minimum order subtotal.

**Orders And Approvals**
- View order details, messages, and approval requests.
- Request approvals for changes or quote requests.
- Track status progression and fulfillment.

**Analytics**
- Profit per job and per printer hour.
- Failure rates by model and material.
- Revenue breakdowns by filament type.


**Integrations**

**OrderWorks**
- MakerWorks records checkout data and sends it to OrderWorks for production scheduling.
- OrderWorks statuses can sync back into MakerWorks to keep customer updates current.

**StockWorks**
- StockWorks connects to the same database for material usage and stock warnings.
- Cart and checkout can surface low-stock warnings.


**Configuration**

**Environment Variables (Common)**
- `DATABASE_URL`
- `JWT_SECRET`
- `BASE_URL`
- `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `DIRECT_UPLOAD_URL` (optional)

**Optional Pricing Settings**
- `COLOR_SURCHARGE_RATE`
- `FINISH_SURCHARGES` or `FINISH_SURCHARGE_MAP`
- `MAX_CART_COLORS`


**Operations And Maintenance**

**Database Migrations**
- Use `npx prisma migrate deploy` in production.
- Use `npx prisma migrate dev` for local development.

**Migration Recovery (If Startup Fails)**
1. Inspect failed migrations:
```
docker exec -i postgres psql -U postgres -d makerworks -c "SELECT migration_name, started_at, finished_at, rolled_back_at FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"
```
2. Roll back the failed entry (replace the name if different):
```
docker exec -i postgres psql -U postgres -d makerworks -c "UPDATE _prisma_migrations SET rolled_back_at = NOW(), logs = COALESCE(logs,'') || E'\nmanual rollback after failure' WHERE migration_name='20260128151129_add_default_colors' AND finished_at IS NULL AND rolled_back_at IS NULL;"
```
3. Re-run migrations or restart the app.


**Troubleshooting**
- Prisma schema errors: run `npx prisma generate` and verify schema relations.
- TypeScript shows many Prisma/route errors after schema or API route changes:
  1. Run `npm run prisma:generate`
  2. Clear `.next` (`cmd /c rmdir /s /q .next` on Windows)
  3. Run `npx tsc --noEmit`
- Docker equivalent (app container):
  1. `docker compose exec app npm run prisma:generate`
  2. `docker compose exec app sh -lc "rm -rf .next"`
  3. `docker compose exec app npx tsc --noEmit`
- `psql` checks (DB migration/state sanity):
  1. `docker exec -i postgres psql -U postgres -d makerworks -c "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 20;"`
  2. `docker exec -i postgres psql -U postgres -d makerworks -c "\dt"`
- Stripe errors: ensure publishable and secret keys are set.
- Upload failures: verify `DIRECT_UPLOAD_URL` and storage permissions.


**Security Notes**
- Auth endpoints enforce rate limiting. Configure via `AUTH_LOGIN_RATE_*`, `AUTH_REGISTER_RATE_*`, and `AUTH_RESEND_RATE_*`.
- Admin invites use magic login links.
- Email verification tokens are stored hashed at rest.


**Screenshots**
![Home](public/screenshots/mwhome.png)
![Discover](public/screenshots/mwdiscover.png)
![Model detail](public/screenshots/mwmodeldetail.png)
![Admin](public/screenshots/mwadmin.png)


**Need Help**
- Issues and questions: `https://github.com/schartrand77/mkw2/issues`
