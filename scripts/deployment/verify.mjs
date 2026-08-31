import { getDatabaseConfig, hasColumn, tableNames, countRows, query } from "./db-tools.mjs";

const config = getDatabaseConfig();
const tables = new Set(tableNames(config));
const requiredTables = [
  "_prisma_migrations",
  "Staff", "Client", "Repair", "Part", "Device", "Diagnosis", "Quote", "QuoteItem",
  "Supplier", "RepairPart", "StockMovement", "RepairTest", "DeliveryRecord", "Notification"
];
const missingTables = requiredTables.filter((table) => !tables.has(table));
const requiredColumns = [
  ["Repair", "deviceId"],
  ["Repair", "readyAt"],
  ["Repair", "deliveredAt"],
  ["Staff", "role"],
  ["Part", "sku"],
  ["Part", "stockQty"]
];
const missingColumns = requiredColumns.filter(([table, column]) => !hasColumn(config, table, column));

if (missingTables.length || missingColumns.length) {
  console.error(JSON.stringify({
    ok: false,
    missingTables,
    missingColumns: missingColumns.map(([table, column]) => `${table}.${column}`)
  }, null, 2));
  process.exit(1);
}

const counts = Object.fromEntries(
  ["Staff", "Client", "Repair", "Part", "Device", "Quote", "Supplier", "Notification"].map((table) => [table, countRows(config, table)])
);
const repairsWithoutDevice = Number(query(config, "SELECT COUNT(*) FROM Repair WHERE deviceId IS NULL"));
const invalidStaffRoles = Number(query(config, "SELECT COUNT(*) FROM Staff WHERE role NOT IN ('ADMIN','FRONT_OFFICE','TECHNICIAN','INVENTORY','CUSTOM')"));
const migrationCount = countRows(config, "_prisma_migrations");

if (invalidStaffRoles > 0) {
  console.error(`✗ Trovati ${invalidStaffRoles} ruoli Staff non riconosciuti`);
  process.exit(1);
}
if (migrationCount < 7) {
  console.error(`✗ Registro Prisma incompleto: attese almeno 7 migrazioni, trovate ${migrationCount}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  database: config.database,
  host: config.host,
  counts,
  diagnostics: {
    repairsWithoutDevice,
    invalidStaffRoles,
    migrationCount
  }
}, null, 2));
