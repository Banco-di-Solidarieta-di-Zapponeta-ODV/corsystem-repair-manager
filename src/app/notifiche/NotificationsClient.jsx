"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./notifications.module.css";

const STATUS_LABEL = {
  QUEUED: "In coda",
  SENDING: "Invio",
  SENT: "Inviata",
  FAILED: "Errore"
};

export default function NotificationsClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications?limit=150", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Impossibile caricare le notifiche");
      setData(payload);
    } catch (err) {
      setError(err.message || "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const providerCards = useMemo(() => {
    if (!data?.providers) return [];
    return Object.entries(data.providers).map(([channel, info]) => ({ channel, ...info }));
  }, [data]);

  async function post(body, key) {
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Operazione non riuscita");
      await load();
    } catch (err) {
      setError(err.message || "Operazione non riuscita");
    } finally {
      setBusy("");
    }
  }

  if (loading && !data) return <div className={styles.loading}>Caricamento notifiche…</div>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <a className={styles.back} href="/#/dashboard/repairs">← Riparazioni</a>
            <div className={styles.kicker}>CorSystem Repair Manager</div>
            <h1>Notifiche clienti</h1>
            <p>Email, WhatsApp e SMS con coda persistente, tentativi ed errori tracciati.</p>
          </div>
          <button
            className={styles.primary}
            disabled={busy === "queue"}
            onClick={() => post({ action: "dispatch-queued", limit: 50 }, "queue")}
          >
            {busy === "queue" ? "Invio…" : "Invia coda"}
          </button>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}

        <section className={styles.providers}>
          {providerCards.map((item) => (
            <article className={styles.provider} key={item.channel}>
              <span className={styles.channel}>{item.channel}</span>
              <strong>{item.provider}</strong>
              <div className={item.enabled && item.configured ? styles.ok : styles.warn}>
                {!item.enabled ? "Disattivato" : item.configured ? "Configurato" : "Configurazione incompleta"}
              </div>
            </article>
          ))}
        </section>

        <section className={styles.metrics}>
          {["QUEUED", "SENDING", "SENT", "FAILED"].map((status) => (
            <div className={styles.metric} key={status}>
              <span>{STATUS_LABEL[status]}</span>
              <strong>{data?.counts?.[status] || 0}</strong>
            </div>
          ))}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2>Registro invii</h2>
              <p>Le credenziali dei provider non vengono mostrate né salvate qui.</p>
            </div>
            <button className={styles.secondary} onClick={load} disabled={loading}>Aggiorna</button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pratica</th>
                  <th>Evento</th>
                  <th>Canale</th>
                  <th>Destinatario</th>
                  <th>Stato</th>
                  <th>Tentativi</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.repair?.ticket || "-"}</strong>
                      <span>{row.repair?.client?.name || ""}</span>
                    </td>
                    <td>{eventLabel(row.event)}</td>
                    <td>{row.channel}</td>
                    <td>{maskRecipient(row.recipient, row.channel)}</td>
                    <td><span className={`${styles.badge} ${styles[`status_${row.status}`] || ""}`}>{STATUS_LABEL[row.status] || row.status}</span></td>
                    <td>{row.attempts}</td>
                    <td>{formatDate(row.sentAt || row.lastAttemptAt || row.createdAt)}</td>
                    <td>
                      {row.status === "FAILED" || row.status === "QUEUED" ? (
                        <button
                          className={styles.small}
                          disabled={busy === row.id}
                          onClick={() => post({ action: "retry", notificationId: row.id }, row.id)}
                        >
                          {busy === row.id ? "…" : "Riprova"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!data?.rows?.length ? (
                  <tr><td colSpan="8" className={styles.empty}>Nessuna notifica registrata.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function eventLabel(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function maskRecipient(value, channel) {
  const text = String(value || "");
  if (channel === "email") {
    const [name, domain] = text.split("@");
    if (!domain) return text;
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (text.length <= 5) return text;
  return `${text.slice(0, 4)}••••${text.slice(-3)}`;
}
