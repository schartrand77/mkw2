# MakerWorks Suite Demo Screenshot Workflow Design

## Purpose

Build a repeatable local documentation workflow that fills MakerWorks, StockWorks, and PrintLab with fully synthetic sample data, captures screenshots of the main feature and integration flows, and produces a comprehensive suite wiki walkthrough.

The workflow must be safe to run on a developer machine. It must not expose `.env` values, reuse real customer/order/inventory/printer data, submit real printer commands, or require production services.

## Scope

The first implementation covers the three active suite apps:

- MakerWorks at `C:\Users\steph\OneDrive\Documents\GitHub\mkwV2`
- StockWorks at `C:\Users\steph\OneDrive\Documents\GitHub\stockworks`
- PrintLab at `C:\Users\steph\OneDrive\Documents\GitHub\printlab`

The generated documentation lives in MakerWorks because MakerWorks is the suite hub and already owns the suite wiki. StockWorks and PrintLab can receive small fixture or demo-mode additions if their existing data model requires it, but the docs and orchestration entry point should stay in MakerWorks.

Out of scope:

- Production data capture
- Production deploy changes
- Real printer pause/resume/stop/temperature/fan/light/upload/print actions
- Real payment flows
- Real emails, push notifications, or third-party callbacks
- SlicerWorks and OrderWorks screenshots, except for brief context links if existing docs already mention them

## Success Criteria

- A developer can seed a synthetic end-to-end suite scenario from a documented command.
- A developer can regenerate screenshots from a documented command.
- Screenshots are named consistently and stored under `docs/wiki/assets/suite-screenshots/`.
- The wiki explains each app and the cross-app flow with matching screenshots.
- The generated flow shows MakerWorks commerce/admin, StockWorks inventory/material demand, and PrintLab printer/job execution perspectives.
- The workflow degrades clearly if one app is not running, with an actionable message rather than partial silent output.
- Verification avoids broad destructive commands and uses only local/demo data.

## User-Facing Workflow

The final workflow should feel like this:

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\mkwV2
npm run suite:demo:seed
npm run suite:demo:screenshots
```

The seed command prepares sample data in the local development services. The screenshot command visits the configured local URLs and writes fresh images to `docs/wiki/assets/suite-screenshots/`.

The comprehensive guide should be available at:

```text
docs/wiki/Suite-Demo-Walkthrough.md
```

## Demo Scenario

The synthetic story is a single end-to-end shop workflow:

1. A customer discovers a configurable model in MakerWorks.
2. MakerWorks shows material availability and quote explainability using StockWorks-style sample inventory.
3. The customer checks out and creates a sample print order.
4. MakerWorks admin views show the order moving into production.
5. PrintLab receives a fake MakerWorks job, runs a safe preflight/routing view, and shows a queued or submitted job against fake printers.
6. PrintLab reports synthetic job status back through local/demo records.
7. StockWorks shows the corresponding material demand, low-stock warning, stock movement, quote, merch sync context, and PrintLab loaded tray context.
8. The wiki ties those screens together as one suite flow.

Suggested sample entities:

- Customer: `Avery Demo`
- Organization: `Northstar Robotics Club`
- Model: `Parametric Enclosure Kit`
- Material: `PLA Matte Black`
- Alternate material: `PETG Translucent Blue`
- Printer: `Demo X1 Carbon`
- Backup printer: `Demo P1S`
- Order: `MW-DEMO-1001`
- PrintLab job: `PL-DEMO-1001`
- StockWorks movement: `Reserved 220g PLA Matte Black for MW-DEMO-1001`

## Screenshot Set

The first screenshot pass should target a stable, useful set rather than every possible route. Additional screenshots can be added after the core flow is reliable.

MakerWorks:

- `makerworks-01-home.png` - storefront or suite landing view
- `makerworks-02-discover.png` - model discovery/search with sample models
- `makerworks-03-model-detail.png` - model detail with printability and materials
- `makerworks-04-quote.png` - configured quote and pricing breakdown
- `makerworks-05-checkout.png` - sample checkout/order review
- `makerworks-06-customer-order.png` - customer order timeline
- `makerworks-07-admin-dashboard.png` - admin overview
- `makerworks-08-admin-production.png` - production/job queue
- `makerworks-09-admin-inventory.png` - StockWorks-backed inventory warning or status surface
- `makerworks-10-printlab-job.png` - PrintLab job/callback surface if present

StockWorks:

- `stockworks-01-dashboard.png` - attention summary
- `stockworks-02-filament.png` - spool/material inventory
- `stockworks-03-hardware.png` - hardware or merch inventory
- `stockworks-04-movements.png` - stock movement history
- `stockworks-05-quotes.png` - material quote estimate
- `stockworks-06-orders.png` - incoming MakerWorks job visibility
- `stockworks-07-printlab.png` - loaded tray or PrintLab settings/status view if present

PrintLab:

- `printlab-01-login-or-dashboard.png` - login page when auth is enabled, otherwise printer dashboard
- `printlab-02-printers.png` - multi-printer dashboard with fake printer states
- `printlab-03-printer-detail.png` - printer detail
- `printlab-04-makerworks-library.png` - MakerWorks library/search handoff if available
- `printlab-05-preflight.png` - safe fake preflight/routing result
- `printlab-06-jobs.png` - submitted job queue
- `printlab-07-job-detail.png` - job history/status detail
- `printlab-08-successful-gcodes.png` - successful G-code/sync surface if available

Cross-app flow diagrams or composite docs references:

- `suite-01-commerce-to-production.png` - MakerWorks order to PrintLab job
- `suite-02-inventory-demand.png` - MakerWorks order to StockWorks material demand
- `suite-03-printer-to-inventory.png` - PrintLab loaded tray context in StockWorks

Composite images may be deferred if the first pass can explain the flow with individual screenshots.

## Architecture

### Orchestrator

MakerWorks should own the orchestration scripts:

- `scripts/suite-demo-seed.ts` for MakerWorks-local records and cross-app fixture calls
- `scripts/capture-suite-screenshots.ts` for Playwright screenshot capture
- `docs/wiki/Suite-Demo-Walkthrough.md` for the generated or hand-authored guide

If StockWorks and PrintLab need local fixture endpoints or demo files, those changes should remain narrow and clearly named as demo-only.

### Data Setup

Use existing persistence mechanisms instead of ad hoc file edits:

- MakerWorks: Prisma/domain helpers where available
- StockWorks: existing app data APIs, local data helpers, or fixture files after inspecting its storage format
- PrintLab: existing `/data` JSON-backed records, demo printer config support, or a narrow demo fixture script

The seed command must be idempotent. Running it twice should update or replace the same demo records, not create an unbounded pile of duplicates.

### Screenshot Capture

Use Playwright because MakerWorks already has end-to-end tooling. The capture script should:

- Read app URLs from non-secret env vars with local defaults:
  - `SUITE_DEMO_MAKERWORKS_URL=http://localhost:3000`
  - `SUITE_DEMO_STOCKWORKS_URL=http://localhost:8000`
  - `SUITE_DEMO_PRINTLAB_URL=http://localhost:8289`
