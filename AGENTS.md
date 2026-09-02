# CorSystem Repair Manager - Agent Instructions

This repository is the first operational module of the future **CorSystem Platform**.

## Primary goals
- Keep the application stable while evolving it into a modular, API-first product.
- Preserve compatibility with existing repair-shop workflows and data.
- Prepare clean integration boundaries for future `corsystem-core`, `corsystem-integrations`, `corsystem-notify`, customer portal, RMM/NOC and AI modules.

## Engineering rules
1. Do not perform broad rewrites when an incremental refactor is possible.
2. Keep domain logic separate from UI, persistence and HTTP route handlers.
3. Prefer small modules and explicit interfaces over large multipurpose files.
4. Maintain backward-compatible migrations unless a migration plan is documented.
5. Never commit secrets, real customer data, database dumps, credentials or private screenshots.
6. Treat device unlock credentials as sensitive data. Do not introduce new plaintext storage.
7. Add tests before high-risk refactors and preserve existing smoke tests.
8. Use API/webhook/event boundaries for future CorSystem integrations. Do not couple external systems directly to this database.
9. Keep Docker and non-Docker development paths working.
10. Document material architectural decisions in `docs/adr/`.

## Current stack
- Next.js 16 / React 19
- Prisma 6
- MySQL / MariaDB
- Node.js 24+
- Playwright smoke testing
- Docker / Docker Compose

## Development workflow
- Work on a dedicated branch.
- Keep commits small and purpose-specific.
- Run `npm run build` and the relevant smoke tests before proposing merge.
- Database changes require a Prisma migration and rollback/migration notes.
- Security-sensitive changes require explicit review notes.

## Near-term priorities
1. Establish technical baseline and documentation.
2. Add characterization/CI coverage before refactoring the large UI shell.
3. Remove or encrypt sensitive device credential storage.
4. Introduce a first-class `Device` domain entity so one physical device can have multiple repair histories.
5. Decompose the monolithic main page into feature modules.
6. Formalize API contracts for future CorSystem Platform integration.

## Do not do without explicit approval
- Replace the framework or database.
- Change production deployment strategy.
- Remove legacy fields before migration is complete.
- Introduce a new authentication provider.
- Merge directly to `main`.
