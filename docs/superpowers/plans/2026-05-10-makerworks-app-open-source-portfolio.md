# makerworks.app Open Source Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new standalone `makerworks.app` repository that presents MakerWorks, StockWorks, and PrintLab as an open source software suite with clickable synthetic demo workflows.

**Architecture:** Build a Vite React TypeScript app in `C:\Users\steph\OneDrive\Documents\GitHub\makerworks.app`. The app is static-first: typed fixture data drives product sections, architecture content, and deterministic demo screens; UI components consume fixture selectors instead of live services. This keeps `makerworks.app` separate from `mkwV2` while allowing future asset/manifest exports from the suite repos.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, lucide-react, CSS modules or plain CSS, npm scripts.

---

## File Structure

Create this new repository:

```text
C:\Users\steph\OneDrive\Documents\GitHub\makerworks.app
```

Planned files:

- `package.json` - npm scripts and dependencies for the standalone app.
- `vite.config.ts` - Vite and Vitest configuration.
- `tsconfig.json` - TypeScript project references.
- `tsconfig.app.json` - browser app TypeScript settings.
- `tsconfig.node.json` - config/build TypeScript settings.
- `index.html` - Vite HTML entry.
- `README.md` - local setup, project intent, safety boundaries.
- `src/main.tsx` - React mount entry.
- `src/App.tsx` - page composition and section order.
- `src/App.test.tsx` - integration smoke tests for core content and demo navigation.
- `src/styles.css` - global visual system and responsive layout.
- `src/data/suite.ts` - typed app/product/demo fixture data.
- `src/data/suite.test.ts` - fixture safety and consistency tests.
- `src/lib/demo-state.ts` - deterministic demo step helpers.
- `src/lib/demo-state.test.ts` - demo transition tests.
- `src/components/SiteHeader.tsx` - top navigation and CTAs.
- `src/components/Hero.tsx` - first-viewport suite positioning.
- `src/components/SuiteWorkflow.tsx` - commerce-to-production workflow summary.
- `src/components/AppShowcase.tsx` - MakerWorks, StockWorks, and PrintLab sections.
- `src/components/DemoExplorer.tsx` - clickable synthetic demo lane.
- `src/components/ArchitectureSection.tsx` - technical architecture and safety summary.
- `src/components/SourceSection.tsx` - GitHub/source/resume signal section.
- `src/test/setup.ts` - Vitest DOM matchers.

No files in `mkwV2` should be modified during implementation except this plan unless a later task explicitly adds export tooling.

---

### Task 1: Scaffold the New Repository

**Files:**
- Create directory: `C:\Users\steph\OneDrive\Documents\GitHub\makerworks.app`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Create: `README.md`

- [ ] **Step 1: Create the Vite app**

Run from `C:\Users\steph\OneDrive\Documents\GitHub`:

```powershell
npm create vite@latest makerworks.app -- --template react-ts
```

Expected: directory `C:\Users\steph\OneDrive\Documents\GitHub\makerworks.app` exists with a React TypeScript Vite scaffold.

- [ ] **Step 2: Initialize git**

Run:

```powershell
cd C:\Users\steph\OneDrive\Documents\GitHub\makerworks.app
git init
```

Expected: `git status --short` shows scaffolded files as untracked.

- [ ] **Step 3: Install runtime and test dependencies**

Run:

```powershell
npm install
npm install lucide-react
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Expected: dependencies install without errors and `package-lock.json` exists.

- [ ] **Step 4: Replace `package.json` scripts**

Update `package.json` so these scripts exist:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b"
  }
}
```

Expected: `npm run typecheck` and `npm test` are valid commands even before tests are added.

- [ ] **Step 5: Configure Vitest**

Set `vite.config.ts` to:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Expected: Vitest can use DOM matchers such as `toBeInTheDocument`.

- [ ] **Step 6: Replace starter app with a minimal shell**

