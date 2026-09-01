import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const PASSWORD = process.env.E2E_PASSWORD || "CorSystem-E2E-Only-2026!";
const TECHNICIAN_ID = "e2e-technician-record";
const stamp = Date.now().toString().slice(-9);

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function line(label, detail = "") {
  console.log(`✓ ${label}${detail ? `: ${detail}` : ""}`);
}

class Session {
  constructor(name) {
    this.name = name;
    this.cookie = "";
  }

  async request(path, options = {}, expectedStatus = 200) {
    const headers = new Headers(options.headers || {});
    if (this.cookie) headers.set("cookie", this.cookie);
    const response = await fetch(`${BASE_URL}${path}`, { ...options, headers, redirect: "manual" });

    const setCookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
    if (setCookies.length) this.cookie = setCookies[0].split(";")[0];

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    assert(response.status === expectedStatus, `${this.name} ${path} expected HTTP ${expectedStatus}, got ${response.status}: ${typeof data === "string" ? data.slice(0, 400) : JSON.stringify(data)}`);
    return data;
  }

  async json(path, method, body, expectedStatus = 200) {
    return this.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }, expectedStatus);
  }

  async login(username) {
    await this.json("/api/auth/login", "POST", { username, password: PASSWORD }, 200);
    assert(this.cookie.includes("repairnote_session="), `${this.name} did not receive a session cookie`);
    line(`Login ${this.name}`, username);
  }
}

async function seedOperators() {
  const passwordHash = hashPassword(PASSWORD);
  const fixtures = [
    { id: "e2e-admin", name: "Admin E2E", username: "e2e-admin", role: "ADMIN", isAdmin: true, pagePermissions: ["repairs", "clients", "categories", "modules", "services", "attributes", "technicians", "reports", "finance", "settings", "backup"] },
    { id: "e2e-front", name: "Front Office E2E", username: "e2e-front", role: "FRONT_OFFICE", isAdmin: false, pagePermissions: ["repairs", "clients", "finance"] },
    { id: "e2e-tech", name: "Tecnico E2E", username: "e2e-tech", role: "TECHNICIAN", isAdmin: false, pagePermissions: ["repairs"] },
    { id: "e2e-stock", name: "Magazzino E2E", username: "e2e-stock", role: "INVENTORY", isAdmin: false, pagePermissions: ["repairs"] }
  ];

  for (const fixture of fixtures) {
    await prisma.staff.upsert({
      where: { username: fixture.username },
      update: {
        name: fixture.name,
        email: `${fixture.username}@example.test`,
        passwordHash,
        role: fixture.role,
        isAdmin: fixture.isAdmin,
        pagePermissions: fixture.pagePermissions,
        sessionTokenHash: null,
        sessionExpiresAt: null
      },
      create: {
        ...fixture,
        email: `${fixture.username}@example.test`,
        passwordHash
      }
    });
  }

  await prisma.technician.upsert({
    where: { id: TECHNICIAN_ID },
    update: { name: "Tecnico Laboratorio E2E", active: true, email: "tecnico.e2e@example.test" },
    create: {
      id: TECHNICIAN_ID,
      name: "Tecnico Laboratorio E2E",
      phone: "3209999999",
      email: "tecnico.e2e@example.test",
      color: "#16a34a",
      active: true,
      sortOrder: 1
    }
  });

  line("Operatori fittizi creati", "Admin / Front Office / Tecnico / Magazzino");
}

async function waitForServer() {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/me`, { redirect: "manual" });
      if (response.status === 200 || response.status === 401) {
        line("Server CorSystem raggiungibile", BASE_URL);
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server non raggiungibile su ${BASE_URL}`);
}

