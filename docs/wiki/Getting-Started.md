# Getting Started

This page is the fastest path from clone to a working MakerWorks environment.

## Prerequisites

### Recommended path: Docker Compose

- Docker Desktop or compatible Docker runtime
- Docker Compose support

### Local Node path

- Node.js 20+
- PostgreSQL 15+
- Redis if you want background processing enabled

## Option 1: Run With Docker Compose

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Set the minimum required values:

- `DATABASE_URL`
- `JWT_SECRET`
- `BASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

3. Start the stack:

```bash
docker compose up --build -d
```

4. Open the app at `http://localhost:3000`.

## Option 2: Run With Local Node

1. Install dependencies:

```bash
npm ci
```

2. Copy environment configuration:

```bash
cp .env.example .env
```

3. Generate the Prisma client and apply migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Bootstrap the first admin account:

```bash
npm run bootstrap:admin
```

5. Start the app:

```bash
npm run dev
```

6. Optional: start the processing worker in a second terminal if `REDIS_URL` is configured:

```bash
npm run worker:processing
```

## First-Run Checklist

- Confirm the home page loads.
- Register or sign in as the admin user.
- Open `/admin` and verify admin access.
- Open `/admin/site-config` and review runtime defaults.
- If uploads are important to your deployment, test one small model upload.
- If using card checkout, verify Stripe keys are configured before testing payment flows.

## Default Compose Services

- `db`: PostgreSQL 15
- `redis`: Redis 7
- `web`: main Next.js app
- `processing-worker`: async image/preview worker
- `backup-scheduler`: optional scheduled backup runner

For Unraid template installs, the primary MakerWorks container starts the image/preview processor itself with `START_PROCESSING_WORKER=1`. That keeps processing on the same database and storage settings as the web app, so a separate worker container is not required for normal Unraid deployments.

## Recommended Startup Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
```

## Common Setup Issues

### Admin bootstrap is skipped

Check `ADMIN_PASSWORD`. The repository enforces password guardrails and rejects weak defaults.

### Backup tests fail locally

`tests/backup.test.ts` depends on PostgreSQL client tooling such as `pg_dump`, or a compatible Docker-backed path.

### Uploads or generated files do not persist

Confirm `STORAGE_DIR` is mapped to a persistent path. In Docker Compose, `./storage:/app/storage` is already configured.

### Processing queues appear idle

Background processing requires `REDIS_URL` plus a running `processing-worker`.
On Unraid, the expected worker is the integrated processor inside the primary MakerWorks container unless you intentionally disable `START_PROCESSING_WORKER`.