Set `src/main.tsx` to:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Set `src/App.tsx` to:

```tsx
export default function App() {
  return (
    <main>
      <h1>MakerWorks Suite</h1>
      <p>Open source software for print-lab commerce, inventory, and production operations.</p>
    </main>
  );
}
```

Set `src/styles.css` to:

```css
:root {
  color: #17211c;
  background: #f7f8f5;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

a {
  color: inherit;
}

button,
input,
select,
textarea {
  font: inherit;
}
```

Expected: `npm run dev` can render a minimal page.

- [ ] **Step 7: Write the README**

Set `README.md` to:

```md
# makerworks.app

Open source portfolio and interactive demo site for the MakerWorks Suite.

`makerworks3d.com` is the printing service. `makerworks.app` is the software suite website for MakerWorks, StockWorks, and PrintLab.

## Local Development

```powershell
npm install
npm run dev
```

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

## Safety

The demos use synthetic records only. This app must not connect to production services, expose secrets, submit payment flows, or send real printer controls.
```

Expected: README explains purpose, local commands, and safety boundary.

- [ ] **Step 8: Verify scaffold**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: both commands pass.

- [ ] **Step 9: Commit scaffold**

Run:

```powershell
git add .
git commit -m "chore: scaffold makerworks app"
```

Expected: first commit exists in the new repo.

---

### Task 2: Add Typed Suite Fixture Data

**Files:**
- Create: `src/data/suite.ts`
- Create: `src/data/suite.test.ts`

- [ ] **Step 1: Write failing fixture tests**

Create `src/data/suite.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { demoScenario, productApps, sourceLinks, workflowSteps } from "./suite";

describe("suite fixtures", () => {
  it("defines the three active suite apps", () => {
    expect(productApps.map((app) => app.name)).toEqual(["MakerWorks", "StockWorks", "PrintLab"]);
  });

  it("uses only synthetic demo identifiers", () => {
    expect(demoScenario.customer).toBe("Avery Demo");
    expect(demoScenario.orderId).toBe("MW-DEMO-1001");
    expect(demoScenario.printLabJobId).toBe("PL-DEMO-1001");
    expect(JSON.stringify(demoScenario)).not.toMatch(/secret|token|password|database_url/i);
  });

  it("connects every workflow step to a known app", () => {
    const appNames = new Set(productApps.map((app) => app.name));
    for (const step of workflowSteps) {
      expect(appNames.has(step.app)).toBe(true);
    }
  });

  it("keeps source links explicit and editable", () => {
    expect(sourceLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "MakerWorks", repo: "mkwV2" }),
        expect.objectContaining({ label: "StockWorks", repo: "stockworks" }),
        expect.objectContaining({ label: "PrintLab", repo: "printlab" }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/data/suite.test.ts
```

Expected: FAIL because `src/data/suite.ts` does not exist.

- [ ] **Step 3: Add suite fixture data**

Create `src/data/suite.ts`:

