export const STOCK_MOVEMENT_TYPES = ["RECEIVE", "ISSUE", "RETURN", "ADJUSTMENT"];
export const REPAIR_PART_STATUSES = ["REQUESTED", "ORDERED", "RESERVED", "RECEIVED", "USED", "CANCELLED"];

export const STOCK_MOVEMENT_LABELS = {
  RECEIVE: "Carico",
  ISSUE: "Scarico",
  RETURN: "Reso a magazzino",
  ADJUSTMENT: "Rettifica"
};

export const REPAIR_PART_STATUS_LABELS = {
  REQUESTED: "Richiesto",
  ORDERED: "Ordinato",
  RESERVED: "Prenotato",
  RECEIVED: "Ricevuto",
  USED: "Utilizzato",
  CANCELLED: "Annullato"
};

export function normalizePartInput(input = {}) {
  return {
    defaultName: clean(input.defaultName || input.name, 500),
    category: clean(input.category, 191),
    sku: nullableClean(input.sku, 64)?.toUpperCase() || null,
    barcode: nullableClean(input.barcode, 128),
    supplierId: nullableClean(input.supplierId, 191),
    price: nonNegativeMoney(input.price),
    cost: nonNegativeMoney(input.cost),
    minStock: nonNegativeQty(input.minStock),
    location: clean(input.location, 191),
    active: input.active !== false
  };
}

export function normalizeSupplierInput(input = {}) {
  return {
    name: clean(input.name, 191),
    vatNumber: clean(input.vatNumber, 191).toUpperCase(),
    taxCode: clean(input.taxCode, 191).toUpperCase(),
    email: clean(input.email, 191).toLowerCase(),
    phone: clean(input.phone, 191),
    address: clean(input.address, 4000),
    website: clean(input.website, 191),
    notes: clean(input.notes, 8000),
    active: input.active !== false
  };
}

export function nonNegativeQty(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 1000) / 1000;
}

export function positiveQty(value) {
  const qty = nonNegativeQty(value);
  if (qty <= 0) throw new Error("La quantità deve essere maggiore di zero");
  return qty;
}

export function nonNegativeMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

export function availableStock(part = {}, reservedQty = 0) {
  return Math.max(0, Number(part.stockQty || 0) - Number(reservedQty || 0));
}

export function isLowStock(part = {}) {
  const min = Number(part.minStock || 0);
  return min > 0 && Number(part.stockQty || 0) <= min;
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function nullableClean(value, maxLength) {
  const result = clean(value, maxLength);
  return result || null;
}
