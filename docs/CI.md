# CorSystem Repair Manager - CI

## Purpose
The CI workflow protects `main` from dependency, Prisma schema, production-build and critical workflow regressions before larger refactors begin.

## Trigger
The workflow runs on:
- pull requests targeting `main`;
- pushes to `main`;
- manual `workflow_dispatch` runs.

## Job 1 - Build and validate
1. Checkout repository.
2. Use the Node version declared in `.node-version`.
3. Install locked dependencies with `npm ci`.
4. Validate the Prisma schema.
5. Generate the Prisma client.
6. Build the Next.js application.

## Job 2 - Characterization smoke
The smoke job uses a disposable MySQL 8.4 service. It never connects to production data.

It performs:
1. `npm ci`;
2. install Chrome for Playwright;
3. deploy Prisma migrations to the isolated database;
4. seed deterministic demo/test data;
5. build and start the application;
6. run the existing `npm run smoke` browser suite;
7. upload the server log when the job fails.

The current smoke suite exercises login failure/success, language switching, clients, catalog data, staff, technicians, repair creation/editing, warranty flow, reports/settings/backup and the public repair status page.

## Local baseline
Before opening a PR, at minimum run:

```bash
npm ci
npx prisma validate
npx prisma generate
npm run build
```

For the full browser characterization suite, use an isolated MySQL/MariaDB database, apply migrations, seed demo data, start the built application and run:

```bash
npm run smoke
```

## Secrets and data
CI uses disposable placeholder credentials only. Production secrets, customer data, backups and screenshots must never be copied into the workflow or test fixtures.

## Evolution
Future tests should be added as small focused checks around domain rules and APIs. The broad browser smoke suite remains a regression safety net, not a replacement for unit/integration tests.
