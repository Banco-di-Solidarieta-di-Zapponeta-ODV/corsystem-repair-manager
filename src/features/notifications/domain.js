export const NOTIFICATION_EVENTS = [
  "INTAKE_CREATED",
  "QUOTE_SENT",
  "QUOTE_APPROVED",
  "QUOTE_REJECTED",
  "WAITING_PART",
  "READY",
  "DELIVERED"
];

export const NOTIFICATION_CHANNELS = ["email", "whatsapp", "sms"];
export const NOTIFICATION_STATUSES = ["QUEUED", "SENDING", "SENT", "FAILED"];

export function normalizeItalianPhone(value) {
  let raw = String(value || "").trim().replace(/[^0-9+]/g, "");
  if (!raw) return "";
  if (raw.startsWith("00")) raw = `+${raw.slice(2)}`;
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("39") && raw.length >= 11) return `+${raw}`;
  return `+39${raw.replace(/^0+/, "")}`;
}

export function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function firstName(value) {
  return String(value || "Cliente").trim().split(/\s+/)[0] || "Cliente";
}

export function renderNotification(event, context = {}) {
  const customer = firstName(context.customerName);
  const ticket = context.ticket || "";
  const device = [context.brand, context.model].filter(Boolean).join(" ") || "dispositivo";
  const statusUrl = context.statusUrl || "";
  const quoteUrl = context.quoteUrl || "";
  const amount = Number(context.amount || 0);
  const amountText = amount > 0 ? ` Importo: € ${amount.toFixed(2).replace(".", ",")}.` : "";

  const templates = {
    INTAKE_CREATED: {
      subject: `CorSystem - pratica ${ticket} registrata`,
      body: `Ciao ${customer}, abbiamo registrato il tuo ${device} con pratica ${ticket}. Puoi seguire lo stato qui: ${statusUrl}`
    },
    QUOTE_SENT: {
      subject: `CorSystem - preventivo disponibile per ${ticket}`,
      body: `Ciao ${customer}, il preventivo della pratica ${ticket} è pronto.${amountText} Puoi consultarlo e rispondere qui: ${quoteUrl}`
    },
    QUOTE_APPROVED: {
      subject: `CorSystem - preventivo approvato ${ticket}`,
      body: `Ciao ${customer}, abbiamo ricevuto l'approvazione del preventivo per la pratica ${ticket}. Procederemo con la lavorazione. Stato pratica: ${statusUrl}`
    },
    QUOTE_REJECTED: {
      subject: `CorSystem - preventivo non approvato ${ticket}`,
      body: `Ciao ${customer}, abbiamo registrato la tua decisione sul preventivo della pratica ${ticket}. Se necessario ti contatteremo per concordare i prossimi passi. Stato pratica: ${statusUrl}`
    },
    WAITING_PART: {
      subject: `CorSystem - ricambio in attesa ${ticket}`,
      body: `Ciao ${customer}, la pratica ${ticket} è in attesa di un ricambio necessario alla riparazione. Puoi seguire gli aggiornamenti qui: ${statusUrl}`
    },
    READY: {
      subject: `CorSystem - ${ticket} pronto per il ritiro`,
      body: `Ciao ${customer}, il tuo ${device} è pronto per il ritiro presso CorSystem.${amountText} Stato pratica: ${statusUrl}`
    },
    DELIVERED: {
      subject: `CorSystem - pratica ${ticket} consegnata`,
      body: `Ciao ${customer}, la pratica ${ticket} risulta consegnata. Grazie per aver scelto CorSystem. Puoi conservare questo link come riferimento: ${statusUrl}`
    }
  };

  return templates[event] || {
    subject: `CorSystem - aggiornamento pratica ${ticket}`,
    body: `Ciao ${customer}, ci sono aggiornamenti sulla pratica ${ticket}. Stato: ${statusUrl}`
  };
}

export function eventEnvKey(event) {
  return String(event || "").replace(/[^A-Z0-9]+/gi, "_").toUpperCase();
}
