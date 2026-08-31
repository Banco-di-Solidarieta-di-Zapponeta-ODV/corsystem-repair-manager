import crypto from "node:crypto";
import { authErrorResponse, requireAnyCapability, requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES } from "@/features/access/roles";
import { normalizeDiagnosisInput, normalizeQuoteInput } from "@/features/workflow/domain";
import { notifyRepairEvent } from "@/features/notifications/server";

const EARLY_REPAIR_STATUSES = new Set([
  "预定", "预定到货", "预定已到货", "待开始", "待检测", "等客户确认",
  "ACCETTATO", "IN_DIAGNOSI", "ATTESA_PREVENTIVO", "ATTESA_APPROVAZIONE", "AUTORIZZATO"
]);

export async function GET(_request, { params }) {
  try {
    await requireAnyCapability([
      CAPABILITIES.REPAIR_VIEW,
      CAPABILITIES.DIAGNOSIS_MANAGE,
      CAPABILITIES.QUOTE_MANAGE
    ]);
    const { repairId } = await params;
    const [repair, technicians] = await Promise.all([
      prisma.repair.findUnique({
        where: { id: repairId },
        select: {
          id: true,
          ticket: true,
          status: true,
          issue: true,
          internalNote: true,
          technicianId: true,
          technicianName: true,
          budget: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { id: true, name: true, phone: true, email: true } },
          device: { select: { id: true, type: true, brand: true, model: true, imei: true, serialNumber: true, color: true } },
          diagnosis: true,
          quotes: {
            orderBy: { version: "desc" },
            include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } }
          }
        }
      }),
      prisma.technician.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, phone: true, email: true }
      })
    ]);

    if (!repair) throwHttpError(404, "Pratica non trovata");
    return Response.json({ repair, technicians });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const staff = await requireCapability(CAPABILITIES.DIAGNOSIS_MANAGE);
    const { repairId } = await params;
    const body = await request.json();
    const diagnosisInput = normalizeDiagnosisInput(body?.diagnosis || body);

    if (diagnosisInput.status === "FINAL") {
      if (!diagnosisInput.findings) throwHttpError(400, "Inserisci l'esito della diagnosi");
      if (!diagnosisInput.proposedWork) throwHttpError(400, "Inserisci l'intervento proposto");
      if (!diagnosisInput.customerSummary) throwHttpError(400, "Inserisci il riepilogo comprensibile per il cliente");
    }

    const result = await prisma.$transaction(async (tx) => {
      const repair = await tx.repair.findUnique({ where: { id: repairId } });
      if (!repair) throwHttpError(404, "Pratica non trovata");

      let technicianName = diagnosisInput.technicianName;
      if (diagnosisInput.technicianId) {
        const technician = await tx.technician.findUnique({ where: { id: diagnosisInput.technicianId } });
        if (!technician || !technician.active) throwHttpError(400, "Tecnico non valido");
        technicianName = technician.name;
      }

      const now = new Date();
      const diagnosis = await tx.diagnosis.upsert({
        where: { repairId },
        update: { ...diagnosisInput, technicianName, completedAt: diagnosisInput.status === "FINAL" ? now : null },
        create: {
          repairId,
          ...diagnosisInput,
          technicianName,
          createdBy: staffLabel(staff),
          completedAt: diagnosisInput.status === "FINAL" ? now : null
        }
      });

      const nextStatus = diagnosisInput.status === "FINAL" ? "ATTESA_PREVENTIVO" : "IN_DIAGNOSI";
      const statusPatch = EARLY_REPAIR_STATUSES.has(repair.status)
        ? repairStatusPatch(repair, nextStatus, diagnosisInput.status === "FINAL" ? "diagnosis-finalized" : "diagnosis-saved", staff)
        : {};
      const technicianPatch = diagnosisInput.technicianId ? { technicianId: diagnosisInput.technicianId, technicianName } : {};

      if (Object.keys(statusPatch).length || Object.keys(technicianPatch).length) {
        await tx.repair.update({ where: { id: repairId }, data: { ...statusPatch, ...technicianPatch } });
      }

      return diagnosis;
    });

    return Response.json({ diagnosis: result });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const staff = await requireCapability(CAPABILITIES.QUOTE_MANAGE);
    const { repairId } = await params;
    const body = await request.json();
    const action = String(body?.action || "").trim();

    if (action === "quote-create") return Response.json(await createQuote(repairId, body.quote, staff));
    if (action === "quote-update") return Response.json(await updateQuote(repairId, body.quoteId, body.quote, staff));
    if (action === "quote-send") {
      const result = await sendQuote(repairId, body.quoteId, staff);
      const notification = await notifyRepairEvent(repairId, "QUOTE_SENT", {
        quoteId: result.quote.id,
        quotePublicToken: result.quote.publicToken,
        amount: Number(result.quote.total),
        dedupeSuffix: `v${result.quote.version}`
      }).catch((error) => ({ error: String(error?.message || error) }));
      return Response.json({ ...result, notification });
    }
    if (action === "quote-new-version") return Response.json(await newQuoteVersion(repairId, body.quoteId, staff));
    if (action === "quote-delete") return Response.json(await deleteDraftQuote(repairId, body.quoteId));

    throwHttpError(400, "Azione preventivo non valida");
  } catch (error) {
    return authErrorResponse(error);
  }
}

