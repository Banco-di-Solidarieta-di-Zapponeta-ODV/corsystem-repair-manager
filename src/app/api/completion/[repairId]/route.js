import { authErrorResponse, hasCapability, requireAnyCapability, requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES } from "@/features/access/roles";
import { notifyRepairEvent } from "@/features/notifications/server";
import {
  PAYMENT_METHODS,
  addMonths,
  checklistCanPass,
  money,
  normalizeChecklist
} from "@/features/completion/domain";

const TEST_START_STATUSES = new Set(["IN_LAVORAZIONE", "IN_TEST"]);

export async function GET(_request, { params }) {
  try {
    const staff = await requireAnyCapability([
      CAPABILITIES.REPAIR_VIEW,
      CAPABILITIES.FINAL_TEST_MANAGE,
      CAPABILITIES.PAYMENT_MANAGE,
      CAPABILITIES.DELIVERY_MANAGE
    ]);
    const { repairId } = await params;
    const repair = await loadRepair(repairId);
    if (!repair) throwHttpError(404, "Pratica non trovata");
    return Response.json(buildPayload(repair, staff));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const staff = await requireStaff();
    const { repairId } = await params;
    const body = await request.json();
    const action = String(body?.action || "").trim();

    if (["test-save", "test-complete", "mark-ready"].includes(action)) {
      requireLocalCapability(staff, CAPABILITIES.FINAL_TEST_MANAGE);
    } else if (action === "payment-add") {
      requireLocalCapability(staff, CAPABILITIES.PAYMENT_MANAGE);
    } else if (action === "deliver") {
      requireLocalCapability(staff, CAPABILITIES.DELIVERY_MANAGE);
    } else {
      throwHttpError(400, "Azione di chiusura non valida");
    }

    if (action === "test-save") return Response.json(await saveTest(repairId, body, staff));
    if (action === "test-complete") return Response.json(await completeTest(repairId, body, staff));
    if (action === "mark-ready") {
      const result = await markReady(repairId, staff);
      const notification = await notifyRepairEvent(repairId, "READY", { dedupeSuffix: "ready" })
        .catch((error) => ({ error: String(error?.message || error) }));
      return Response.json({ ...result, notification });
    }
    if (action === "payment-add") return Response.json(await addPayment(repairId, body, staff));
    if (action === "deliver") {
      const result = await deliverRepair(repairId, body, staff);
      const notification = await notifyRepairEvent(repairId, "DELIVERED", {
        amount: Number(result.finalAmount || 0),
        dedupeSuffix: result.delivery?.id || "delivered"
      }).catch((error) => ({ error: String(error?.message || error) }));
      return Response.json({ ...result, notification });
    }

    throwHttpError(400, "Azione di chiusura non valida");
  } catch (error) {
    return authErrorResponse(error);
  }
}

async function saveTest(repairId, body, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUnique({ where: { id: repairId } });
    if (!repair) throwHttpError(404, "Pratica non trovata");
    if (!TEST_START_STATUSES.has(repair.status)) {
      throwHttpError(409, "La pratica deve essere in lavorazione o in test");
    }

    const checklist = normalizeChecklist(body.checklist);
    const testId = String(body.testId || "").trim();
    let result;
    if (testId) {
      const existing = await tx.repairTest.findFirst({ where: { id: testId, repairId } });
      if (!existing) throwHttpError(404, "Sessione test non trovata");
      if (existing.status !== "DRAFT") throwHttpError(409, "Un test già concluso non può essere modificato");
      result = await tx.repairTest.update({
        where: { id: testId },
        data: {
          checklist,
          notes: String(body.notes || "").trim().slice(0, 10000),
          technicianId: repair.technicianId || "",
          technicianName: repair.technicianName || ""
        }
      });
    } else {
      result = await tx.repairTest.create({
        data: {
          repairId,
          status: "DRAFT",
          checklist,
          notes: String(body.notes || "").trim().slice(0, 10000),
          technicianId: repair.technicianId || "",
          technicianName: repair.technicianName || "",
          createdBy: staffLabel(staff)
        }
      });
    }

    if (repair.status !== "IN_TEST") {
      await tx.repair.update({
        where: { id: repairId },
        data: statusPatch(repair, "IN_TEST", "final-test-started", staff)
      });
    }
    return { test: result, repairStatus: "IN_TEST" };
  });
}

async function completeTest(repairId, body, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUnique({ where: { id: repairId } });
    if (!repair) throwHttpError(404, "Pratica non trovata");
    if (repair.status !== "IN_TEST") throwHttpError(409, "La pratica non è in fase di test");

    const testId = String(body.testId || "").trim();
    const test = await tx.repairTest.findFirst({ where: { id: testId, repairId } });
    if (!test) throwHttpError(404, "Sessione test non trovata");
    if (test.status !== "DRAFT") throwHttpError(409, "Questo test è già concluso");

    const checklist = normalizeChecklist(body.checklist || test.checklist);
    const passed = checklistCanPass(checklist);
    const status = passed ? "PASSED" : "FAILED";
    const completed = await tx.repairTest.update({
      where: { id: test.id },
      data: {
        status,
        checklist,
        notes: String(body.notes ?? test.notes ?? "").trim().slice(0, 10000),
        completedAt: new Date(),
        technicianId: repair.technicianId || test.technicianId || "",
        technicianName: repair.technicianName || test.technicianName || ""
      }
    });

    if (!passed) {
      await tx.repair.update({
        where: { id: repairId },
        data: statusPatch(repair, "IN_LAVORAZIONE", "final-test-failed", staff, { testId: test.id })
      });
      return { test: completed, repairStatus: "IN_LAVORAZIONE" };
    }

    return { test: completed, repairStatus: "IN_TEST" };
  });
}

