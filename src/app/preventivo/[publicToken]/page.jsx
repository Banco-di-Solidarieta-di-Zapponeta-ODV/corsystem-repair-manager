import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deviceDisplayName, formatItalianDateTime, maskCustomerName } from "@/features/intake/receipt";
import { isQuoteExpired, QUOTE_STATUS_LABELS, serializeMoney } from "@/features/workflow/domain";
import QuoteDecision from "./QuoteDecision";
import styles from "./page.module.css";

export const metadata = {
  title: "Preventivo riparazione | CorSystem",
  robots: { index: false, follow: false, nocache: true }
};

export default async function PublicQuotePage({ params }) {
  const { publicToken } = await params;
  const quote = await prisma.quote.findUnique({
    where: { publicToken },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      repair: {
        include: {
          client: true,
          device: true,
          diagnosis: true
        }
      }
    }
  });

  if (!quote || ["DRAFT", "LEGACY"].includes(quote.status)) notFound();

  const expired = quote.status === "SENT" && isQuoteExpired(quote);
  const status = expired ? "EXPIRED" : quote.status;
  const repair = quote.repair;
  const deviceName = deviceDisplayName(repair.device || {}, repair);
  const diagnosisSummary = String(repair.diagnosis?.customerSummary || "").trim();
  const statusLabel = QUOTE_STATUS_LABELS[status] || status;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>CorSystem · Repair Manager</div>
          <div className={styles.kicker}>Preventivo di riparazione</div>
          <h1>{quote.title || "Preventivo riparazione"}</h1>
          <div className={styles.ticket}>{repair.ticket} · versione {quote.version}</div>
          <div className={`${styles.status} ${styles[`status${status}`] || ""}`}>{statusLabel}</div>
        </header>

        <section className={styles.card}>
          <h2>Pratica</h2>
          <div className={styles.grid}>
            <Field label="Cliente" value={maskCustomerName(repair.client?.name)} />
            <Field label="Dispositivo" value={deviceName} />
            <Field label="Problema segnalato" value={repair.issue || "-"} wide />
            {diagnosisSummary ? <Field label="Esito della diagnosi" value={diagnosisSummary} wide /> : null}
          </div>
        </section>

        <section className={styles.card}>
          <h2>Voci del preventivo</h2>
          <div className={styles.items}>
            {quote.items.map((item) => (
              <div className={styles.item} key={item.id}>
                <div>
                  <strong>{item.description}</strong>
                  <span>{itemTypeLabel(item.type)} · {Number(item.qty)} × € {serializeMoney(item.unitPrice)}</span>
                </div>
                <strong>€ {serializeMoney(item.lineTotal)}</strong>
              </div>
            ))}
          </div>
          <div className={styles.totals}>
            <div><span>Subtotale</span><strong>€ {serializeMoney(quote.subtotal)}</strong></div>
            {Number(quote.discountAmount) > 0 ? <div><span>Sconto</span><strong>- € {serializeMoney(quote.discountAmount)}</strong></div> : null}
            <div className={styles.grandTotal}><span>Totale</span><strong>€ {serializeMoney(quote.total)}</strong></div>
          </div>
        </section>

        {(quote.customerMessage || quote.estimatedDays || quote.validUntil) ? (
          <section className={styles.card}>
            <h2>Informazioni</h2>
            {quote.customerMessage ? <p className={styles.message}>{quote.customerMessage}</p> : null}
            <div className={styles.infoGrid}>
              {quote.estimatedDays ? <Field label="Tempo stimato" value={`${quote.estimatedDays} ${quote.estimatedDays === 1 ? "giorno" : "giorni"}`} /> : null}
              {quote.validUntil ? <Field label="Valido fino al" value={formatItalianDateTime(quote.validUntil)} /> : null}
              {quote.sentAt ? <Field label="Inviato il" value={formatItalianDateTime(quote.sentAt)} /> : null}
            </div>
          </section>
        ) : null}

        <QuoteDecision publicToken={publicToken} initialStatus={status} expired={expired} />

        <footer className={styles.footer}>
          Questo collegamento è personale e associato alla pratica {repair.ticket}. Non inoltrarlo a terzi.<br />
          CorSystem · il tuo hub tecnologico
        </footer>
      </div>
    </main>
  );
}

function Field({ label, value, wide = false }) {
  return (
    <div className={wide ? styles.wide : ""}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{String(value || "-")}</div>
    </div>
  );
}

function itemTypeLabel(type) {
  return { service: "Servizio", part: "Ricambio", other: "Altro", legacy: "Storico" }[type] || "Voce";
}
