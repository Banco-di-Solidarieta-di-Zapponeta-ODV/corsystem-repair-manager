import { createHash } from "node:crypto";
import { normalizeImei } from "@/features/devices/domain";

export async function ensureDeviceForRepair(tx, repair) {
  const clientId = String(repair?.clientId || "").trim();
  if (!clientId) return null;

  const requestedDeviceId = String(repair?.deviceId || "").trim();
  if (requestedDeviceId) {
    const requested = await tx.device.findUnique({ where: { id: requestedDeviceId } });
    if (!requested) throwHttpError(404, "Dispositivo non trovato");
    if (requested.clientId !== clientId) throwHttpError(400, "Il dispositivo appartiene a un altro cliente");
    return requested;
  }

  const imei = normalizeImei(repair?.imei);
  if (imei) {
    const existingByImei = await tx.device.findFirst({ where: { clientId, imei } });
    if (existingByImei) return existingByImei;
  }

  const brand = String(repair?.brand || "").trim();
  const model = String(repair?.model || "").trim();
  const properties = String(repair?.properties || "").trim();
  if (!imei && !brand && !model && !properties) return null;

  const fingerprint = repairDeviceFingerprint({ clientId, imei, brand, model, properties });
  return tx.device.upsert({
    where: { clientId_fingerprint: { clientId, fingerprint } },
    update: {
      brand,
      model,
      ...(imei ? { imei } : {})
    },
    create: {
      clientId,
      type: "Altro",
      brand,
      model,
      imei,
      serialNumber: "",
      color: "",
      notes: "",
      fingerprint
    }
  });
}

export function repairDeviceFingerprint({ clientId, imei, brand, model, properties }) {
  const normalizedImei = normalizeImei(imei);
  const identity = normalizedImei
    ? `imei:${normalizedImei.toLowerCase()}`
    : `legacy:${normalizeText(brand)}|${normalizeText(model)}|${normalizeText(properties)}`;
  return createHash("sha256").update(`${String(clientId || "").trim()}|${identity}`).digest("hex");
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("it-IT");
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
