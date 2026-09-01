import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dumpDatabase, getDatabaseConfig, countRows, sha256File } from "./db-tools.mjs";

const config = getDatabaseConfig();
const backupRoot = path.resolve(process.env.CORSYSTEM_BACKUP_DIR || "backups/corsystem");
mkdirSync(backupRoot, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const safeDb = config.database.replace(/[^A-Za-z0-9_.-]/g, "_");
const baseName = `${stamp}-${safeDb}-predeploy`;
const dumpPath = path.join(backupRoot, `${baseName}.sql`);
const checksumPath = `${dumpPath}.sha256`;
const manifestPath = `${dumpPath}.json`;

console.log(`Creazione snapshot: ${dumpPath}`);
dumpDatabase(config, dumpPath);
const sha256 = await sha256File(dumpPath);
writeFileSync(checksumPath, `${sha256}  ${path.basename(dumpPath)}\n`, { mode: 0o600 });

const counts = {};
for (const table of ["Staff", "Client", "Repair", "Part"]) {
  try {
    counts[table] = countRows(config, table);
  } catch {
    counts[table] = null;
  }
}

const manifest = {
  createdAt: new Date().toISOString(),
  database: config.database,
  host: config.host,
  port: config.port,
  gitSha: process.env.GITHUB_SHA || process.env.CORSYSTEM_GIT_SHA || "",
  dump: path.basename(dumpPath),
  sha256,
  counts
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

console.log(JSON.stringify({ ok: true, dumpPath, checksumPath, manifestPath, sha256, counts }, null, 2));
