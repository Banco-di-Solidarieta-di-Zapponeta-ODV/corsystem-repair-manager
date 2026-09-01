import { prisma } from "@/lib/prisma";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  normalizeItalianPhone,
  renderNotification,
  validEmail
} from "@/features/notifications/domain";
import {
  notificationProviderStatus,
  providerForChannel,
  sendNotificationWithProvider
} from "@/features/notifications/providers";

const MAX_ATTEMPTS = 5;

export async function notifyRepairEvent(repairId, event, options = {}) {
  if (!NOTIFICATION_EVENTS.includes(event)) throw new Error(`Evento notifica non valido: ${event}`);
  const repair = await prisma.repair.findUnique({
    where: { id: repairId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      device: { select: { brand: true, model: true } },
      quotes: { orderBy: { version: "desc" }, take: 1 }
    }
  });
  if (!repair) return { queued: [], skipped: ["repair-not-found"] };

  const context = buildContext(repair, options);
  const rendered = renderNotification(event, context);
  const providers = notificationProviderStatus();
  const queued = [];
  const skipped = [];

  for (const channel of NOTIFICATION_CHANNELS) {
    const provider = providers[channel];
    if (!provider?.enabled) {
      skipped.push(`${channel}:disabled`);
      continue;
    }

    const recipient = recipientForChannel(channel, repair.client);
    if (!recipient) {
      skipped.push(`${channel}:recipient-missing`);
      continue;
    }

    const dedupeSuffix = String(options.dedupeSuffix || options.quoteId || options.quotePublicToken || "default")
      .replace(/[^a-zA-Z0-9_.:-]/g, "")
      .slice(0, 80);
    const dedupeKey = `${repair.id}:${event}:${channel}:${dedupeSuffix}`.slice(0, 191);
    const record = await prisma.notification.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        repairId: repair.id,
        event,
        channel,
        status: "QUEUED",
        provider: providerForChannel(channel),
        recipient,
        subject: rendered.subject.slice(0, 191),
        body: rendered.body,
        lastError: "",
        dedupeKey
      }
    });
    queued.push(record);
  }

  const autoSend = String(process.env.NOTIFICATIONS_AUTO_SEND || "true").toLowerCase() !== "false";
  const results = [];
  if (autoSend) {
    for (const item of queued) results.push(await safeDispatch(item.id));
  }

  return { queued, skipped, results };
}

export async function dispatchQueuedNotifications(limit = 25) {
  const take = Math.max(1, Math.min(100, Number(limit) || 25));
  const rows = await prisma.notification.findMany({
    where: {
      status: { in: ["QUEUED", "FAILED"] },
      attempts: { lt: MAX_ATTEMPTS },
      scheduledAt: { lte: new Date() }
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take
  });

  const results = [];
  for (const row of rows) results.push(await safeDispatch(row.id));
  return results;
}

export async function dispatchNotification(id, { force = false } = {}) {
  const existing = await prisma.notification.findUnique({
    where: { id },
    include: { repair: { include: { client: true, device: true } } }
  });
  if (!existing) throw new Error("Notifica non trovata");
  if (existing.status === "SENT" && !force) return existing;
  if (existing.attempts >= MAX_ATTEMPTS && !force) throw new Error("Numero massimo di tentativi raggiunto");

  const providerState = notificationProviderStatus()[existing.channel];
  if (!providerState?.enabled) throw new Error(`Canale ${existing.channel} disattivato`);
  if (!providerState?.configured) throw new Error(`Provider ${providerState?.provider || existing.channel} non configurato`);

  const claimed = await prisma.notification.updateMany({
    where: {
      id: existing.id,
      ...(force ? {} : { status: { in: ["QUEUED", "FAILED"] } })
    },
    data: {
      status: "SENDING",
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: ""
    }
  });
  if (!claimed.count && !force) return prisma.notification.findUnique({ where: { id: existing.id } });

  try {
    const context = {
      customerName: existing.repair?.client?.name || "Cliente",
      ticket: existing.repair?.ticket || ""
    };
    const sent = await sendNotificationWithProvider(existing, context);
    return await prisma.notification.update({
      where: { id: existing.id },
      data: {
        status: "SENT",
        provider: sent.provider || existing.provider,
        externalId: String(sent.externalId || "").slice(0, 191),
        sentAt: new Date(),
        lastError: ""
      }
    });
  } catch (error) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        status: "FAILED",
        lastError: String(error?.message || error || "Errore invio").slice(0, 10000)
      }
    });
    throw error;
  }
}

export async function notificationDashboard(limit = 100) {
  const take = Math.max(1, Math.min(250, Number(limit) || 100));
  const [rows, grouped] = await Promise.all([
    prisma.notification.findMany({
      take,
      orderBy: [{ createdAt: "desc" }],
      include: {
        repair: {
          select: {
            id: true,
            ticket: true,
            status: true,
            client: { select: { name: true, phone: true, email: true } }
          }
        }
      }
    }),
    prisma.notification.groupBy({ by: ["status"], _count: { _all: true } })
  ]);

  return {
    providers: notificationProviderStatus(),
    autoSend: String(process.env.NOTIFICATIONS_AUTO_SEND || "true").toLowerCase() !== "false",
    rows,
    counts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))
  };
}

async function safeDispatch(id) {
  try {
    return { ok: true, notification: await dispatchNotification(id) };
  } catch (error) {
    return { ok: false, id, error: String(error?.message || error || "Errore invio") };
  }
}

function buildContext(repair, options) {
  const baseUrl = String(process.env.CORSYSTEM_PUBLIC_URL || "").trim().replace(/\/$/, "");
  const latestQuote = repair.quotes?.[0];
  const quoteToken = options.quotePublicToken || latestQuote?.publicToken || "";
  return {
    customerName: repair.client?.name || "Cliente",
    ticket: repair.ticket,
    brand: repair.device?.brand || repair.brand || "",
    model: repair.device?.model || repair.model || "",
    amount: Number(options.amount ?? latestQuote?.total ?? repair.finalAmount ?? repair.budget ?? 0),
    statusUrl: baseUrl ? `${baseUrl}/stato/${encodeURIComponent(repair.publicToken)}` : "",
    quoteUrl: baseUrl && quoteToken ? `${baseUrl}/preventivo/${encodeURIComponent(quoteToken)}` : ""
  };
}

function recipientForChannel(channel, client) {
  if (channel === "email") return validEmail(client?.email);
  if (channel === "whatsapp" || channel === "sms") return normalizeItalianPhone(client?.phone);
  return "";
}
