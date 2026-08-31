import { getDatabaseConfig, hasColumn, tableNames, countRows } from "./db-tools.mjs";

const LEGACY_TABLES = ["Staff", "Client", "Repair", "Part"];
const CURRENT_TABLES = ["Device", "Diagnosis", "Quote", "Supplier", "RepairPart", "StockMovement", "RepairTest", "DeliveryRecord", "Notification"];

function expectedMode() {
  const raw = process.argv.find((arg) => arg.startsWith("--expect="));
  return raw ? raw.split("=")[1] : "compatible";
}

export function runPreflight(expect = "compatible") {
  const config = getDatabaseConfig();
  const tables = new Set(tableNames(config));
  const missingLegacy = LEGACY_TABLES.filter((name) => !tables.has(name));
  if (missingLegacy.length) {
    throw new Error(`Database non riconosciuto come RepairNOTE: mancano ${missingLegacy.join(", ")}`);
  }

  const currentSignals = {
    deviceTable: tables.has("Device"),
    repairDeviceId: hasColumn(config, "Repair", "deviceId"),
    staffRole: hasColumn(config, "Staff", "role")
  };
  const isCurrent = currentSignals.deviceTable && currentSignals.repairDeviceId && currentSignals.staffRole;
  const isLegacy = !currentSignals.deviceTable && !currentSignals.repairDeviceId && !currentSignals.staffRole;

  if (expect === "legacy" && !isLegacy) {
    throw new Error("Il database non è nello stato legacy atteso. Interrompo per evitare una doppia migrazione.");
  }
  if (expect === "current") {
    const missingCurrent = CURRENT_TABLES.filter((name) => !tables.has(name));
    if (!isCurrent || missingCurrent.length) {
      throw new Error(`Schema CorSystem incompleto. Tabelle mancanti: ${missingCurrent.join(", ") || "nessuna"}`);
    }
  }
  if (expect === "compatible" && !isLegacy && !isCurrent) {
    throw new Error("Schema parzialmente migrato rilevato. Serve verifica manuale o rollback prima di proseguire.");
  }

  const counts = Object.fromEntries(LEGACY_TABLES.map((table) => [table, countRows(config, table)]));
  const result = {
    database: config.database,
    host: config.host,
    state: isCurrent ? "current" : "legacy",
    counts,
    signals: currentSignals
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

try {
  runPreflight(expectedMode());
} catch (error) {
  console.error(`✗ Preflight CorSystem: ${error.message}`);
  process.exit(1);
}
