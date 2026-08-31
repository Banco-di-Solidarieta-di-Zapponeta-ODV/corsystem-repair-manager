"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./dashboard.module.css";

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export default function DashboardClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard-operativo", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Impossibile caricare la dashboard");
      setData(payload);
    } catch (err) {
      setError(err?.message || "Errore durante il caricamento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lastUpdate = useMemo(() => {
    if (!data?.generatedAt) return "";
    return new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Rome"
    }).format(new Date(data.generatedAt));
  }, [data?.generatedAt]);

  if (loading && !data) {
    return <main className={styles.shell}><div className={styles.loading}>Caricamento dashboard CorSystem…</div></main>;
  }

  if (error && !data) {
    return (
      <main className={styles.shell}>
        <div className={styles.errorBox}>
          <strong>Dashboard non disponibile</strong>
          <span>{error}</span>
          <button type="button" onClick={load}>Riprova</button>
        </div>
      </main>
    );
  }

  const kpi = data?.kpis || {};
  const financial = data?.financial30d || {};

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>CorSystem Repair Manager</div>
          <h1>Dashboard operativo</h1>
          <p>Stato del laboratorio, criticità, carico tecnici e andamento economico.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.updated}>Aggiornato {lastUpdate}</span>
          <button type="button" onClick={load} disabled={loading}>{loading ? "Aggiorno…" : "Aggiorna"}</button>
          <a href="/intake">Nuova accettazione</a>
          <a href="/#/dashboard/repairs">Riparazioni</a>
        </div>
      </header>

      {error ? <div className={styles.inlineError}>{error}</div> : null}

      <section className={styles.kpiGrid} aria-label="Indicatori principali">
        <Kpi title="Pratiche aperte" value={kpi.openRepairs || 0} note="Tutto il lavoro ancora attivo" />
        <Kpi title="Attesa cliente" value={kpi.pendingQuotes || 0} note="Preventivi inviati senza risposta" tone={kpi.pendingQuotes ? "warning" : "normal"} />
        <Kpi title="Attesa ricambio" value={kpi.waitingPart || 0} note="Pratiche bloccate dai materiali" tone={kpi.waitingPart ? "warning" : "normal"} />
        <Kpi title="Pronti" value={kpi.ready || 0} note={`${kpi.overdueReady || 0} da oltre 3 giorni`} tone={kpi.overdueReady ? "danger" : "good"} />
        <Kpi title="Senza tecnico" value={kpi.unassigned || 0} note="Pratiche da assegnare" tone={kpi.unassigned ? "warning" : "good"} />
        <Kpi title="Scorte basse" value={kpi.lowStock || 0} note="Articoli alla soglia minima" tone={kpi.lowStock ? "warning" : "good"} href="/magazzino" />
        <Kpi title="Notifiche fallite" value={kpi.failedNotifications || 0} note="Messaggi da verificare" tone={kpi.failedNotifications ? "danger" : "good"} href="/notifiche" />
        <Kpi title="Incassi 30 gg" value={euro.format(financial.payments || 0)} note={`${financial.paymentMovements || 0} movimenti`} />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Flusso lavorazioni</h2>
            <p>Dove si trovano oggi le pratiche aperte.</p>
          </div>
        </div>
        <div className={styles.pipeline}>
          {(data?.pipeline || []).map((item) => (
            <div className={styles.pipelineItem} key={item.key}>
              <strong>{item.count}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Pratiche da attenzionare</h2>
              <p>Le situazioni che rischiano di rallentare il laboratorio o il ritiro.</p>
            </div>
          </div>
          {(data?.alerts || []).length ? (
            <div className={styles.list}>
              {data.alerts.map((item) => (
                <a className={styles.alertRow} key={item.id} href={repairActionHref(item)}>
                  <span className={`${styles.severity} ${item.severity >= 4 ? styles.severityHigh : item.severity >= 3 ? styles.severityMedium : styles.severityLow}`} />
                  <div className={styles.alertMain}>
                    <div className={styles.alertTitle}>
                      <strong>{item.ticket}</strong>
                      <span>{item.clientName}</span>
                    </div>
                    <div className={styles.alertMeta}>{item.device} · {item.technicianName}</div>
                  </div>
                  <div className={styles.alertReason}>{item.reason}</div>
                </a>
              ))}
            </div>
          ) : <Empty text="Nessuna criticità operativa rilevata." />}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Carico tecnici</h2>
              <p>Distribuzione delle pratiche ancora aperte.</p>
            </div>
          </div>
          {(data?.technicians || []).length ? (
            <div className={styles.techList}>
              {data.technicians.map((tech) => (
                <div className={styles.techRow} key={tech.id}>
                  <div className={styles.techName}><strong>{tech.name}</strong><span>{tech.total} pratiche</span></div>
                  <div className={styles.techStats}>
                    <Mini label="Diagnosi" value={tech.diagnosis} />
                    <Mini label="Ricambi" value={tech.waitingPart} />
                    <Mini label="Lavoro" value={tech.working} />
                    <Mini label="Test" value={tech.testing} />
                    <Mini label="Pronti" value={tech.ready} />
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="Nessuna pratica aperta assegnata." />}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Economia del laboratorio</h2>
            <p>Ultimi 30 giorni, con tempo medio calcolato sulle consegne degli ultimi 90 giorni.</p>
          </div>
        </div>
        <div className={styles.financeGrid}>
          <Finance label="Incassi" value={euro.format(financial.payments || 0)} />
          <Finance label="Valore consegnato" value={euro.format(financial.deliveredValue || 0)} sub={`${financial.deliveries || 0} consegne`} />
          <Finance label="Costi registrati" value={euro.format(financial.deliveredCost || 0)} />
          <Finance label="Margine" value={euro.format(financial.margin || 0)} />
          <Finance label="Ticket medio" value={euro.format(financial.averageTicket || 0)} />
          <Finance label="Tempo medio" value={formatTurnaround(financial.averageTurnaroundHours || 0)} sub="accettazione → consegna" />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Scorte da riordinare</h2>
            <p>Ricambi alla soglia minima o sotto soglia.</p>
          </div>
          <a className={styles.textLink} href="/magazzino">Apri magazzino</a>
        </div>
        {(data?.lowStock || []).length ? (
          <div className={styles.stockTable}>
            <div className={`${styles.stockRow} ${styles.stockHead}`}>
              <span>Ricambio</span><span>SKU</span><span>Giacenza</span><span>Minimo</span><span>Posizione / fornitore</span>
            </div>
            {data.lowStock.map((part) => (
              <div className={styles.stockRow} key={part.id}>
                <strong>{part.name}</strong>
                <span>{part.sku || "—"}</span>
                <span>{part.stockQty}</span>
                <span>{part.minStock}</span>
                <span>{[part.location, part.supplierName].filter(Boolean).join(" · ") || "—"}</span>
              </div>
            ))}
          </div>
        ) : <Empty text="Nessun ricambio sotto la scorta minima." />}
      </section>
    </main>
  );
}

function Kpi({ title, value, note, tone = "normal", href = "" }) {
  const content = (
    <>
      <span className={styles.kpiTitle}>{title}</span>
      <strong className={styles.kpiValue}>{value}</strong>
      <span className={styles.kpiNote}>{note}</span>
    </>
  );
  const className = `${styles.kpiCard} ${tone === "warning" ? styles.kpiWarning : tone === "danger" ? styles.kpiDanger : tone === "good" ? styles.kpiGood : ""}`;
  return href ? <a className={className} href={href}>{content}</a> : <div className={className}>{content}</div>;
}

function Finance({ label, value, sub = "" }) {
  return <div className={styles.financeCard}><span>{label}</span><strong>{value}</strong>{sub ? <small>{sub}</small> : null}</div>;
}

function Mini({ label, value }) {
  return <div className={styles.mini}><strong>{value}</strong><span>{label}</span></div>;
}

function Empty({ text }) {
  return <div className={styles.empty}>{text}</div>;
}

function repairActionHref(item) {
  if (item.status === "PRONTO" || item.status === "IN_TEST") return `/chiusura/${encodeURIComponent(item.id)}`;
  if (item.status === "ATTESA_RICAMBIO") return `/magazzino/pratica/${encodeURIComponent(item.id)}`;
  return `/lavorazione/${encodeURIComponent(item.id)}`;
}

function formatTurnaround(hours) {
  if (!hours) return "—";
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round((hours / 24) * 10) / 10} gg`;
}
