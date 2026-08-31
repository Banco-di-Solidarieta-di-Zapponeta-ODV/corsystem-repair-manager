"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const CHECKS = [
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

const EMPTY_CHECKLIST = Object.fromEntries(CHECKS.map(([key]) => [key, "NA"]));

export default function ClosureClient({ repairId }) {
  const [data, setData] = useState(null);
  const [testId, setTestId] = useState("");
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST);
  const [testNotes, setTestNotes] = useState("");
  const [payment, setPayment] = useState({ amount: "", method: "cash", note: "" });
  const [delivery, setDelivery] = useState({ handedTo: "", warrantyMonths: "0", settlementMode: "PAID", note: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const repair = data?.repair;
  const financial = data?.financial;
  const currentDraft = useMemo(() => repair?.finalTests?.find((item) => item.status === "DRAFT") || null, [repair]);
  const latestTest = repair?.finalTests?.[0] || null;

  useEffect(() => { load(); }, [repairId]);
  useEffect(() => {
    if (!repair) return;
    const draft = currentDraft;
    if (draft) {
      setTestId(draft.id);
      setChecklist({ ...EMPTY_CHECKLIST, ...(draft.checklist || {}) });
      setTestNotes(draft.notes || "");
    } else {
      setTestId("");
      setChecklist(EMPTY_CHECKLIST);
      setTestNotes("");
    }
    setDelivery((value) => ({ ...value, handedTo: value.handedTo || repair.client?.name || "" }));
  }, [repair, currentDraft]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/completion/${encodeURIComponent(repairId)}`, { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile caricare la pratica");
      setData(payload);
    } catch (err) {
      setError(err.message || "Errore durante il caricamento");
    } finally {
      setLoading(false);
    }
  }

  async function act(action, body = {}, message = "Operazione completata.") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/completion/${encodeURIComponent(repairId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Operazione non riuscita");
      setNotice(message);
      await load();
      return payload;
    } catch (err) {
      setError(err.message || "Operazione non riuscita");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveTest() {
    const result = await act("test-save", { testId: testId || undefined, checklist, notes: testNotes }, "Bozza test salvata.");
    if (result?.test?.id) setTestId(result.test.id);
  }

  async function completeTest() {
    let id = testId;
    if (!id) {
      const created = await act("test-save", { checklist, notes: testNotes }, "Sessione test creata.");
      id = created?.test?.id;
      if (!id) return;
      setTestId(id);
    }
    await act("test-complete", { testId: id, checklist, notes: testNotes }, "Test finale registrato.");
  }

  async function addPayment() {
    const result = await act("payment-add", payment, "Pagamento registrato.");
    if (result) setPayment({ amount: "", method: "cash", note: "" });
  }

  async function deliver() {
    const credit = Number(financial?.balance || 0) > 0.009;
    await act("deliver", {
      ...delivery,
      settlementMode: credit ? delivery.settlementMode : "PAID"
    }, "Dispositivo consegnato e pratica chiusa.");
  }

  if (loading) return <main className={styles.page}><div className={styles.loading}>Caricamento chiusura pratica...</div></main>;
  if (!data) return <main className={styles.page}><div className={styles.error}>{error || "Pratica non disponibile"}</div></main>;

  const canTest = ["IN_LAVORAZIONE", "IN_TEST"].includes(repair.status);
  const canReady = repair.status === "IN_TEST" && latestTest?.status === "PASSED";
  const canDeliver = repair.status === "PRONTO" && !repair.delivery;
  const closed = repair.status === "CONSEGNATO" || Boolean(repair.delivery);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <a className={styles.back} href={`/#/dashboard/repairs/${encodeURIComponent(repair.id)}`}>← Torna alla pratica</a>
            <div className={styles.kicker}>Collaudo e consegna</div>
            <h1>{repair.ticket}</h1>
            <p>{repair.client?.name || "Cliente"} · {deviceLabel(repair.device)}</p>
          </div>
          <span className={styles.status}>{statusLabel(repair.status)}</span>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        <section className={styles.metrics}>
          <Metric label="Totale pratica" value={`€ ${money(financial.amountDue)}`} />
          <Metric label="Incassato" value={`€ ${money(financial.amountPaid)}`} />
          <Metric label="Saldo" value={`€ ${money(financial.balance)}`} />
          <Metric label="Margine stimato" value={`€ ${money(financial.projectedMargin)}`} />
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}><div><span>1</span><div><h2>Test finale</h2><p>Segna PASS, FAIL o N/A. Un FAIL rimanda la pratica in lavorazione.</p></div></div>{latestTest ? <strong>{testLabel(latestTest.status)}</strong> : null}</div>
          <div className={styles.checks}>
            {CHECKS.map(([key, label]) => (
              <div className={styles.checkRow} key={key}>
                <span>{label}</span>
                <div className={styles.segmented}>
                  {[["PASS", "OK"], ["FAIL", "KO"], ["NA", "N/A"]].map(([value, text]) => (
                    <button key={value} type="button" disabled={!canTest || saving} className={checklist[key] === value ? styles.selected : ""} onClick={() => setChecklist((old) => ({ ...old, [key]: value }))}>{text}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <label className={styles.field}>Note test<textarea disabled={!canTest} value={testNotes} onChange={(e) => setTestNotes(e.target.value)} placeholder="Esito prove, anomalie residue, test specifici..." /></label>
          <div className={styles.actions}>
            <button className={styles.secondary} disabled={!canTest || saving} onClick={saveTest}>Salva bozza</button>
            <button className={styles.primary} disabled={!canTest || saving} onClick={completeTest}>Concludi test</button>
            <button className={styles.ready} disabled={!canReady || saving} onClick={() => act("mark-ready", {}, "Pratica pronta per il ritiro.")}>Segna PRONTO</button>
          </div>
          {repair.finalTests?.length ? <div className={styles.history}>{repair.finalTests.map((test) => <div key={test.id}><strong>{testLabel(test.status)}</strong><span>{dateTime(test.completedAt || test.createdAt)} · {test.technicianName || test.createdBy || "CorSystem"}</span></div>)}</div> : null}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}><div><span>2</span><div><h2>Pagamenti</h2><p>Acconti e saldo restano movimenti separati e tracciati.</p></div></div></div>
          {data.legacyDepositUsed ? <div className={styles.legacy}>È conteggiato l'acconto storico RepairNOTE di € {money(repair.deposit)}.</div> : null}
          <div className={styles.paymentForm}>
            <input type="number" min="0.01" step="0.01" placeholder="Importo €" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
            <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}><option value="cash">Contanti</option><option value="card">Carta / POS</option><option value="bank_transfer">Bonifico</option><option value="other">Altro</option></select>
            <input placeholder="Nota facoltativa" value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} />
            <button className={styles.primary} disabled={saving || !payment.amount} onClick={addPayment}>Registra pagamento</button>
          </div>
          <div className={styles.history}>
            {repair.payments?.length ? repair.payments.map((item) => <div key={item.id}><strong>€ {money(item.amount)} · {paymentLabel(item.method)}</strong><span>{dateTime(item.paidAt)}{item.note ? ` · ${item.note}` : ""}</span></div>) : <div><span>Nessun pagamento registrato.</span></div>}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}><div><span>3</span><div><h2>Consegna</h2><p>Chiude la pratica e congela importo, costo ricambi e margine finale.</p></div></div></div>
          {closed ? (
            <div className={styles.closed}><strong>Pratica consegnata</strong><span>{dateTime(repair.delivery?.deliveredAt || repair.deliveredAt)} · a {repair.delivery?.handedTo || "cliente"}</span><span>Margine finale: € {money(repair.finalMargin)}</span></div>
          ) : (
            <div className={styles.deliveryGrid}>
              <label className={styles.field}>Consegnato a<input value={delivery.handedTo} onChange={(e) => setDelivery({ ...delivery, handedTo: e.target.value })} /></label>
              <label className={styles.field}>Garanzia mesi<select value={delivery.warrantyMonths} onChange={(e) => setDelivery({ ...delivery, warrantyMonths: e.target.value })}><option value="0">Nessuna impostata</option><option value="3">3 mesi</option><option value="6">6 mesi</option><option value="12">12 mesi</option><option value="24">24 mesi</option></select></label>
              {Number(financial.balance) > 0.009 ? <label className={styles.field}>Saldo aperto<select value={delivery.settlementMode} onChange={(e) => setDelivery({ ...delivery, settlementMode: e.target.value })}><option value="PAID">Non consegnare finché non saldato</option><option value="CREDIT">Consegna a credito, solo amministratore</option></select></label> : null}
              <label className={`${styles.field} ${styles.full}`}>Note consegna<textarea value={delivery.note} onChange={(e) => setDelivery({ ...delivery, note: e.target.value })} placeholder="Condizioni di consegna o motivazione dell'eventuale credito" /></label>
              <div className={`${styles.actions} ${styles.full}`}><button className={styles.deliveryButton} disabled={!canDeliver || saving || !delivery.handedTo} onClick={deliver}>Consegna e chiudi pratica</button></div>
            </div>
          )}
          {!canDeliver && !closed ? <div className={styles.hint}>La consegna si attiva quando la pratica è nello stato PRONTO.</div> : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }) { return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>; }
function money(value) { return Number(value || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dateTime(value) { if (!value) return "-"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("it-IT"); }
function deviceLabel(device) { return [device?.brand, device?.model].filter(Boolean).join(" ") || device?.type || "Dispositivo"; }
function paymentLabel(value) { return { cash: "Contanti", card: "Carta / POS", bank_transfer: "Bonifico", other: "Altro" }[value] || value; }
function testLabel(value) { return { DRAFT: "Test in bozza", PASSED: "Test superato", FAILED: "Test non superato" }[value] || value; }
function statusLabel(value) { return { IN_LAVORAZIONE: "In lavorazione", IN_TEST: "In test", PRONTO: "Pronto per il ritiro", CONSEGNATO: "Consegnato", AUTORIZZATO: "Autorizzato", ATTESA_RICAMBIO: "Attesa ricambio" }[value] || value; }
