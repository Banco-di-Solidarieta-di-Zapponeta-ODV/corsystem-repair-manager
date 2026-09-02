# CorSystem Repair Manager - Architecture Baseline

## Current state
Repair Manager is a full-stack Next.js application using the App Router. It already provides repair tickets, clients, catalog data, technicians, staff authentication/permissions, reports, public status pages, QR support, payments and backup/import/export.

### Runtime stack
- Next.js 16 / React 19
- Prisma ORM
- MySQL or MariaDB
- Node.js 24+
- Docker / Docker Compose

### Main layers today
- `src/app`: UI and Next.js route handlers.
- `src/app/api`: application HTTP endpoints.
- `src/lib`: authentication, persistence helpers, data validation, backup logic, search and calculations.
- `prisma`: schema, migrations and seed data.

## Main architectural risks

### 1. Monolithic UI shell
`src/app/page.jsx` is extremely large and currently concentrates too much UI/state/workflow logic in one file. This increases regression risk and makes parallel development difficult.

Target: split by feature/domain, for example:
- repairs
- clients
- catalog
- technicians
- finance/reports
- settings
- backup

### 2. Oversized global stylesheet
`src/app/globals.css` is very large. Styles should progressively move into feature/component boundaries while preserving shared design tokens globally.

### 3. Domain model mixes device and repair data
The current `Repair` entity stores brand, model, IMEI and device credentials directly. A physical device needs its own identity because the same device can return for multiple repairs.

Target relationship:
`Client 1 -> N Device 1 -> N Repair`

### 4. Sensitive data handling
Device unlock credentials must be considered high-sensitivity operational data. Plaintext persistence should be eliminated or minimized. If business requirements require temporary storage, use authenticated encryption, strict access controls, expiry and auditability.

### 5. Integration boundary
External CorSystem modules must not read this database directly. Future integrations should use versioned APIs, webhooks or events.

## Target modular architecture

```text
UI / Feature Modules
        |
Application Services
        |
Domain Rules
        |
Repositories / Prisma
        |
MySQL/MariaDB

External boundary:
CorSystem Core / Notify / Inventory / Portal
        |
Versioned API + Webhooks/Events
```

## Proposed feature structure

```text
src/
  app/
    api/
    status/
  features/
    repairs/
    clients/
    devices/
    catalog/
    technicians/
    reports/
    settings/
  components/
    ui/
    shared/
  lib/
    auth/
    db/
    validation/
    integrations/
```

This is a target direction, not a request for a one-shot rewrite.

## CorSystem Platform integration principles
- Stable internal IDs.
- Versioned API contracts.
- Idempotent webhooks/events where possible.
- No shared-database coupling.
- SSO integration may be introduced later, but current auth must remain operational until a migration plan exists.
- Notification delivery should eventually move behind `corsystem-notify` rather than being embedded throughout repair workflows.
