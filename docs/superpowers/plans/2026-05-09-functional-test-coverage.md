# Functional Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable functional test suite that verifies every important page workflow, API route behavior, and shared domain function without sending real printer commands or exposing secrets.

**Architecture:** Use layered coverage instead of trying to click every DOM node blindly. Playwright owns browser workflows, Node tests own API/domain behavior, and small route inventories prevent new pages/routes from being added without a matching test decision.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, Node test runner with `tsx`, Playwright, existing MakerWorks test fixtures and command scripts.

---

## Scope And Guardrails

Do not send real printer controls or print-job submissions during functional tests. Mock or fixture PrintLab responses for scheduling, sync, status, and submit flows.

Do not require real Stripe, PayPal, SMTP, Discord, StockWorks, or PrintLab services for CI-level tests. Test those boundaries with mocked `fetch`, route-level contract tests, and explicit optional integration smoke tests.

Do not print `.env`, secrets, database URLs, API keys, session secrets, or tokens in test output.

Treat "every function on every page" as:

- every page has a smoke test or a documented reason it is covered by a broader journey
- every user-facing action has at least one functional test
- every API route family has auth/error/success coverage
- every nontrivial `lib/` domain function has direct unit or contract coverage

## Files

- Create: `tests/coverage/route-inventory.test.ts`
- Create: `tests/e2e/helpers/auth.ts`
- Create: `tests/e2e/helpers/test-data.ts`
- Create: `tests/e2e/public-pages.spec.ts`
- Create: `tests/e2e/account-workflows.spec.ts`
- Create: `tests/e2e/admin-production.spec.ts`
- Create: `tests/e2e/admin-catalog.spec.ts`
- Create: `tests/api-route-matrix.test.ts`
- Modify: `tests/e2e/buyer-journey.spec.ts`
- Modify: `package.json`
- Modify: `docs/wiki/Developer-Guide.md`

---

### Task 1: Route Inventory Gate

**Files:**
- Create: `tests/coverage/route-inventory.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing inventory test**

Create `tests/coverage/route-inventory.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  }))
  return files.flat()
}

