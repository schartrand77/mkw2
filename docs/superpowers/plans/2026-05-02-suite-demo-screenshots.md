# Suite Demo Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable local workflow that seeds synthetic MakerWorks suite demo data, captures screenshots across MakerWorks, StockWorks, and PrintLab, and writes a comprehensive wiki walkthrough.

**Architecture:** MakerWorks owns the orchestration because it is the suite hub. A typed manifest defines screenshot routes and documentation copy, a wiki generator writes Markdown from that manifest, a seed script prepares safe synthetic records and local fixture files, and a Playwright script captures screenshots from local app URLs.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Playwright, Node test runner, StockWorks FastAPI HTTP APIs, PrintLab JSON-backed local data files.

---

### Task 1: Manifest and Wiki Generator

**Files:**
- Create: `lib/suite-demo/manifest.ts`
- Create: `lib/suite-demo/wiki.ts`
- Test: `tests/suite-demo-wiki.test.ts`

- [ ] **Step 1: Write the failing tests**

Create tests that import `SUITE_DEMO_SCREENSHOTS` and `buildSuiteDemoWiki`, then assert the manifest has unique filenames, every screenshot path is referenced in the generated wiki, and the safety section mentions synthetic data and real printer actions.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test tests/suite-demo-wiki.test.ts`

Expected: fail because `lib/suite-demo/manifest.ts` does not exist.

- [ ] **Step 3: Implement the manifest and generator**

Add a typed screenshot manifest grouped by MakerWorks, StockWorks, PrintLab, and Suite Flow. Add a generator that returns Markdown for `docs/wiki/Suite-Demo-Walkthrough.md` and references `docs/wiki/assets/suite-screenshots/<filename>`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test tests/suite-demo-wiki.test.ts`

Expected: pass.

### Task 2: Synthetic Seed Script

**Files:**
- Create: `scripts/suite-demo-seed.ts`
- Modify: `package.json`
- Test: `tests/suite-demo-seed.test.ts`

- [ ] **Step 1: Write the failing tests**

Test pure helper functions from the seed script: local path resolution stays inside expected StockWorks/PrintLab repo roots, PrintLab fixture filenames are deterministic, and generated fixture records include the `MW-DEMO-1001` and `PL-DEMO-1001` identifiers.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test tests/suite-demo-seed.test.ts`

Expected: fail because `scripts/suite-demo-seed.ts` does not exist.

- [ ] **Step 3: Implement the seed script**

The script should:

- Upsert demo MakerWorks user, profile, organization, printer, model, collection, product template, merch item, and order through Prisma.
- Use fixed demo IDs where possible for idempotency.
- Seed StockWorks over HTTP when `SUITE_DEMO_STOCKWORKS_SEED=1` and `STOCKWORKS_ADMIN_USERNAME` plus `STOCKWORKS_ADMIN_PASSWORD` are available.
- Write PrintLab demo fixture JSON under `SUITE_DEMO_PRINTLAB_DATA_DIR` or `../printlab/data`, including `queue_demo-x1c.json`, `submitted_jobs_demo-x1c.json`, and `successful_gcodes_demo-x1c.json`.
- Never print passwords, tokens, database URLs, or private env values.

- [ ] **Step 4: Add npm command**

Add `suite:demo:seed` to `package.json` as `tsx scripts/suite-demo-seed.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test tests/suite-demo-seed.test.ts`

Expected: pass.

### Task 3: Screenshot Capture Script

**Files:**
- Create: `scripts/capture-suite-screenshots.ts`
- Modify: `package.json`
- Test: `tests/suite-demo-screenshots.test.ts`

- [ ] **Step 1: Write the failing tests**

Test capture helper functions: default URLs resolve to localhost app ports, output paths stay under `docs/wiki/assets/suite-screenshots`, and optional screenshots can be skipped without failing the whole manifest.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test tests/suite-demo-screenshots.test.ts`

Expected: fail because `scripts/capture-suite-screenshots.ts` does not exist.

- [ ] **Step 3: Implement the capture script**

The script should:

- Use Playwright Chromium.
- Read local URLs from `SUITE_DEMO_MAKERWORKS_URL`, `SUITE_DEMO_STOCKWORKS_URL`, and `SUITE_DEMO_PRINTLAB_URL`.
- Verify each app URL before capture unless `SUITE_DEMO_ALLOW_SKIPS=1`.
- Capture manifest routes into `docs/wiki/assets/suite-screenshots`.
- Click StockWorks tab buttons before screenshots when the manifest entry has a `tabTarget`.
- Log skipped optional screenshots with reasons.
- Avoid printing credentials or secrets.

- [ ] **Step 4: Add npm command**

Add `suite:demo:screenshots` to `package.json` as `tsx scripts/capture-suite-screenshots.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test tests/suite-demo-screenshots.test.ts`

Expected: pass.

### Task 4: Wiki Generation Command

**Files:**
- Create: `scripts/generate-suite-demo-wiki.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement the generator command**

Write `docs/wiki/Suite-Demo-Walkthrough.md` from `buildSuiteDemoWiki`.

- [ ] **Step 2: Add npm command**

Add `suite:demo:wiki` to `package.json` as `tsx scripts/generate-suite-demo-wiki.ts`.

- [ ] **Step 3: Run command**

Run: `npm run suite:demo:wiki`

Expected: `docs/wiki/Suite-Demo-Walkthrough.md` exists and references the screenshot asset directory.

### Task 5: Verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test tests/suite-demo-wiki.test.ts tests/suite-demo-seed.test.ts tests/suite-demo-screenshots.test.ts
```

Expected: pass.

- [ ] **Step 2: Run TypeScript check**

Run: `npm run typecheck`

Expected: pass.

- [ ] **Step 3: Run whitespace verification**

Run: `git diff --check`

Expected: clean.

- [ ] **Step 4: Summarize operational limits**

Report that screenshot capture requires local app services to be running and that real printer actions are not sent.
