export const DEVICE_TYPES = [
  "Smartphone",
  "Tablet",
  "Notebook",
  "Desktop",
  "Smartwatch",
  "Console",
  "Altro"
];

export function normalizeImei(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

export function normalizeSerial(value) {
  return String(value || "").trim().toUpperCase();
}

export function deviceDisplayLabel(device) {
  if (!device) return "Dispositivo";
  const type = String(device.type || "").trim();
  const brand = String(device.brand || "").trim();
  const model = String(device.model || "").trim();
  const imei = String(device.imei || "").trim();
  const serial = String(device.serialNumber || "").trim();
  const main = [type, brand, model].filter(Boolean).join(" ") || "Dispositivo";
  const identifier = imei ? `IMEI ${imei}` : serial ? `S/N ${serial}` : "";
  return [main, identifier].filter(Boolean).join(" · ");
}

export function legacyDeviceKey(repair) {
  const imei = normalizeImei(repair?.imei);
  if (imei) return `imei:${imei}`;
  const brand = String(repair?.brand || "").trim().toLocaleLowerCase("it-IT");
  const model = String(repair?.model || "").trim().toLocaleLowerCase("it-IT");
  const clientId = String(repair?.clientId || "").trim();
  return `legacy:${clientId}:${brand}:${model}`;
}