function normalizeRoute(file: string) {
  return file.replace(/\\/g, '/').replace(/^app\//, '/').replace(/\/page\.tsx$/, '').replace(/\/route\.ts$/, '')
}

test('page route inventory is intentionally covered by functional tests', async () => {
  const files = await walk('app')
  const pages = files.filter((file) => file.endsWith(`${path.sep}page.tsx`)).map(normalizeRoute).sort()

  const covered = new Set([
    '/',
    '/admin',
    '/admin/analytics',
    '/admin/backups',
    '/admin/backup-tools',
    '/admin/batch-optimization',
    '/admin/catalog',
    '/admin/demand-forecasting',
    '/admin/failure-photos',
    '/admin/featured',
    '/admin/fleet-intelligence',
    '/admin/home-comments',
    '/admin/inventory',
    '/admin/jobs',
    '/admin/material-optimization',
    '/admin/models',
    '/admin/models/[id]/images',
    '/admin/notifications',
    '/admin/processing-queues',
    '/admin/production',
    '/admin/products',
    '/admin/site-config',
    '/admin/users',
    '/admin/users/[userId]/orders',
    '/admin/users/[userId]/orders/[orderId]',
    '/admin/users/[userId]/orders/[orderId]/ticket',
    '/cart',
    '/checkout',
    '/collections',
    '/collections/[slug]',
    '/customer/orders',
    '/customer/orders/[orderId]',
    '/customer/portal',
    '/customer/workspaces',
    '/customer/workspaces/[organizationId]/[projectCode]',
    '/discover',
    '/likes',
    '/login',
    '/me',
    '/models/[id]',
    '/models/[id]/edit',
    '/products',
    '/products/[id]',
    '/register',
    '/settings/account',
    '/settings/organizations',
    '/settings/profile',
    '/signed-out',
    '/u/[slug]',
    '/upload',
  ])

  assert.deepEqual(pages.filter((route) => !covered.has(route)), [])
})
```

- [ ] **Step 2: Run test to verify it fails before wiring command**

Run: `node --test --import tsx tests/coverage/route-inventory.test.ts`

Expected: PASS if the current inventory list matches the repo. If it fails, update the `covered` set to match the actual page inventory from the failure output.

- [ ] **Step 3: Add a package script**

Modify `package.json` scripts:

```json
"test:coverage-inventory": "node --test --import tsx tests/coverage/route-inventory.test.ts"
```

- [ ] **Step 4: Run the inventory command**

Run: `npm run test:coverage-inventory`

Expected: PASS.

---

### Task 2: Playwright Auth And Data Helpers

**Files:**
- Create: `tests/e2e/helpers/auth.ts`
- Create: `tests/e2e/helpers/test-data.ts`

- [ ] **Step 1: Write helper files**

Create `tests/e2e/helpers/auth.ts`:

```ts
import { expect, type Page } from '@playwright/test'

export async function loginAsAdmin(page: Page) {
  const email = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'change-me-please'

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function logout(page: Page) {
  await page.goto('/api/logout')
}
```

Create `tests/e2e/helpers/test-data.ts`:

```ts
import type { Page } from '@playwright/test'

export async function firstModelHref(page: Page) {
  await page.goto('/discover')
  const href = await page.locator('a[href^="/models/"]').first().getAttribute('href')
  if (!href) throw new Error('No model link found on discover page')
  return href
}
```

- [ ] **Step 2: Run current E2E to catch helper selector mismatch early**

Run: `npx playwright test tests/e2e/buyer-journey.spec.ts --project=chromium`

Expected: existing buyer journey still passes.

---

### Task 3: Public Page Functional Coverage

**Files:**
- Create: `tests/e2e/public-pages.spec.ts`
- Modify: `tests/e2e/buyer-journey.spec.ts`

- [ ] **Step 1: Add smoke tests for public pages**

Create `tests/e2e/public-pages.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

const publicPages = [
  { path: '/', heading: /MakerWorks|Browse|Library/i },
  { path: '/discover', heading: /Discover Models/i },
  { path: '/collections', heading: /Collections/i },
  { path: '/products', heading: /Products|Shop/i },
  { path: '/cart', heading: /Cart/i },
  { path: '/checkout', heading: /Checkout/i },
  { path: '/login', heading: /Sign in|Login/i },
  { path: '/register', heading: /Create account|Register/i },
  { path: '/signed-out', heading: /Signed out|Sign in/i },
  { path: '/upload', heading: /Upload/i },
]

for (const pageCase of publicPages) {
  test(`public page renders: ${pageCase.path}`, async ({ page }) => {
    await page.goto(pageCase.path)
    await expect(page.getByRole('heading', { name: pageCase.heading }).first()).toBeVisible()
  })
}

test('discover search updates visible model results', async ({ page }) => {
  await page.goto('/discover')
  const input = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).first()
  await expect(input).toBeVisible()
  await input.fill('demo')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/discover/)
})
```

- [ ] **Step 2: Run new public page tests**

Run: `npx playwright test tests/e2e/public-pages.spec.ts --project=chromium`

Expected: PASS. If a heading copy differs, update the expected regex to match real page copy.

- [ ] **Step 3: Extend buyer journey assertions**

Modify `tests/e2e/buyer-journey.spec.ts` to assert the cart line item remains visible after navigation:

```ts
await page.goto('/cart')
await expect(page.getByRole('heading', { name: /Cart/i })).toBeVisible()
await expect(page.locator('main')).toContainText(/PLA|PETG|Checkout|Quote/i)
```

- [ ] **Step 4: Run buyer journey**

Run: `npx playwright test tests/e2e/buyer-journey.spec.ts --project=chromium`

Expected: PASS.

---

### Task 4: Account Workflow Coverage

**Files:**
- Create: `tests/e2e/account-workflows.spec.ts`

- [ ] **Step 1: Add account page and validation tests**

Create `tests/e2e/account-workflows.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

test('login rejects invalid credentials with a user-visible error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('nobody@example.com')
  await page.getByLabel(/password/i).fill('definitely-wrong')
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(page.locator('body')).toContainText(/invalid|failed|incorrect/i)
})

test('admin can open account settings pages', async ({ page }) => {
  await loginAsAdmin(page)
  for (const path of ['/me', '/settings/account', '/settings/profile', '/settings/organizations']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
  }
})
```

- [ ] **Step 2: Run account workflow tests**

Run: `npx playwright test tests/e2e/account-workflows.spec.ts --project=chromium`

Expected: PASS with valid local admin env. If local admin password is intentionally unavailable, mark these tests with a clear `test.skip(!process.env.E2E_ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD, 'admin credentials required')`.

---

### Task 5: Admin Production Functional Coverage

**Files:**
- Create: `tests/e2e/admin-production.spec.ts`

- [ ] **Step 1: Add production scheduling browser tests**

Create `tests/e2e/admin-production.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

test('production scheduling renders queue, printer panel, and action buttons', async ({ page }) => {
  await page.goto('/admin/production')
  await expect(page.getByRole('heading', { name: /Production Scheduling/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Auto-assign queue/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Sync PrintLab/i })).toBeVisible()
  await expect(page.locator('main')).toContainText(/Printer availability/i)
})

