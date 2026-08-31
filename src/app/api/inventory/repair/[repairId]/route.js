import { authErrorResponse, requireAnyPageAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nonNegativeMoney, positiveQty } from "@/features/inventory/domain";

const WORKABLE_STATUSES = new Set(["AUTORIZZATO", "ATTESA_RICAMBIO", "IN_LAVORAZIONE"]);

export async function GET(_request, { params }) {
  try {
    await requireAnyPageAccess(["repairs"]);
    const { repairId } = await params;
    const repair = await prisma.repair.findUnique({
      where: { id: repairId },
      select: {
        id: true,
        ticket: true,
        status: true,
        costAmount: true,
        client: { select: { id: true, name: true } },
        device: { select: { id: true, type: true, brand: true, model: true } },
        quotes: {
          where: { status: "APPROVED" },
          orderBy: { version: "desc" },
          take: 1,
          include: { items: { orderBy: { sortOrder: "asc" } } }
        },
        repairParts: {
          orderBy: [{ createdAt: "asc" }],
          include: { part: { include: { supplier: true } }, quoteItem: true }
        }
      }
    });
    if (!repair) throwHttpError(404, "Pratica non trovata");

    const parts = await prisma.part.findMany({
      where: { active: true },
      orderBy: { defaultName: "asc" },
      include: { supplier: true }
    });
    const reservations = await prisma.repairPart.findMany({
      where: { status: "RESERVED", qtyReserved: { gt: 0 } },
      select: { partId: true, qtyReserved: true }
    });
    const reservedByPart = reservations.reduce((map, row) => {
      map[row.partId] = (map[row.partId] || 0) + Number(row.qtyReserved || 0);
      return map;
    }, {});

    return Response.json({
      repair,
      parts: parts.map((part) => ({
        ...part,
        reservedQty: reservedByPart[part.id] || 0,
        availableQty: Math.max(0, Number(part.stockQty || 0) - (reservedByPart[part.id] || 0))
      }))
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const staff = await requireAnyPageAccess(["repairs"]);
    const { repairId } = await params;
    const body = await request.json();
    const action = String(body?.action || "").trim();

    if (action === "request") return Response.json(await requestPart(repairId, body, staff));
    if (action === "reserve") return Response.json(await reservePart(repairId, body.repairPartId, staff));
    if (action === "order") return Response.json(await orderPart(repairId, body, staff));
    if (action === "receive") return Response.json(await receivePart(repairId, body, staff));
    if (action === "use") return Response.json(await usePart(repairId, body, staff));
    if (action === "cancel") return Response.json(await cancelPart(repairId, body.repairPartId, staff));
    if (action === "start-repair") return Response.json(await startRepair(repairId, staff));

    throwHttpError(400, "Azione ricambio non valida");
  } catch (error) {
    return authErrorResponse(error);
  }
}

async function requestPart(repairId, body, staff) {
  const partId = String(body.partId || "").trim();
  const qtyRequested = positiveQty(body.qtyRequested);
  const quoteItemId = String(body.quoteItemId || "").trim() || null;

  return prisma.$transaction(async (tx) => {
    const repair = await requireWorkableRepair(tx, repairId);
    const part = await tx.part.findUnique({ where: { id: partId } });
    if (!part || !part.active) throwHttpError(404, "Ricambio non trovato o non attivo");

    if (quoteItemId) {
      const quoteItem = await tx.quoteItem.findFirst({
        where: { id: quoteItemId, quote: { repairId, status: "APPROVED" } },
        select: { id: true }
      });
      if (!quoteItem) throwHttpError(400, "Voce preventivo non valida");
      await tx.quoteItem.update({ where: { id: quoteItemId }, data: { partId } });
    }

    const row = await tx.repairPart.create({
      data: {
        repairId,
        partId,
        quoteItemId,
        status: "REQUESTED",
        qtyRequested,
        unitCostSnapshot: Number(part.cost || 0),
        notes: String(body.notes || "").trim().slice(0, 8000)
      },
      include: { part: true }
    });

    await setRepairStatus(tx, repair, "ATTESA_RICAMBIO", "part-requested", staff, { repairPartId: row.id, partId });
    return { repairPart: row, repairStatus: "ATTESA_RICAMBIO" };
  });
}

async function reservePart(repairId, repairPartId, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await requireWorkableRepair(tx, repairId);
    const row = await tx.repairPart.findFirst({ where: { id: repairPartId, repairId }, include: { part: true } });
    if (!row) throwHttpError(404, "Richiesta ricambio non trovata");
    if (["USED", "CANCELLED"].includes(row.status)) throwHttpError(409, "Questa richiesta non può essere prenotata");

    const otherReservations = await tx.repairPart.aggregate({
      where: { partId: row.partId, status: "RESERVED", NOT: { id: row.id } },
      _sum: { qtyReserved: true }
    });
    const available = Number(row.part.stockQty || 0) - Number(otherReservations._sum.qtyReserved || 0);
    const needed = Math.max(0, Number(row.qtyRequested || 0) - Number(row.qtyUsed || 0));
    if (available < needed) throwHttpError(409, `Disponibilità insufficiente: liberi ${Math.max(0, available)}`);

    const updated = await tx.repairPart.update({
      where: { id: row.id },
      data: { status: "RESERVED", qtyReserved: needed }
    });
    const repairStatus = await syncRepairAvailabilityStatus(tx, repair, staff);
    return { repairPart: updated, repairStatus };
  });
}

