# makerworks.app Open Source Portfolio Design

## Purpose

Create `makerworks.app` as a new standalone software website app for the MakerWorks Suite. The site should drive interest in the open source projects, show the suite as serious product engineering work, and serve as a resume-quality portfolio without reading like a personal resume.

`makerworks3d.com` remains the home of the 3D printing service. `makerworks.app` becomes the home of the software suite: MakerWorks, StockWorks, and PrintLab.

## Product Positioning

`makerworks.app` presents the MakerWorks Suite as open source software for operating a small print lab or maker-oriented production workflow.

The core message:

- MakerWorks handles storefront, quoting, checkout, customer order tracking, and admin production views.
- StockWorks handles materials, inventory, merch, stock movements, low-stock awareness, and job-demand visibility.
- PrintLab handles printer fleet visibility, preflight/routing context, submitted jobs, and production handoff.
- Together, the apps show a full commerce-to-production workflow backed by synthetic demo data.

The site should make the software work visible through clickable demos, screenshots, architecture notes, and source links.

## Audience

Primary audience:

- People evaluating the open source software and project direction.
- Hiring managers, technical recruiters, engineering teams, and collaborators reviewing the work as a portfolio artifact.
- Print shops, makerspaces, schools, clubs, and small production teams interested in the workflow.

The tone should be practical and product-focused. It should explain what the system does, how the apps fit together, and what engineering problems the suite solves.

## Repository Boundary

`makerworks.app` should be a new repository, separate from `mkwV2`.

The new repo should own:

- The public website application for `makerworks.app`.
- Interactive synthetic demo screens.
- Site-specific copy, routing, styling, and deployment configuration.
- A lightweight demo data layer or JSON fixtures for first-version interactions.

The existing MakerWorks repo can continue to own:

- The real MakerWorks storefront and operations app.
- Suite demo screenshot generation and wiki documentation.
- Shared planning docs until the new repo exists.

Future work may export a demo manifest or screenshots from MakerWorks into the `makerworks.app` repo, but v1 should not require coupling deployments between the repos.

## First Version Scope

The first public version should be an open source product portfolio with a strong demo lane.

Required pages or sections:

- Home / suite overview.
- MakerWorks product section.
- StockWorks product section.
- PrintLab product section.
- Interactive suite demo entry.
- Architecture / integration overview.
- GitHub/source links.

Primary calls to action:

- Explore Demo
- View GitHub
- Read Architecture

Out of scope for v1:

- User accounts.
- Real hosted sandbox writes.
- Production data access.
- Real printer controls.
- Payment flows.
- SaaS pricing pages.
- Customer-facing print service ordering, which belongs on `makerworks3d.com`.

## Demo Model

The first demo should use safe synthetic data and behave like a clickable product tour. It should not iframe production apps or connect to live services.

The demo can follow the same scenario used by the MakerWorks suite walkthrough:

- Customer: Avery Demo
- Organization: Northstar Robotics Club
- Model: Parametric Enclosure Kit
- Material: PLA Matte Black
- Order: MW-DEMO-1001
- PrintLab job: PL-DEMO-1001
- Printer: Demo X1 Carbon

The user should be able to click through the workflow at a product level:

1. Discover or inspect a model in MakerWorks.
2. Review a quote and material context.
3. See the order enter production.
4. See StockWorks reflect material demand and stock movement.
5. See PrintLab route the job to a safe fake printer.
6. Return to a suite-level timeline that explains the handoff.

The first version can use local fixtures and deterministic state transitions. It does not need persistence, authentication, or real backend writes.

## Information Architecture

The site should prioritize product comprehension over marketing decoration.

Suggested top navigation:

- Suite
- Apps
- Demo
- Architecture
- GitHub

Suggested home structure:

1. Hero: "MakerWorks Suite" as the first-viewport signal, with concise copy explaining that it is open source software for print-lab commerce, inventory, and production operations.
2. Suite workflow: a compact commerce-to-production timeline showing MakerWorks, StockWorks, and PrintLab responsibilities.
3. App overview: three product sections with screenshots or live demo previews.
4. Interactive demo lane: entry points into the synthetic workflow.
5. Engineering highlights: architecture, safety boundaries, integrations, and local-first/demo-first approach.
6. Source and resume signal: GitHub links, project docs, and concise technical highlights.

## Visual Direction

The site should feel like a polished software product surface, not a personal homepage and not a generic SaaS landing page.

Design priorities:

- Dense but readable product UI previews.
- Real screenshots or high-fidelity synthetic demo screens.
- Clear app identity for MakerWorks, StockWorks, and PrintLab.
- Restrained, technical visual style with strong information hierarchy.
- No production customer data, printer identifiers, secrets, or live service indicators.

The first screen should show the suite and a hint of the workflow. It should not hide the product behind abstract graphics.

## Technical Approach

The new repo can start as a mostly static frontend app.

Recommended stack for v1:

- Next.js or Vite with React and TypeScript.
- Local JSON fixtures for demo state.
- Static image assets from the existing suite screenshot workflow where useful.
- Componentized demo screens that can later be backed by exported manifests or API fixtures.

The demo layer should be isolated from the presentation layer:

- `data/` or `fixtures/` for synthetic records.
- `lib/demo-state` for deterministic transitions and derived timeline data.
- `components/demo/` for interactive demo surfaces.
- `components/product/` for reusable suite and app presentation sections.

This keeps the first version simple while preserving a path to richer demos later.

## Safety Rules

The site must not expose:

- Real customer records.
- Real inventory counts.
- Printer access codes, serials, camera feeds, or live states.
- `.env` values, API keys, database URLs, tokens, or private deployment details.
- Real payment or order submission flows.

Any printer-related UI must be clearly synthetic. Demo actions should update local state only.

## Success Criteria

- A visitor can understand the MakerWorks Suite within the first page view.
- A visitor can see how MakerWorks, StockWorks, and PrintLab connect.
- A visitor can click through a synthetic workflow without accounts or production access.
- The site clearly links to source code and architecture documentation.
- The site strengthens the open source and resume value of the MakerWorks work.
- The separation between `makerworks3d.com` and `makerworks.app` is obvious.

## Verification For Implementation

When the new repo is created, initial implementation should verify:

- TypeScript passes.
- Linting passes.
- The app builds.
- Demo routes render without runtime console errors.
- Desktop and mobile screenshots show readable, non-overlapping text.
- Demo data contains only synthetic records.

## Open Decisions

These can be resolved when scaffolding the new repo:

- Whether to use Next.js or Vite for the first implementation.
- Whether screenshots are copied manually at first or exported through a manifest from MakerWorks.
- Whether each app gets a separate route immediately or starts as sections on a single page.
- Whether the GitHub links point to public repos immediately or are added as repos become ready.