```ts
export type ProductApp = {
  name: "MakerWorks" | "StockWorks" | "PrintLab";
  tagline: string;
  summary: string;
  responsibilities: string[];
  technicalHighlights: string[];
  accent: string;
};

export type WorkflowStep = {
  id: string;
  app: ProductApp["name"];
  title: string;
  description: string;
};

export type DemoScenario = {
  customer: string;
  organization: string;
  model: string;
  material: string;
  orderId: string;
  printLabJobId: string;
  printer: string;
  stockMovement: string;
};

export type SourceLink = {
  label: ProductApp["name"];
  repo: string;
  description: string;
  href: string;
};

export const productApps: ProductApp[] = [
  {
    name: "MakerWorks",
    tagline: "Storefront, quoting, checkout, and production admin.",
    summary:
      "MakerWorks turns model discovery into priced print orders, then gives operators the production context needed to move work through the shop.",
    responsibilities: [
      "Catalog and model discovery",
      "Instant quote configuration",
      "Checkout and customer order tracking",
      "Admin production queues and job detail",
    ],
    technicalHighlights: [
      "Next.js App Router storefront",
      "Prisma-backed order lifecycle",
      "Synthetic suite screenshot workflow",
    ],
    accent: "#2f7f6f",
  },
  {
    name: "StockWorks",
    tagline: "Materials, inventory, movements, and demand visibility.",
    summary:
      "StockWorks tracks the material side of production so incoming print jobs can be planned against filament, hardware, and stock movements.",
    responsibilities: [
      "Material catalog and color records",
      "Spool inventory and reorder awareness",
      "Stock movement history",
      "Incoming MakerWorks job demand",
    ],
    technicalHighlights: [
      "Inventory-first workflow modeling",
      "Material demand views",
      "PrintLab loaded-tray context",
    ],
    accent: "#8f6b2e",
  },
  {
    name: "PrintLab",
    tagline: "Printer fleet visibility, preflight context, and job handoff.",
    summary:
      "PrintLab represents the production execution layer, showing safe synthetic printer routing and job state without exposing live printer controls.",
    responsibilities: [
      "Printer fleet status",
      "Preflight and routing context",
      "Submitted job tracking",
      "Callback-ready production state",
    ],
    technicalHighlights: [
      "Bambu-oriented printer bridge concepts",
      "Fixture-backed demo mode",
      "Real-world safety boundaries",
    ],
    accent: "#5965a8",
  },
];

export const demoScenario: DemoScenario = {
  customer: "Avery Demo",
  organization: "Northstar Robotics Club",
  model: "Parametric Enclosure Kit",
  material: "PLA Matte Black",
  orderId: "MW-DEMO-1001",
  printLabJobId: "PL-DEMO-1001",
  printer: "Demo X1 Carbon",
  stockMovement: "Reserved 220g PLA Matte Black for MW-DEMO-1001",
};

export const workflowSteps: WorkflowStep[] = [
  {
    id: "discover",
    app: "MakerWorks",
    title: "Model selected",
    description: "Avery Demo selects the Parametric Enclosure Kit and reviews printability context.",
  },
  {
    id: "quote",
    app: "MakerWorks",
    title: "Quote configured",
    description: "MakerWorks prices PLA Matte Black with lead-time and production context.",
  },
  {
    id: "reserve",
    app: "StockWorks",
    title: "Material reserved",
    description: "StockWorks records material demand and the matching stock movement.",
  },
  {
    id: "route",
    app: "PrintLab",
    title: "Job routed",
    description: "PrintLab routes PL-DEMO-1001 to Demo X1 Carbon using synthetic printer state.",
  },
  {
    id: "track",
    app: "MakerWorks",
    title: "Order tracked",
    description: "MakerWorks shows the customer and operator where the order sits in production.",
  },
];

export const sourceLinks: SourceLink[] = [
  {
    label: "MakerWorks",
    repo: "mkwV2",
    description: "Storefront, quoting, checkout, admin operations, and suite demo orchestration.",
    href: "https://github.com/",
  },
  {
    label: "StockWorks",
    repo: "stockworks",
    description: "Material, inventory, merch, stock movement, and job demand visibility.",
    href: "https://github.com/",
  },
  {
    label: "PrintLab",
    repo: "printlab",
    description: "Printer integration, production handoff, safe demo fixtures, and fleet context.",
    href: "https://github.com/",
  },
];
```

- [ ] **Step 4: Run fixture tests**

Run:

```powershell
npm test -- src/data/suite.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit fixture data**

Run:

```powershell
git add src/data/suite.ts src/data/suite.test.ts
git commit -m "feat: add suite fixture data"
```

Expected: commit records typed synthetic suite fixtures.

---

### Task 3: Add Deterministic Demo State

**Files:**
- Create: `src/lib/demo-state.ts`
- Create: `src/lib/demo-state.test.ts`

- [ ] **Step 1: Write failing demo-state tests**

Create `src/lib/demo-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getDemoStep, getNextDemoStep, getPreviousDemoStep } from "./demo-state";

