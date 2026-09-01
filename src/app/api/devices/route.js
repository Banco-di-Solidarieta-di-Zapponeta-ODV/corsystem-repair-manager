import { createHash } from "node:crypto";
import { requireAnyPageAccess, authErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEVICE_TYPES, normalizeImei, normalizeSerial } from "@/features/devices/domain";

export async function GET(request) {
  try {
    await requireAnyPageAccess(["clients", "repairs"]);
    const { searchParams } = new URL(request.url);
    const clientId = String(searchParams.get("clientId") || "").trim();
    const devices = await prisma.device.findMany({
      where: clientId ? { clientId } : undefined,
      include: {
        _count: { select: { repairs: true } },
        repairs: {
          select: { id: true, ticket: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    });
    return Response.json(devices.map(serializeDevice));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    await requireAnyPageAccess(["clients", "repairs"]);
    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    if (!clientId) return badRequest("Il cliente è obbligatorio");

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return notFound("Cliente non trovato");

    const payload = normalizeDevice(body);
    if (!payload.brand && !payload.model && !payload.imei && !payload.serialNumber) {
      return badRequest("Inserisci almeno marca, modello, IMEI o numero seriale");
    }

    let device;
    if (body.id) {
      const existing = await prisma.device.findUnique({ where: { id: String(body.id) } });
      if (!existing) return notFound("Dispositivo non trovato");
      if (existing.clientId !== clientId) return badRequest("Il dispositivo appartiene a un altro cliente");
      await assertIdentifiersAvailable({ ...payload, clientId, excludeId: existing.id });
      device = await prisma.device.update({
        where: { id: existing.id },
        data: payload
      });
    } else {
      const existing = await findExistingDevice(clientId, payload);
      if (existing) {
        device = await prisma.device.update({
          where: { id: existing.id },
          data: payload
        });
      } else {
        const fingerprint = buildFingerprint(clientId, payload);
        device = await prisma.device.create({
          data: { ...payload, clientId, fingerprint }
        });
      }
    }

    return Response.json({ device: serializeDevice(device) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    await requireAnyPageAccess(["clients", "repairs"]);
    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) return badRequest("Dispositivo mancante");

    const existing = await prisma.device.findUnique({
      where: { id },
      include: { _count: { select: { repairs: true } } }
    });
    if (!existing) return notFound("Dispositivo non trovato");
    if (existing._count.repairs > 0) {
      return badRequest("Il dispositivo ha uno storico di riparazioni e non può essere eliminato");
    }

    await prisma.device.delete({ where: { id } });
    return Response.json({ ok: true, id });
  } catch (error) {
    return authErrorResponse(error);
  }
}

function normalizeDevice(body) {
  const type = DEVICE_TYPES.includes(body.type) ? body.type : "Altro";
  return {
    type,
    brand: String(body.brand || "").trim(),
    model: String(body.model || "").trim(),
    imei: normalizeImei(body.imei),
    serialNumber: normalizeSerial(body.serialNumber),
    color: String(body.color || "").trim(),
    notes: String(body.notes || "").trim()
  };
}

async function findExistingDevice(clientId, payload) {
  if (payload.imei) {
    const byImei = await prisma.device.findFirst({ where: { clientId, imei: payload.imei } });
    if (byImei) return byImei;
  }
  if (payload.serialNumber) {
    const bySerial = await prisma.device.findFirst({ where: { clientId, serialNumber: payload.serialNumber } });
    if (bySerial) return bySerial;
  }
  return null;
}

async function assertIdentifiersAvailable({ clientId, imei, serialNumber, excludeId }) {
  if (imei) {
    const duplicate = await prisma.device.findFirst({
      where: { clientId, imei, id: { not: excludeId } },
      select: { id: true }
    });
    if (duplicate) throwHttpError(409, "Esiste già un dispositivo del cliente con questo IMEI");
  }
  if (serialNumber) {
    const duplicate = await prisma.device.findFirst({
      where: { clientId, serialNumber, id: { not: excludeId } },
      select: { id: true }
    });
    if (duplicate) throwHttpError(409, "Esiste già un dispositivo del cliente con questo numero seriale");
  }
}

function buildFingerprint(clientId, payload) {
  let identity;
  if (payload.imei) identity = `imei:${payload.imei.toLowerCase()}`;
  else if (payload.serialNumber) identity = `serial:${payload.serialNumber.toLowerCase()}`;
  else {
    identity = ["device", payload.type, payload.brand, payload.model, payload.color]
      .map((value) => String(value || "").trim().toLocaleLowerCase("it-IT"))
      .join(":");
  }
  return createHash("sha256").update(`${clientId}|${identity}`).digest("hex");
}

function serializeDevice(device) {
  const latestRepair = Array.isArray(device.repairs) ? device.repairs[0] || null : undefined;
  const repairCount = device._count?.repairs;
  const { _count, repairs, ...clean } = device;
  return {
    ...clean,
    ...(repairCount === undefined ? {} : { repairCount }),
    ...(latestRepair === undefined ? {} : { latestRepair })
  };
}

function badRequest(message) {
  return Response.json({ error: message }, { status: 400 });
}

function notFound(message) {
  return Response.json({ error: message }, { status: 404 });
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
