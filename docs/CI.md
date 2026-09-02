# CorSystem Repair Manager - CI Baseline

## Purpose
The CI workflow protects `main` from obvious dependency, Prisma schema and production-build regressions before larger refactors begin.

## Trigger
The workflow runs on:
- pull requests targeting `main`;
- pushes to `main`;
- manual `workflow_dispatch` runs.

## Baseline checks
1. Checkout repository.
2. Use the Node version declared in `.node-version`.
3. Install exactly the locked dependencies with `npm ci`.
4. Validate the Prisma schema.
5. Generate the Prisma client.
6. Build the Next.js application.

## Local equivalent
Run before opening a PR:

```bash
npm ci
npx prisma validate
npx prisma generate
npm run build
```

A syntactically valid `DATABASE_URL` is required by Prisma even when the baseline job does not connect to a live database.

## Secrets and data
The baseline workflow does not use production secrets or real customer data. Values in CI are disposable placeholders and must never be reused in production.

## Next step
Characterization and browser smoke tests will be added separately after their database fixtures and lifecycle are made deterministic. This keeps the first CI change small and diagnosable.
