import { createHash } from "node:crypto";
import { createReadStream, existsSync, openSync, closeSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function getDatabaseConfig() {
  const raw = process.env.DATABASE_URL || "";
  if (!raw) throw new Error("DATABASE_URL mancante");

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL non valida");
  }

  if (url.protocol !== "mysql:") {
    throw new Error("CorSystem deployment supporta solo DATABASE_URL mysql://");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("Nome database mancante in DATABASE_URL");

  return {
    host: url.hostname || "127.0.0.1",
    port: url.port || "3306",
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database
  };
}

export function findBinary(candidates) {
  for (const command of candidates) {
    const result = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });
    if (result.status === 0) return command;
  }
  throw new Error(`Comando non trovato: ${candidates.join(" oppure ")}`);
}

function baseMysqlArgs(config) {
  return [
    "--protocol=TCP",
    "-h", config.host,
    "-P", String(config.port),
    "-u", config.user,
    "--default-character-set=utf8mb4",
    config.database
  ];
}

function mysqlEnv(config) {
  return { ...process.env, MYSQL_PWD: config.password };
}

export function query(config, sql) {
  const command = findBinary(["mysql", "mariadb"]);
  const result = spawnSync(command, [...baseMysqlArgs(config), "-N", "-B", "-e", sql], {
    encoding: "utf8",
    env: mysqlEnv(config),
    shell: false
  });
  if (result.status !== 0) throw new Error(result.stderr || `Query MySQL fallita (${result.status})`);
  return String(result.stdout || "").trim();
}

export function execute(config, sql) {
  const command = findBinary(["mysql", "mariadb"]);
  const result = spawnSync(command, [...baseMysqlArgs(config), "-e", sql], {
    stdio: "inherit",
    env: mysqlEnv(config),
    shell: false
  });
  if (result.status !== 0) throw new Error(`Comando MySQL fallito (${result.status})`);
}

export function dumpDatabase(config, outputPath) {
  const command = findBinary(["mysqldump", "mariadb-dump"]);
  const fd = openSync(outputPath, "w", 0o600);
  try {
    const args = [
      "--protocol=TCP",
      "-h", config.host,
      "-P", String(config.port),
      "-u", config.user,
      "--single-transaction",
      "--quick",
      "--add-drop-table",
      "--hex-blob",
      "--default-character-set=utf8mb4",
      config.database
    ];
    const result = spawnSync(command, args, {
      stdio: ["ignore", fd, "inherit"],
      env: mysqlEnv(config),
      shell: false
    });
    if (result.status !== 0) throw new Error(`Dump database fallito (${result.status})`);
  } finally {
    closeSync(fd);
  }
}

export function restoreDatabase(config, inputPath) {
  if (!existsSync(inputPath)) throw new Error(`Snapshot non trovato: ${inputPath}`);
  const command = findBinary(["mysql", "mariadb"]);
  const fd = openSync(inputPath, "r");
  try {
    const result = spawnSync(command, baseMysqlArgs(config), {
      stdio: [fd, "inherit", "inherit"],
      env: mysqlEnv(config),
      shell: false
    });
    if (result.status !== 0) throw new Error(`Restore database fallito (${result.status})`);
  } finally {
    closeSync(fd);
  }
}

export async function sha256File(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function tableNames(config) {
  const rows = query(config, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  return rows ? rows.split(/\r?\n/).filter(Boolean) : [];
}

export function hasColumn(config, table, column) {
  const safeTable = String(table).replaceAll("'", "''");
  const safeColumn = String(column).replaceAll("'", "''");
  return Number(query(config, `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${safeTable}' AND COLUMN_NAME='${safeColumn}'`)) > 0;
}

export function countRows(config, table) {
  if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error(`Nome tabella non valido: ${table}`);
  return Number(query(config, `SELECT COUNT(*) FROM \`${table}\``));
}
