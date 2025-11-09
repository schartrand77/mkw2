MakerWorks v2 — 3D Model Hosting & Cost Estimation

Overview
- Full‑stack Next.js 14 app with Prisma + Postgres
- Upload STL/OBJ, optional cover image, 3D viewer for STL (three.js)
- Simple cost estimate based on STL volume (cm³) + fixed fee
- File storage on a Docker volume, served via `/files/*`
- Auth via email/password using signed HttpOnly cookie (JWT)
- Automatic user page creation upon register/login with route `/u/{slug}` and quick link at `/me`.
- Production/development ready Docker Compose
 - Admin dashboard to manage featured models and basic site settings

Quick Start (Docker)
- Copy `.env.example` to `.env` (optional; compose sets sane defaults)
- Build and run: `docker-compose up --build`
- App: `http://localhost:3000`
- Postgres: `postgres://postgres:postgres@localhost:5432/makerworks`

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
- `POST /api/upload` multipart form: title, description?, material?, model(.stl|.obj), image(optional)
- `GET /api/models` list latest public models
- `GET /api/models/:id` model details
- `POST /api/models/:id/like` toggle like (auth)
- `GET /files/...` serve stored files
- `GET /api/tags` list popular tags
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
- Volume estimation supports binary and ASCII STL; OBJ volume not computed.
- Default pricing: `$0.30 / cm³ + $1.00 fixed` (env configurable).
- Anonymous uploads are attached to a stable `anonymous@local` user for demo.
- Admin flag is stored on users (`isAdmin`). Registration never grants admin.
 - Avatars are resized to 512x512 webp on upload. Old avatars are deleted on replacement.

Next Steps (nice to have)
- OAuth providers and user profiles
- Server-side thumbnail generation with `sharp`
- Likes/downloads, comments, tags, search facets
- MinIO/S3 storage backend option
- Advanced cost model (material/time/layer height)