test('sync printlab failure surfaces actionable message', async ({ page }) => {
  await page.route('**/api/admin/printers/sync-printlab', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Unable to reach PrintLab at http://printlab:8080. Confirm PRINTLAB_BASE_URL is reachable from the MakerWorks container, both containers are on the shared Docker network, and PrintLab is listening on the configured internal port.',
      }),
    })
  })

  await page.goto('/admin/production')
  await page.getByRole('button', { name: /Sync PrintLab/i }).click()
  await expect(page.locator('body')).toContainText(/Unable to reach PrintLab/i)
  await expect(page.locator('body')).toContainText(/shared Docker network/i)
})
```

- [ ] **Step 2: Run production tests**

Run: `npx playwright test tests/e2e/admin-production.spec.ts --project=chromium`

Expected: PASS.

---

### Task 6: Admin Catalog And Order Workflow Coverage

**Files:**
- Create: `tests/e2e/admin-catalog.spec.ts`

- [ ] **Step 1: Add admin page smoke coverage**

Create `tests/e2e/admin-catalog.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

const adminPages = [
  '/admin',
  '/admin/analytics',
  '/admin/catalog',
  '/admin/featured',
  '/admin/home-comments',
  '/admin/inventory',
  '/admin/jobs',
  '/admin/models',
  '/admin/notifications',
  '/admin/processing-queues',
  '/admin/products',
  '/admin/site-config',
  '/admin/users',
]

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

for (const path of adminPages) {
  test(`admin page renders: ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error/i)
  })
}
```

- [ ] **Step 2: Run admin smoke coverage**

Run: `npx playwright test tests/e2e/admin-catalog.spec.ts --project=chromium`

Expected: PASS.

---

### Task 7: API Route Matrix Coverage

**Files:**
- Create: `tests/api-route-matrix.test.ts`

- [ ] **Step 1: Add unauthenticated API guard tests**

Create `tests/api-route-matrix.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

const guardedAdminRoutes = [
  '../app/api/admin/analytics/route',
  '../app/api/admin/backup/route',
  '../app/api/admin/catalog/route',
  '../app/api/admin/env-check/route',
  '../app/api/admin/printers/sync-printlab/route',
  '../app/api/admin/production/route',
  '../app/api/admin/site-config/route',
]

for (const routeModule of guardedAdminRoutes) {
  test(`${routeModule} rejects unauthenticated access`, async () => {
    const route = await import(routeModule)
    const handler = route.GET || route.POST
    assert.equal(typeof handler, 'function')
    const response = await handler(new Request('http://localhost/test', { method: route.GET ? 'GET' : 'POST' }) as any)
    assert.ok([401, 403].includes(response.status), `expected 401/403, got ${response.status}`)
  })
}
```

- [ ] **Step 2: Run matrix test**

Run: `node --test --import tsx tests/api-route-matrix.test.ts`

Expected: PASS. If a route relies on `next/headers` internals and cannot be imported directly, move it to the existing API test pattern used by nearby tests.

---

### Task 8: Documentation And Verification Script

**Files:**
- Modify: `package.json`
- Modify: `docs/wiki/Developer-Guide.md`

- [ ] **Step 1: Add a functional test script**

Modify `package.json` scripts:

```json
"test:functional": "npm run test:coverage-inventory && npm run test:api && npm run test:contracts && npm run e2e"
```

- [ ] **Step 2: Document the functional testing tiers**

Add to `docs/wiki/Developer-Guide.md` under Testing Notes:

```md
Functional coverage is split into tiers:

- `npm run test:coverage-inventory` ensures every page route is intentionally covered.
- `npm run test:api` and `npm run test:contracts` cover API and integration boundaries.
- `npm run e2e` covers user-visible workflows in Playwright.
- `npm run test:functional` runs the full functional gate.

Printer-control workflows must use mocked PrintLab responses unless a human explicitly approves a real printer operation.
```

- [ ] **Step 3: Run full functional gate**

Run: `npm run test:functional`

Expected: PASS. If backup-related tests are included by mistake, keep them out of this script because backup tests may require local PostgreSQL client tooling.

---

## Execution Order

1. Route inventory gate.
2. E2E helpers.
3. Public page workflow tests.
4. Account workflow tests.
5. Admin production tests.
6. Admin catalog/order smoke tests.
7. API route matrix tests.
8. Documentation and full functional script.

## Self-Review

Spec coverage:

- Page coverage is handled by the route inventory and Playwright specs.
- User-facing actions are started with buyer, account, admin production, and admin page workflows.
- API behavior is handled by the route matrix plus existing `test:api` and `test:contracts`.
- Shared function coverage remains covered by existing Node tests and should expand incrementally as gaps are found.

Known gaps after this plan:

- Dynamic pages need seeded fixture data for full deep-link verification.
- Checkout payment completion should remain mocked unless test Stripe credentials are available.
- PrintLab job submission must remain mocked unless a human approves a real printer-side action.
