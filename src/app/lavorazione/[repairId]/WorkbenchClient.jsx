"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const EMPTY_DIAGNOSIS = {
  status: "DRAFT",
  technicianId: "",
  technicianName: "",
  findings: "",
  rootCause: "",
  proposedWork: "",
  partsNeeded: "",
  testsPerformed: "",
  riskNotes: "",
  customerSummary: ""
};

const EMPTY_QUOTE = {
  id: "",
  title: "Preventivo riparazione",
  customerMessage: "",
  internalNote: "",
  discountAmount: 0,
  estimatedDays: "",
  validUntil: "",
  items: [{ type: "service", description: "", qty: 1, unitPrice: 0, unitCost: 0 }]
};

const QUOTE_LABELS = {
  DRAFT: "Bozza",
  SENT: "Inviato",
  APPROVED: "Approvato",
  REJECTED: "Rifiutato",
  EXPIRED: "Scaduto",
  SUPERSEDED: "Sostituito",
  LEGACY: "Storico"
};

export default function WorkbenchClient({ repairId }) {
  const [data, setData] = useState(null);
  const [diagnosis, setDiagnosis] = useState(EMPTY_DIAGNOSIS);
  const [quote, setQuote] = useState(EMPTY_QUOTE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const draftQuote = useMemo(() => data?.repair?.quotes?.find((item) => item.status === "DRAFT") || null, [data]);
  const totals = useMemo(() => quoteTotals(quote), [quote]);

  useEffect(() => {
    load();
  }, [repairId]);

  useEffect(() => {
    if (!data) return;
    setDiagnosis({ ...EMPTY_DIAGNOSIS, ...(data.repair.diagnosis || {}) });
    const draft = data.repair.quotes.find((item) => item.status === "DRAFT");
    setQuote(draft ? quoteFromApi(draft) : EMPTY_QUOTE);
  }, [data]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/workflow/${encodeURIComponent(repairId)}`, { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile caricare la pratica");
      setData(payload);
    } catch (err) {
      setError(err.message || "Errore durante il caricamento");
    } finally {
      setLoading(false);
    }
  }

  async function saveDiagnosis(status) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/workflow/${encodeURIComponent(repairId)}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosis: { ...diagnosis, status } })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile salvare la diagnosi");
      setDiagnosis(payload.diagnosis);
      setNotice(status === "FINAL" ? "Diagnosi finalizzata. Ora puoi preparare il preventivo." : "Bozza diagnosi salvata.");
      await load();
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio della diagnosi");
    } finally {
      setSaving(false);
    }
  }

  async function saveQuote() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const action = quote.id ? "quote-update" : "quote-create";
      const response = await fetch(`/api/workflow/${encodeURIComponent(repairId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, quoteId: quote.id || undefined, quote: quotePayload(quote) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile salvare il preventivo");
      setQuote(quoteFromApi(payload.quote));
      setNotice(`Preventivo v${payload.quote.version} salvato in bozza.`);
      await load();
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio del preventivo");
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote() {
    if (!quote.id) {
      setError("Salva prima la bozza del preventivo.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/workflow/${encodeURIComponent(repairId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote-send", quoteId: quote.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile inviare il preventivo");
      setNotice(`Preventivo v${payload.quote.version} pronto per il cliente. Link: ${payload.publicPath}`);
      await load();
    } catch (err) {
      setError(err.message || "Errore durante l'invio del preventivo");
    } finally {
      setSaving(false);
    }
  }

  async function createVersion(sourceId) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/workflow/${encodeURIComponent(repairId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote-new-version", quoteId: sourceId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile creare una nuova versione");
      setNotice(`Creata bozza preventivo v${payload.quote.version}.`);
      await load();
    } catch (err) {
      setError(err.message || "Errore durante la creazione della nuova versione");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!quote.id) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/workflow/${encodeURIComponent(repairId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote-delete", quoteId: quote.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile eliminare la bozza");
      setQuote(EMPTY_QUOTE);
      setNotice("Bozza preventivo eliminata.");
      await load();
    } catch (err) {
      setError(err.message || "Errore durante l'eliminazione della bozza");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className={styles.page}><div className={styles.loading}>Caricamento pratica...</div></main>;
  if (!data) return <main className={styles.page}><div className={styles.errorBox}>{error || "Pratica non disponibile"}</div></main>;

  const repair = data.repair;
  const diagnosisFinal = diagnosis.status === "FINAL";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div>
            <a className={styles.back} href={`/#/dashboard/repairs/${encodeURIComponent(repair.id)}`}>← Torna alla pratica</a>
            <div className={styles.kicker}>Diagnosi e preventivo</div>
            <h1>{repair.ticket}</h1>
            <div className={styles.subtitle}>{repair.client?.name || "Cliente"} · {deviceLabel(repair.device)}</div>
          </div>
          <div className={styles.statusPill}>{statusLabel(repair.status)}</div>
        </header>

        {error ? <div className={styles.errorBox}>{error}</div> : null}
        {notice ? <div className={styles.noticeBox}>{notice}</div> : null}

        <section className={styles.summaryGrid}>
          <Summary label="Problema segnalato" value={repair.issue || "-"} />
          <Summary label="Tecnico pratica" value={repair.technicianName || "Da assegnare"} />
          <Summary label="Preventivo legacy" value={`€ ${money(repair.budget)}`} />
          <Summary label="Versioni preventivo" value={repair.quotes.length} />
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.step}>1</div>
              <div>
                <h2>Diagnosi tecnica</h2>
                <p>Le note interne restano al laboratorio. Il riepilogo cliente sarà visibile nel preventivo.</p>
              </div>
            </div>
            <span className={diagnosisFinal ? styles.finalBadge : styles.draftBadge}>{diagnosisFinal ? "Finale" : "Bozza"}</span>
          </div>

          <div className={styles.formGrid}>
            <label>
              Tecnico
              <select value={diagnosis.technicianId || ""} onChange={(event) => patchDiagnosis("technicianId", event.target.value)}>
                <option value="">Da assegnare</option>
                {data.technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
              </select>
            </label>
            <label className={styles.full}>
              Esito verifiche
              <textarea value={diagnosis.findings || ""} onChange={(event) => patchDiagnosis("findings", event.target.value)} placeholder="Cosa hai rilevato durante l'ispezione e i test" />
            </label>
            <label className={styles.full}>
              Causa probabile
              <textarea value={diagnosis.rootCause || ""} onChange={(event) => patchDiagnosis("rootCause", event.target.value)} placeholder="Origine tecnica del guasto, se identificata" />
            </label>
            <label className={styles.full}>
              Intervento proposto
              <textarea value={diagnosis.proposedWork || ""} onChange={(event) => patchDiagnosis("proposedWork", event.target.value)} placeholder="Attività necessarie per ripristinare il dispositivo" />
            </label>
            <label>
              Ricambi necessari
              <textarea value={diagnosis.partsNeeded || ""} onChange={(event) => patchDiagnosis("partsNeeded", event.target.value)} placeholder="Display OLED, batteria, connettore..." />
            </label>
            <label>
              Test eseguiti
              <textarea value={diagnosis.testsPerformed || ""} onChange={(event) => patchDiagnosis("testsPerformed", event.target.value)} placeholder="Alimentazione, ricarica, diagnostica..." />
            </label>
            <label className={styles.full}>
              Rischi e note interne
              <textarea value={diagnosis.riskNotes || ""} onChange={(event) => patchDiagnosis("riskNotes", event.target.value)} placeholder="Dati sensibili al laboratorio. Non vengono mostrati al cliente." />
            </label>
            <label className={styles.full}>
              Riepilogo per il cliente
              <textarea value={diagnosis.customerSummary || ""} onChange={(event) => patchDiagnosis("customerSummary", event.target.value)} placeholder="Spiega in modo semplice cosa non funziona e cosa proponiamo di fare" />
            </label>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => saveDiagnosis("DRAFT")}>Salva bozza diagnosi</button>
            <button type="button" className={styles.primaryButton} disabled={saving} onClick={() => saveDiagnosis("FINAL")}>Finalizza diagnosi</button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.step}>2</div>
              <div>
                <h2>Preventivo</h2>
                <p>Una versione inviata non si modifica. Per correggerla si crea una nuova versione.</p>
              </div>
            </div>
            {draftQuote ? <span className={styles.draftBadge}>Bozza v{draftQuote.version}</span> : null}
          </div>

          {!diagnosisFinal ? <div className={styles.locked}>Finalizza prima la diagnosi per attivare il preventivo.</div> : (
            <>
              <div className={styles.formGrid}>
                <label>
                  Titolo
                  <input value={quote.title} onChange={(event) => patchQuote("title", event.target.value)} />
                </label>
                <label>
                  Tempo stimato, giorni
                  <input type="number" min="1" value={quote.estimatedDays} onChange={(event) => patchQuote("estimatedDays", event.target.value)} />
                </label>
                <label>
                  Valido fino al
                  <input type="date" value={dateInputValue(quote.validUntil)} onChange={(event) => patchQuote("validUntil", event.target.value)} />
                </label>
                <label>
                  Sconto €
                  <input type="number" min="0" step="0.01" value={quote.discountAmount} onChange={(event) => patchQuote("discountAmount", event.target.value)} />
                </label>
                <label className={styles.full}>
                  Messaggio al cliente
                  <textarea value={quote.customerMessage} onChange={(event) => patchQuote("customerMessage", event.target.value)} placeholder="Informazioni utili, condizioni, disponibilità ricambio..." />
                </label>
              </div>

              <div className={styles.itemsHead}>
                <h3>Voci</h3>
                <button type="button" className={styles.smallButton} onClick={addItem}>+ Aggiungi voce</button>
              </div>

              <div className={styles.itemList}>
                {quote.items.map((item, index) => (
                  <div className={styles.itemRow} key={index}>
                    <select value={item.type} onChange={(event) => patchItem(index, "type", event.target.value)}>
                      <option value="service">Servizio</option>
                      <option value="part">Ricambio</option>
                      <option value="other">Altro</option>
                    </select>
                    <input className={styles.itemDescription} value={item.description} onChange={(event) => patchItem(index, "description", event.target.value)} placeholder="Descrizione" />
                    <input type="number" min="0.001" step="0.001" value={item.qty} onChange={(event) => patchItem(index, "qty", event.target.value)} aria-label="Quantità" />
                    <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => patchItem(index, "unitPrice", event.target.value)} aria-label="Prezzo unitario" />
                    <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => patchItem(index, "unitCost", event.target.value)} aria-label="Costo unitario interno" />
                    <strong>€ {money(Number(item.qty || 0) * Number(item.unitPrice || 0))}</strong>
                    <button type="button" className={styles.removeButton} onClick={() => removeItem(index)} aria-label="Rimuovi voce">×</button>
                  </div>
                ))}
              </div>

              <div className={styles.legend}>Quantità · Prezzo cliente · Costo interno. Il costo interno non viene mai mostrato nella pagina cliente.</div>

              <div className={styles.quoteTotals}>
                <div><span>Subtotale</span><strong>€ {money(totals.subtotal)}</strong></div>
                <div><span>Sconto</span><strong>- € {money(totals.discount)}</strong></div>
                <div className={styles.totalLine}><span>Totale cliente</span><strong>€ {money(totals.total)}</strong></div>
                <div><span>Costo stimato</span><strong>€ {money(totals.cost)}</strong></div>
                <div><span>Margine stimato</span><strong>€ {money(totals.margin)}</strong></div>
              </div>

              <label className={styles.internalNote}>
                Nota interna preventivo
                <textarea value={quote.internalNote} onChange={(event) => patchQuote("internalNote", event.target.value)} placeholder="Non visibile al cliente" />
              </label>

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} disabled={saving} onClick={saveQuote}>{quote.id ? "Aggiorna bozza" : "Salva nuova bozza"}</button>
                {quote.id ? <button type="button" className={styles.primaryButton} disabled={saving} onClick={sendQuote}>Invia al cliente</button> : null}
                {quote.id ? <button type="button" className={styles.dangerButton} disabled={saving} onClick={deleteDraft}>Elimina bozza</button> : null}
              </div>
            </>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.step}>3</div>
              <div>
                <h2>Storico preventivi</h2>
                <p>Ogni versione resta consultabile con risposta e data.</p>
              </div>
            </div>
          </div>

          <div className={styles.historyList}>
            {repair.quotes.length ? repair.quotes.map((item) => (
              <article className={styles.historyItem} key={item.id}>
                <div>
                  <div className={styles.versionLine}><strong>v{item.version}</strong><span className={styles.quoteStatus}>{QUOTE_LABELS[item.status] || item.status}</span></div>
                  <div className={styles.historyTitle}>{item.title || "Preventivo riparazione"}</div>
                  <div className={styles.historyMeta}>Totale € {money(item.total)}{item.sentAt ? ` · inviato ${shortDate(item.sentAt)}` : ""}{item.respondedAt ? ` · risposta ${shortDate(item.respondedAt)}` : ""}</div>
                  {item.customerNote ? <div className={styles.customerNote}>Nota cliente: {item.customerNote}</div> : null}
                </div>
                <div className={styles.historyActions}>
                  {item.status !== "DRAFT" && item.status !== "LEGACY" ? <a href={`/preventivo/${encodeURIComponent(item.publicToken)}`} target="_blank" rel="noreferrer">Vista cliente</a> : null}
                  {item.status !== "DRAFT" && item.status !== "LEGACY" ? <button type="button" onClick={() => copyLink(item.publicToken)}>Copia link</button> : null}
                  {item.status !== "DRAFT" ? <button type="button" disabled={saving || Boolean(draftQuote)} onClick={() => createVersion(item.id)}>Nuova versione</button> : null}
                </div>
              </article>
            )) : <div className={styles.empty}>Nessun preventivo ancora creato.</div>}
          </div>
        </section>
      </div>
    </main>
  );

  function patchDiagnosis(key, value) {
    setDiagnosis((current) => ({ ...current, [key]: value }));
  }

  function patchQuote(key, value) {
    setQuote((current) => ({ ...current, [key]: value }));
  }

  function patchItem(index, key, value) {
    setQuote((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  }

  function addItem() {
    setQuote((current) => ({ ...current, items: [...current.items, { type: "service", description: "", qty: 1, unitPrice: 0, unitCost: 0 }] }));
  }

  function removeItem(index) {
    setQuote((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function copyLink(publicToken) {
    const url = `${window.location.origin}/preventivo/${encodeURIComponent(publicToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link preventivo copiato negli appunti.");
    } catch {
      setNotice(url);
    }
  }
}

function Summary({ label, value }) {
  return <div className={styles.summary}><span>{label}</span><strong>{value}</strong></div>;
}

function quoteFromApi(value) {
  return {
    id: value.id,
    title: value.title || "Preventivo riparazione",
    customerMessage: value.customerMessage || "",
    internalNote: value.internalNote || "",
    discountAmount: Number(value.discountAmount || 0),
    estimatedDays: value.estimatedDays || "",
    validUntil: value.validUntil || "",
    items: (value.items || []).map((item) => ({
      type: item.type,
      description: item.description,
      qty: Number(item.qty || 1),
      unitPrice: Number(item.unitPrice || 0),
      unitCost: Number(item.unitCost || 0)
    }))
  };
}

function quotePayload(value) {
  return {
    title: value.title,
    customerMessage: value.customerMessage,
    internalNote: value.internalNote,
    discountAmount: Number(value.discountAmount || 0),
    estimatedDays: value.estimatedDays === "" ? null : Number(value.estimatedDays),
    validUntil: value.validUntil ? `${value.validUntil}T23:59:59` : null,
    items: value.items.map((item) => ({
      type: item.type,
      description: item.description,
      qty: Number(item.qty || 0),
      unitPrice: Number(item.unitPrice || 0),
      unitCost: Number(item.unitCost || 0)
    }))
  };
}

function quoteTotals(value) {
  const subtotal = value.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0);
  const cost = value.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitCost || 0), 0);
  const discount = Math.min(subtotal, Math.max(0, Number(value.discountAmount || 0)));
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total, cost, margin: total - cost };
}

function deviceLabel(device) {
  if (!device) return "Dispositivo";
  return [device.type, device.brand, device.model].filter(Boolean).join(" ") || "Dispositivo";
}

function money(value) {
  return Number(value || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function statusLabel(value) {
  const map = {
    "预定": "Accettato",
    "待检测": "In diagnosi",
    "等客户确认": "Attesa approvazione cliente",
    ACCETTATO: "Accettato",
    IN_DIAGNOSI: "In diagnosi",
    ATTESA_PREVENTIVO: "Attesa preventivo",
    ATTESA_APPROVAZIONE: "Attesa approvazione cliente",
    AUTORIZZATO: "Autorizzato dal cliente",
    ATTESA_RICAMBIO: "Attesa ricambio",
    IN_LAVORAZIONE: "In lavorazione",
    IN_TEST: "In test",
    PRONTO: "Pronto",
    CONSEGNATO: "Consegnato",
    ANNULLATO: "Annullato"
  };
  return map[value] || value || "Pratica";
}
