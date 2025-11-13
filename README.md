MakerWorks v2 â€” 3D Model Hosting & Cost Estimation

Overview
- Fullâ€‘stack Next.js 14 app with Prisma + Postgres
- Upload STL/OBJ/3MF, optional cover image, 3D viewer for STL (three.js)
- Simple cost estimate based on material mass (per-kg spool prices) plus labor/energy with PLA/PETG selectors
- File storage on a Docker volume, served via `/files/*`
- Auth via email/password using signed HttpOnly cookie (JWT)
- Automatic user page creation upon register/login with route `/u/{slug}` and quick link at `/me`.
- Production/development ready Docker Compose
- Admin dashboard to manage featured models and basic site settings
- Embedded Stripe Payment Element checkout keeps purchases inside the app (no redirects)

Quick Start (Docker)
- Copy `.env.example` to `.env` (optional; compose sets sane defaults)
- Build and run: `docker-compose up --build`
- App: `http://localhost:3000`
- Postgres: `postgres://postgres:postgres@localhost:5432/makerworks`

Unraid (Community Applications)
1. Ensure the GitHub Action **Publish container image** pushed `ghcr.io/schartrand77/mkw2:latest` (happens on every push to `main` and any `v*` tag).
2. On Unraid go to `Apps â†’ Settings â†’ Additional Repositories` and add `https://raw.githubusercontent.com/schartrand77/mkw2/main/unraid/templates`. The feed exposes the **MakerWorks v2** template inside Community Applications.
3. When installing, map `/app/storage` to a persistent share such as `/mnt/user/appdata/makerworks/storage`, and pick the external port you want (defaults to 3000).
4. Point `DATABASE_URL` at any reachable Postgres 15+ instance. If you deploy the official `postgres` container on the same host, place both containers on a custom user-defined bridge (e.g. `makerworks_net`) and use `postgresql://postgres:postgres@postgres:5432/makerworks?schema=public`.
5. Set `BASE_URL` to the public URL (e.g. `https://makerworks.example.com`), set `JWT_SECRET` to a long random value, and define the bootstrap `ADMIN_EMAIL` / `ADMIN_PASSWORD`. First launch runs migrations and seeds that admin user automatically.
6. Leave `STORAGE_DIR` at `/app/storage` unless you have a special layout, and flip `COOKIE_SECURE=true` whenever you serve the site behind HTTPS so auth cookies remain secure.

Local Dev (without Docker)
1. Install deps: `npm ci`
2. Start Postgres and set `DATABASE_URL`
3. Generate client: `npm run prisma:generate`
4. Apply schema: `npm run prisma:migrate`
5. Run dev server: `npm run dev`

Admin Account
- Configure in env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (optional)
- On startup, a bootstrap script upserts the admin user and sets `isAdmin=true`.
- Change credentials in the environment to rotate the admin password.

Core Endpoints
- `POST /api/register` { email, name?, password }
- `POST /api/login` { email, password }
- `POST /api/logout`
- `GET /api/me` current session user
- `GET /api/profile` fetch current profile
- `PATCH /api/profile` update name, slug, bio, avatar (multipart or JSON)
- `PATCH /api/account/email` change email (requires auth, unique)
- `PATCH /api/account/password` change password (requires currentPassword)
- `GET /api/profile` fetch current profile
- `PATCH /api/profile` update name, slug, bio, avatar (multipart or JSON)
- `POST /api/upload` multipart form: title, description?, material?, model(.stl|.obj|.3mf), image(optional)
- `GET /api/models` list latest public models
- `GET /api/models/:id` model details
- `POST /api/models/:id/like` toggle like (auth)
- `GET /files/...` serve stored files
- `GET /api/tags` list popular tags
- `POST /api/checkout` build totals from the cart and create a Stripe PaymentIntent
- `POST /api/account/email/request` request email change (returns verifyUrl in dev)
- `GET /api/account/email/verify?token=...` verify email change token
- Admin:
  - `GET /api/admin/featured` list featured models
  - `POST /api/admin/featured` set featured order
  - `GET /api/admin/site-config` fetch config
  - `PATCH /api/admin/site-config` update config
  - `GET /api/admin/search-models?q=` search models

Storage Layout
- Models: `/app/storage/{userId}/models/{timestamp}-{slug}.{ext}`
- Thumbnails: `/app/storage/{userId}/thumbnails/{timestamp}-{slug}.{ext}`
- Avatars: `/app/storage/{userId}/avatars/{timestamp}.webp`

Notes
- Volume estimation supports binary and ASCII STL; OBJ/3MF volume not computed.
- Default pricing: `$0.30 / cmÂ³ + $1.00 fixed` (env configurable).
- Anonymous uploads are attached to a stable `anonymous@local` user for demo.
- Admin flag is stored on users (`isAdmin`). Registration never grants admin.
- PLA vs PETG selection and up to four cart colors now draw from the configured spool prices; extra colors apply the `COLOR_SURCHARGE_RATE`.
 - Avatars are resized to 512x512 webp on upload. Old avatars are deleted on replacement.

Next Steps (nice to have)
- OAuth providers and user profiles
- Server-side thumbnail generation with `sharp`
- Likes/downloads, comments, tags, search facets
- MinIO/S3 storage backend option
- Advanced cost model (material/time/layer height)
Stripe Checkout
- Provide `STRIPE_SECRET_KEY` (server) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client) in your environment.
- Use Stripe test keys (`sk_test_...`, `pk_test_...`) for development; switch to live keys and HTTPS in production.
- The in-app checkout screen calls `POST /api/checkout` to create PaymentIntents and renders Stripe’s Payment Element without redirecting users.