describe("demo state helpers", () => {
  it("starts at the MakerWorks discovery step", () => {
    expect(getDemoStep(0)).toMatchObject({ id: "discover", app: "MakerWorks" });
  });

  it("clamps out-of-range indexes", () => {
    expect(getDemoStep(-10).id).toBe("discover");
    expect(getDemoStep(99).id).toBe("track");
  });

  it("advances until the final step", () => {
    expect(getNextDemoStep(0).id).toBe("quote");
    expect(getNextDemoStep(99).id).toBe("track");
  });

  it("moves backward until the first step", () => {
    expect(getPreviousDemoStep(3).id).toBe("reserve");
    expect(getPreviousDemoStep(-1).id).toBe("discover");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/lib/demo-state.test.ts
```

Expected: FAIL because `src/lib/demo-state.ts` does not exist.

- [ ] **Step 3: Implement demo-state helpers**

Create `src/lib/demo-state.ts`:

```ts
import { workflowSteps, type WorkflowStep } from "../data/suite";

function clampStepIndex(index: number): number {
  if (index < 0) {
    return 0;
  }

  if (index >= workflowSteps.length) {
    return workflowSteps.length - 1;
  }

  return index;
}

export function getDemoStep(index: number): WorkflowStep {
  return workflowSteps[clampStepIndex(index)];
}

export function getNextDemoStep(index: number): WorkflowStep {
  return getDemoStep(clampStepIndex(index) + 1);
}

export function getPreviousDemoStep(index: number): WorkflowStep {
  return getDemoStep(clampStepIndex(index) - 1);
}
```

- [ ] **Step 4: Run demo-state tests**

Run:

```powershell
npm test -- src/lib/demo-state.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit demo-state helpers**

Run:

```powershell
git add src/lib/demo-state.ts src/lib/demo-state.test.ts
git commit -m "feat: add synthetic demo state helpers"
```

Expected: commit records deterministic demo navigation helpers.

---

### Task 4: Build the Product Portfolio Page

**Files:**
- Create: `src/components/SiteHeader.tsx`
- Create: `src/components/Hero.tsx`
- Create: `src/components/SuiteWorkflow.tsx`
- Create: `src/components/AppShowcase.tsx`
- Create: `src/components/ArchitectureSection.tsx`
- Create: `src/components/SourceSection.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing app smoke tests**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("positions makerworks.app as the software suite home", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: /MakerWorks Suite/i })).toBeInTheDocument();
    expect(screen.getByText(/makerworks3d.com is the printing service/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Demo/i })).toHaveAttribute("href", "#demo");
    expect(screen.getByRole("link", { name: /Read Architecture/i })).toHaveAttribute("href", "#architecture");
  });

  it("renders the three product sections", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "MakerWorks" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "StockWorks" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PrintLab" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because the app still renders the minimal scaffold.

- [ ] **Step 3: Add site header**

Create `src/components/SiteHeader.tsx`:

```tsx
import { Github } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="MakerWorks Suite home">
        <span className="brand-mark">MW</span>
        <span>makerworks.app</span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#suite">Suite</a>
        <a href="#apps">Apps</a>
        <a href="#demo">Demo</a>
        <a href="#architecture">Architecture</a>
      </nav>
      <a className="icon-link" href="#source">
        <Github size={18} aria-hidden="true" />
        <span>GitHub</span>
      </a>
    </header>
  );
}
```

- [ ] **Step 4: Add hero**

Create `src/components/Hero.tsx`:

```tsx
import { ArrowRight, Boxes, GitBranch } from "lucide-react";

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">Open source print-lab operations software</p>
        <h1>MakerWorks Suite</h1>
        <p className="hero-text">
          A portfolio-grade software suite for storefront quoting, material intelligence, and printer
          production workflows.
        </p>
        <p className="service-note">
          makerworks3d.com is the printing service. makerworks.app is the software suite.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#demo">
            Explore Demo
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="button secondary" href="#source">
            <GitBranch size={18} aria-hidden="true" />
            View GitHub
          </a>
          <a className="button tertiary" href="#architecture">
            <Boxes size={18} aria-hidden="true" />
            Read Architecture
          </a>
        </div>
      </div>
      <div className="hero-panel" aria-label="Suite workflow preview">
        <div className="preview-row">
          <span>MakerWorks</span>
          <strong>Quote ready</strong>
        </div>
        <div className="preview-row">
          <span>StockWorks</span>
          <strong>220g reserved</strong>
        </div>
        <div className="preview-row">
          <span>PrintLab</span>
          <strong>Demo X1 Carbon routed</strong>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Add suite workflow**

Create `src/components/SuiteWorkflow.tsx`:

```tsx
import { workflowSteps } from "../data/suite";

export function SuiteWorkflow() {
  return (
    <section className="section" id="suite">
      <div className="section-heading">
        <p className="eyebrow">Commerce to production</p>
        <h2>One synthetic order across three apps</h2>
      </div>
      <ol className="workflow-list">
        {workflowSteps.map((step, index) => (
          <li className="workflow-card" key={step.id}>
            <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="app-label">{step.app}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 6: Add app showcase**

Create `src/components/AppShowcase.tsx`:

```tsx
import { productApps } from "../data/suite";

export function AppShowcase() {
  return (
    <section className="section" id="apps">
      <div className="section-heading">
        <p className="eyebrow">The suite</p>
        <h2>Focused apps with clear operating boundaries</h2>
      </div>
      <div className="app-grid">
        {productApps.map((app) => (
          <article className="app-card" key={app.name} style={{ borderTopColor: app.accent }}>
            <h3>{app.name}</h3>
            <p className="tagline">{app.tagline}</p>
            <p>{app.summary}</p>
            <h4>Owns</h4>
            <ul>
              {app.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Technical signals</h4>
            <ul>
              {app.technicalHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Add architecture and source sections**

Create `src/components/ArchitectureSection.tsx`:

```tsx
export function ArchitectureSection() {
  return (
    <section className="section split-section" id="architecture">
      <div>
        <p className="eyebrow">Architecture</p>
        <h2>Static-first demos with production boundaries</h2>
      </div>
      <div className="text-stack">
        <p>
          The first version uses local TypeScript fixtures and deterministic state transitions. It does
          not iframe production apps, write to backend services, submit payments, or send printer
          commands.
        </p>
        <p>
          This keeps the portfolio site deployable on its own while leaving room for future exported
          manifests from MakerWorks, StockWorks, and PrintLab.
        </p>
      </div>
    </section>
  );
}
```

Create `src/components/SourceSection.tsx`:

```tsx
import { sourceLinks } from "../data/suite";

export function SourceSection() {
  return (
    <section className="section" id="source">
      <div className="section-heading">
        <p className="eyebrow">Open source</p>
        <h2>Source-first portfolio signal</h2>
      </div>
      <div className="source-grid">
        {sourceLinks.map((link) => (
          <a className="source-card" href={link.href} key={link.repo}>
            <span>{link.repo}</span>
            <h3>{link.label}</h3>
            <p>{link.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Compose the page**

Replace `src/App.tsx` with:

```tsx
import { AppShowcase } from "./components/AppShowcase";
import { ArchitectureSection } from "./components/ArchitectureSection";
import { Hero } from "./components/Hero";
import { SiteHeader } from "./components/SiteHeader";
import { SourceSection } from "./components/SourceSection";
import { SuiteWorkflow } from "./components/SuiteWorkflow";

export default function App() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <SuiteWorkflow />
        <AppShowcase />
        <div id="demo" className="section">
          <p className="eyebrow">Interactive demo</p>
          <h2>Demo explorer arrives in the next task</h2>
          <p>The demo uses Avery Demo and MW-DEMO-1001 with synthetic state only.</p>
        </div>
        <ArchitectureSection />
        <SourceSection />
      </main>
    </>
  );
}
```

- [ ] **Step 9: Add responsive styling**

Append to `src/styles.css`:

```css
.site-header {
  align-items: center;
  background: rgba(247, 248, 245, 0.94);
  border-bottom: 1px solid #dde3d8;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 16px clamp(18px, 4vw, 56px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand,
.icon-link,
.site-nav,
.hero-actions,
.preview-row {
  align-items: center;
  display: flex;
}

.brand,
.icon-link,
.site-nav a,
.button,
.source-card {
  text-decoration: none;
}

.brand {
  font-weight: 800;
  gap: 10px;
}

.brand-mark {
  background: #17211c;
  color: #f7f8f5;
  display: inline-grid;
  height: 34px;
  place-items: center;
  width: 34px;
}

.site-nav {
  gap: 18px;
}

.site-nav a,
.icon-link {
  color: #475149;
  font-size: 0.95rem;
  font-weight: 650;
}

.icon-link {
  gap: 8px;
}

.hero {
  display: grid;
  gap: 36px;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  min-height: calc(100vh - 68px);
  padding: clamp(56px, 9vw, 112px) clamp(18px, 4vw, 56px) 40px;
}

.eyebrow {
  color: #667166;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0 0 12px;
  text-transform: uppercase;
}

h1,
h2,
h3,
h4,
p {
  margin-top: 0;
}

h1 {
  font-size: clamp(3rem, 9vw, 7.6rem);
  line-height: 0.95;
  margin-bottom: 22px;
  max-width: 9ch;
}

h2 {
  font-size: clamp(2rem, 5vw, 4.4rem);
  line-height: 1;
  margin-bottom: 18px;
}

h3 {
  font-size: 1.25rem;
}

.hero-text {
  color: #344038;
  font-size: clamp(1.1rem, 2vw, 1.45rem);
  line-height: 1.5;
  max-width: 760px;
}

.service-note,
.tagline {
  color: #5a655e;
  font-weight: 700;
}

.hero-actions {
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.button {
  border: 1px solid #17211c;
  display: inline-flex;
  gap: 8px;
  min-height: 44px;
  padding: 11px 16px;
}

.button.primary {
  background: #17211c;
  color: #ffffff;
}

.button.secondary,
.button.tertiary {
  background: #ffffff;
}

.hero-panel {
  align-self: end;
  background: #ffffff;
  border: 1px solid #d9dfd4;
  box-shadow: 0 24px 80px rgba(23, 33, 28, 0.12);
  padding: 18px;
}

.preview-row {
  border-bottom: 1px solid #e6ebe1;
  justify-content: space-between;
  min-height: 72px;
}

.preview-row:last-child {
  border-bottom: 0;
}

.section {
  padding: clamp(56px, 8vw, 96px) clamp(18px, 4vw, 56px);
}

.section-heading {
  max-width: 900px;
}

.workflow-list,
.app-grid,
.source-grid {
  display: grid;
  gap: 16px;
  margin: 30px 0 0;
  padding: 0;
}

.workflow-list {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  list-style: none;
}

.workflow-card,
.app-card,
.source-card {
  background: #ffffff;
  border: 1px solid #dce2d8;
  color: #17211c;
  padding: 20px;
}

.step-number,
.app-label {
  color: #667166;
  display: block;
  font-size: 0.82rem;
  font-weight: 800;
}

.app-grid,
.source-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.app-card {
  border-top-width: 5px;
}

.app-card ul {
  padding-left: 20px;
}

.split-section {
  border-bottom: 1px solid #dde3d8;
  border-top: 1px solid #dde3d8;
  display: grid;
  gap: 32px;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
}

.text-stack {
  color: #344038;
  font-size: 1.08rem;
  line-height: 1.7;
}

@media (max-width: 920px) {
  .site-nav {
    display: none;
  }

  .hero,
  .split-section,
  .workflow-list,
  .app-grid,
  .source-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    min-height: auto;
  }
}
```

- [ ] **Step 10: Run app tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit portfolio page**

Run:

```powershell
git add src
git commit -m "feat: build portfolio landing page"
```

Expected: commit records landing page components and styles.

---

### Task 5: Build the Clickable Demo Explorer

**Files:**
- Create: `src/components/DemoExplorer.tsx`
- Create: `src/components/DemoExplorer.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing demo explorer tests**

Create `src/components/DemoExplorer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DemoExplorer } from "./DemoExplorer";

describe("DemoExplorer", () => {
  it("starts with the MakerWorks discovery step", () => {
    render(<DemoExplorer />);

    expect(screen.getByRole("heading", { name: /Model selected/i })).toBeInTheDocument();
    expect(screen.getByText(/Avery Demo/i)).toBeInTheDocument();
    expect(screen.getByText(/MW-DEMO-1001/i)).toBeInTheDocument();
  });

  it("advances through the synthetic workflow", async () => {
    const user = userEvent.setup();
    render(<DemoExplorer />);

    await user.click(screen.getByRole("button", { name: /Next step/i }));
    expect(screen.getByRole("heading", { name: /Quote configured/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next step/i }));
    expect(screen.getByRole("heading", { name: /Material reserved/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/components/DemoExplorer.test.tsx
```

Expected: FAIL because `DemoExplorer.tsx` does not exist.

- [ ] **Step 3: Implement demo explorer**

Create `src/components/DemoExplorer.tsx`:

```tsx
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { demoScenario, workflowSteps } from "../data/suite";
import { getDemoStep } from "../lib/demo-state";

export function DemoExplorer() {
  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = getDemoStep(stepIndex);

  return (
    <section className="section demo-section" id="demo">
      <div className="section-heading">
        <p className="eyebrow">Interactive demo</p>
        <h2>Click through the synthetic suite workflow</h2>
        <p>
          Avery Demo moves order {demoScenario.orderId} from quote to material reservation to safe
          fake printer routing.
        </p>
      </div>

      <div className="demo-layout">
        <div className="demo-steps" role="tablist" aria-label="Demo workflow steps">
          {workflowSteps.map((step, index) => (
            <button
              aria-selected={index === stepIndex}
              className="demo-step-button"
              key={step.id}
              onClick={() => setStepIndex(index)}
              role="tab"
              type="button"
            >
              <span>{step.app}</span>
              {step.title}
            </button>
          ))}
        </div>

        <article className="demo-screen">
          <span className="app-label">{activeStep.app}</span>
          <h3>{activeStep.title}</h3>
          <p>{activeStep.description}</p>
          <dl className="demo-facts">
            <div>
              <dt>Customer</dt>
              <dd>{demoScenario.customer}</dd>
            </div>
            <div>
              <dt>Organization</dt>
              <dd>{demoScenario.organization}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{demoScenario.model}</dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>{demoScenario.material}</dd>
            </div>
            <div>
              <dt>Order</dt>
              <dd>{demoScenario.orderId}</dd>
            </div>
            <div>
              <dt>PrintLab job</dt>
              <dd>{demoScenario.printLabJobId}</dd>
            </div>
            <div>
              <dt>Printer</dt>
              <dd>{demoScenario.printer}</dd>
            </div>
          </dl>
          <p className="safety-note">Synthetic demo only. No backend writes, payment actions, or printer controls.</p>
          <div className="demo-actions">
            <button
              className="button secondary"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              type="button"
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Previous step
            </button>
            <button
              className="button primary"
              disabled={stepIndex === workflowSteps.length - 1}
              onClick={() =>
                setStepIndex((current) => Math.min(workflowSteps.length - 1, current + 1))
              }
              type="button"
            >
              Next step
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace demo placeholder in App**

Modify `src/App.tsx`:

```tsx
import { AppShowcase } from "./components/AppShowcase";
import { ArchitectureSection } from "./components/ArchitectureSection";
import { DemoExplorer } from "./components/DemoExplorer";
import { Hero } from "./components/Hero";
import { SiteHeader } from "./components/SiteHeader";
import { SourceSection } from "./components/SourceSection";
import { SuiteWorkflow } from "./components/SuiteWorkflow";

export default function App() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <SuiteWorkflow />
        <AppShowcase />
        <DemoExplorer />
        <ArchitectureSection />
        <SourceSection />
      </main>
    </>
  );
}
```

- [ ] **Step 5: Add demo styles**

Append to `src/styles.css`:

```css
.demo-section {
  background: #eef2ea;
}

.demo-layout {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(220px, 0.36fr) minmax(0, 0.64fr);
  margin-top: 28px;
}

.demo-steps {
  display: grid;
  gap: 10px;
}

.demo-step-button {
  background: #ffffff;
  border: 1px solid #d4dccf;
  color: #17211c;
  cursor: pointer;
  min-height: 64px;
  padding: 12px;
  text-align: left;
}

.demo-step-button[aria-selected="true"] {
  border-color: #17211c;
  box-shadow: inset 4px 0 0 #17211c;
}

.demo-step-button span {
  color: #667166;
  display: block;
  font-size: 0.76rem;
  font-weight: 800;
}

.demo-screen {
  background: #ffffff;
  border: 1px solid #d4dccf;
  min-height: 520px;
  padding: clamp(20px, 4vw, 34px);
}

.demo-facts {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 28px 0;
}

.demo-facts div {
  background: #f7f8f5;
  border: 1px solid #e1e6dd;
  padding: 12px;
}

.demo-facts dt {
  color: #667166;
  font-size: 0.78rem;
  font-weight: 800;
}

.demo-facts dd {
  margin: 4px 0 0;
}

.safety-note {
  background: #fff8df;
  border: 1px solid #ead78f;
  padding: 12px;
}

.demo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.demo-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 920px) {
  .demo-layout,
  .demo-facts {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run demo tests**

Run:

```powershell
npm test -- src/components/DemoExplorer.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit demo explorer**

Run:

```powershell
git add src
git commit -m "feat: add synthetic workflow demo"
```

Expected: commit records clickable fixture-backed demo.

---

### Task 6: Final Verification and Local Browser Check

**Files:**
- All files in `C:\Users\steph\OneDrive\Documents\GitHub\makerworks.app`

- [ ] **Step 1: Run full tests**

Run:

```powershell
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: TypeScript passes with no errors.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: Vite production build completes.

- [ ] **Step 4: Check git whitespace**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Start dev server**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 6: Browser smoke test**

Open the local URL and verify:

- First viewport says `MakerWorks Suite`.
- Hero copy states that `makerworks3d.com` is the printing service and `makerworks.app` is the software suite.
- Header links scroll to Suite, Apps, Demo, Architecture, and GitHub sections.
- Demo starts at `Model selected`.
- Clicking `Next step` reaches `Quote configured` and `Material reserved`.
- Desktop and mobile widths have no overlapping text.

- [ ] **Step 7: Commit verification docs if changed**

If README or scripts changed during verification, run:

```powershell
git add README.md package.json package-lock.json
git commit -m "docs: document makerworks app verification"
```

Expected: only intentional documentation or script changes are committed.

- [ ] **Step 8: Final status**

Run:

```powershell
git status --short
```

Expected: clean worktree, or only explicitly noted uncommitted changes.

