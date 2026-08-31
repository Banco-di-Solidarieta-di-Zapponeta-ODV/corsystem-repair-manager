export const DEFAULT_CLIENT_LEVEL = "Standard";
export const CLIENT_LEVELS = ["Standard", "VIP", "Attenzione"];
export const DEFAULT_DOCUMENT_TYPE = "CF";

export function normalizeClientName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/(^|\s|['’-])(\p{L})/gu, (match) => match.toLocaleUpperCase("it-IT"));
}

export function normalizePhone(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeClientLevel(value) {
  return CLIENT_LEVELS.includes(value) ? value : DEFAULT_CLIENT_LEVEL;
}

export function clientDisplayLabel(client) {
  if (!client) return "Cliente";
  const name = String(client.name || "").trim();
  const phone = String(client.phone || "").trim();
  return [name, phone].filter(Boolean).join(" · ") || "Cliente";
}
