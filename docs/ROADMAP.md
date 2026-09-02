# CorSystem Repair Manager - Engineering Roadmap

## Sprint 0 - Stabilize before expansion
Goal: create a safe foundation for continued development.

1. Architecture and agent documentation.
2. Baseline build and smoke-test workflow.
3. Security review of authentication, session handling, import/restore and sensitive fields.
4. Characterization tests around critical repair workflows.
5. Define migration strategy for the new Device entity.
6. Define API contracts for future CorSystem integration.

Exit criteria:
- existing production behaviour remains stable;
- critical workflows have repeatable tests;
- sensitive-data risks have an explicit remediation plan;
- future refactors are documented and incremental.

## Milestone 1 - Device and repair domain
Goal: normalize the physical device as a first-class entity.

Target flow:
Client -> Device -> Repair

Device should eventually support:
- owner/client relationship;
- brand/model;
- IMEI/serial number;
- device type;
- identifying notes;
- repair history;
- photos where appropriate;
- created/updated timestamps.

Requirements:
- preserve existing repair records;
- backfill Device records from existing Repair data;
- do not delete legacy repair fields until compatibility is verified;
- add tests for migration and history lookup.

## Milestone 2 - Repair workflow formalization
Target workflow:
Acceptance -> Diagnosis -> Estimate -> Customer approval -> Technician -> Parts -> Work -> Testing -> Payment -> Delivery

Replace loosely defined status strings with a controlled workflow while maintaining migration compatibility.

## Milestone 3 - Frontend decomposition
Extract the current monolithic page into feature modules without redesigning everything at once.

Order:
1. clients/devices;
2. repairs;
3. catalog;
4. technicians;
5. finance/reports;
6. settings/backup.

## Milestone 4 - Inventory integration
Connect repair parts and cost data to a real stock/asset boundary. Initially keep this module local or behind an adapter so it can later integrate with ERPNext/GLPI/Snipe-IT or `corsystem-core`.

## Milestone 5 - Notifications
Introduce an internal notification interface and later connect it to `corsystem-notify` for email/SMS/WhatsApp without coupling providers to repair-domain code.

## Milestone 6 - CorSystem Platform APIs
Provide versioned APIs/webhooks for:
- clients;
- devices;
- repairs;
- repair status;
- technicians;
- payments/financial summaries where authorized.

## Milestone 7 - Customer and technician experience
- customer portal integration;
- technician-focused workflow;
- QR/status experience;
- richer audit/history.

## Milestone 8 - AI readiness
Expose safe, permission-aware retrieval endpoints for future CorSystem AI. Never expose device unlock credentials or unrestricted customer data to AI retrieval.
