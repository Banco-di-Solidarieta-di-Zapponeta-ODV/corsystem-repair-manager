import crypto from "node:crypto";
import { authErrorResponse, requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRepairSearchText } from "@/lib/search-text";
import { getRevisionPatch } from "@/lib/data-store";
import { CAPABILITIES } from "@/features/access/roles";
import { notifyRepairEvent } from "@/features/notifications/server";
import {
  DEFAULT_DOCUMENT_TYPE,
  normalizeClientLevel,
  normalizeClientName,
  normalizePhone
} from "@/features/clients/domain";
import { DEVICE_TYPES, normalizeImei, normalizeSerial } from "@/features/devices/domain";
import { repairDeviceFingerprint } from "@/features/devices/server";
import { INTAKE_ACCESSORIES, INTAKE_CONDITION_FLAGS } from "@/features/intake/domain";

const MAX_TICKET_ATTEMPTS = 3;

export async function GET() {
  try {
    await requireCapability(CAPABILITIES.INTAKE_CREATE);
    const [clients, technicians] = await Promise.all([
      prisma.client.findMany({ orderBy: [{ updatedAt: "desc" }, { name: "asc" }] }),
      prisma.technician.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
    ]);

    return Response.json({
      clients,
      technicians,
      deviceTypes: DEVICE_TYPES,
      accessories: INTAKE_ACCESSORIES,
      conditionFlags: INTAKE_CONDITION_FLAGS
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    const staff = await requireCapability(CAPABILITIES.INTAKE_CREATE);
    const body = await request.json();
    validateRequest(body);

    const result = await createIntakeWithRetry(body, staff);
    const notification = await notifyRepairEvent(result.repair.id, "INTAKE_CREATED", {
      dedupeSuffix: result.repair.id
    }).catch((error) => ({ error: String(error?.message || error) }));
    return Response.json({
      ...result,
      repair: serializeRepair(result.repair),
      notification,
      _revisionPatch: await getRevisionPatch(["clients", "repairs"])
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return Response.json({ error: "Conflitto durante la creazione del numero pratica. Riprova." }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}

async function createIntakeWithRetry(body, staff) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_TICKET_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => createIntakeTransaction(tx, body, staff));
    } catch (error) {
      lastError = error;
      if (error?.code !== "P2002" || attempt === MAX_TICKET_ATTEMPTS) throw error;
    }
  }
  throw lastError;
}

async function createIntakeTransaction(tx, body, staff) {
  const client = await resolveClient(tx, body);
  const device = await resolveDevice(tx, body, client.id);
  const { ticket, ticketSort } = await nextCorSystemTicket(tx);
  const now = new Date();
  const repairTime = formatRepairTime(now);
  const intakeProperties = serializeIntakeProperties(body, now);

  const repairDraft = {
    ticket,
    clientId: client.id,
    deviceId: device.id,
    brand: device.brand,
    model: device.model,
    imei: device.imei,
    properties: intakeProperties,
    issue: String(body.reportedIssue || "").trim(),
    internalNote: String(body.internalNote || body.notes || "").trim(),
    technicianId: String(body.technicianId || "").trim(),
    technicianName: ""
  };

  if (repairDraft.technicianId) {
    const technician = await tx.technician.findUnique({ where: { id: repairDraft.technicianId } });
    if (!technician || !technician.active) throwHttpError(400, "Tecnico non valido");
    repairDraft.technicianName = technician.name;
  }

  const searchText = buildRepairSearchText(repairDraft, { client, items: [], sourceTicket: "" });
  const repair = await tx.repair.create({
    data: {
      ticket,
      clientId: client.id,
      deviceId: device.id,
      brand: device.brand,
      model: device.model,
      properties: intakeProperties,
      imei: device.imei,
      issue: repairDraft.issue,
      internalNote: repairDraft.internalNote,
      passwordType: "",
      passwordText: "",
      passwordPattern: [],
      status: "预定",
      repairTime,
      warrantyStart: "",
      technicianId: repairDraft.technicianId,
      technicianName: repairDraft.technicianName,
      budget: 0,
      deposit: 0,
      paymentMethod: "none",
      discountAmount: 0,
      costAmount: 0,
      frontPhoto: String(body.frontPhoto || ""),
      backPhoto: String(body.backPhoto || ""),
      signatureDataUrl: String(body.signatureDataUrl || ""),
      signedAt: now.toISOString(),
      publicToken: crypto.randomUUID(),
      orderType: "repair",
      sourceRepairId: "",
      warrantyReason: "",
      warrantyDiagnosis: "",
      warrantyResolution: "",
      warrantyChargeable: false,
      statusHistory: [{
        status: "预定",
        type: "intake-created",
        at: now.toISOString(),
        by: staff?.name || staff?.username || "CorSystem"
      }],
      notificationLog: [],
      searchText,
      ticketSort
    }
  });

  return { client, device, repair };
}

async function resolveClient(tx, body) {
  const clientId = String(body.clientId || "").trim();
  if (clientId) {
    const existing = await tx.client.findUnique({ where: { id: clientId } });
    if (!existing) throwHttpError(404, "Cliente non trovato");
    return existing;
  }

  const input = body.client || {};
  const name = normalizeClientName(input.name);
  const phone = normalizePhone(input.phone);
  if (!name || !phone) throwHttpError(400, "Nome cliente e telefono sono obbligatori");

  return tx.client.create({
    data: {
      name,
      phone,
      docType: input.docType || DEFAULT_DOCUMENT_TYPE,
      identity: String(input.identity || "").trim().toUpperCase(),
      email: String(input.email || "").trim().toLocaleLowerCase("it-IT"),
      address: String(input.address || "").trim(),
      comment: String(input.comment || "").trim(),
      level: normalizeClientLevel(input.level)
    }
  });
}

async function resolveDevice(tx, body, clientId) {
  const deviceId = String(body.deviceId || "").trim();
  if (deviceId) {
    const existing = await tx.device.findUnique({ where: { id: deviceId } });
    if (!existing) throwHttpError(404, "Dispositivo non trovato");
    if (existing.clientId !== clientId) throwHttpError(400, "Il dispositivo appartiene a un altro cliente");
    return existing;
  }

  const input = body.device || {};
  const type = DEVICE_TYPES.includes(input.type) ? input.type : "Altro";
  const brand = String(input.brand || "").trim();
  const model = String(input.model || "").trim();
  const imei = normalizeImei(input.imei);
  const serialNumber = normalizeSerial(input.serialNumber);
  const color = String(input.color || "").trim();
  const notes = String(input.notes || "").trim();

  if (!brand && !model && !imei && !serialNumber) throwHttpError(400, "Inserisci almeno marca/modello, IMEI o numero seriale del dispositivo");

  if (imei) {
    const sameImei = await tx.device.findFirst({ where: { clientId, imei } });
    if (sameImei) return sameImei;
  }
  if (serialNumber) {
    const sameSerial = await tx.device.findFirst({ where: { clientId, serialNumber } });
    if (sameSerial) return sameSerial;
  }

  const fingerprint = repairDeviceFingerprint({
    clientId,
    imei,
    brand,
    model,
    properties: [type, serialNumber, color].join("|")
  });

  return tx.device.upsert({
    where: { clientId_fingerprint: { clientId, fingerprint } },
    update: { type, brand, model, imei, serialNumber, color, notes },
    create: { clientId, type, brand, model, imei, serialNumber, color, notes, fingerprint }
  });
}

async function nextCorSystemTicket(tx) {
  const year = Number(formatRepairTime(new Date()).slice(0, 4));
  const prefix = `CS-${year}-`;
  const latest = await tx.repair.findFirst({
    where: { ticket: { startsWith: prefix } },
    orderBy: { ticket: "desc" },
    select: { ticket: true }
  });
  const previous = Number(String(latest?.ticket || "").slice(prefix.length)) || 0;
  const sequence = previous + 1;
  const ticket = `${prefix}${String(sequence).padStart(5, "0")}`;
  return { ticket, ticketSort: BigInt(`${year}${String(sequence).padStart(5, "0")}`) };
}

function serializeRepair(repair) {
  return {
    ...repair,
    ticketSort: Number(repair?.ticketSort || 0)
  };
}

function serializeIntakeProperties(body, now = new Date()) {
  return JSON.stringify({
    schema: "corsystem-intake-v1",
    initialCondition: uniqueStrings(body.initialCondition),
    accessories: uniqueStrings(body.accessories),
    notes: String(body.notes || "").trim(),
    privacyAccepted: body.privacyAccepted === true,
    acceptedAt: now.toISOString()
  });
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function validateRequest(body) {
  const hasClient = String(body?.clientId || "").trim() || (String(body?.client?.name || "").trim() && String(body?.client?.phone || "").trim());
  if (!hasClient) throwHttpError(400, "Seleziona un cliente o inseriscine uno nuovo");
  const hasDevice = String(body?.deviceId || "").trim() || body?.device;
  if (!hasDevice) throwHttpError(400, "Seleziona o registra un dispositivo");
  if (!String(body?.reportedIssue || "").trim()) throwHttpError(400, "Descrivi il problema segnalato dal cliente");
  if (!String(body?.signatureDataUrl || "").startsWith("data:image/")) throwHttpError(400, "La firma del cliente è obbligatoria");
  if (body?.privacyAccepted !== true) throwHttpError(400, "È necessaria l'accettazione dell'informativa privacy");
}

function formatRepairTime(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
