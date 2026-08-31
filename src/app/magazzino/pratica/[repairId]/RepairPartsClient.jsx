"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../../warehouse.module.css";

export default function RepairPartsClient({ repairId }) {
  const [data, setData] = useState(null);
  const [partId, setPartId] = useState("");
  const [quoteItemId, setQuoteItemId] = useState("");
  const [qtyRequested, setQtyRequested] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { load(); }, [repairId]);

  const repair = data?.repair;
  const approvedQuote = repair?.quotes?.[0];
  const quotePartItems = useMemo(() => approvedQuote?.items?.filter((item) => item.type === "part") || [], [approvedQuote]);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/inventory/repair/${encodeURIComponent(repairId)}`, { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile caricare i ricambi della pratica");
      setData(payload);
    } catch (err) {
      setError(err.message || "Errore caricamento ricambi");
    } finally { setLoading(false); }
  }

  async function act(action, payload = {}, success = "Operazione completata.") {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/inventory/repair/${encodeURIComponent(repairId)}`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Operazione non riuscita");
      setNotice(success);
      await load();
      return result;
    } catch (err) {
      setError(err.message || "Errore durante l'operazione");
      return null;
    } finally { setSaving(false); }
  }

  async function addRequest(event) {
    event.preventDefault();
    const result = await act("request", { partId, quoteItemId: quoteItemId || undefined, qtyRequested, notes }, "Ricambio aggiunto alla pratica.");
    if (result) { setPartId(""); setQuoteItemId(""); setQtyRequested(1); setNotes(""); }
  }

  function selectQuoteItem(id) {
    setQuoteItemId(id);
    const item = quotePartItems.find((row) => row.id === id);
    if (item) {
      setQtyRequested(Number(item.qty || 1));
      if (item.partId) setPartId(item.partId);
    }
  }

  if (loading) return <main className={styles.page}><div className={styles.loading}>Caricamento ricambi pratica...</div></main>;
  if (!data) return <main className={styles.page}><div className={styles.error}>{error || "Pratica non disponibile"}</div></main>;

  const workable = ["AUTORIZZATO", "ATTESA_RICAMBIO", "IN_LAVORAZIONE"].includes(repair.status);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <a href={`/lavorazione/${encodeURIComponent(repair.id)}`} className={styles.back}>← Diagnosi / Preventivo</a>
            <div className={styles.kicker}>Ricambi pratica</div>
            <h1>{repair.ticket}</h1>
            <p>{repair.client?.name || "Cliente"} · {deviceLabel(repair.device)} · Stato: <strong>{statusLabel(repair.status)}</strong></p>
          </div>
          <a href="/magazzino" className={styles.secondary}>Apri magazzino</a>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}
        {!workable ? <div className={styles.error}>La pratica deve essere approvata dal cliente prima di impegnare ricambi.</div> : null}

        <section className={styles.metrics}>
          <Metric label="Stato pratica" value={statusLabel(repair.status)} />
          <Metric label="Ricambi richiesti" value={repair.repairParts.length} />
          <Metric label="Preventivo approvato" value={approvedQuote ? `v${approvedQuote.version}` : "Nessuno"} />
          <Metric label="Costo ricambi usati" value={`€ ${money(repair.costAmount)}`} />
        </section>

        <section className={styles.card}>
          <h2>Ricambi collegati alla pratica</h2>
          <p>Prenotare impegna la disponibilità. “Utilizza” effettua lo scarico fisico dal magazzino.</p>
          <div className={styles.tableWrap} style={{ marginTop: 16 }}>
            <table>
              <thead><tr><th>Ricambio</th><th>Richiesto</th><th>Prenotato</th><th>Usato</th><th>Stato</th><th>Ordine</th><th>Azioni</th></tr></thead>
              <tbody>
                {repair.repairParts.length ? repair.repairParts.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.part?.defaultName || "Ricambio"}</strong><span>{row.part?.sku || "senza SKU"} · stock {qty(row.part?.stockQty)}</span></td>
                    <td>{qty(row.qtyRequested)}</td><td>{qty(row.qtyReserved)}</td><td>{qty(row.qtyUsed)}</td>
                    <td>{repairPartLabel(row.status)}</td>
                    <td>{row.orderReference || "-"}{row.expectedAt ? <span>Previsto {date(row.expectedAt)}</span> : null}</td>
                    <td>
                      <div className={styles.actions}>
                        {!["USED", "CANCELLED"].includes(row.status) ? <button className={styles.small} disabled={saving || !workable} onClick={() => act("reserve", { repairPartId: row.id }, "Ricambio prenotato.")}>Prenota</button> : null}
                        {["REQUESTED", "RECEIVED", "RESERVED"].includes(row.status) ? <button className={styles.small} disabled={saving || !workable} onClick={() => {
                          const ref = window.prompt("Riferimento ordine (facoltativo)", row.orderReference || "") || "";
                          act("order", { repairPartId: row.id, orderReference: ref }, "Ricambio segnato come ordinato.");
                        }}>Ordina</button> : null}
                        {row.status === "ORDERED" ? <button className={styles.small} disabled={saving || !workable} onClick={() => {
                          const cost = window.prompt("Costo unitario ricevuto", String(row.unitCostSnapshot || row.part?.cost || 0));
                          act("receive", { repairPartId: row.id, unitCost: Number(cost || 0) }, "Ricambio ricevuto e caricato a magazzino.");
                        }}>Ricevi</button> : null}
                        {["RESERVED", "RECEIVED"].includes(row.status) ? <button className={styles.primary} disabled={saving || !workable} onClick={() => act("use", { repairPartId: row.id }, "Ricambio scaricato e registrato come utilizzato.")}>Utilizza</button> : null}
                        !["USED", "CANCELLED"].includes(row.status) ? <button className={styles.secondary} disabled={saving || !workable} onClick={() => act("cancel", { repairPartId: row.id }, "Richiesta ricambio annullata.")}>Annulla</button> : null}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan="7">Nessun ricambio ancora collegato alla pratica.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className={styles.actions} style={{ marginTop: 14 }}>
            <button className={styles.primary} disabled={saving || !workable} onClick={() => act("start-repair", {}, "Pratica passata in lavorazione.")}>Avvia lavorazione</button>
          </div>
        </section>

        <div className={styles.twoCols}>
          <section className={styles.card}>
            <h2>Aggiungi ricambio</h2>
            <form className={styles.form} onSubmit={addRequest}>
              {quotePartItems.length ? <label>Voce preventivo approvato<select value={quoteItemId} onChange={(e) => selectQuoteItem(e.target.value)}><option value="">Non collegare a una voce</option>{quotePartItems.map((item) => <option key={item.id} value={item.id}>{item.description} · {qty(item.qty)} × € {money(item.unitPrice)}</option>)}</select></label> : null}
              <label>Ricambio di magazzino<select required value={partId} onChange={(e) => setPartId(e.target.value)}><option value="">Seleziona ricambio</option>{data.parts.map((part) => <option key={part.id} value={part.id}>{part.defaultName} · liberi {qty(part.availableQty)} · {part.sku || "senza SKU"}</option>)}</select></label>
              <label>Quantità<input type="number" min="0.001" step="0.001" value={qtyRequested} onChange={(e) => setQtyRequested(e.target.value)} /></label>
              <textarea placeholder="Note ricambio" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className={styles.primary} disabled={saving || !workable}>Aggiungi alla pratica</button>
            </form>
          </section>

          <section className={styles.card}>
            <h2>Ricambi nel preventivo approvato</h2>
            {approvedQuote ? <div className={styles.movements}>{quotePartItems.length ? quotePartItems.map((item) => <div className={styles.movement} key={item.id}><div><strong>{item.description}</strong><span>v{approvedQuote.version} · quantità {qty(item.qty)}</span></div><div>€ {money(item.lineTotal)}</div></div>) : <p>Il preventivo approvato non contiene voci marcate come ricambio.</p>}</div> : <p>Nessun preventivo approvato disponibile.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }) { return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>; }
function deviceLabel(device) { return [device?.type, device?.brand, device?.model].filter(Boolean).join(" ") || "Dispositivo"; }
function statusLabel(value) { return ({ AUTORIZZATO: "Autorizzato", ATTESA_RICAMBIO: "Attesa ricambio", IN_LAVORAZIONE: "In lavorazione", ATTESA_APPROVAZIONE: "Attesa approvazione" })[value] || String(value || "-").replaceAll("_", " "); }
function repairPartLabel(value) { return ({ REQUESTED: "Richiesto", ORDERED: "Ordinato", RESERVED: "Prenotato", RECEIVED: "Ricevuto", USED: "Utilizzato", CANCELLED: "Annullato" })[value] || value; }
function money(value) { return Number(value || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function qty(value) { return Number(value || 0).toLocaleString("it-IT", { maximumFractionDigits: 3 }); }
function date(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("it-IT"); }