async function createQuote(repairId, input, staff) {
  const normalized = normalizeQuoteInput(input);
  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUnique({ where: { id: repairId }, include: { diagnosis: true } });
    if (!repair) throwHttpError(404, "Pratica non trovata");
    if (!repair.diagnosis || repair.diagnosis.status !== "FINAL") {
      throwHttpError(409, "Completa e finalizza la diagnosi prima di creare il preventivo");
    }

    const latest = await tx.quote.findFirst({ where: { repairId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (latest?.version || 0) + 1;
    const quote = await tx.quote.create({
      data: {
        repairId,
        version,
        status: "DRAFT",
        publicToken: crypto.randomUUID(),
        title: normalized.title,
        customerMessage: normalized.customerMessage,
        internalNote: normalized.internalNote,
        customerNote: "",
        subtotal: normalized.subtotal,
        discountAmount: normalized.discountAmount,
        total: normalized.total,
        estimatedDays: normalized.estimatedDays,
        validUntil: normalized.validUntil,
        createdBy: staffLabel(staff),
        items: { create: normalized.items }
      },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    return { quote };
  });
}

async function updateQuote(repairId, quoteId, input) {
  const normalized = normalizeQuoteInput(input);
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({ where: { id: quoteId, repairId } });
    if (!quote) throwHttpError(404, "Preventivo non trovato");
    if (quote.status !== "DRAFT") throwHttpError(409, "Un preventivo già inviato non può essere modificato: crea una nuova versione");

    await tx.quoteItem.deleteMany({ where: { quoteId } });
    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        title: normalized.title,
        customerMessage: normalized.customerMessage,
        internalNote: normalized.internalNote,
        subtotal: normalized.subtotal,
        discountAmount: normalized.discountAmount,
        total: normalized.total,
        estimatedDays: normalized.estimatedDays,
        validUntil: normalized.validUntil,
        items: { create: normalized.items }
      },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    return { quote: updated };
  });
}

async function sendQuote(repairId, quoteId, staff) {
  return prisma.$transaction(async (tx) => {
    const [repair, quote] = await Promise.all([
      tx.repair.findUnique({ where: { id: repairId } }),
      tx.quote.findFirst({ where: { id: quoteId, repairId }, include: { items: true } })
    ]);
    if (!repair) throwHttpError(404, "Pratica non trovata");
    if (!quote) throwHttpError(404, "Preventivo non trovato");
    if (quote.status !== "DRAFT") throwHttpError(409, "Il preventivo non è più in bozza");
    if (!quote.items.length || Number(quote.total) <= 0) throwHttpError(400, "Inserisci almeno una voce con importo maggiore di zero");

    const now = new Date();
    await tx.quote.updateMany({
      where: { repairId, status: "SENT", NOT: { id: quoteId } },
      data: { status: "SUPERSEDED", supersededAt: now }
    });

    const sent = await tx.quote.update({
      where: { id: quoteId },
      data: { status: "SENT", sentAt: now },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });

    await tx.repair.update({
      where: { id: repairId },
      data: {
        ...repairStatusPatch(repair, "ATTESA_APPROVAZIONE", "quote-sent", staff, { quoteId, quoteVersion: quote.version }),
        budget: sent.total,
        notificationLog: appendJsonArray(repair.notificationLog, {
          type: "quote-ready",
          channel: "portal",
          status: "ready",
          quoteId,
          quoteVersion: quote.version,
          at: now.toISOString(),
          by: staffLabel(staff)
        })
      }
    });

    return { quote: sent, publicPath: `/preventivo/${encodeURIComponent(sent.publicToken)}` };
  });
}

async function newQuoteVersion(repairId, quoteId, staff) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.quote.findFirst({ where: { id: quoteId, repairId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    if (!source) throwHttpError(404, "Preventivo di origine non trovato");
    const existingDraft = await tx.quote.findFirst({ where: { repairId, status: "DRAFT" }, orderBy: { version: "desc" } });
    if (existingDraft) throwHttpError(409, `Esiste già una bozza v${existingDraft.version}: completa o elimina quella prima di crearne un'altra`);

    const latest = await tx.quote.findFirst({ where: { repairId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (latest?.version || 0) + 1;
    const quote = await tx.quote.create({
      data: {
        repairId,
        version,
        status: "DRAFT",
        publicToken: crypto.randomUUID(),
        title: source.title,
        customerMessage: source.customerMessage,
        internalNote: source.internalNote,
        customerNote: "",
        subtotal: source.subtotal,
        discountAmount: source.discountAmount,
        total: source.total,
        estimatedDays: source.estimatedDays,
        validUntil: source.validUntil,
        createdBy: staffLabel(staff),
        items: {
          create: source.items.map((item) => ({
            type: item.type,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            lineTotal: item.lineTotal,
            lineCost: item.lineCost,
            sortOrder: item.sortOrder
          }))
        }
      },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    return { quote };
  });
}

async function deleteDraftQuote(repairId, quoteId) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, repairId } });
  if (!quote) throwHttpError(404, "Preventivo non trovato");
  if (quote.status !== "DRAFT") throwHttpError(409, "Puoi eliminare solo una bozza");
  await prisma.quote.delete({ where: { id: quoteId } });
  return { deleted: true };
}

function repairStatusPatch(repair, status, type, staff, extra = {}) {
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

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
