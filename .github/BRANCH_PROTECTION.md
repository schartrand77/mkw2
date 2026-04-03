# Branch Protection Setup

To block merges on failing checks, configure branch protection on `main` (and optionally `dev`) and require these status checks:

- `lint`
- `typecheck`
- `test`
- `prisma-drift`

These checks are produced by `.github/workflows/ci.yml`.
