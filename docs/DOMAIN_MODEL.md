# CorSystem Repair Manager - Domain Model

## Current core entities
- Staff
- StaffSession
- Client
- Brand
- Model
- Service
- Part
- Technician
- AttributeGroup
- Attribute
- Repair
- RepairItem
- Payment
- Setting
- BackupSnapshot

## Current relationship summary
```text
Client 1 -> N Repair
Repair 1 -> N RepairItem
Repair 1 -> N Payment
Brand 1 -> N Model
AttributeGroup 1 -> N Attribute
Staff 1 -> N StaffSession
```

## Key modeling limitation
A physical device is currently embedded inside `Repair` through fields such as brand, model and IMEI. This makes the repair ticket act both as a service event and as the device identity.

For CorSystem, the same physical device must have a persistent history across multiple visits.

## Target domain
```text
Client 1 -> N Device
Device 1 -> N Repair
Repair 1 -> N RepairItem
Repair 1 -> N Payment
```

### Proposed Device entity
Conceptual fields:
- `id`
- `clientId`
- `type`
- `brandId` or normalized brand reference
- `modelId` or normalized model reference
- `serialNumber`
- `imei`
- `secondaryImei` where applicable
- `color`
- `notes`
- `createdAt`
- `updatedAt`

Sensitive unlock credentials should not be normal Device fields. If business requirements require temporary credential storage, model them separately with encryption, expiry and access auditing.

## Repair as service event
A Repair should represent one service lifecycle:
- ticket number;
- device reference;
- reported issue;
- intake condition/photos;
- diagnosis;
- estimate;
- customer approval;
- technician assignment;
- repair items/parts/services;
- status lifecycle;
- testing outcome;
- warranty information;
- payments;
- delivery/closure;
- audit/history.

## Migration strategy
1. Add Device without deleting existing Repair device fields.
2. Create devices from existing repairs using safe matching rules.
3. Add nullable `deviceId` to Repair.
4. Backfill relationships.
5. Update UI/API to use Device while still reading legacy values as fallback.
6. Verify history and reports.
7. Only then consider removal/deprecation of duplicated fields in a later migration.

## Future platform identifiers
Entities exposed to other CorSystem modules should retain stable immutable IDs. Avoid integrations based only on names, phone numbers, ticket display strings or mutable external labels.