async function markReady(repairId, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUnique({ where: { id: repairId } });
    if (!repair) throwHttpError(404, "Pratica non trovata");
    if (repair.status !== "IN_TEST") throwHttpError(409, "La pratica deve essere in test");

    const lastTest = await tx.repairTest.findFirst({
      where: { repairId, status: { in: ["PASSED", "FAILED"] } },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }]
    });
    if (!lastTest || lastTest.status !== "PASSED") {
      throwHttpError(409, "Serve un test finale superato prima di segnare la pratica come pronta");
    }

    const now = new Date();
    const updated = await tx.repair.update({
      where: { id: repairId },
      data: {
        ...statusPatch(repair, "PRONTO", "repair-ready", staff, { testId: lastTest.id }),
        readyAt: now,
        notificationLog: appendJsonArray(repair.notificationLog, {
          type: "repair-ready",
          channel: "portal",
          status: "ready",
          at: now.toISOString(),
          by: staffLabel(staff)
        })
      }
    });
    return { repairStatus: updated.status, readyAt: updated.readyAt };
  });
}

async function addPayment(repairId, body, staff) {
  const amount = money(body.amount);
  if (amount <= 0) throwHttpError(400, "Inserisci un importo maggiore di zero");
  const method = String(body.method || "cash").trim();
  if (!PAYMENT_METHODS.includes(method)) throwHttpError(400, "Metodo di pagamento non valido");
  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) throwHttpError(400, "Data pagamento non valida");

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUnique({
      where: { id: repairId },
      include: {
        quotes: { where: { status: "APPROVED" }, orderBy: { version: "desc" }, take: 1 },
        payments: { orderBy: { paidAt: "asc" } }
      }
    });
    if (!repair) throwHttpError(404, "Pratica non trovata");
    const financial = financialSummary(repair);
    if (financial.amountDue <= 0) throwHttpError(409, "La pratica non ha un importo da incassare");
    if (amount > financial.balance + 0.009) {
      throwHttpError(409, `Importo superiore al saldo residuo di € ${financial.balance.toFixed(2)}`);
    }

    let legacyMaterialized = false;
    if (!repair.payments.length && Number(repair.deposit || 0) > 0.009) {
      await tx.payment.create({
        data: {
          repairId,
          amount: money(repair.deposit),
          method: legacyPaymentMethod(repair.paymentMethod),
          note: "Acconto storico RepairNOTE",
          paidAt: legacyPaymentDate(repair.repairTime, repair.createdAt),
          createdBy: "Migrazione compatibilità CorSystem"
        }
      });
      legacyMaterialized = true;
    }

    const payment = await tx.payment.create({
      data: {
        repairId,
        amount,
        method,
        note: String(body.note || "").trim().slice(0, 191),
        paidAt,
        createdBy: staffLabel(staff)
      }
    });
    return { payment, legacyMaterialized };
  });
}

