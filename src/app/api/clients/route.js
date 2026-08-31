import { collectionRoute } from "@/lib/api-crud";
import { authErrorResponse, requireAnyPageAccess } from "@/lib/auth";
import { getRevisionPatch } from "@/lib/data-store";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DOCUMENT_TYPE,
  normalizeClientLevel,
  normalizeClientName,
  normalizePhone
} from "@/features/clients/domain";

const route = collectionRoute("clients");
export const GET = route.GET;

export async function POST(request) {
  try {
    await requireAnyPageAccess(["clients", "repairs"]);
    const body = await request.json();
    const clientId = body.id || crypto.randomUUID();
    const name = normalizeClientName(body.name);
    const phone = normalizePhone(body.phone);

    if (!name || !phone) {
      return Response.json({ error: "Nome cliente e telefono sono obbligatori" }, { status: 400 });
    }

    const payload = {
      name,
      phone,
      level: normalizeClientLevel(body.level),
      docType: body.docType || DEFAULT_DOCUMENT_TYPE,
      identity: String(body.identity || "").trim(),
      email: String(body.email || "").trim().toLocaleLowerCase("it-IT"),
      address: String(body.address || "").trim(),
      comment: String(body.comment || "").trim()
    };

    const client = await prisma.client.upsert({
      where: { id: clientId },
      create: { id: clientId, ...payload },
      update: payload
    });

    return Response.json({ client, _revisionPatch: await getRevisionPatch(["clients"]) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    await requireAnyPageAccess(["clients"]);
    const body = await request.json();
    const clientId = String(body?.id || "").trim();
    if (!clientId) throwBadRequest("Cliente mancante");

    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (!existing) throwNotFound("Cliente non trovato");

    const repairCount = await prisma.repair.count({ where: { clientId } });
    if (repairCount > 0) {
      throwBadRequest("Il cliente ha uno storico riparazioni e non può essere eliminato");
    }

    await prisma.client.delete({ where: { id: clientId } });
    return Response.json({ ok: true, id: clientId, _revisionPatch: await getRevisionPatch(["clients"]) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

function throwBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function throwNotFound(message) {
  const error = new Error(message);
  error.status = 404;
  throw error;
}
