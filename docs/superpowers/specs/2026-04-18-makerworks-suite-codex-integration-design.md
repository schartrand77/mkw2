# MakerWorks Suite Codex Integration Design

## Context

The Windows dev workspace contains a MakerWorks suite of related local repositories:

- MakerWorks at `C:\Users\steph\OneDrive\Documents\GitHub\mkwV2`
- PrintLab at `C:\Users\steph\OneDrive\Documents\GitHub\printlab`
- StockWorks at `C:\Users\steph\OneDrive\Documents\GitHub\stockworks`
- SlicerWorks at `C:\Users\steph\OneDrive\Documents\GitHub\slicerworks`
- OrderWorks at `C:\Users\steph\OneDrive\Documents\GitHub\orderworks`

MakerWorks is a Next.js/TypeScript/Prisma/Docker app and is the suite hub for storefront, quoting, checkout, admin workflows, order lifecycle, and integrations. PrintLab is the printer execution app. StockWorks owns material and inventory workflows. SlicerWorks is an iPad slicer concept. OrderWorks is legacy/compatibility context.

## Goal

Make Codex behave as a broader MakerWorks suite assistant, not just a single-repo coding helper.

## Design

Add persistent assistant guidance in MakerWorks because MakerWorks is the operational hub. The guidance has two layers:

1. Root `AGENTS.md` with high-priority local instructions for future assistant sessions.
2. `docs/codex-suite-integration.md` with the detailed suite map, command playbook, ownership boundaries, safety rules, verification matrix, and common runbooks.

The root guide stays concise so it is easy for Codex to load and follow. The detailed guide carries the operational context that would otherwise be rediscovered every session.

## Safety Model

Codex may inspect code, docs, package metadata, Docker status, logs, and non-secret configuration templates. It may run normal local verification commands when relevant.

Codex must ask before destructive or real-world operations: deleting files/data, resetting Git history, applying database changes to non-local databases, pruning Docker volumes, stopping active services, sending printer controls, or submitting actual print jobs.

Codex must not expose secrets from `.env`, Docker inspect output, logs, config files, printer access codes, tokens, or database URLs.

## Verification Model

The guide defines app-specific verification rather than one global command. MakerWorks uses lint, typecheck, Node tests, API/contract tests, Playwright, build, Prisma, and Docker checks depending on change scope. PrintLab uses pytest, ruff, mypy, and Docker checks after confirming the repo's current command files. StockWorks, SlicerWorks, and OrderWorks require repo inspection before running commands.

## Scope

In scope:

- assistant guidance
- suite map
- safety rules
- command playbook
- verification matrix
- common cross-app runbooks

Out of scope for this first pass:

- new automation scripts
- new MCP servers
- secrets management changes
- Docker compose rewrites
- GitHub Actions changes
- real printer control automation

## Acceptance Criteria

- Future Codex sessions can identify the relevant app for suite work.
- The docs explain the local paths and responsibilities of MakerWorks, PrintLab, StockWorks, SlicerWorks, and OrderWorks.
- The docs distinguish safe inspection from actions requiring approval.
- The docs give concrete verification commands for MakerWorks and guidance for the related repos.
- The docs explain common MakerWorks/PrintLab and MakerWorks/StockWorks debugging workflows.