async function deliverRepair(repairId, body, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUnique({
      where: { id: repairId },
      include: {
        client: { select: { id: true, name: true } },
        quotes: { where: { status: "APPROVED" }, orderBy: { version: "desc" }, take: 1 },
        payments: { orderBy: { paidAt: "asc" } },
        delivery: true
      }
    });
    if (!repair) throwHttpError(404, "Pratica non trovata");
    if (repair.delivery || repair.status === "CONSEGNATO") throwHttpError(409, "La pratica risulta già consegnata");
    if (repair.status !== "PRONTO") throwHttpError(409, "La pratica deve essere pronta per il ritiro");

    const financial = financialSummary(repair);
    const requestedMode = String(body.settlementMode || "PAID").toUpperCase();
    let settlementMode = financial.balance <= 0.009 ? "PAID" : requestedMode;
    const note = String(body.note || "").trim().slice(0, 10000);

    if (financial.balance > 0.009) {
      if (settlementMode !== "CREDIT") {
        throwHttpError(409, `Saldo residuo € ${financial.balance.toFixed(2)}. Registra il pagamento prima della consegna.`);
      }
      if (!staff?.isAdmin) throwHttpError(403, "La consegna con saldo aperto richiede un amministratore");
      if (!note) throwHttpError(400, "Per la consegna a credito inserisci una nota con la motivazione");
    } else {
      settlementMode = "PAID";
    }

    const deliveredAt = new Date();
    const warrantyMonths = Math.max(0, Math.min(60, Math.trunc(Number(body.warrantyMonths || 0))));
    const warrantyUntil = addMonths(deliveredAt, warrantyMonths);
    const finalCostAmount = money(repair.costAmount);
    const finalAmount = financial.amountDue;
    const finalMargin = money(finalAmount - finalCostAmount);
    const handedTo = String(body.handedTo || repair.client?.name || "Cliente").trim().slice(0, 191);
    if (!handedTo) throwHttpError(400, "Indica a chi viene consegnato il dispositivo");

    const delivery = await tx.deliveryRecord.create({
      data: {
        repairId,
        handedTo,
        note,
        settlementMode,
        amountDue: finalAmount,
        amountPaid: financial.amountPaid,
        balanceAtDelivery: financial.balance,
        warrantyMonths,
        warrantyUntil,
        deliveredAt,
        createdBy: staffLabel(staff)
      }
    });

    await tx.repair.update({
      where: { id: repairId },
      data: {
        ...statusPatch(repair, "CONSEGNATO", "repair-delivered", staff, {
          settlementMode,
          balanceAtDelivery: financial.balance
        }),
        deliveredAt,
        warrantyUntil,
        warrantyStart: warrantyMonths ? deliveredAt.toISOString().slice(0, 10) : repair.warrantyStart,
        finalAmount,
        finalCostAmount,
        finalMargin,
        notificationLog: appendJsonArray(repair.notificationLog, {
          type: "repair-delivered",
          channel: "portal",
          status: "delivered",
          at: deliveredAt.toISOString(),
          by: staffLabel(staff)
        })
      }
    });

    return { delivery, finalAmount, finalCostAmount, finalMargin, repairStatus: "CONSEGNATO" };
  });
}

async function loadRepair(repairId) {
  return prisma.repair.findUnique({
    where: { id: repairId },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      device: { select: { id: true, type: true, brand: true, model: true, imei: true, serialNumber: true } },
      quotes: { where: { status: "APPROVED" }, orderBy: { version: "desc" }, take: 1 },
      payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
      repairParts: { include: { part: { select: { id: true, defaultName: true, sku: true } } } },
      finalTests: { orderBy: [{ createdAt: "desc" }] },
      delivery: true
    }
  });
}

function buildPayload(repair, staff) {
  const canTest = hasCapability(staff, CAPABILITIES.FINAL_TEST_MANAGE);
  const canPay = hasCapability(staff, CAPABILITIES.PAYMENT_MANAGE);
  const canDeliver = hasCapability(staff, CAPABILITIES.DELIVERY_MANAGE);
  const canSeeFinance = canPay || canDeliver || staff?.isAdmin;
  const financial = canSeeFinance ? financialSummary(repair) : null;
  const safeRepair = canSeeFinance
    ? repair
    : {
        ...repair,
        budget: null,
        deposit: null,
        paymentMethod: null,
        costAmount: null,
        finalAmount: null,
        finalCostAmount: null,
        finalMargin: null,
        quotes: [],
        payments: []
      };

  return {
    repair: safeRepair,
    financial,
    legacyDepositUsed: canSeeFinance ? repair.payments.length === 0 && Number(repair.deposit || 0) > 0 : false,
    permissions: {
      finalTest: canTest,
      payment: canPay,
      delivery: canDeliver,
      finance: canSeeFinance
    }
  };
}

function financialSummary(repair) {
  const approved = repair.quotes?.[0];
  const amountDue = money(Number(repair.finalAmount || 0) > 0 ? repair.finalAmount : (approved?.total ?? repair.budget));
  const paymentRows = Array.isArray(repair.payments) ? repair.payments : [];
  const paymentTotal = money(paymentRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const legacyDeposit = paymentRows.length ? 0 : money(repair.deposit);
  const amountPaid = money(paymentTotal + legacyDeposit);
  const balance = money(Math.max(0, amountDue - amountPaid));
  return {
    amountDue,
    amountPaid,
    balance,
    costAmount: money(repair.costAmount),
    projectedMargin: money(amountDue - money(repair.costAmount))
  };
}

function legacyPaymentMethod(value) {
  const method = String(value || "").toLowerCase();
  if (method === "cash") return "cash";
  if (method === "card") return "card";
  return "other";
}

function legacyPaymentDate(repairTime, createdAt) {
  const candidate = repairTime ? new Date(repairTime) : new Date(createdAt);
  return Number.isNaN(candidate.getTime()) ? new Date() : candidate;
}

function statusPatch(repair, status, type, staff, extra = {}) {
  return {
    status,
    statusHistory: appendJsonArray(repair.statusHistory, {
      status,
      type,
      at: new Date().toISOString(),
      by: staffLabel(staff),
      ...extra
    })
  };
}

function appendJsonArray(value, entry) {
  return [...(Array.isArray(value) ? value : []), entry];
}

function staffLabel(staff) {
  return staff?.name || staff?.username || "CorSystem";
}

function requireLocalCapability(staff, capability) {
  if (hasCapability(staff, capability)) return;
  throwHttpError(403, "Non hai i permessi necessari per questa operazione");
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