async function main() {
  await seedOperators();
  await waitForServer();

  const admin = new Session("Amministratore");
  const front = new Session("Front Office");
  const tech = new Session("Tecnico");
  const stock = new Session("Magazzino");
  const anonymous = new Session("Cliente pubblico");

  await admin.login("e2e-admin");
  const staffMeta = await admin.request("/api/staff?meta=1");
  assert(Array.isArray(staffMeta.roles) && staffMeta.roles.length >= 4, "role metadata missing");
  line("Gestione ruoli amministratore verificata");

  await front.login("e2e-front");

  const intake = await front.json("/api/intake", "POST", {
    client: {
      name: "Mario Collaudo",
      phone: `320${stamp.slice(-7)}`,
      email: `mario.collaudo.${stamp}@example.test`,
      docType: "CF",
      identity: `TEST${stamp}`,
      address: "Via Test 1, Zapponeta"
    },
    device: {
      type: "Smartphone",
      brand: "Samsung",
      model: "Galaxy S25",
      imei: `35${stamp.padStart(13, "0")}`.slice(0, 15),
      serialNumber: `E2E-S25-${stamp}`,
      color: "Nero",
      notes: "Dispositivo fittizio per collaudo end-to-end"
    },
    reportedIssue: "Display rotto dopo urto, touch parzialmente funzionante",
    initialCondition: ["Display rotto", "Segni di urto"],
    accessories: ["Custodia"],
    notes: "Prova completa fittizia CorSystem",
    internalNote: "E2E CI, nessun dispositivo reale",
    technicianId: TECHNICIAN_ID,
    frontPhoto: "",
    backPhoto: "",
    signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    privacyAccepted: true
  });

  const repairId = intake.repair.id;
  const repairToken = intake.repair.publicToken;
  assert(/^CS-\d{4}-\d{5}$/.test(intake.repair.ticket), `unexpected ticket ${intake.repair.ticket}`);
  line("Accettazione Front Office", intake.repair.ticket);

  await front.request(`/ricevuta/${encodeURIComponent(repairId)}`, {}, 200);
  line("Ricevuta A4 renderizzata");

  await front.json(`/api/workflow/${encodeURIComponent(repairId)}`, "PUT", {
    diagnosis: { status: "FINAL", findings: "Tentativo non autorizzato dal Front Office" }
  }, 403);
  line("Permesso negato correttamente", "Front Office non può chiudere la diagnosi");

  await tech.login("e2e-tech");
  await tech.json(`/api/workflow/${encodeURIComponent(repairId)}`, "PUT", {
    diagnosis: {
      status: "FINAL",
      technicianId: TECHNICIAN_ID,
      findings: "Pannello OLED danneggiato, touch instabile. Scheda logica funzionante.",
      rootCause: "Danno meccanico da urto sul gruppo display.",
      proposedWork: "Sostituzione completa del gruppo display OLED e collaudo finale.",
      partsNeeded: "1 display OLED Samsung Galaxy S25 compatibile.",
      testsPerformed: "Accensione, ricarica, rete, audio e diagnostica di base.",
      riskNotes: "Nessuna anomalia aggiuntiva rilevata nel test iniziale.",
      customerSummary: "Il display è danneggiato e va sostituito. Il resto del dispositivo risulta operativo nei test eseguiti."
    }
  });
  line("Diagnosi tecnica finalizzata", "ATTESA_PREVENTIVO");

  const quoteCreated = await tech.json(`/api/workflow/${encodeURIComponent(repairId)}`, "POST", {
    action: "quote-create",
    quote: {
      title: "Sostituzione display Samsung Galaxy S25",
      customerMessage: "Sostituzione display OLED e collaudo completo del dispositivo.",
      internalNote: "Preventivo fittizio E2E",
      estimatedDays: 2,
      discountAmount: 0,
      items: [
        {
          type: "part",
          description: "Display OLED Samsung Galaxy S25",
          qty: 1,
          unitPrice: 129,
          unitCost: 50
        }
      ]
    }
  });
  assert(Number(quoteCreated.quote.total) === 129, "quote total should be 129 EUR");

  const quoteId = quoteCreated.quote.id;
  const quoteItemId = quoteCreated.quote.items[0].id;
  const quoteSent = await tech.json(`/api/workflow/${encodeURIComponent(repairId)}`, "POST", {
    action: "quote-send",
    quoteId
  });
  const quoteToken = quoteSent.quote.publicToken;
  line("Preventivo v1 inviato", "€129,00");

  await anonymous.request(`/preventivo/${encodeURIComponent(quoteToken)}`, {}, 200);
  const customerApproval = await anonymous.json(`/api/quotes/${encodeURIComponent(quoteToken)}/response`, "POST", {
    response: "APPROVED",
    customerNote: "Preventivo fittizio approvato per il test E2E"
  });
  assert(customerApproval.repairStatus === "AUTORIZZATO", "approved quote should authorize repair");
  line("Cliente fittizio approva preventivo", "AUTORIZZATO");

  await front.json("/api/inventory", "POST", {
    action: "part-save",
    part: { defaultName: "Tentativo non autorizzato" }
  }, 403);
  line("Permesso negato correttamente", "Front Office non può modificare il magazzino");

  await stock.login("e2e-stock");
  const supplierResult = await stock.json("/api/inventory", "POST", {
    action: "supplier-save",
    supplier: {
      name: `Fornitore E2E ${stamp}`,
      email: `fornitore.${stamp}@example.test`,
      phone: "0884000000",
      notes: "Fornitore fittizio CI"
    }
  });
  const partResult = await stock.json("/api/inventory", "POST", {
    action: "part-save",
    part: {
      defaultName: "Display OLED Samsung Galaxy S25",
      category: "Display",
      sku: `E2E-S25-${stamp}`,
      supplierId: supplierResult.supplier.id,
      price: 129,
      cost: 50,
      minStock: 1,
      location: "E2E-A1",
      active: true
    }
  });
  const partId = partResult.part.id;
  line("Articolo e fornitore creati dal Magazzino");

  const requested = await tech.json(`/api/inventory/repair/${encodeURIComponent(repairId)}`, "POST", {
    action: "request",
    partId,
    quoteItemId,
    qtyRequested: 1,
    notes: "Ricambio necessario per prova E2E"
  });
  const repairPartId = requested.repairPart.id;
  assert(requested.repairStatus === "ATTESA_RICAMBIO", "part request should put repair in waiting state");
  line("Tecnico richiede ricambio", "ATTESA_RICAMBIO");

  await stock.json(`/api/inventory/repair/${encodeURIComponent(repairId)}`, "POST", {
    action: "order",
    repairPartId,
    orderReference: `ORD-E2E-${stamp}`
  });
  const received = await stock.json(`/api/inventory/repair/${encodeURIComponent(repairId)}`, "POST", {
    action: "receive",
    repairPartId,
    quantity: 1,
    unitCost: 50,
    reference: `DDT-E2E-${stamp}`
  });
  assert(["AUTORIZZATO", "IN_LAVORAZIONE"].includes(received.repairStatus), `unexpected status after receipt ${received.repairStatus}`);
  line("Magazzino ordina e riceve display", "1 pz a €50,00");

  const used = await tech.json(`/api/inventory/repair/${encodeURIComponent(repairId)}`, "POST", {
    action: "use",
    repairPartId,
    quantity: 1
  });
  assert(used.repairStatus === "IN_LAVORAZIONE", "using part should start working status");
  assert(Number(used.costAmount) === 50, "repair cost should be 50 EUR");
  line("Tecnico utilizza ricambio", "IN_LAVORAZIONE");

  const checklist = {
    power: "PASS",
    charging: "PASS",
    display: "PASS",
    audio: "PASS",
    camera: "PASS",
    connectivity: "PASS",
    sensors: "PASS",
    ports: "PASS",
    specific: "PASS"
  };
  const testDraft = await tech.json(`/api/completion/${encodeURIComponent(repairId)}`, "POST", {
    action: "test-save",
    checklist,
    notes: "Tutti i controlli fittizi superati"
  });
  await tech.json(`/api/completion/${encodeURIComponent(repairId)}`, "POST", {
    action: "test-complete",
    testId: testDraft.test.id,
    checklist,
    notes: "Collaudo E2E superato"
  });
  const ready = await tech.json(`/api/completion/${encodeURIComponent(repairId)}`, "POST", {
    action: "mark-ready"
  });
  assert(ready.repairStatus === "PRONTO", "repair should be ready after passed test");
  line("Collaudo tecnico superato", "PRONTO");

  await tech.json(`/api/completion/${encodeURIComponent(repairId)}`, "POST", {
    action: "payment-add",
    amount: 129,
    method: "cash"
  }, 403);
  line("Permesso negato correttamente", "Tecnico non può registrare pagamenti");

  const techStaffDenied = await tech.request("/api/staff?meta=1", {}, 403);
  assert(techStaffDenied?.error, "staff endpoint should return permission error");
  line("Permesso negato correttamente", "Tecnico non può gestire operatori");

  await front.json(`/api/completion/${encodeURIComponent(repairId)}`, "POST", {
    action: "payment-add",
    amount: 129,
    method: "cash",
    note: "Saldo fittizio E2E"
  });
  line("Front Office registra saldo", "€129,00 contanti");

  const delivered = await front.json(`/api/completion/${encodeURIComponent(repairId)}`, "POST", {
    action: "deliver",
    handedTo: "Mario Collaudo",
    warrantyMonths: 6,
    settlementMode: "PAID",
    note: "Consegna fittizia conclusiva E2E"
  });
  assert(delivered.repairStatus === "CONSEGNATO", "delivery should close repair");
  line("Front Office consegna dispositivo", "CONSEGNATO");

  const finalState = await front.request(`/api/completion/${encodeURIComponent(repairId)}`);
  assert(finalState.repair.status === "CONSEGNATO", "final API state should be CONSEGNATO");
  assert(Number(finalState.repair.finalAmount) === 129, "final amount should be 129 EUR");
  assert(Number(finalState.repair.finalCostAmount) === 50, "final cost should be 50 EUR");
  assert(Number(finalState.repair.finalMargin) === 79, "final margin should be 79 EUR");
  assert(Number(finalState.financial.balance) === 0, "final balance should be zero");
  line("Snapshot economico finale verificato", "ricavo €129 / costo €50 / margine €79");

  await anonymous.request(`/stato/${encodeURIComponent(repairToken)}`, {}, 200);
  line("Portale stato cliente pubblico renderizzato");

  const frontDashboard = await front.request("/api/dashboard-operativo");
  assert(frontDashboard.visibility?.finance === false, "Front Office must not receive dashboard finance data");
  assert(frontDashboard.financial30d === null, "Front Office dashboard financial block should be null");
  line("Dashboard Front Office senza margini economici verificata");

  const adminDashboard = await admin.request("/api/dashboard-operativo");
  assert(adminDashboard.visibility?.finance === true, "Admin should receive dashboard finance data");
  assert(adminDashboard.financial30d, "Admin financial dashboard block missing");
  line("Dashboard Amministratore con dati economici verificata");

  await front.request("/api/notifications?limit=20", {}, 200);
  line("Console notifiche Front Office raggiungibile");

  console.log("\n=== PROVA COMPLETA FITTIZIA CORSYSTEM: SUCCESS ===");
  console.log(`Pratica: ${intake.repair.ticket}`);
  console.log("Cliente: Mario Collaudo (fittizio)");
  console.log("Dispositivo: Samsung Galaxy S25 (fittizio)");
  console.log("Preventivo: €129,00");
  console.log("Costo ricambio: €50,00");
  console.log("Margine finale: €79,00");
  console.log("Stato finale: CONSEGNATO");
}

main()
  .catch((error) => {
    console.error("\n=== PROVA COMPLETA FITTIZIA CORSYSTEM: FAILED ===");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
