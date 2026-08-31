import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  countRows,
  execute,
  getDatabaseConfig,
  restoreDatabase,
  sha256File,
  tableNames
} from "./db-tools.mjs";

const dumpArg = process.argv.find((arg) => arg.startsWith("--dump="));
const reportArg = process.argv.find((arg) => arg.startsWith("--report="));
const dumpPath = dumpArg ? path.resolve(dumpArg.slice("--dump=".length)) : "";
const reportPath = reportArg
  ? path.resolve(reportArg.slice("--report=".length))
  : path.resolve("reports", `staging-real-dump-${new Date().toISOString().replaceAll(":", "-")}.json`);

if (!dumpPath || !existsSync(dumpPath)) {
  console.error("✗ Specifica un dump SQL esistente con --dump=/percorso/backup.sql");
  process.exit(1);
}

const config = getDatabaseConfig();
const safeDbPattern = /(staging|stage|test|ci|sandbox|clone|copy)/i;
if (!safeDbPattern.test(config.database)) {
  console.error(`✗ Database '${config.database}' rifiutato: il nome deve indicare chiaramente staging/test/clone/copy.`);
  process.exit(1);
}

const expectedConfirmation = `REPLACE-STAGING-${config.database}`;
if (process.env.CORSYSTEM_STAGING_IMPORT_CONFIRM !== expectedConfirmation) {
  console.error(`✗ Conferma mancante. Imposta CORSYSTEM_STAGING_IMPORT_CONFIRM=${expectedConfirmation}`);
  process.exit(1);
}

const preview = readFileSync(dumpPath, { encoding: "utf8" });
const forbidden = [
  /\bCREATE\s+DATABASE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /^\s*USE\s+[`'\"]?/im
];
for (const pattern of forbidden) {
  if (pattern.test(preview)) {
    console.error(`✗ Dump rifiutato: contiene istruzione non ammessa (${pattern}). Esporta il solo database senza CREATE/DROP DATABASE o USE.`);
    process.exit(1);
  }
}

const dumpSha256 = await sha256File(dumpPath);
const startedAt = new Date().toISOString();

function run(command, args, extraEnv = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function safeCounts() {
  const tables = new Set(tableNames(config));
  const result = {};
  for (const table of ["Staff", "Client", "Repair", "Part"]) {
    result[table] = tables.has(table) ? countRows(config, table) : null;
  }
  return result;
}

function dropAllTables() {
  const tables = tableNames(config);
  if (!tables.length) return;
  const statements = [
    "SET FOREIGN_KEY_CHECKS=0",
    ...tables.map((table) => `DROP TABLE IF EXISTS \`${String(table).replaceAll("`", "``")}\``),
    "SET FOREIGN_KEY_CHECKS=1"
  ];
  execute(config, statements.join(";\n") + ";");
}

console.log("CorSystem staging rehearsal da dump reale");
console.log(JSON.stringify({ database: config.database, host: config.host, dumpPath, dumpSha256 }, null, 2));

console.log("\n1/6 Pulizia esclusiva del database di staging");
dropAllTables();

console.log("2/6 Restore dump RepairNOTE nel database di staging");
restoreDatabase(config, dumpPath);

console.log("3/6 Preflight legacy e fotografia conteggi");
run("node", ["scripts/deployment/preflight.mjs", "--expect=legacy"]);
const legacyCounts = safeCounts();

console.log("4/6 Deploy CorSystem protetto sul clone");
run("node", ["scripts/deployment/deploy.mjs"], {
  CORSYSTEM_DEPLOY_TARGET: "staging",
  CORSYSTEM_DEPLOY_CONFIRM: "APPLY-STAGING"
});

console.log("5/6 Verifica CorSystem e confronto conteggi");
run("node", ["scripts/deployment/verify.mjs"]);
const migratedCounts = safeCounts();

const preservation = Object.fromEntries(
  Object.keys(legacyCounts).map((table) => [
    table,
    legacyCounts[table] === migratedCounts[table]
  ])
);
const preserved = Object.values(preservation).every(Boolean);

const report = {
  ok: preserved,
  startedAt,
  completedAt: new Date().toISOString(),
  database: config.database,
  host: config.host,
  dump: {
    path: dumpPath,
    sha256: dumpSha256
  },
  legacyCounts,
  migratedCounts,
  preservation
};

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });

console.log("6/6 Report staging");
console.log(JSON.stringify(report, null, 2));
console.log(`Report scritto in: ${reportPath}`);

if (!preserved) {
  console.error("✗ NO-GO: almeno un conteggio chiave è cambiato durante la migrazione.");
  process.exit(2);
}

console.log("\n✓ GO tecnico preliminare: i conteggi chiave Staff/Client/Repair/Part sono preservati.");
console.log("Eseguire ora i controlli funzionali/UI e il campionamento manuale prima di qualsiasi produzione.");