async function orderPart(repairId, body, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await requireWorkableRepair(tx, repairId);
    const row = await tx.repairPart.findFirst({ where: { id: body.repairPartId, repairId } });
    if (!row) throwHttpError(404, "Richiesta ricambio non trovata");
    if (["USED", "CANCELLED"].includes(row.status)) throwHttpError(409, "Questa richiesta non può essere ordinata");

    const updated = await tx.repairPart.update({
      where: { id: row.id },
      data: {
        status: "ORDERED",
        qtyReserved: 0,
        orderReference: String(body.orderReference || "").trim().slice(0, 191),
        expectedAt: parseOptionalDate(body.expectedAt)
      }
    });
    await setRepairStatus(tx, repair, "ATTESA_RICAMBIO", "part-ordered", staff, { repairPartId: row.id, partId: row.partId });
    return { repairPart: updated, repairStatus: "ATTESA_RICAMBIO" };
  });
}

async function receivePart(repairId, body, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await requireWorkableRepair(tx, repairId);
    const row = await tx.repairPart.findFirst({ where: { id: body.repairPartId, repairId }, include: { part: true } });
    if (!row) throwHttpError(404, "Richiesta ricambio non trovata");
    if (row.status !== "ORDERED") throwHttpError(409, "Puoi ricevere solo un ricambio ordinato");

    const remaining = Math.max(0, Number(row.qtyRequested || 0) - Number(row.qtyUsed || 0));
    const qty = positiveQty(body.quantity || remaining);
    const unitCost = nonNegativeMoney(body.unitCost || row.unitCostSnapshot || row.part.cost);
    const stockBefore = Number(row.part.stockQty || 0);
    const stockAfter = roundQty(stockBefore + qty);
    const qtyReserved = Math.min(remaining, roundQty(Number(row.qtyReserved || 0) + qty));

    await tx.part.update({
      where: { id: row.partId },
      data: { stockQty: stockAfter, ...(unitCost > 0 ? { cost: unitCost } : {}) }
    });
    await tx.stockMovement.create({
      data: {
        partId: row.partId,
        repairId,
        type: "RECEIVE",
        quantity: qty,
        stockBefore,
        stockAfter,
        unitCost,
        reference: String(body.reference || row.orderReference || "").trim().slice(0, 191),
        note: "Ricezione ricambio ordinato per pratica",
        createdBy: staffLabel(staff)
      }
    });

    const updated = await tx.repairPart.update({
      where: { id: row.id },
      data: {
        status: "RESERVED",
        qtyReserved,
        receivedAt: new Date(),
        unitCostSnapshot: unitCost
      }
    });
    const repairStatus = await syncRepairAvailabilityStatus(tx, repair, staff);
    return { repairPart: updated, stockQty: stockAfter, repairStatus };
  });
}