- Verify each app is reachable before screenshotting.
- Log skipped screenshots with reasons when an optional route is unavailable.
- Use a consistent viewport for desktop screenshots.
- Prefer stable selectors or route-ready checks over arbitrary sleeps.
- Avoid printing credentials or secret-derived config.

Authentication should use demo-only accounts or existing local admin login flows. If PrintLab auth is enabled and no safe demo credentials are available, capture the login page and document that authenticated PrintLab screenshots require local demo auth configuration.

### Documentation

The wiki page should be hand-authored or generated from a small manifest. A manifest-based approach is preferable if it keeps route, title, filename, and description in one place:

```ts
{
  app: "MakerWorks",
  title: "Quote Builder",
  filename: "makerworks-04-quote.png",
  description: "Shows pricing, material selection, risk, and lead-time explanation for the demo model."
}
```

The guide should explain:

- What each app owns
- How the synthetic data is arranged
- The end-to-end customer-to-production flow
- Where inventory and material warnings appear
- Where PrintLab preflight, queueing, and status sync appear
- How to regenerate the screenshots
- Safety limitations around real printer actions and production data

## Error Handling

- If an app is down, the capture command should fail early with the exact URL that did not respond.
- If a route returns 404, the script should mark that screenshot as skipped and continue only when the route is explicitly optional.
- If auth blocks a page, the script should either perform a demo login or capture the auth screen with a clear filename.
- If seed data cannot be written, the seed command should fail before screenshot capture begins.
- If screenshot output exists, the script can overwrite known screenshot filenames but should not delete unrelated files in the asset directory.

## Testing and Verification

Minimum verification for implementation:

- MakerWorks docs/script changes:
  - `npm run typecheck` if TypeScript scripts are added
  - targeted script dry run where supported
  - `git diff --check`
- Screenshot workflow:
  - run the seed command against local demo services
  - run the screenshot command
  - verify expected screenshot files exist and are non-empty
- StockWorks changes:
  - inspect repo scripts first, then run the smallest relevant test or lint command
- PrintLab changes:
  - run targeted `pytest` for any changed fixture/demo helpers, plus `ruff` if Python files change

Do not run destructive database resets, Docker volume pruning, or real printer action endpoints.

## Open Decisions

These are implementation-time discovery items, not product ambiguities:

- Whether StockWorks exposes enough APIs to seed demo data without direct file manipulation
- Whether PrintLab already has a safe fake-printer/demo mode or needs a narrow fixture mechanism
- Whether MakerWorks has existing seed helpers that should be extended rather than adding a new script from scratch
- Whether the first version should generate the wiki from a manifest or keep the wiki as hand-authored Markdown with screenshots referenced directly

The default implementation should choose the smallest approach that produces repeatable synthetic screenshots without changing production behavior.
