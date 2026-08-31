export const TEST_CHECKS = [
  ["power", "Accensione e stabilità"],
  ["charging", "Ricarica / alimentazione"],
  ["display", "Display e touch"],
  ["audio", "Audio, microfono e altoparlanti"],
  ["camera", "Fotocamere"],
  ["connectivity", "Wi-Fi, Bluetooth e rete"],
  ["sensors", "Sensori / biometria"],
  ["ports", "Porte, tasti e connettori"],
  ["specific", "Test specifico della riparazione"]
];

export const TEST_VALUES = ["PASS", "FAIL", "NA"];
export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "other"];

export function normalizeChecklist(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return Object.fromEntries(TEST_CHECKS.map(([key]) => {
    const value = String(source[key] || "NA").toUpperCase();
    return [key, TEST_VALUES.includes(value) ? value : "NA"];
  }));
}

export function checklistCanPass(checklist) {
  const values = Object.values(normalizeChecklist(checklist));
  return values.some((value) => value === "PASS") && values.every((value) => value !== "FAIL");
}

export function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function paymentMethodLabel(method) {
  return {
    cash: "Contanti",
    card: "Carta / POS",
    bank_transfer: "Bonifico",
    other: "Altro"
  }[method] || method || "Altro";
}

export function addMonths(dateValue, months) {
  const date = new Date(dateValue);
  const count = Math.max(0, Math.min(60, Math.trunc(Number(months || 0))));
  if (!count || Number.isNaN(date.getTime())) return null;
  const target = new Date(date);
  const day = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + count);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}
