import { REPAIR_STATUS_LABELS } from "@/features/repairs/constants";

const LEGACY_STATUS_MAP = {
  "预定": "ACCETTATO",
  "预定到货": "ACCETTATO",
  "预定已到货": "ACCETTATO",
  "待开始": "ACCETTATO",
  "待检测": "IN_DIAGNOSI",
  "等客户确认": "ATTESA_APPROVAZIONE",
  "维修中": "IN_LAVORAZIONE",
  "处理中": "IN_LAVORAZIONE",
  "完成": "PRONTO",
  "已完成": "PRONTO",
  "已取走": "CONSEGNATO",
  "取消": "ANNULLATO",
  "关闭": "ANNULLATO",
  "拒保": "ANNULLATO"
};

export const CUSTOMER_PROGRESS_STEPS = [
  { key: "PRESA_IN_CARICO", label: "Presa in carico" },
  { key: "VALUTAZIONE", label: "Valutazione" },
  { key: "LAVORAZIONE", label: "Lavorazione" },
  { key: "CONTROLLO", label: "Controllo finale" },
  { key: "PRONTO", label: "Pronto" },
  { key: "CONSEGNATO", label: "Consegnato" }
];

export function parseIntakeProperties(value) {
  const raw = String(value || "").trim();
  if (!raw) return { initialCondition: [], accessories: [], notes: "", privacyAccepted: false };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid");
    return {
      schema: parsed.schema || "",
      initialCondition: cleanList(parsed.initialCondition),
      accessories: cleanList(parsed.accessories),
      notes: String(parsed.notes || "").trim(),
      privacyAccepted: parsed.privacyAccepted === true,
      acceptedAt: String(parsed.acceptedAt || "").trim()
    };
  } catch {
    return {
      schema: "legacy",
      initialCondition: [],
      accessories: [],
      notes: raw,
      privacyAccepted: false,
      acceptedAt: ""
    };
  }
}

export function normalizeRepairStatus(status) {
  const value = String(status || "").trim();
  return LEGACY_STATUS_MAP[value] || value || "ACCETTATO";
}

export function repairStatusLabel(status) {
  const normalized = normalizeRepairStatus(status);
  return REPAIR_STATUS_LABELS[normalized] || normalized.replaceAll("_", " ") || "Accettato";
}

export function customerProgress(status) {
  const normalized = normalizeRepairStatus(status);
  const mapping = {
    ACCETTATO: "PRESA_IN_CARICO",
    IN_DIAGNOSI: "VALUTAZIONE",
    ATTESA_PREVENTIVO: "VALUTAZIONE",
    ATTESA_APPROVAZIONE: "VALUTAZIONE",
    ATTESA_RICAMBIO: "VALUTAZIONE",
    IN_LAVORAZIONE: "LAVORAZIONE",
    IN_TEST: "CONTROLLO",
    PRONTO: "PRONTO",
    CONSEGNATO: "CONSEGNATO",
    ANNULLATO: "PRESA_IN_CARICO"
  };
  const key = mapping[normalized] || "PRESA_IN_CARICO";
  const index = CUSTOMER_PROGRESS_STEPS.findIndex((step) => step.key === key);
  return {
    key,
    index: Math.max(0, index),
    percent: normalized === "ANNULLATO" ? 100 : Math.round(((Math.max(0, index) + 1) / CUSTOMER_PROGRESS_STEPS.length) * 100),
    cancelled: normalized === "ANNULLATO"
  };
}

export function deviceDisplayName(device = {}, repair = {}) {
  const type = String(device.type || "").trim();
  const brand = String(device.brand || repair.brand || "").trim();
  const model = String(device.model || repair.model || "").trim();
  return [type, brand, model].filter(Boolean).join(" ") || "Dispositivo";
}

export function deviceIdentifier(device = {}, repair = {}) {
  const imei = String(device.imei || repair.imei || "").trim();
  const serial = String(device.serialNumber || "").trim();
  if (imei) return `IMEI ${imei}`;
  if (serial) return `S/N ${serial}`;
  return "";
}

export function formatItalianDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export function maskCustomerName(name) {
  const value = String(name || "").trim();
  if (!value) return "Cliente";
  return value
    .split(/\s+/)
    .map((part) => part.length <= 2 ? `${part[0] || ""}*` : `${part.slice(0, 2)}${"*".repeat(Math.min(3, part.length - 2))}`)
    .join(" ");
}

export function publicBaseUrlFromRequest(settings = {}, requestHeaders) {
  const configured = String(settings.publicBaseUrl || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = requestHeaders?.get?.("x-forwarded-host") || requestHeaders?.get?.("host") || "";
  if (!host) return "";
  const forwardedProto = requestHeaders?.get?.("x-forwarded-proto");
  const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host);
  const protocol = forwardedProto || (local ? "http" : "https");
  return `${protocol}://${host}`;
}

export function customerStatusUrl(baseUrl, publicToken) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  const token = encodeURIComponent(String(publicToken || ""));
  return base && token ? `${base}/stato/${token}` : token ? `/stato/${token}` : "";
}

function cleanList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean))];
}
