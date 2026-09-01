import { spawnSync } from "node:child_process";
import { getDatabaseConfig, hasColumn, tableNames } from "./db-tools.mjs";

const BASELINE = "20260831000000_repairnote_baseline";
const config = getDatabaseConfig();
const tables = new Set(tableNames(config));

const legacySignals =
  tables.has("Staff") &&
  tables.has("Client") &&
  tables.has("Repair") &&
  tables.has("Part") &&
  !tables.has("Device") &&
  !hasColumn(config, "Repair", "deviceId") &&
  !hasColumn(config, "Staff", "role");

const currentSignals =
  tables.has("Device") &&
  hasColumn(config, "Repair", "deviceId") &&
  hasColumn(config, "Staff", "role");

if (tables.has("_prisma_migrations")) {
  console.log("✓ Registro Prisma migrations già presente. Nessuna baseline necessaria.");
  process.exit(0);
}

if (currentSignals) {
  console.error("✗ Schema CorSystem già presente ma senza registro _prisma_migrations. Interrompo: serve riconciliazione manuale prima di usare migrate deploy.");
  process.exit(1);
}

if (!legacySignals) {
  console.error("✗ Lo schema non corrisponde a un RepairNOTE legacy pulito. Baseline annullata.");
  process.exit(1);
}

console.log(`Registrazione baseline Prisma: ${BASELINE}`);
const result = spawnSync("npx", ["prisma", "migrate", "resolve", "--applied", BASELINE], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32"
});
if (result.status !== 0) process.exit(result.status || 1);

console.log("✓ Baseline RepairNOTE registrata senza modificare lo schema legacy.");
