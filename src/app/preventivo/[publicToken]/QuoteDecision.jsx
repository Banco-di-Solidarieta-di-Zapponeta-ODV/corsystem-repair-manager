"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function QuoteDecision({ publicToken, initialStatus, expired }) {
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (expired || status === "EXPIRED") {
    return <div className={styles.decisionMessage}>Preventivo scaduto. Contatta CorSystem per ricevere una nuova versione.</div>;
  }
  if (status === "APPROVED") {
    return <div className={styles.approved}>Preventivo approvato. CorSystem può procedere con la riparazione.</div>;
  }
  if (status === "REJECTED") {
    return <div className={styles.rejected}>Preventivo rifiutato. CorSystem preparerà eventuali alternative o chiuderà la pratica secondo gli accordi.</div>;
  }
  if (status !== "SENT") {
    return <div className={styles.decisionMessage}>Questa versione del preventivo non è disponibile per una nuova risposta.</div>;
  }

  async function respond(response) {
    setLoading(true);
    setError("");
    try {
      const result = await fetch(`/api/quotes/${encodeURIComponent(publicToken)}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, customerNote: note })
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Impossibile registrare la risposta");
      setStatus(data.quoteStatus);
    } catch (err) {
      setError(err.message || "Errore durante la risposta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.decisionBox}>
      <h2>La tua decisione</h2>
      <p>Con l'approvazione autorizzi CorSystem a procedere secondo le voci e l'importo indicati in questo preventivo.</p>
      <label className={styles.noteLabel}>
        Nota facoltativa
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} placeholder="Es. Chiamatemi prima di ordinare un ricambio alternativo" />
      </label>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.decisionActions}>
        <button className={styles.approveButton} type="button" disabled={loading} onClick={() => respond("APPROVED")}>Approva preventivo</button>
        <button className={styles.rejectButton} type="button" disabled={loading} onClick={() => respond("REJECTED")}>Rifiuta preventivo</button>
      </div>
      <small>La risposta viene registrata con data e ora sulla pratica.</small>
    </div>
  );
}
