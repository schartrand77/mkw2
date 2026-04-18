# MakerWorks Suite Codex Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent Codex guidance so this Windows dev workspace can be managed as a MakerWorks suite, including MakerWorks, PrintLab, StockWorks, SlicerWorks, and OrderWorks.

**Architecture:** Store concise assistant instructions in root `AGENTS.md` and detailed suite operating guidance in `docs/codex-suite-integration.md`. Keep the design and implementation record under `docs/superpowers` for traceability.

**Tech Stack:** Markdown documentation, existing MakerWorks repository conventions.

---

### Task 1: Add Design Spec

**Files:**
- Create: `docs/superpowers/specs/2026-04-18-makerworks-suite-codex-integration-design.md`

- [x] **Step 1: Create the specs directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path docs\superpowers\specs
```

Expected: directory exists.

- [x] **Step 2: Write the design spec**

Create a Markdown spec that records the suite context, goal, two-layer guidance design, safety model, verification model, scope, and acceptance criteria.

- [x] **Step 3: Review the design spec**

Read the file and confirm there are no unfinished markers, contradictions, or unclear ownership statements.

### Task 2: Add Root Assistant Instructions

**Files:**
- Create: `AGENTS.md`

- [x] **Step 1: Write the root assistant guide**

Create `AGENTS.md` with:

```markdown
# MakerWorks Suite Assistant Guide
```

Include workspace paths, first references, MakerWorks conventions, safety rules, and standard verification commands.

- [x] **Step 2: Check that the root guide stays concise**

Confirm the root guide points to `docs/codex-suite-integration.md` for detailed workflows instead of duplicating every runbook.

### Task 3: Add Detailed Suite Guide

**Files:**
- Create: `docs/codex-suite-integration.md`

- [x] **Step 1: Write suite inventory**

Document MakerWorks, PrintLab, StockWorks, SlicerWorks, and OrderWorks with local paths, responsibilities, and primary stacks.

- [x] **Step 2: Write ownership boundaries**

Document which app owns storefront, printer execution, inventory/materials, slicer UX, and legacy orchestration work.

- [x] **Step 3: Write command playbook**

Add concrete MakerWorks commands and repo-inspection-first guidance for PrintLab, StockWorks, SlicerWorks, and OrderWorks.

- [x] **Step 4: Write safety and verification sections**

Define approval-required operations, allowed inspection operations, and the verification matrix.

- [x] **Step 5: Write common runbooks**

Add runbooks for suite health checks, MakerWorks-to-PrintLab job flow debugging, StockWorks sync debugging, and PR preparation.

### Task 4: Verify Documentation

**Files:**
- Read: `AGENTS.md`
- Read: `docs/codex-suite-integration.md`
- Read: `docs/superpowers/specs/2026-04-18-makerworks-suite-codex-integration-design.md`
- Read: `docs/superpowers/plans/2026-04-18-makerworks-suite-codex-integration.md`

- [x] **Step 1: Run diff whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [x] **Step 2: Review changed files**

Run:

```powershell
git status --short
git diff -- AGENTS.md docs/codex-suite-integration.md docs/superpowers/specs/2026-04-18-makerworks-suite-codex-integration-design.md docs/superpowers/plans/2026-04-18-makerworks-suite-codex-integration.md
```

Expected: only the intended documentation files are changed.
