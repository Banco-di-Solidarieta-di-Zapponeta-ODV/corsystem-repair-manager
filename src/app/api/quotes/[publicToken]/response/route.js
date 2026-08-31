import { prisma } from "@/lib/prisma";
import { isQuoteExpired } from "@/features/workflow/domain";

export async function POST(request, { params }) {
  try {
    const { publicToken } = await params;
    const body = await request.json();
    const response = String(body?.response || "").trim().toUpperCase();
    const customerNote = String(body?.customerNote || "").trim().slice(0, 4000);

    if (!['APPROVED', 'REJECTED'].includes(response)) {
      return Response.json({ error: "Risposta non valida" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { publicToken },
        include: { repair: true }
      });
      if (!quote) throwHttpError(404, "Preventivo non trovato");

      if (quote.status === "APPROVED" || quote.status === "REJECTED") {
        return { quoteStatus: quote.status, repairStatus: quote.repair.status, alreadyResponded: true };
      }
      if (quote.status !== "SENT") throwHttpError(409, "Questo preventivo non è disponibile per una nuova risposta");

      if (isQuoteExpired(quote)) {
        await tx.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
        throwHttpError(410, "Il preventivo è scaduto. Contatta CorSystem per una nuova versione.");
      }

      const now = new Date();
      const repairStatus = response === "APPROVED" ? "AUTORIZZATO" : "ATTESA_PREVENTIVO";
      const updatedQuote = await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: response,
          customerResponse: response,
          customerNote,
          respondedAt: now
        }
      });

      await tx.repair.update({
        where: { id: quote.repairId },
        data: {
          status: repairStatus,
          budget: updatedQuote.total,
          statusHistory: appendJsonArray(quote.repair.statusHistory, {
            status: repairStatus,
            type: response === "APPROVED" ? "quote-approved" : "quote-rejected",
            quoteId: quote.id,
            quoteVersion: quote.version,
            at: now.toISOString(),
            by: "Cliente"
          }),
          notificationLog: appendJsonArray(quote.repair.notificationLog, {
            type: response === "APPROVED" ? "quote-approved" : "quote-rejected",
            channel: "portal",
            status: "received",
            quoteId: quote.id,
            quoteVersion: quote.version,
            at: now.toISOString()
          })
        }
      });

      return { quoteStatus: updatedQuote.status, repairStatus, alreadyResponded: false };
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error?.message || "Errore durante la registrazione della risposta" }, { status: error?.status || 500 });
  }
}

function appendJsonArray(value, entry) {
  return [...(Array.isArray(value) ? value : []), entry];
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
