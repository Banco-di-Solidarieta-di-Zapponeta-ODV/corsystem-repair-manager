import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { execute, getDatabaseConfig, restoreDatabase, sha256File, tableNames } from "./db-tools.mjs";

const snapshotArg = process.argv[2];
if (!snapshotArg) {
  console.error("Uso: npm run deploy:rollback -- /percorso/snapshot.sql");
  process.exit(1);
}
const snapshotPath = path.resolve(snapshotArg);
if (!existsSync(snapshotPath)) {
  console.error(`✗ Snapshot non trovato: ${snapshotPath}`);
  process.exit(1);
}

const config = getDatabaseConfig();
const target = String(process.env.CORSYSTEM_ROLLBACK_TARGET || "").toLowerCase();
if (!["staging", "production"].includes(target)) {
  console.error("✗ Imposta CORSYSTEM_ROLLBACK_TARGET=staging oppure production");
  process.exit(1);
}
if (process.env.CORSYSTEM_ROLLBACK_ALLOW_DESTRUCTIVE !== "YES") {
  console.error("✗ Rollback distruttivo non autorizzato. Imposta CORSYSTEM_ROLLBACK_ALLOW_DESTRUCTIVE=YES");
  process.exit(1);
}
const expected = `RESTORE-${config.database}`;
if (process.env.CORSYSTEM_ROLLBACK_CONFIRM !== expected) {
  console.error(`✗ Conferma database errata. Per questo database serve CORSYSTEM_ROLLBACK_CONFIRM=${expected}`);
  process.exit(1);
}

const checksumPath = `${snapshotPath}.sha256`;
if (!existsSync(checksumPath)) {
  console.error(`✗ File checksum mancante: ${checksumPath}`);
  process.exit(1);
}
const expectedHash = readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
const actualHash = await sha256File(snapshotPath);
if (!expectedHash || expectedHash !== actualHash) {
  console.error("✗ Checksum snapshot non valido. Restore annullato.");
  process.exit(1);
}

const tables = tableNames(config);
if (!tables.length) {
  console.error("✗ Il database non contiene tabelle. Restore annullato per verifica manuale.");
  process.exit(1);
}

console.log(`ATTENZIONE: rollback ${target.toUpperCase()} sul database ${config.database}`);
console.log(`Snapshot verificato SHA-256: ${actualHash}`);
console.log(`Saranno rimosse ${tables.length} tabelle prima del restore.`);

const quoted = tables.map((name) => `\`${String(name).replaceAll("`", "``")}\``).join(", ");
execute(config, `SET FOREIGN_KEY_CHECKS=0; DROP TABLE IF EXISTS ${quoted}; SET FOREIGN_KEY_CHECKS=1;`);
restoreDatabase(config, snapshotPath);

const result = spawnSync("node", ["scripts/deployment/preflight.mjs", "--expect=legacy"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32"
});
if (result.status !== 0) {
  console.error("✗ Il dump è stato ripristinato, ma il preflight legacy non è passato. Non riavviare l'app nuova.");
  process.exit(result.status || 1);
}

console.log("✓ Database ripristinato allo snapshot legacy.");
console.log("Ripristina ora anche il codice/app alla release precedente, esegui npm ci/build e solo dopo riavvia il servizio.");
