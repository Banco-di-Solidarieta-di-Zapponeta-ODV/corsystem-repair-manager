import { eventEnvKey, normalizeItalianPhone, validEmail } from "@/features/notifications/domain";

export function notificationProviderStatus() {
  return {
    email: {
      provider: "resend",
      enabled: envTrue("NOTIFICATIONS_EMAIL_ENABLED"),
      configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM)
    },
    whatsapp: {
      provider: "meta",
      enabled: envTrue("NOTIFICATIONS_WHATSAPP_ENABLED"),
      configured: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.META_GRAPH_API_VERSION
      )
    },
    sms: {
      provider: "twilio",
      enabled: envTrue("NOTIFICATIONS_SMS_ENABLED"),
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM)
      )
    }
  };
}

export function providerForChannel(channel) {
  if (channel === "email") return "resend";
  if (channel === "whatsapp") return "meta";
  if (channel === "sms") return "twilio";
  return "";
}

export async function sendNotificationWithProvider(notification, context = {}) {
  if (notification.channel === "email") return sendEmail(notification);
  if (notification.channel === "whatsapp") return sendWhatsApp(notification, context);
  if (notification.channel === "sms") return sendSms(notification);
  throw new Error(`Canale non supportato: ${notification.channel}`);
}

async function sendEmail(notification) {
  const recipient = validEmail(notification.recipient);
  if (!recipient) throw new Error("Indirizzo email non valido");
  requireEnv("RESEND_API_KEY");
  requireEnv("RESEND_FROM");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "CorSystem-Repair-Manager/0.1",
      "Idempotency-Key": String(notification.dedupeKey || notification.id).slice(0, 256)
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [recipient],
      subject: notification.subject || "CorSystem - aggiornamento riparazione",
      text: notification.body
    }),
    signal: AbortSignal.timeout(12000)
  });

  const payload = await readJson(response);
  if (!response.ok) throw new Error(providerError("Resend", response, payload));
  return { externalId: String(payload?.id || ""), provider: "resend" };
}

async function sendWhatsApp(notification, context = {}) {
  requireEnv("WHATSAPP_ACCESS_TOKEN");
  requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  requireEnv("META_GRAPH_API_VERSION");

  const recipient = normalizeItalianPhone(notification.recipient).replace(/^\+/, "");
  if (!recipient) throw new Error("Numero WhatsApp non valido");

  const eventKey = eventEnvKey(notification.event);
  const templateName = process.env[`WHATSAPP_TEMPLATE_${eventKey}`] || "";
  const allowSessionText = envTrue("WHATSAPP_ALLOW_SESSION_TEXT");
  let message;

  if (templateName) {
    message = {
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "it" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(context.customerName || "Cliente").slice(0, 120) },
              { type: "text", text: String(context.ticket || "").slice(0, 120) },
              { type: "text", text: String(notification.body || "").slice(0, 900) }
            ]
          }
        ]
      }
    };
  } else if (allowSessionText) {
    message = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: false, body: notification.body }
    };
  } else {
    throw new Error(
      `Template WhatsApp mancante per ${notification.event}. Configura WHATSAPP_TEMPLATE_${eventKey} oppure abilita WHATSAPP_ALLOW_SESSION_TEXT solo per conversazioni consentite.`
    );
  }

  const url = `https://graph.facebook.com/${encodeURIComponent(process.env.META_GRAPH_API_VERSION)}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(12000)
  });

  const payload = await readJson(response);
  if (!response.ok) throw new Error(providerError("Meta WhatsApp", response, payload));
  return { externalId: String(payload?.messages?.[0]?.id || ""), provider: "meta" };
}

async function sendSms(notification) {
  requireEnv("TWILIO_ACCOUNT_SID");
  requireEnv("TWILIO_AUTH_TOKEN");
  const recipient = normalizeItalianPhone(notification.recipient);
  if (!recipient) throw new Error("Numero SMS non valido");

  const form = new URLSearchParams();
  form.set("To", recipient);
  form.set("Body", notification.body);
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    requireEnv("TWILIO_FROM");
    form.set("From", process.env.TWILIO_FROM);
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: form.toString(),
    signal: AbortSignal.timeout(12000)
  });

  const payload = await readJson(response);
  if (!response.ok) throw new Error(providerError("Twilio", response, payload));
  return { externalId: String(payload?.sid || ""), provider: "twilio" };
}

function envTrue(name) {
  return String(process.env[name] || "").trim().toLowerCase() === "true";
}

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Configurazione mancante: ${name}`);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 1000) };
  }
}

function providerError(provider, response, payload) {
  const message =
    payload?.message ||
    payload?.error?.message ||
    payload?.errors?.[0]?.message ||
    `HTTP ${response.status}`;
  return `${provider}: ${String(message).slice(0, 1200)}`;
}
