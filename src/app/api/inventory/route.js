import { authErrorResponse, requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES } from "@/features/access/roles";
import {
  STOCK_MOVEMENT_TYPES,
  normalizePartInput,
  normalizeSupplierInput,
  nonNegativeMoney,
  nonNegativeQty,
  positiveQty
} from "@/features/inventory/domain";

export async function GET() {
  try {
    await requireCapability(CAPABILITIES.INVENTORY_VIEW);
    const [parts, suppliers, recentMovements, reservations] = await Promise.all([
      prisma.part.findMany({
        orderBy: [{ active: "desc" }, { defaultName: "asc" }],
        include: { supplier: true }
      }),
      prisma.supplier.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.stockMovement.findMany({
        take: 80,
        orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
        include: {
          part: { select: { id: true, defaultName: true, sku: true } },
          repair: { select: { id: true, ticket: true } }
        }
      }),
      prisma.repairPart.findMany({
        where: { status: "RESERVED", qtyReserved: { gt: 0 } },
        select: { partId: true, qtyReserved: true }
      })
    ]);

    const reservedByPart = reservations.reduce((map, row) => {
      map[row.partId] = (map[row.partId] || 0) + Number(row.qtyReserved || 0);
      return map;
    }, {});

    return Response.json({
      parts: parts.map((part) => ({
        ...part,
        reservedQty: reservedByPart[part.id] || 0,
        availableQty: Math.max(0, Number(part.stockQty || 0) - (reservedByPart[part.id] || 0)),
        lowStock: Number(part.minStock || 0) > 0 && Number(part.stockQty || 0) <= Number(part.minStock || 0)
      })),
      suppliers,
      recentMovements
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    const staff = await requireCapability(CAPABILITIES.INVENTORY_MANAGE);
    const body = await request.json();
    const action = String(body?.action || "").trim();

    if (action === "supplier-save") return Response.json(await saveSupplier(body.supplier));
    if (action === "part-save") return Response.json(await savePart(body.part));
    if (action === "stock-move") return Response.json(await moveStock(body.movement, staff));

    throwHttpError(400, "Azione magazzino non valida");
  } catch (error) {
    if (error?.code === "P2002") {
      return Response.json({ error: "SKU, barcode o altro identificativo già presente" }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}

async function saveSupplier(input = {}) {
  const data = normalizeSupplierInput(input);
  if (!data.name) throwHttpError(400, "Il nome del fornitore è obbligatorio");
  const id = String(input.id || "").trim();

  const supplier = id
    ? await prisma.supplier.update({ where: { id }, data })
    : await prisma.supplier.create({ data });

  return { supplier };
}

async function savePart(input = {}) {
  const data = normalizePartInput(input);
  if (!data.defaultName) throwHttpError(400, "Il nome del ricambio è obbligatorio");
  if (data.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId }, select: { id: true } });
    if (!supplier) throwHttpError(400, "Fornitore non valido");
  }

  const id = String(input.id || "").trim();
  const part = id
    ? await prisma.part.update({ where: { id }, data })
    : await prisma.part.create({
        data: { ...data, zh: "", es: "", sortOrder: 0, stockQty: 0 }
      });

  return { part };
}

async function moveStock(input = {}, staff) {
  const type = String(input.type || "").trim().toUpperCase();
  if (!STOCK_MOVEMENT_TYPES.includes(type)) throwHttpError(400, "Tipo movimento non valido");
  const partId = String(input.partId || "").trim();
  if (!partId) throwHttpError(400, "Seleziona un ricambio");

  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({ where: { id: partId } });
    if (!part) throwHttpError(404, "Ricambio non trovato");

    const reserved = await tx.repairPart.aggregate({
      where: { partId, status: "RESERVED", qtyReserved: { gt: 0 } },
      _sum: { qtyReserved: true }
    });
    const reservedQty = Number(reserved._sum.qtyReserved || 0);
    const physicalStock = Number(part.stockQty || 0);

    let delta = 0;
    let stockAfter = physicalStock;
    const unitCost = nonNegativeMoney(input.unitCost);

    if (type === "ADJUSTMENT") {
      const targetStock = nonNegativeQty(input.targetStock);
      if (targetStock < reservedQty) {
        throwHttpError(409, `Rettifica non consentita: ${reservedQty} pezzi sono già prenotati per riparazioni`);
      }
      delta = roundQty(targetStock - physicalStock);
      stockAfter = targetStock;
      await tx.part.update({ where: { id: partId }, data: { stockQty: targetStock } });
    } else {
      const qty = positiveQty(input.quantity);
      delta = type === "ISSUE" ? -qty : qty;
      if (delta < 0) {
        const freeStock = Math.max(0, physicalStock - reservedQty);
        if (qty > freeStock) {
          throwHttpError(409, `Scarico non consentito: disponibili ${freeStock}, mentre ${reservedQty} sono prenotati`);
        }
      }
      stockAfter = roundQty(physicalStock + delta);
      await tx.part.update({
        where: { id: partId },
        data: {
          stockQty: stockAfter,
          ...(type === "RECEIVE" && unitCost > 0 ? { cost: unitCost } : {})
        }
      });
    }

    const repairId = String(input.repairId || "").trim() || null;
    if (repairId) {
      const repair = await tx.repair.findUnique({ where: { id: repairId }, select: { id: true } });
      if (!repair) throwHttpError(400, "Pratica collegata non valida");
    }

    const movement = await tx.stockMovement.create({
      data: {
        partId,
        repairId,
        type,
        quantity: delta,
        stockBefore: physicalStock,
        stockAfter,
        unitCost,
        reference: String(input.reference || "").trim().slice(0, 191),
        note: String(input.note || "").trim().slice(0, 8000),
        createdBy: staffLabel(staff)
      }
    });

    return { movement, stockQty: stockAfter, reservedQty };
  });
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
