import { spawnSync } from "node:child_process";

const target = String(process.env.CORSYSTEM_DEPLOY_TARGET || "").toLowerCase();
if (!["staging", "production"].includes(target)) {
  console.error("✗ Imposta CORSYSTEM_DEPLOY_TARGET=staging oppure production");
  process.exit(1);
}

const expectedConfirmation = target === "production" ? "APPLY-PRODUCTION" : "APPLY-STAGING";
if (process.env.CORSYSTEM_DEPLOY_CONFIRM !== expectedConfirmation) {
  console.error(`✗ Conferma mancante. Imposta CORSYSTEM_DEPLOY_CONFIRM=${expectedConfirmation}`);
  process.exit(1);
}

function run(command, args, extraEnv = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`CorSystem deploy protetto → ${target.toUpperCase()}`);
console.log("1/7 Preflight database");
run("node", ["scripts/deployment/preflight.mjs", "--expect=compatible"]);

console.log("2/7 Audit dipendenze");
run("npm", ["audit", "--audit-level=high"]);

console.log("3/7 Validazione e build PRIMA di toccare il database");
run("npx", ["prisma", "validate"]);
run("npm", ["run", "build"]);

console.log("4/7 Snapshot pre-deploy con checksum");
run("node", ["scripts/deployment/snapshot.mjs"]);

console.log("5/7 Applicazione migrazioni Prisma");
run("npx", ["prisma", "migrate", "deploy"]);

console.log("6/7 Generazione Prisma Client");
run("npx", ["prisma", "generate"]);

console.log("7/7 Verifica post-migrazione");
run("node", ["scripts/deployment/verify.mjs"]);

console.log(`\n✓ Deploy database ${target} completato.`);
console.log("Riavvia ora l'applicazione Node.js/Plesk e completa lo smoke test operativo prima di riaprire agli utenti.");
