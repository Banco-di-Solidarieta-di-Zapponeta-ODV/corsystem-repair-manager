# CorSystem Repair Manager - Security Baseline

## Current positives
- Passwords are hashed with Node `crypto.scrypt` and a random salt.
- Session tokens are random and stored hashed in the database.
- Session cookies are `httpOnly`, `sameSite=lax`, and secure in production by default.
- Role/page access helpers already exist.
- Import/restore paths have dedicated validation logic.

## Priority risks to address

### P0 - Device credentials
The current Repair model contains `passwordText` and `passwordPattern`. Device unlock credentials must not remain broadly readable plaintext business data.

Required direction:
- determine whether storage is operationally necessary;
- if unnecessary, remove after a safe migration;
- if necessary, use authenticated encryption with a key outside the database;
- restrict access to explicitly authorized staff;
- support automatic expiry/deletion;
- never include credentials in logs, backups exported without protection, search indexes, notifications or AI retrieval.

### P1 - Authentication/session review
Review:
- login rate limiting;
- brute-force protection;
- session invalidation on password/permission changes;
- maximum active sessions;
- password policy;
- secure cookie behaviour behind reverse proxies;
- CSRF exposure on state-changing endpoints.

### P1 - Backup/import/restore
Backup and restore are high-impact administrative operations.

Required controls:
- admin-only access;
- explicit confirmation;
- payload validation;
- size limits;
- audit event;
- backup before destructive replacement;
- ensure exported archives do not accidentally expose sensitive device credentials.

### P1 - Public repair status
Public tokens must disclose only information intentionally designed for customers. Never expose internal notes, staff data, costs, unlock credentials or sensitive customer fields.

### P2 - Audit trail
Introduce structured audit events for:
- authentication;
- permission changes;
- sensitive credential access;
- repair status transitions;
- financial adjustments;
- backup/restore/import;
- deletion/destructive actions.

## Secrets
- `.env` files with real values must remain out of Git.
- production database credentials, encryption keys and provider tokens must be injected via environment/secret manager.
- future CorSystem integrations must use scoped credentials and rotation.

## AI safety boundary
Future CorSystem AI/RAG integration must use a dedicated permission-aware retrieval layer. Sensitive fields such as device unlock credentials are categorically excluded from AI context.
