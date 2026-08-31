export const DIAGNOSIS_STATUSES = ["DRAFT", "FINAL"];
export const QUOTE_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED", "SUPERSEDED", "LEGACY"];
export const QUOTE_ITEM_TYPES = ["service", "part", "other", "legacy"];

export const QUOTE_STATUS_LABELS = {
  DRAFT: "Bozza",
  SENT: "Inviato al cliente",
  APPROVED: "Approvato",
  REJECTED: "Rifiutato",
  EXPIRED: "Scaduto",
  SUPERSEDED: "Sostituito da nuova versione",
  LEGACY: "Importato dallo storico"
};

export function normalizeDiagnosisInput(input = {}) {
  return {
    status: DIAGNOSIS_STATUSES.includes(input.status) ? input.status : "DRAFT",
    technicianId: cleanText(input.technicianId, 191),
    technicianName: cleanText(input.technicianName, 191),
    findings: cleanText(input.findings, 12000),
    rootCause: cleanText(input.rootCause, 12000),
    proposedWork: cleanText(input.proposedWork, 12000),
    partsNeeded: cleanText(input.partsNeeded, 12000),
    testsPerformed: cleanText(input.testsPerformed, 12000),
    riskNotes: cleanText(input.riskNotes, 12000),
    customerSummary: cleanText(input.customerSummary, 12000)
  };
}

export function normalizeQuoteInput(input = {}) {
  const items = normalizeQuoteItems(input.items);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = Math.min(subtotal, Math.max(0, roundMoney(input.discountAmount)));
  const total = roundMoney(subtotal - discountAmount);
  const estimatedDays = optionalPositiveInt(input.estimatedDays, 3650);
  const validUntil = optionalDate(input.validUntil);

  return {
    title: cleanText(input.title, 191) || "Preventivo riparazione",
    customerMessage: cleanText(input.customerMessage, 12000),
    internalNote: cleanText(input.internalNote, 12000),
    items,
    subtotal,
    discountAmount,
    total,
    estimatedDays,
    validUntil
  };
}

export function normalizeQuoteItems(value) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item, index) => {
      const qty = positiveDecimal(item?.qty, 1, 9999);
      const unitPrice = Math.max(0, roundMoney(item?.unitPrice));
      const unitCost = Math.max(0, roundMoney(item?.unitCost));
      return {
        type: QUOTE_ITEM_TYPES.includes(item?.type) ? item.type : "service",
        description: cleanText(item?.description, 4000),
        qty,
        unitPrice,
        unitCost,
        lineTotal: roundMoney(qty * unitPrice),
        lineCost: roundMoney(qty * unitCost),
        sortOrder: index
      };
    })
    .filter((item) => item.description);
}

export function quoteMargin(quote) {
  const revenue = Number(quote?.total || 0);
  const cost = (quote?.items || []).reduce((sum, item) => sum + Number(item.lineCost || 0), 0);
  return {
    revenue: roundMoney(revenue),
    cost: roundMoney(cost),
    margin: roundMoney(revenue - cost)
  };
}

export function isQuoteExpired(quote, now = new Date()) {
  return Boolean(quote?.validUntil && new Date(quote.validUntil).getTime() < now.getTime());
}

export function serializeMoney(value) {
  return Number(value || 0).toFixed(2);
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function roundMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function positiveDecimal(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(max, Math.round(number * 1000) / 1000);
}

function optionalPositiveInt(value, max) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return Math.min(max, number);
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