async function usePart(repairId, body, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await requireWorkableRepair(tx, repairId);
    const row = await tx.repairPart.findFirst({ where: { id: body.repairPartId, repairId }, include: { part: true } });
    if (!row) throwHttpError(404, "Richiesta ricambio non trovata");
    if (row.status !== "RESERVED") throwHttpError(409, "Prenota il ricambio prima di utilizzarlo");

    const remaining = Math.max(0, Number(row.qtyRequested || 0) - Number(row.qtyUsed || 0));
    const qty = positiveQty(body.quantity || Math.min(remaining, Number(row.qtyReserved || 0)));
    if (qty > remaining) throwHttpError(400, `Quantità superiore al residuo richiesto (${remaining})`);
    if (qty > Number(row.qtyReserved || 0)) throwHttpError(409, `Quantità superiore a quella prenotata (${Number(row.qtyReserved || 0)})`);
    if (Number(row.part.stockQty || 0) < qty) throwHttpError(409, `Giacenza insufficiente: ${Number(row.part.stockQty || 0)}`);

    const stockBefore = Number(row.part.stockQty || 0);
    const stockAfter = roundQty(stockBefore - qty);
    const qtyUsed = roundQty(Number(row.qtyUsed || 0) + qty);
    const qtyReserved = Math.max(0, roundQty(Number(row.qtyReserved || 0) - qty));
    const completed = qtyUsed >= Number(row.qtyRequested || 0);

    await tx.part.update({ where: { id: row.partId }, data: { stockQty: stockAfter } });
    await tx.stockMovement.create({
      data: {
        partId: row.partId,
        repairId,
        type: "ISSUE",
        quantity: -qty,
        stockBefore,
        stockAfter,
        unitCost: Number(row.unitCostSnapshot || row.part.cost || 0),
        reference: repair.ticket,
        note: "Ricambio utilizzato nella riparazione",
        createdBy: staffLabel(staff)
      }
    });
    const updated = await tx.repairPart.update({
      where: { id: row.id },
      data: { status: completed ? "USED" : "RESERVED", qtyUsed, qtyReserved }
    });

    const usedRows = await tx.repairPart.findMany({ where: { repairId, qtyUsed: { gt: 0 } } });
    const costAmount = usedRows.reduce((total, item) => total + Number(item.qtyUsed || 0) * Number(item.unitCostSnapshot || 0), 0);
    await tx.repair.update({ where: { id: repairId }, data: { costAmount: Math.round(costAmount * 100) / 100 } });
    const repairStatus = await syncRepairAvailabilityStatus(tx, repair, staff);

    return { repairPart: updated, stockQty: stockAfter, repairStatus, costAmount };
  });
}

async function cancelPart(repairId, repairPartId, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await requireWorkableRepair(tx, repairId);
    const row = await tx.repairPart.findFirst({ where: { id: repairPartId, repairId } });
    if (!row) throwHttpError(404, "Richiesta ricambio non trovata");
    if (row.status === "USED" || Number(row.qtyUsed || 0) > 0) {
      throwHttpError(409, "Una richiesta con ricambi già utilizzati non può essere annullata");
    }

    const updated = await tx.repairPart.update({
      where: { id: row.id },
      data: { status: "CANCELLED", qtyReserved: 0 }
    });
    const repairStatus = await syncRepairAvailabilityStatus(tx, repair, staff);
    return { repairPart: updated, repairStatus };
  });
}

async function startRepair(repairId, staff) {
  return prisma.$transaction(async (tx) => {
    const repair = await requireWorkableRepair(tx, repairId);
    const active = await tx.repairPart.findMany({ where: { repairId, NOT: { status: "CANCELLED" } } });
    const blocked = active.some((row) => coverage(row) < Number(row.qtyRequested || 0));
    if (blocked) throwHttpError(409, "Ci sono ricambi ancora da ordinare o prenotare");
    await setRepairStatus(tx, repair, "IN_LAVORAZIONE", "repair-started", staff);
    return { repairStatus: "IN_LAVORAZIONE" };
  });
}

async function syncRepairAvailabilityStatus(tx, repair, staff) {
  const rows = await tx.repairPart.findMany({ where: { repairId: repair.id, NOT: { status: "CANCELLED" } } });
  if (!rows.length) {
    await setRepairStatus(tx, repair, "AUTORIZZATO", "parts-cleared", staff);
    return "AUTORIZZATO";
  }

  const waiting = rows.some((row) => coverage(row) < Number(row.qtyRequested || 0));
  if (waiting) {
    if (repair.status !== "ATTESA_RICAMBIO") await setRepairStatus(tx, repair, "ATTESA_RICAMBIO", "parts-waiting", staff);
    return "ATTESA_RICAMBIO";
  }

  const workStarted = rows.some((row) => Number(row.qtyUsed || 0) > 0);
  const status = workStarted ? "IN_LAVORAZIONE" : "AUTORIZZATO";
  if (repair.status !== status) await setRepairStatus(tx, repair, status, workStarted ? "repair-parts-in-use" : "parts-ready", staff);
  return status;
}

function coverage(row) {
  return roundQty(Number(row.qtyReserved || 0) + Number(row.qtyUsed || 0));
}

async function setRepairStatus(tx, repair, status, type, staff, extra = {}) {
  if (repair.status === status) return;
  await tx.repair.update({
    where: { id: repair.id },
    data: {
      status,
      statusHistory: [
        ...(Array.isArray(repair.statusHistory) ? repair.statusHistory : []),
        { status, type, at: new Date().toISOString(), by: staffLabel(staff), ...extra }
      ]
    }
  });
}

async function requireWorkableRepair(tx, repairId) {
  const repair = await tx.repair.findUnique({ where: { id: repairId } });
  if (!repair) throwHttpError(404, "Pratica non trovata");
  if (!WORKABLE_STATUSES.has(repair.status)) {
    throwHttpError(409, "La pratica deve essere autorizzata prima di gestire i ricambi");
  }
  return repair;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundQty(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function staffLabel(staff) {
  return staff?.name || staff?.username || "CorSystem";
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
