# Upgrade Recommendations (2026-03)

This is a pragmatic upgrade backlog for MakerWorks focused on security support windows, low-risk wins, and high-impact platform upgrades.

## 1) Infrastructure & Runtime

### PostgreSQL
- **Current baseline in docs:** PostgreSQL 15+
- **Recommendation:** move production to **PostgreSQL 16** first, then evaluate 17 after burn-in.
- **Why:** better planner improvements and longer support runway while minimizing compatibility risk with Prisma.
- **Notes:** rehearse backup/restore (`pg_dump`/`psql`) and run migration diff checks in staging before production cutover.

### Node.js
- **Current baseline in docs:** Node.js 20+
- **Recommendation:** standardize on latest Node 20 LTS patch across all environments; stage Node 22 pilot after dependency matrix validation.
- **Why:** keeps ABI stability for native modules (`sharp`) while staying current on security fixes.

## 2) Dependency upgrades to do now (low risk)

Based on `npm outdated --long`, these can generally be upgraded in one maintenance PR with regression checks:

- `react` / `react-dom`: `19.0.0` → `19.2.x`
- `@stripe/react-stripe-js`: `5.3.0` → `5.6.x`
- `@stripe/stripe-js`: `8.4.0` → `8.9.x`
- `bullmq`: `5.69.3` → `5.71.x`
- `ioredis`: `5.9.3` → `5.10.x`
- `dotenv`: `17.2.3` → `17.3.x`
- `jsonwebtoken`: `9.0.2` → `9.0.3`
- `autoprefixer`: `10.4.22` → `10.4.27`
- `postcss`: `8.5.6` → `8.5.8`
- `baseline-browser-mapping`: `2.9.19` → `2.10.x`

## 3) Strategic upgrades (plan separately)

These have larger breaking-change surfaces and should be isolated into dedicated migration tracks.

### Prisma (`5.12.1` → latest)
- **Path:** `5.x` latest patch first (`5.22.x`), then evaluate major upgrades.
- **Risk areas:** generated client behavior, migration engine changes, and SQL diff edge cases.
- **Validation:** run migration drift checks, full API test suite, and backup/restore smoke tests.

### Next.js / ESLint alignment
- `next` is `16.0.10` while `eslint-config-next` is newer (`16.1.6`).
- **Recommendation:** align to the same minor line to avoid framework/tooling mismatch drift.

### Tailwind CSS (`3.4.x` → `4.x`)
- **Risk:** config and build pipeline changes may affect utility generation and custom plugin behavior.
- **Recommendation:** only upgrade with visual regression pass and screenshot diffs on critical pages.

### Zod (`3.x` → `4.x`)
- **Risk:** schema and error formatting behavior changes can impact API validation responses.
- **Recommendation:** migrate route-by-route with contract tests.

### Stripe server SDK (`19.x` → `20.x`)
- **Risk:** typed API surface updates and potential behavior changes around payment intent flows.
- **Recommendation:** perform checkout + webhook replay tests before production rollout.

## 4) Proposed rollout order

1. **Infra patching:** Node 20 latest patch + PostgreSQL 16 staging rehearsal.
2. **Low-risk dependency batch:** patch/minor updates listed above.
3. **Prisma stabilization:** upgrade to latest 5.x and re-baseline migration health.
4. **Framework migration wave:** Tailwind 4, Zod 4, Stripe 20, and then Prisma major.

## 5) Suggested acceptance checklist for each upgrade PR

- `npm run lint`
- `npm run typecheck`
- `npm test`
- Checkout flow smoke test (quote → payment intent → order creation)
- Admin queue/production smoke test
- Backup + restore smoke test in staging

